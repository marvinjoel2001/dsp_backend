import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from '../webhooks.controller';
import { WebhooksService } from '../webhooks.service';
import { WebhookDeliveryStatus } from '../entities/webhook-delivery.entity';
import { NotFoundException } from '@nestjs/common';
import { CryptoUtil } from '../../../common/utils/crypto.util';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: WebhooksService;

  const mockWebhooksService = {
    getDeliveries: jest.fn(),
    retryWebhook: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhooksService,
          useValue: mockWebhooksService,
        },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    service = module.get<WebhooksService>(WebhooksService);
    jest.clearAllMocks();
  });

  describe('getDeliveries', () => {
    it('should return list of webhook deliveries', async () => {
      const expected = [{ id: 'del-1', status: WebhookDeliveryStatus.SUCCESS }];
      mockWebhooksService.getDeliveries.mockResolvedValue(expected);

      const result = await controller.getDeliveries('tenant-1', WebhookDeliveryStatus.SUCCESS);
      expect(result).toEqual(expected);
      expect(service.getDeliveries).toHaveBeenCalledWith('tenant-1', WebhookDeliveryStatus.SUCCESS);
    });
  });

  describe('retryWebhook', () => {
    it('should retry a webhook successfully', async () => {
      const expected = { exito: true, mensaje: 'Reencolado exitosamente' };
      mockWebhooksService.retryWebhook.mockResolvedValue(expected);

      const result = await controller.retryWebhook('del-1');
      expect(result).toEqual(expected);
      expect(service.retryWebhook).toHaveBeenCalledWith('del-1');
    });

    it('should throw NotFoundException if delivery not found', async () => {
      mockWebhooksService.retryWebhook.mockRejectedValue(new NotFoundException('No encontrado'));
      await expect(controller.retryWebhook('del-unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('simulateVerify', () => {
    it('should verify signature and compute signature correctly', async () => {
      const payload = { event: 'order.created', data: { id: 'ord_1' } };
      const secret = 'whsec_test_secret_12345';
      const signature = CryptoUtil.signWebhookPayload(payload, secret);

      const result = await controller.simulateVerify({ payload, secret, signature });
      expect(result.isValid).toBe(true);
      expect(result.computedSignature).toBe(signature);
      expect(result.providedSignature).toBe(signature);
    });

    it('should return isValid: false for incorrect signature', async () => {
      const payload = { event: 'order.created' };
      const secret = 'whsec_secret';

      const result = await controller.simulateVerify({ payload, secret, signature: 'wrong_signature' });
      expect(result.isValid).toBe(false);
    });
  });
});
