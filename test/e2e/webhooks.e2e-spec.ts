import * as request from 'supertest';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WebhooksController } from '../../src/modules/webhooks/webhooks.controller';
import { WebhooksService } from '../../src/modules/webhooks/webhooks.service';
import { WebhookDeliveryStatus } from '../../src/modules/webhooks/entities/webhook-delivery.entity';
import { CryptoUtil } from '../../src/common/utils/crypto.util';
import { createTestingApp } from '../test-helper';

describe('Webhooks API (e2e)', () => {
  let app: INestApplication;

  const mockWebhooksService = {
    getDeliveries: jest.fn(),
    retryWebhook: jest.fn(),
  };

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhooksService,
          useValue: mockWebhooksService,
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

  describe('GET /v1/webhooks/deliveries', () => {
    it('should return 200 with delivery logs and DLQ items', async () => {
      const deliveries = [
        { id: 'del-1', eventType: 'order.created', status: WebhookDeliveryStatus.SUCCESS },
        { id: 'del-2', eventType: 'order.assigned', status: WebhookDeliveryStatus.FAILED },
      ];
      mockWebhooksService.getDeliveries.mockResolvedValue(deliveries);

      const res = await request(app.getHttpServer())
        .get('/v1/webhooks/deliveries')
        .query({ tenantId: 'tenant-1', status: WebhookDeliveryStatus.FAILED })
        .expect(200);

      expect(res.body).toEqual(deliveries);
      expect(mockWebhooksService.getDeliveries).toHaveBeenCalledWith('tenant-1', WebhookDeliveryStatus.FAILED);
    });
  });

  describe('POST /v1/webhooks/deliveries/:id/retry', () => {
    it('should re-enqueue failed webhook and return 200', async () => {
      const retryResult = {
        exito: true,
        mensaje: 'Webhook reencolado exitosamente para entrega.',
        deliveryId: 'del-1',
      };
      mockWebhooksService.retryWebhook.mockResolvedValue(retryResult);

      const res = await request(app.getHttpServer())
        .post('/v1/webhooks/deliveries/del-1/retry')
        .expect(200);

      expect(res.body).toEqual(retryResult);
    });

    it('should return 404 if webhook delivery not found', async () => {
      mockWebhooksService.retryWebhook.mockRejectedValue(
        new NotFoundException('Registro de entrega de webhook no encontrado.'),
      );

      const res = await request(app.getHttpServer())
        .post('/v1/webhooks/deliveries/del-unknown/retry')
        .expect(404);

      expect(res.body.statusCode).toBe(404);
      expect(res.body.exito).toBe(false);
    });
  });

  describe('POST /v1/webhooks/simulate-verify', () => {
    it('should verify correct HMAC SHA-256 signature and return isValid: true', async () => {
      const payload = { event: 'order.delivered', data: { orderId: 'ord_123' } };
      const secret = 'whsec_test_secret_998877';
      const signature = CryptoUtil.signWebhookPayload(payload, secret);

      const res = await request(app.getHttpServer())
        .post('/v1/webhooks/simulate-verify')
        .send({ payload, secret, signature })
        .expect(200);

      expect(res.body).toEqual({
        isValid: true,
        computedSignature: signature,
        providedSignature: signature,
      });
    });

    it('should return isValid: false for tampered signature', async () => {
      const payload = { event: 'order.delivered', data: { orderId: 'ord_123' } };
      const secret = 'whsec_test_secret_998877';

      const res = await request(app.getHttpServer())
        .post('/v1/webhooks/simulate-verify')
        .send({ payload, secret, signature: 'wrong_tampered_signature' })
        .expect(200);

      expect(res.body.isValid).toBe(false);
    });
  });
});
