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
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus } from './entities/order.entity';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Tenant } from '../tenants/entities/tenant.entity';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@ApiTags('Orders (Lifecycle & Deliveries)')
@Controller('v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiSecurity('x-api-key')
  @ApiHeader({ name: 'x-api-key', description: 'Merchant B2B API Key', required: true })
  @ApiHeader({ name: 'idempotency-key', description: 'Unique idempotency key to prevent double creation', required: false })
  @ApiOperation({ summary: 'Create new delivery order via quote or raw coordinates' })
  @ApiResponse({ status: 201, description: 'Order created and dispatched' })
  async createOrder(
    @CurrentTenant() tenant: Tenant,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(tenant.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List orders with optional status or tenant filter' })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  async getAllOrders(
    @Query('status') status?: OrderStatus,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.ordersService.getAllOrders(status, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details with full audit log and driver' })
  async getOrderById(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transition order status (ARRIVED, IN_TRANSIT, DELIVERED with proof)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(id, dto, 'DRIVER');
  }

  @Get('track/:token')
  @ApiOperation({ summary: 'Public order tracking endpoint' })
  async getPublicTracking(@Param('token') token: string) {
    return this.ordersService.getPublicTracking(token);
  }
}
