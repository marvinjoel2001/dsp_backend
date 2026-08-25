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

  @Get()
  @ApiOperation({
    summary: 'Listar pedidos con filtros opcionales por estado o comercio',
    description: 'Obtiene el listado cronológico de pedidos registrados en el sistema.',
  })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false, description: 'Filtrar por estado del pedido' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Filtrar por UUID del comercio' })
  @ApiResponse({ status: 200, description: 'Lista de pedidos.' })
  async getAllOrders(
    @Query('status') status?: OrderStatus,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.ordersService.getAllOrders(status, tenantId);
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
