import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiHeader,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus } from './entities/order.entity';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Tenant } from '../tenants/entities/tenant.entity';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@ApiTags('Orders (Ciclo de Vida de Pedidos)')
@Controller('v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiSecurity('x-api-key')
  @ApiHeader({ name: 'x-api-key', description: 'Clave de API del comercio B2B', required: true })
  @ApiHeader({
    name: 'idempotency-key',
    description: 'Clave única para garantizar idempotencia y evitar órdenes duplicadas en reintentos',
    required: false,
  })
  @ApiOperation({
    summary: 'Crear nueva orden de despacho (mediante quoteId o coordenadas directas)',
    description: 'Crea el pedido, genera el registro de auditoría, despacha el webhook order.created e inicia el proceso de matchmaking geoespacial.',
  })
  @ApiResponse({ status: 201, description: 'Orden creada y despachada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Cotización vencida o parámetros inválidos.' })
  async createOrder(
    @CurrentTenant() tenant: Tenant,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(tenant.id, dto);
  }

  @Post('manual')
  @ApiOperation({
    summary: 'Crear orden manual desde el panel de administración central',
    description: 'Permite al operador de la central despachar pedidos directamente seleccionando los puntos en el mapa.',
  })
  async createManualOrder(
    @Body() body: CreateOrderDto & { tenantId?: string },
  ) {
    return this.ordersService.createManualOrderAdmin(body);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar pedidos con filtros opcionales por estado, comercio o asociación DSP',
    description: 'Obtiene el listado cronológico de pedidos registrados en el sistema.',
  })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false, description: 'Filtrar por estado del pedido' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Filtrar por UUID del comercio' })
  @ApiQuery({ name: 'delegatedDspId', required: false, description: 'Filtrar por UUID de la asociación de motos / DSP' })
  @ApiResponse({ status: 200, description: 'Lista de pedidos.' })
  async getAllOrders(
    @Query('status') status?: OrderStatus,
    @Query('tenantId') tenantId?: string,
    @Query('delegatedDspId') delegatedDspId?: string,
  ) {
    return this.ordersService.getAllOrders(status, tenantId, delegatedDspId);
  }

  @Post(':id/delegate-dsp')
  @ApiOperation({
    summary: 'Delegar pedido a una asociación de motos / partner DSP externo',
    description: 'Permite al Super Admin transferir una orden a una asociación para que sea atendida por su flota.',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden (ej: ord_8f912a7b)' })
  @ApiResponse({ status: 200, description: 'Orden delegada exitosamente al DSP.' })
  async delegateOrderToDsp(
    @Param('id') id: string,
    @Body() body: { dspPartnerId: string; dspPayout?: number },
  ) {
    return this.ordersService.delegateOrderToDsp(id, body.dspPartnerId, body.dspPayout);
  }

  @Post(':id/dsp-accept')
  @ApiOperation({
    summary: 'Aceptar orden delegada por parte de la asociación de motos / DSP',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden' })
  async dspAcceptOrder(
    @Param('id') id: string,
    @Body() body: { dspPartnerId: string },
  ) {
    return this.ordersService.dspAcceptOrder(id, body.dspPartnerId);
  }

  @Post(':id/dsp-assign')
  @ApiOperation({
    summary: 'Asignar un motorizado de la asociación a la orden delegada',
    description: 'La asociación despacha la orden a uno de sus propios conductores registrados.',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden' })
  async dspAssignDriver(
    @Param('id') id: string,
    @Body() body: { dspPartnerId: string; driverId: string },
  ) {
    return this.ordersService.dspAssignDriver(id, body.dspPartnerId, body.driverId);
  }

  @Get('alerts/stuck')
  @ApiOperation({
    summary: 'Detectar órdenes colgadas o con demoras críticas (Soporte Operativo)',
    description: 'Devuelve órdenes en búsqueda prolongada (+10 min) o en tránsito sin reportes (+40 min).',
  })
  async getStuckOrders() {
    return this.ordersService.getStuckOrders();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle completo de un pedido con su registro de auditoría inmutable',
    description: 'Devuelve los datos del pedido, repartidor asignado e historial de cambios de estado.',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden (ej: ord_8f912a7b)', example: 'ord_8f912a7b' })
  @ApiResponse({ status: 200, description: 'Detalle de la orden y auditoría.' })
  @ApiResponse({ status: 404, description: 'Orden no encontrada.' })
  async getOrderById(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Transicionar estado de la orden (Llegada a recogida, En tránsito, Entregado con POD)',
    description: 'Permite actualizar el ciclo de vida del pedido por parte del repartidor o despachador, enviando Webhooks y acreditando pagos en billetera.',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden', example: 'ord_8f912a7b' })
  @ApiResponse({ status: 200, description: 'Estado actualizado correctamente.' })
  @ApiResponse({ status: 404, description: 'Orden no encontrada.' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(id, dto, 'DRIVER');
  }

  @Post(':id/force-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Forzar estado de una orden manualmente (Marcar Completada, Cancelar, etc.)',
    description: 'Permite a los operadores resolver pedidos atascados, registrar motivo y opcionalmente acreditar fondos al conductor.',
  })
  async forceStatus(
    @Param('id') id: string,
    @Body()
    dto: {
      status: OrderStatus;
      reason: string;
      creditDriver?: boolean;
      proofPhotoUrl?: string;
      signatureSvg?: string;
    },
  ) {
    return this.ordersService.forceOrderStatus(id, dto);
  }

  @Post(':id/resend-webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reenviar Webhook con comprobante POD al comercio',
    description: 'Permite reemitir el evento a la tienda asociada en caso de fallos de recepción o reintentos solicitados.',
  })
  async resendWebhook(@Param('id') id: string) {
    return this.ordersService.resendWebhook(id);
  }

  @Get('track/:token')
  @ApiOperation({
    summary: 'Seguimiento público en tiempo real del pedido (Sin autenticación requerida)',
    description: 'Endpoint ligero para compartir con el cliente final con la ubicación en vivo del repartidor y datos del viaje.',
  })
  @ApiParam({ name: 'token', description: 'Token público de seguimiento (trackingToken)', example: 'track-434567' })
  @ApiResponse({ status: 200, description: 'Datos públicos de seguimiento.' })
  @ApiResponse({ status: 404, description: 'Información de seguimiento no encontrada.' })
  async getPublicTracking(@Param('token') token: string) {
    return this.ordersService.getPublicTracking(token);
  }
}
