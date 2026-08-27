import * as request from 'supertest';
import { INestApplication, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QuotesController } from '../../src/modules/quotes/quotes.controller';
import { QuotesService } from '../../src/modules/quotes/quotes.service';
import { ApiKeyGuard } from '../../src/common/guards/api-key.guard';
import { DataSource } from 'typeorm';
import { createTestingApp } from '../test-helper';

describe('Quotes API (e2e)', () => {
  let app: INestApplication;

  const mockQuotesService = {
    calculateAndCreateQuote: jest.fn(),
    getQuoteById: jest.fn(),
  };

  const mockApiKeyGuard = {
    canActivate: jest.fn().mockImplementation((context) => {
      const req = context.switchToHttp().getRequest();
      const apiKey = req.headers['x-api-key'];
      if (!apiKey || apiKey !== 'dsp_live_valid_test_key') {
        throw new UnauthorizedException('Missing or invalid X-API-Key header');
      }
      req.tenant = { id: 'tenant-100', name: 'Test Tenant', isActive: true };
      return true;
    }),
  };

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [QuotesController],
      providers: [
        {
          provide: QuotesService,
          useValue: mockQuotesService,
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

  describe('POST /v1/quotes', () => {
    const validPayload = {
      pickupAddress: 'Av. San Martin #123',
      pickupLat: -17.7833,
      pickupLng: -63.1821,
      dropoffAddress: 'Calle Los Pinos #450',
      dropoffLat: -17.795,
      dropoffLng: -63.17,
      surgeMultiplier: 1.2,
    };

    it('should return 401 when x-api-key header is absent or invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/quotes')
        .send(validPayload)
        .expect(401);

      expect(res.body).toMatchObject({
        statusCode: 401,
        exito: false,
        mensaje: 'Missing or invalid X-API-Key header',
      });
    });

    it('should return 201 and calculated quote with valid API key', async () => {
      const expectedQuote = {
        id: 'quote-uuid-123',
        tenantId: 'tenant-100',
        ...validPayload,
        distanceKm: 2.1,
        durationMinutes: 10,
        totalPrice: 12.5,
        driverPayout: 10.0,
        currency: 'USD',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
      mockQuotesService.calculateAndCreateQuote.mockResolvedValue(expectedQuote);

      const res = await request(app.getHttpServer())
        .post('/v1/quotes')
        .set('x-api-key', 'dsp_live_valid_test_key')
        .send(validPayload)
        .expect(201);

      expect(res.body).toEqual(expectedQuote);
      expect(mockQuotesService.calculateAndCreateQuote).toHaveBeenCalledWith('tenant-100', validPayload);
    });

    it('should return 400 when distance exceeds 50 km', async () => {
      mockQuotesService.calculateAndCreateQuote.mockRejectedValue(
        new BadRequestException('La distancia calculada supera el radio máximo permitido de entrega (50 km)'),
      );

      const res = await request(app.getHttpServer())
        .post('/v1/quotes')
        .set('x-api-key', 'dsp_live_valid_test_key')
        .send(validPayload)
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        exito: false,
        mensaje: 'La distancia calculada supera el radio máximo permitido de entrega (50 km)',
      });
    });

    it('should return 400 when coordinates validation fails', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/quotes')
        .set('x-api-key', 'dsp_live_valid_test_key')
        .send({
          pickupAddress: 'Av A',
          pickupLat: 150, // invalid latitude > 90
          pickupLng: -63.18,
          dropoffAddress: 'Calle B',
          dropoffLat: -17.79,
          dropoffLng: -63.17,
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.exito).toBe(false);
      expect(res.body.detalles).toBeDefined();
    });
  });

  describe('GET /v1/quotes/:id', () => {
    it('should return 200 with quote details when valid API key and quote exists', async () => {
      const quote = { id: 'quote-uuid-123', totalPrice: 15.0 };
      mockQuotesService.getQuoteById.mockResolvedValue(quote);

      const res = await request(app.getHttpServer())
        .get('/v1/quotes/quote-uuid-123')
        .set('x-api-key', 'dsp_live_valid_test_key')
        .expect(200);

      expect(res.body).toEqual(quote);
    });

    it('should return 404 when quote does not exist', async () => {
      mockQuotesService.getQuoteById.mockRejectedValue(new NotFoundException('Cotización no encontrada'));

      const res = await request(app.getHttpServer())
        .get('/v1/quotes/quote-unknown')
        .set('x-api-key', 'dsp_live_valid_test_key')
        .expect(404);

      expect(res.body.statusCode).toBe(404);
      expect(res.body.exito).toBe(false);
    });
  });
});
