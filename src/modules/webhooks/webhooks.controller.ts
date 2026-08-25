import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiResponse, ApiBody, ApiProperty } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { WebhookDeliveryStatus } from './entities/webhook-delivery.entity';
import { CryptoUtil } from '../../common/utils/crypto.util';

export class SimulateVerifyDto {
  @ApiProperty({ description: 'Payload JSON enviado en el webhook', example: { event: 'order.created', data: { order_id: 'ord_123' } } })
  payload: any;

  @ApiProperty({ description: 'Secreto de webhook del comercio', example: 'whsec_884b2c1e...' })
  secret: string;

  @ApiProperty({ description: 'Firma recibida en el encabezado x-dsp-signature', example: 'a1b2c3d4...' })
  signature: string;
}

@ApiTags('Webhooks (Gestor de Envíos y DLQ)')
@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get('deliveries')
  @ApiOperation({
    summary: 'Listar historial de envíos de Webhooks y registros de la Dead-Letter Queue (DLQ)',
    description: 'Permite auditar el estado de entrega (SUCCESS, FAILED, PENDING), códigos HTTP de respuesta y errores de los clientes.',
  })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Filtrar por comercio' })
  @ApiQuery({ name: 'status', enum: WebhookDeliveryStatus, required: false, description: 'Filtrar por estado de entrega' })
  @ApiResponse({ status: 200, description: 'Lista de intentos de entrega de Webhooks.' })
  async getDeliveries(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: WebhookDeliveryStatus,
  ) {
    return this.webhooksService.getDeliveries(tenantId, status);
  }

  @Post('deliveries/:id/retry')
  @ApiOperation({
    summary: 'Reencolar manualmente un webhook fallido desde la Dead-Letter Queue',
    description: 'Envía de nuevo el trabajo a la cola BullMQ para reintentar la entrega con backoff exponencial.',
  })
  @ApiParam({ name: 'id', description: 'UUID del registro de entrega de webhook', example: '32df9e8e-d9f7-4148-8cf4-fcf629cbbe70' })
  @ApiResponse({ status: 200, description: 'Webhook reencolado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Registro de entrega no encontrado.' })
  async retryWebhook(@Param('id') id: string) {
    return this.webhooksService.retryWebhook(id);
  }

  @Post('simulate-verify')
  @ApiOperation({
    summary: 'Herramienta de depuración: Verificar y calcular firmas HMAC SHA-256',
    description: 'Permite a los desarrolladores comprobar si su implementación de validación de firmas coincide exactamente con la del backend.',
  })
  @ApiBody({ type: SimulateVerifyDto })
  @ApiResponse({ status: 200, description: 'Resultado de la validación y firma calculada.' })
  async simulateVerify(@Body() body: SimulateVerifyDto) {
    const isValid = CryptoUtil.verifyWebhookSignature(body.payload, body.secret, body.signature);
    const computed = CryptoUtil.signWebhookPayload(body.payload, body.secret);
    return {
      isValid,
      computedSignature: computed,
      providedSignature: body.signature,
    };
  }
}
