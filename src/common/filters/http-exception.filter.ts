import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let mensaje = 'Error interno en el servidor';
    let detalles: any = null;

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        mensaje = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, any>;
        mensaje = obj.message || obj.error || 'Error en la solicitud';
        detalles = Array.isArray(obj.message) ? obj.message : obj;
      }
    } else if (exception instanceof Error) {
      mensaje = exception.message || 'Error interno no controlado';
    }

    this.logger.error(
      `[${request.method}] ${request.url} - Status: ${status} - Error: ${JSON.stringify(mensaje)}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json({
      statusCode: status,
      exito: false,
      mensaje: Array.isArray(mensaje) ? mensaje.join(', ') : mensaje,
      detalles: detalles && Array.isArray(detalles) ? detalles : undefined,
      ruta: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
