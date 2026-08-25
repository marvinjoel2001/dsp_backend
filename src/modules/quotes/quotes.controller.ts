import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiResponse, ApiHeader, ApiParam } from '@nestjs/swagger';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Tenant } from '../tenants/entities/tenant.entity';

@ApiTags('Quotes (Cotizaciones Dinámicas)')
@Controller('v1/quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('x-api-key')
  @ApiHeader({ name: 'x-api-key', description: 'Clave de API del comercio B2B (dsp_live_...)', required: true })
  @ApiOperation({
    summary: 'Calcular cotización dinámica de entrega con vigencia de 15 minutos',
    description: 'Calcula la distancia geodésica, duración estimada, precio total y pago al conductor aplicando tarifas base y factores dinámicos (surge).',
  })
  @ApiResponse({ status: 201, description: 'Cotización calculada y guardada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Datos de coordenadas inválidos o distancia mayor al radio permitido (50 km).' })
  @ApiResponse({ status: 401, description: 'Clave API ausente o inválida.' })
  async createQuote(
    @CurrentTenant() tenant: Tenant,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.quotesService.calculateAndCreateQuote(tenant.id, dto);
  }

  @Get(':id')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('x-api-key')
  @ApiHeader({ name: 'x-api-key', description: 'Clave de API del comercio B2B', required: true })
  @ApiOperation({
    summary: 'Consultar detalles de una cotización por su UUID',
    description: 'Permite consultar el estado y vigencia de una cotización generada previamente antes de convertirla en orden.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la cotización', example: '32df9e8e-d9f7-4148-8cf4-fcf629cbbe70' })
  @ApiResponse({ status: 200, description: 'Detalle de la cotización.' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada.' })
  async getQuote(@Param('id') id: string) {
    return this.quotesService.getQuoteById(id);
  }
}
