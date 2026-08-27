import * as request from 'supertest';
import { INestApplication, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DispatchController } from '../../src/modules/dispatch/dispatch.controller';
import { DispatchService } from '../../src/modules/dispatch/dispatch.service';
import { createTestingApp } from '../test-helper';

describe('Dispatch API (e2e)', () => {
  let app: INestApplication;

  const mockDispatchService = {
    matchAndDispatch: jest.fn(),
    acceptOffer: jest.fn(),
    manualAssign: jest.fn(),
  };

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [DispatchController],
      providers: [
        {
          provide: DispatchService,
          useValue: mockDispatchService,
        },
      ],
    });

    const testApp = await createTestingApp(moduleBuilder);
    app = testApp.app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/dispatch/orders/:id/match', () => {
    it('should trigger matchmaking and return 200 with candidates count', async () => {
      const matchResult = { matched: true, candidatesCount: 4 };
      mockDispatchService.matchAndDispatch.mockResolvedValue(matchResult);

      const res = await request(app.getHttpServer())
        .post('/v1/dispatch/orders/ord_123/match')
        .expect(200);

      expect(res.body).toEqual(matchResult);
    });

    it('should return 404 when order is not found', async () => {
      mockDispatchService.matchAndDispatch.mockRejectedValue(
        new NotFoundException('La orden #ord_unknown no fue encontrada.'),
      );

      const res = await request(app.getHttpServer())
        .post('/v1/dispatch/orders/ord_unknown/match')
        .expect(404);

      expect(res.body.statusCode).toBe(404);
      expect(res.body.exito).toBe(false);
    });
  });

  describe('POST /v1/dispatch/accept', () => {
    const validDto = {
      orderId: 'ord_123',
      driverId: 'c8716b1e-6240-4b2a-8c01-7faef83151cf',
    };

    it('should accept offer atomically and return 200', async () => {
      const acceptedResponse = {
        success: true,
        exito: true,
        mensaje: 'Pedido asignado y aceptado con éxito.',
        order: { id: validDto.orderId, status: 'ASSIGNED' },
        driver: { id: validDto.driverId, fullName: 'Alex' },
      };
      mockDispatchService.acceptOffer.mockResolvedValue(acceptedResponse);

      const res = await request(app.getHttpServer())
        .post('/v1/dispatch/accept')
        .send(validDto)
        .expect(200);

      expect(res.body).toEqual(acceptedResponse);
    });

    it('should return 409 Conflict when order was already taken by another driver', async () => {
      mockDispatchService.acceptOffer.mockRejectedValue(
        new ConflictException('El pedido no puede ser aceptado. Estado actual: ASSIGNED'),
      );

      const res = await request(app.getHttpServer())
        .post('/v1/dispatch/accept')
        .send(validDto)
        .expect(409);

      expect(res.body.statusCode).toBe(409);
      expect(res.body.exito).toBe(false);
    });

    it('should return 400 when driverId is not a valid UUID', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/dispatch/accept')
        .send({ orderId: 'ord_123', driverId: 'not-a-uuid' })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.exito).toBe(false);
    });
  });

  describe('POST /v1/dispatch/manual-assign', () => {
    const validDto = {
      orderId: 'ord_123',
      driverId: 'c8716b1e-6240-4b2a-8c01-7faef83151cf',
    };

    it('should assign order manually and return 200', async () => {
      const expected = { id: validDto.orderId, status: 'ASSIGNED', driverId: validDto.driverId };
      mockDispatchService.manualAssign.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .post('/v1/dispatch/manual-assign')
        .send(validDto)
        .expect(200);

      expect(res.body).toEqual(expected);
    });

    it('should return 404 if order or driver not found', async () => {
      mockDispatchService.manualAssign.mockRejectedValue(new NotFoundException('Conductor no encontrado'));

      const res = await request(app.getHttpServer())
        .post('/v1/dispatch/manual-assign')
        .send(validDto)
        .expect(404);

      expect(res.body.statusCode).toBe(404);
      expect(res.body.exito).toBe(false);
    });
  });
});
