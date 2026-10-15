import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    if (response.headersSent) return;

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const err = exception as any;
    // Known Mongo/Mongoose errors are client mistakes, not server faults.
    if (['CastError', 'BSONError', 'BSONTypeError'].includes(err?.name)) {
      response.status(400).json({ statusCode: 400, message: 'Invalid ID or value format', error: 'Bad Request' });
      return;
    }
    if (err?.name === 'ValidationError' && err?.errors) {
      const message = Object.values(err.errors).map((e: any) => e?.message).filter(Boolean);
      response.status(400).json({ statusCode: 400, message, error: 'Bad Request' });
      return;
    }
    if (err?.code === 11000) {
      const field = Object.keys(err.keyValue || err.keyPattern || {})[0];
      response.status(409).json({ statusCode: 409, message: field ? `A record with this ${field} already exists` : 'Duplicate record', error: 'Conflict' });
      return;
    }

    console.error(err);
    // Never forward raw internal error text (driver/Mongo/stack details) to
    // the client — log it server-side above, return a generic message.
    response.status(500).json({ statusCode: 500, message: 'Internal server error', error: 'Internal server error' });
  }
}
