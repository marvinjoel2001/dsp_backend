import * as request from 'supertest';
import { INestApplication, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrdersController } from '../../src/modules/orders/orders.controller';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { OrderStatus } from '../../src/modules/orders/entities/order.entity';
import { ApiKeyGuard } from '../../src/common/guards/api-key.guard';
import { DataSource } from 'typeorm';
import { createTestingApp } from '../test-helper';

describe('Orders API (e2e)', () => {
  let app: INestApplication;

  const mockOrdersService = {
    createOrder: jest.fn(),
    getAllOrders: jest.fn(),
    getOrderById: jest.fn(),
    updateOrderStatus: jest.fn(),
    getPublicTracking: jest.fn(),
  };

  const mockApiKeyGuard = {
    canActivate: jest.fn().mockImplementation((context) => {
      const req = context.switchToHttp().getRequest();
      const apiKey = req.headers['x-api-key'];
      if (!apiKey || apiKey !== 'dsp_live_test_key') {
        throw new UnauthorizedException('Missing or invalid X-API-Key header');
      }
      req.tenant = { id: 'tenant-100', name: 'Super Tienda', isActive: true };
      return true;
    }),
  };

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: DataSource,
          useValue: { getRepository: jest.fn() },
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue(mockApiKeyGuard);

    const testApp = await createTestingApp(moduleBuilder);
    app = testApp.app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/orders', () => {
    it('should return 401 when x-api-key header is absent', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .send({ quoteId: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' })
        .expect(401);

      expect(res.body.statusCode).toBe(401);
      expect(res.body.exito).toBe(false);
    });

    it('should create order and return 201 with trackingToken', async () => {
      const payload = { quoteId: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' };
      const expected = {
        id: 'ord_abcdef12',
        tenantId: 'tenant-100',
        status: OrderStatus.CREATED,
        trackingToken: 'track-token-xyz',
        price: 15.0,
        driverPayout: 12.0,
      };
      mockOrdersService.createOrder.mockResolvedValue(expected);

      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('x-api-key', 'dsp_live_test_key')
        .send(payload)
        .expect(201);

      expect(res.body).toEqual(expected);
      expect(mockOrdersService.createOrder).toHaveBeenCalledWith('tenant-100', payload);
    });

    it('should return cached response when same idempotency-key is provided', async () => {
      const idempotencyKey = `idem-${Date.now()}-${Math.random()}`;
      const payload = { quoteId: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' };
      const expected = {
        id: 'ord_idempotent_1',
        tenantId: 'tenant-100',
        status: OrderStatus.CREATED,
      };
      mockOrdersService.createOrder.mockResolvedValue(expected);

      // First call
      const res1 = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('x-api-key', 'dsp_live_test_key')
        .set('idempotency-key', idempotencyKey)
        .send(payload)
        .expect(201);

      expect(res1.body).toEqual(expected);
      expect(mockOrdersService.createOrder).toHaveBeenCalledTimes(1);

      // Second call with same idempotency-key
      const res2 = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('x-api-key', 'dsp_live_test_key')
        .set('idempotency-key', idempotencyKey)
        .send(payload)
        .expect(201);

      expect(res2.body).toEqual(expected);
      // Service should NOT have been invoked again
      expect(mockOrdersService.createOrder).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when neither quoteId nor coordinates are supplied', async () => {
      mockOrdersService.createOrder.mockRejectedValue(
        new BadRequestException('Se requiere quoteId previo o las coordenadas completas.'),
      );

      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('x-api-key', 'dsp_live_test_key')
        .send({})
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.exito).toBe(false);
      expect(res.body.mensaje).toContain('Se requiere quoteId');
    });
  });

  describe('GET /v1/orders', () => {
    it('should return 200 with list of orders', async () => {
      const list = [{ id: 'ord_1', status: OrderStatus.CREATED }];
      mockOrdersService.getAllOrders.mockResolvedValue(list);

      const res = await request(app.getHttpServer())
        .get('/v1/orders')
        .query({ status: OrderStatus.CREATED, tenantId: 'tenant-100' })
        .expect(200);

      expect(res.body).toEqual(list);
      expect(mockOrdersService.getAllOrders).toHaveBeenCalledWith(OrderStatus.CREATED, 'tenant-100');
    });
  });

  describe('GET /v1/orders/:id', () => {
    it('should return 200 with order and audit logs', async () => {
      const order = { id: 'ord_1', status: OrderStatus.ASSIGNED, logs: [] };
      mockOrdersService.getOrderById.mockResolvedValue(order);

      const res = await request(app.getHttpServer())
        .get('/v1/orders/ord_1')
        .expect(200);

      expect(res.body).toEqual(order);
    });

    it('should return 404 when order does not exist', async () => {
      mockOrdersService.getOrderById.mockRejectedValue(new NotFoundException('Orden no encontrada'));

      const res = await request(app.getHttpServer())
        .get('/v1/orders/ord_unknown')
        .expect(404);

      expect(res.body.statusCode).toBe(404);
      expect(res.body.exito).toBe(false);
    });
  });

  describe('PATCH /v1/orders/:id/status', () => {
    it('should transition status and return 200', async () => {
      const dto = { status: OrderStatus.IN_TRANSIT };
      const updated = { id: 'ord_1', status: OrderStatus.IN_TRANSIT };
      mockOrdersService.updateOrderStatus.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/v1/orders/ord_1/status')
        .send(dto)
        .expect(200);

      expect(res.body).toEqual(updated);
    });

    it('should return 400 when status is not a valid enum value', async () => {
      const res = await request(app.getHttpServer())
        .patch('/v1/orders/ord_1/status')
        .send({ status: 'INVALID_STATUS' })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.exito).toBe(false);
    });
  });

  describe('GET /v1/orders/track/:token', () => {
    it('should return public tracking data without authorization header', async () => {
      const trackingData = {
        orderId: 'ord_1',
        status: OrderStatus.IN_TRANSIT,
        pickupAddress: 'Av. A',
        dropoffAddress: 'Calle B',
        driver: { fullName: 'Alex', currentLat: -17.78, currentLng: -63.18 },
      };
      mockOrdersService.getPublicTracking.mockResolvedValue(trackingData);

      const res = await request(app.getHttpServer())
        .get('/v1/orders/track/track-token-123')
        .expect(200);

      expect(res.body).toEqual(trackingData);
    });

    it('should return 404 for non-existing tracking token', async () => {
      mockOrdersService.getPublicTracking.mockRejectedValue(
        new NotFoundException('Información de seguimiento no encontrada'),
      );

      const res = await request(app.getHttpServer())
        .get('/v1/orders/track/invalid-token')
        .expect(404);

      expect(res.body.statusCode).toBe(404);
      expect(res.body.exito).toBe(false);
    });
  });
});
