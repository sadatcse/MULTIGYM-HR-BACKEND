import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NextFunction, Request, Response } from 'express';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  TransactionLog,
  TransactionLogDocument,
} from '../../modules/transaction-log/schemas/transaction-log.schema';

@Injectable()
export class TransactionLoggerMiddleware implements NestMiddleware {
  constructor(
    @InjectModel(TransactionLog.name)
    private readonly transactionLogModel: Model<TransactionLogDocument>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.method === 'GET') {
        return next();
      }

      const clientIP =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket?.remoteAddress ||
        'Unknown IP';

      const transactionCode = uuidv4();

      // Initial log data (assuming success)
      const logData: Record<string, any> = {
        transactionType: req.method,
        transactionCode,
        userEmail: req.headers['x-user-email'] || 'Unknown User',
        userName: req.headers['x-user-name'] || 'Unknown User',
        branch: req.headers['x-user-branch'] || 'Unknown Branch',
        ipAddress: req.headers['x-user-ip'] || clientIP,
        status: 'success',
        amount: req.body?.amount || 0,
        details: `Request to ${req.originalUrl} - Method: ${req.method}`,
        Message: 'Transaction successfully processed',
        transactionTime: new Date(),
      };

      // Proceed with the request processing
      const originalSend = res.send.bind(res);
      res.send = ((body?: any) => {
        return (async () => {
          try {
            // Let controllers (e.g. login/logout) fill in identity details the middleware
            // couldn't know up front, without writing a second log entry
            if (res.locals.transactionMeta) {
              Object.assign(logData, res.locals.transactionMeta);
            }

            if (res.statusCode >= 400) {
              logData.status = 'failed'; // Mark as failed if response status is an error
              logData.details += ` - Error Status: ${res.statusCode}`;
              logData.transactionCode = res.statusCode.toString(); // Assign error code as transactionCode
              logData.Message = typeof body === 'string' ? body : JSON.stringify(body);
            }

            await this.transactionLogModel.create(logData);
          } catch (error) {
            console.error('Error logging transaction:', error);
          }
          return originalSend(body);
        })();
      }) as unknown as Response['send'];

      next();
    } catch (error) {
      console.error('Error logging transaction:', error);

      const errorLogData = {
        transactionType: req.method,
        transactionCode: '500', // Default error code for server failure
        userEmail: req.headers['x-user-email'] || 'Unknown User',
        userName: req.headers['x-user-name'] || 'Unknown User',
        branch: req.headers['x-user-branch'] || 'Unknown Branch',
        ipAddress: req.headers['x-user-ip'] || 'Unknown IP',
        status: 'failed',
        amount: req.body?.amount || 0,
        details: `Error processing request to ${req.originalUrl}`,
        Message: (error as Error).message,
        stackTrace: (error as Error).stack,
        transactionTime: new Date(),
      };

      await this.transactionLogModel.create(errorLogData);
      next();
    }
  }
}
