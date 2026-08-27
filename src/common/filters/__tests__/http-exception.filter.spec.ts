import { HttpExceptionFilter } from '../http-exception.filter';
import { HttpException, HttpStatus, BadRequestException, NotFoundException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockGetResponse: jest.Mock;
  let mockGetRequest: jest.Mock;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockImplementation(() => ({ json: mockJson }));
    mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
    mockGetRequest = jest.fn().mockReturnValue({ method: 'POST', url: '/v1/orders' });

    mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      }),
    } as any;
  });

  it('should format standard HttpException properly', () => {
    const exception = new NotFoundException('Orden no encontrada');

    filter.catch(exception, mockArgumentsHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        exito: false,
        mensaje: 'Orden no encontrada',
        ruta: '/v1/orders',
      }),
    );
  });

  it('should format ValidationPipe BadRequestException with array of messages', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      message: ['email must be an email', 'password is too short'],
      error: 'Bad Request',
    });

    filter.catch(exception, mockArgumentsHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        exito: false,
        mensaje: 'email must be an email, password is too short',
        detalles: ['email must be an email', 'password is too short'],
        ruta: '/v1/orders',
      }),
    );
  });

  it('should handle unhandled Error with 500 status code', () => {
    const exception = new Error('Database connection failed');

    filter.catch(exception, mockArgumentsHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        exito: false,
        mensaje: 'Database connection failed',
        ruta: '/v1/orders',
      }),
    );
  });
});
