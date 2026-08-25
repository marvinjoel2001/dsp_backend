import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookDelivery, WebhookDeliveryStatus } from './entities/webhook-delivery.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { CryptoUtil } from '../../common/utils/crypto.util';

export interface WebhookPayloadData {
  order_id: string;
  merchant_reference?: string;
  status: string;
  driver?: {
    id?: string;
    name?: string;
    phone?: string;
    vehicle_type?: string;
    vehicle_plate?: string;
  };
  pickup_address?: string;
  dropoff_address?: string;
  tracking_url?: string;
  proof_photo_url?: string;
  metadata?: any;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectQueue('webhooks-queue')
    private readonly webhooksQueue: Queue,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async enqueueWebhookEvent(
    tenantId: string,
    orderId: string,
    eventType: string,
    data: WebhookPayloadData,
  ): Promise<WebhookDelivery | null> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant || !tenant.webhookUrl) {
      this.logger.debug(`No hay URL de webhook configurada para el comercio ${tenantId}, omitiendo envío.`);
      return null;
    }

    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    const signature = CryptoUtil.signWebhookPayload(payload, tenant.webhookSecret);

    const delivery = this.deliveryRepo.create({
      tenantId: tenant.id,
      orderId,
      eventType,
      payload,
      signature,
      status: WebhookDeliveryStatus.PENDING,
      attempts: 0,
    });

    const savedDelivery = await this.deliveryRepo.save(delivery);

    // Encolar en BullMQ con política de reintentos exponenciales
    await this.webhooksQueue.add(
      'send-webhook',
      {
        deliveryId: savedDelivery.id,
        webhookUrl: tenant.webhookUrl,
        payload,
        signature,
      },
      {
        attempts: 4,
        backoff: {
          type: 'exponential',
          delay: 60 * 1000, // 1 minuto base
        },
        removeOnComplete: true,
      },
    );

    this.logger.log(`Webhook ${eventType} encolado para orden ${orderId} -> ${tenant.webhookUrl}`);
    return savedDelivery;
  }

  async getDeliveries(tenantId?: string, status?: WebhookDeliveryStatus) {
    const query = this.deliveryRepo.createQueryBuilder('delivery').orderBy('delivery.createdAt', 'DESC').take(100);
    if (tenantId) {
      query.andWhere('delivery.tenantId = :tenantId', { tenantId });
    }
    if (status) {
      query.andWhere('delivery.status = :status', { status });
    }
    return query.getMany();
  }

  async retryWebhook(deliveryId: string) {
    const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
    if (!delivery) {
      throw new NotFoundException('Registro de entrega de webhook no encontrado.');
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: delivery.tenantId } });
    if (!tenant || !tenant.webhookUrl) {
      throw new NotFoundException('El comercio no tiene una URL de webhook configurada.');
    }

    delivery.status = WebhookDeliveryStatus.PENDING;
    delivery.attempts = 0;
    delivery.errorMessage = null;
    await this.deliveryRepo.save(delivery);

    await this.webhooksQueue.add(
      'send-webhook',
      {
        deliveryId: delivery.id,
        webhookUrl: tenant.webhookUrl,
        payload: delivery.payload,
        signature: delivery.signature,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
      },
    );

    return {
      exito: true,
      mensaje: 'Webhook reencolado exitosamente para entrega.',
      deliveryId: delivery.id,
    };
  }
}
