import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SettlementsService } from './settlements.service';
import { WithdrawalStatus } from './entities/driver-withdrawal.entity';

@ApiTags('Liquidaciones y Finanzas (Settlements, Payouts & Billing)')
@Controller('v1/settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get('dashboard-metrics')
  @ApiOperation({ summary: 'Obtener KPIs financieros consolidados para el Dashboard Admin' })
  async getDashboardFinancialMetrics() {
    return this.settlementsService.getDashboardFinancialMetrics();
  }

  // --- COBRANZA Y LIQUIDACIÓN A COMERCIOS (MERCHANTS) ---

  @Get('merchants')
  @ApiOperation({ summary: 'Obtener balance y estado de liquidación de todas las tiendas' })
  async getMerchantSettlementSummary() {
    return this.settlementsService.getMerchantSettlementSummary();
  }

  @Get('merchants/:tenantId/orders')
  @ApiOperation({ summary: 'Listar órdenes detalladas de una tienda específica para auditoría' })
  async getMerchantOrders(@Param('tenantId') tenantId: string) {
    return this.settlementsService.getMerchantOrders(tenantId);
  }

  @Post('merchants/:tenantId/record-payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registrar un pago o liquidación recibida de un comercio' })
  async recordMerchantPayment(
    @Param('tenantId') tenantId: string,
    @Body()
    dto: {
      amountPaid: number;
      method: 'QR_SIMPLE' | 'BANK_TRANSFER' | 'CASH';
      paymentReference?: string;
      ordersCount?: number;
      notes?: string;
    },
  ) {
    return this.settlementsService.recordMerchantPayment(tenantId, dto);
  }

  // --- RETIROS Y PAGOS A REPARTIDORES (DRIVER PAYOUTS) ---

  @Get('withdrawals')
  @ApiOperation({ summary: 'Listar solicitudes de retiro de conductores' })
  @ApiQuery({ name: 'status', enum: WithdrawalStatus, required: false })
  async getAllWithdrawals(@Query('status') status?: WithdrawalStatus) {
    return this.settlementsService.getAllWithdrawals(status);
  }

  @Post('withdrawals/request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Conductor solicita retiro de fondos a su banco o QR' })
  async createWithdrawalRequest(
    @Body()
    dto: {
      driverId: string;
      amount: number;
      method: 'BANK_TRANSFER' | 'QR_PAYMENT';
      accountHolder: string;
      accountNumberOrPhone: string;
      qrPhotoUrl?: string;
    },
  ) {
    return this.settlementsService.createWithdrawalRequest(dto.driverId, dto);
  }

  @Patch('withdrawals/:id/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin marca una solicitud de retiro como pagada y registra comprobante' })
  async payDriverWithdrawal(
    @Param('id') id: string,
    @Body() dto: { paymentReference?: string; adminNotes?: string },
  ) {
    return this.settlementsService.payDriverWithdrawal(id, dto);
  }

  @Patch('withdrawals/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin rechaza una solicitud de retiro y devuelve fondos al conductor' })
  async rejectDriverWithdrawal(
    @Param('id') id: string,
    @Body() dto: { reason: string },
  ) {
    return this.settlementsService.rejectDriverWithdrawal(id, dto.reason || 'Datos bancarios incorrectos');
  }
}
