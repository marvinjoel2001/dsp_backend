import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { DspPartnersService } from './dsp-partners.service';
import { CreateDspPartnerDto } from './dto/create-dsp-partner.dto';
import { UpdateDspPartnerDto } from './dto/update-dsp-partner.dto';
import { OrderStatus } from '../orders/entities/order.entity';

@ApiTags('DSP Partners (Asociaciones de Motos y Flotas Externas)')
@Controller('v1/dsp-partners')
export class DspPartnersController {
  constructor(private readonly dspPartnersService: DspPartnersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las asociaciones de motos y DSPs registrados' })
  @ApiResponse({ status: 200, description: 'Lista de asociaciones.' })
  async findAll() {
    return this.dspPartnersService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Registrar nueva asociación de motos o partner DSP' })
  @ApiResponse({ status: 201, description: 'Asociación creada exitosamente.' })
  async create(@Body() dto: CreateDspPartnerDto) {
    return this.dspPartnersService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una asociación por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la asociación' })
  async findById(@Param('id') id: string) {
    return this.dspPartnersService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de una asociación de motos' })
  @ApiParam({ name: 'id', description: 'UUID de la asociación' })
  async update(@Param('id') id: string, @Body() dto: UpdateDspPartnerDto) {
    return this.dspPartnersService.update(id, dto);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Activar o suspender una asociación de motos' })
  async toggleActive(@Param('id') id: string) {
    return this.dspPartnersService.toggleActive(id);
  }

  @Get(':id/drivers')
  @ApiOperation({ summary: 'Listar todos los motorizados pertenecientes a esta asociación' })
  @ApiParam({ name: 'id', description: 'UUID de la asociación' })
  async getDrivers(@Param('id') id: string) {
    return this.dspPartnersService.getDriversByDsp(id);
  }

  @Get(':id/orders')
  @ApiOperation({ summary: 'Listar órdenes delegadas a esta asociación con filtro de estado' })
  @ApiParam({ name: 'id', description: 'UUID de la asociación' })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false })
  async getOrders(
    @Param('id') id: string,
    @Query('status') status?: OrderStatus,
  ) {
    return this.dspPartnersService.getOrdersByDsp(id, status);
  }

  @Get(':id/metrics')
  @ApiOperation({ summary: 'Obtener resumen métrico y liquidaciones de la asociación' })
  @ApiParam({ name: 'id', description: 'UUID de la asociación' })
  async getMetrics(@Param('id') id: string) {
    return this.dspPartnersService.getMetrics(id);
  }
}
