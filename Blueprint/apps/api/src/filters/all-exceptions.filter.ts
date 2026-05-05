import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";

/**
 * Catches every unhandled exception in the NestJS pipeline.
 * Returns a structured JSON error body so the client always gets parseable JSON,
 * and logs the full stack trace to aid debugging.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request  = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : exception instanceof Error
          ? exception.message
          : "Internal server error";

    // Avoid spamming ERROR logs for expected client-side conditions (expired sessions, not found, etc).
    const logLine = `Unhandled exception [${status}] ${request.method} ${request.url}: ${message}`;
    const stack = exception instanceof Error ? exception.stack : undefined;
    if (status >= 500) this.logger.error(logLine, stack);
    else if (status >= 400) this.logger.warn(logLine);
    else this.logger.log(logLine);

    response.status(status).json({
      statusCode: status,
      error: true,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
