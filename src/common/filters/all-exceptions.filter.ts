import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

type MongoDuplicateKeyError = Error & {
  code?: number;
  keyValue?: Record<string, unknown>;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message } = this.formatException(exception);

    response.status(statusCode).json({
      statusCode,
      message,
      error: this.getErrorLabel(statusCode),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private formatException(exception: unknown): {
    statusCode: number;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const message = exceptionResponse.message as string | string[];

        return {
          statusCode,
          message:
            statusCode === 404 &&
            typeof message === 'string' &&
            message.startsWith('Cannot ')
              ? `Route ${requestMethodFromMessage(message)} ${requestPathFromMessage(message)} not found`
              : message,
        };
      }

      return {
        statusCode,
        message: exception.message,
      };
    }

    if (exception instanceof MongooseError.ValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: Object.values(exception.errors).map((error) => error.message),
      };
    }

    if (exception instanceof MongooseError.CastError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Invalid value for "${exception.path}"`,
      };
    }

    if (this.isDuplicateKeyError(exception)) {
      const duplicateFields = Object.keys(exception.keyValue ?? {});

      return {
        statusCode: HttpStatus.CONFLICT,
        message:
          duplicateFields.length > 0
            ? `Duplicate value for field: ${duplicateFields.join(', ')}`
            : 'Duplicate value violates a unique constraint',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private getErrorLabel(statusCode: number): string {
    return HttpStatus[statusCode] ?? 'Error';
  }

  private isDuplicateKeyError(
    exception: unknown,
  ): exception is MongoDuplicateKeyError {
    return (
      exception instanceof Error &&
      'code' in exception &&
      (exception as MongoDuplicateKeyError).code === 11000
    );
  }
}

function requestMethodFromMessage(message: string): string {
  return message.split(' ')[1] ?? 'UNKNOWN';
}

function requestPathFromMessage(message: string): string {
  return message.split(' ')[2] ?? 'unknown';
}
