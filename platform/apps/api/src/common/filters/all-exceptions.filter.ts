import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const requestId = request.headers['x-request-id'] || undefined;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    // Handle HTTP exceptions
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const responseObj = response as Record<string, unknown>;
        message = (responseObj.message as string) || message;
        error = (responseObj.error as string) || exception.name;
      }
    }
    // Handle Prisma known errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': // Unique constraint violation
          statusCode = HttpStatus.CONFLICT;
          message = 'A record with this value already exists';
          error = 'Conflict';
          break;
        case 'P2025': // Record not found
          statusCode = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          error = 'Not Found';
          break;
        case 'P2003': // Foreign key constraint failed
          statusCode = HttpStatus.BAD_REQUEST;
          message = 'Referenced record does not exist';
          error = 'Bad Request';
          break;
        default:
          statusCode = HttpStatus.BAD_REQUEST;
          message = 'Database operation failed';
          error = 'Bad Request';
      }

      this.logger.warn(
        `Prisma error ${exception.code}: ${exception.message}`,
        { requestId, path: request.url }
      );
    }
    // Handle Prisma validation errors
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
      error = 'Bad Request';

      this.logger.warn(
        `Prisma validation error: ${exception.message}`,
        { requestId, path: request.url }
      );
    }
    // Handle other errors
    else if (exception instanceof Error) {
      message = exception.message || message;

      // Log the full error for debugging
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        { requestId, path: request.url }
      );
    } else {
      this.logger.error(
        'Unknown exception type',
        JSON.stringify(exception),
        { requestId, path: request.url }
      );
    }

    const responseBody: ErrorResponse = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(request),
      ...(requestId && { requestId }),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, statusCode);
  }
}
