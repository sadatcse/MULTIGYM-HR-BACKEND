import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const err = exception as Error;
    console.error(err);
    // Never forward raw internal error text (driver/Mongo/stack details) to
    // the client — log it server-side above, return a generic message.
    response.status(500).json({ statusCode: 500, message: 'Internal server error', error: 'Internal server error' });
  }
}
