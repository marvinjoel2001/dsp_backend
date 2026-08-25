import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { WebhookDeliveryStatus } from './entities/webhook-delivery.entity';
import { CryptoUtil } from '../../common/utils/crypto.util';

@ApiTags('Webhooks (BullMQ Dispatcher & DLQ)')
@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get('deliveries')
  @ApiOperation({ summary: 'List recent webhook delivery attempts & DLQ logs' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'status', enum: WebhookDeliveryStatus, required: false })
  async getDeliveries(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: WebhookDeliveryStatus,
  ) {
    return this.webhooksService.getDeliveries(tenantId, status);
  }

  @Post('deliveries/:id/retry')
  @ApiOperation({ summary: 'Manually re-enqueue a failed webhook from the DLQ' })
  async retryWebhook(@Param('id') id: string) {
    return this.webhooksService.retryWebhook(id);
  }

  @Post('simulate-verify')
  @ApiOperation({ summary: 'Helper endpoint to verify HMAC SHA-256 signatures for testing' })
  async simulateVerify(
    @Body() body: { payload: any; secret: string; signature: string },
  ) {
    const isValid = CryptoUtil.verifyWebhookSignature(body.payload, body.secret, body.signature);
    const computed = CryptoUtil.signWebhookPayload(body.payload, body.secret);
    return {
      isValid,
      computedSignature: computed,
      providedSignature: body.signature,
    };
  }
}
