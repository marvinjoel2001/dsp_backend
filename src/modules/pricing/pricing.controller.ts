import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PricingService, PriceCalculationResult } from './pricing.service';
import { PricingConfig } from './entities/pricing-config.entity';
import { CreatePricingConfigDto, SimulateQuoteDto } from './dto/pricing.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Tarifas y Precios (Pricing & Distance Brackets)')
@Controller('v1/pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get()
  @ApiOperation({ summary: 'Listar configuraciones de tarifas (Globales y/o por DSP Partner)' })
  @ApiResponse({ status: 200, description: 'Lista de esquemas tarifarios' })
  async getPricingConfigs(
    @Query('dspPartnerId') dspPartnerId?: string,
  ): Promise<PricingConfig[]> {
    return this.pricingService.findAll(dspPartnerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una configuración tarifaria por ID' })
  async getPricingById(@Param('id') id: string): Promise<PricingConfig> {
    return this.pricingService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear o guardar nueva configuración tarifaria por tramos de km' })
  @ApiResponse({ status: 201, description: 'Tarifa creada exitosamente' })
  async createPricing(
    @Body() dto: CreatePricingConfigDto,
    @CurrentUser() user: any,
  ): Promise<PricingConfig> {
    // Si es un usuario de DSP Partner, forzar su dspPartnerId
    if (user?.role === 'DSP_EXTERNAL' && user?.dspPartnerId) {
      dto.dspPartnerId = user.dspPartnerId;
    }
    return this.pricingService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar configuración tarifaria existente' })
  async updatePricing(
    @Param('id') id: string,
    @Body() dto: Partial<CreatePricingConfigDto>,
  ): Promise<PricingConfig> {
    return this.pricingService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar una configuración tarifaria' })
  async deletePricing(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.pricingService.delete(id);
  }

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Simular cotización en tiempo real con tramos de distancia' })
  @ApiResponse({ status: 200, description: 'Resultado del cálculo de tarifa y pago al chofer' })
  async simulatePricing(@Body() dto: SimulateQuoteDto): Promise<PriceCalculationResult> {
    return this.pricingService.simulate(dto);
  }
}
