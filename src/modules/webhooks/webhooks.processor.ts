import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookDelivery, WebhookDeliveryStatus } from './entities/webhook-delivery.entity';

@Processor('webhooks-queue')
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhooksProcessor.name);

  constructor(
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { deliveryId, webhookUrl, payload, signature } = job.data;
    this.logger.log(`Attempt ${job.attemptsMade + 1} processing webhook: ${deliveryId} -> ${webhookUrl}`);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DSP-Signature': signature,
          'User-Agent': 'OpenDSP-Webhook-Engine/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      const responseText = await response.text();
      const isSuccess = response.ok;

      await this.deliveryRepo.update(deliveryId, {
        attempts: job.attemptsMade + 1,
        httpStatusCode: response.status,
        responseBody: responseText ? responseText.substring(0, 1000) : null,
        status: isSuccess ? WebhookDeliveryStatus.SUCCESS : WebhookDeliveryStatus.FAILED,
        errorMessage: isSuccess ? null : `HTTP ${response.status}: ${response.statusText}`,
      });

      if (!isSuccess) {
        throw new Error(`Webhook target responded with status ${response.status}`);
      }

      this.logger.log(`Webhook delivery ${deliveryId} succeeded (HTTP ${response.status})`);
      return { success: true, status: response.status };
    } catch (error: any) {
      this.logger.error(`Webhook delivery ${deliveryId} failed: ${error.message}`);
      await this.deliveryRepo.update(deliveryId, {
        attempts: job.attemptsMade + 1,
        status: WebhookDeliveryStatus.FAILED,
        errorMessage: error.message,
      });
      throw error; // Let BullMQ retry according to backoff
    }
  }
}
