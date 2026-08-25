import { Controller, Get, Patch, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { ToggleOnlineDto } from './dto/update-driver-status.dto';
import { DriverVerificationStatus } from './entities/driver.entity';

@ApiTags('Drivers (Conductores y Flota)')
@Controller('v1/drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar todos los conductores registrados en la flota',
    description: 'Obtiene el listado completo de repartidores, su estado online/offline, vehículo y calificación.',
  })
  @ApiResponse({ status: 200, description: 'Lista de conductores.' })
  async getAllDrivers() {
    return this.driversService.getAllDrivers();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener perfil y detalles de un conductor por UUID',
    description: 'Devuelve información personal, vehículo, estado de turno y balance de billetera.',
  })
  @ApiParam({ name: 'id', description: 'UUID del conductor', example: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' })
  @ApiResponse({ status: 200, description: 'Detalle del conductor.' })
  @ApiResponse({ status: 404, description: 'Conductor no encontrado.' })
  async getDriverById(@Param('id') id: string) {
    return this.driversService.getDriverById(id);
  }

  @Patch(':id/profile')
  @ApiOperation({
    summary: 'Actualizar información personal y vehículo del conductor',
  })
  async updateProfile(@Param('id') id: string, @Body() data: any) {
    return this.driversService.updateProfile(id, data);
  }

  @Post(':id/documents')
  @ApiOperation({
    summary: 'Subir documentos de identidad, licencia, SOAT y vehículo',
  })
  async uploadDocuments(@Param('id') id: string, @Body() docs: any) {
    return this.driversService.uploadDocuments(id, docs);
  }

  @Patch(':id/verify')
  @ApiOperation({
    summary: 'Aprobar o rechazar verificación de conductor (Admin)',
  })
  async verifyDriver(
    @Param('id') id: string,
    @Body() body: { status: DriverVerificationStatus },
  ) {
    return this.driversService.updateVerificationStatus(id, body.status);
  }

  @Patch(':id/online')
  @ApiOperation({
    summary: 'Cambiar estado de turno del conductor (Conectado / Desconectado)',
    description: 'Actualiza la disponibilidad en base de datos e indexa/remueve al conductor de la llave espacial Redis GEO.',
  })
  @ApiParam({ name: 'id', description: 'UUID del conductor', example: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' })
  @ApiResponse({ status: 200, description: 'Estado de turno actualizado.' })
  async toggleOnline(@Param('id') id: string, @Body() dto: ToggleOnlineDto) {
    return this.driversService.toggleOnlineStatus(id, dto.isOnline);
  }

  @Get(':id/feed')
  @ApiOperation({
    summary: 'Obtener feed de órdenes disponibles para la App del Conductor',
    description: 'Devuelve las órdenes en estado CREATED y SEARCHING_DRIVER listas para ser tomadas.',
  })
  @ApiParam({ name: 'id', description: 'UUID del conductor', example: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' })
  @ApiResponse({ status: 200, description: 'Lista de órdenes disponibles para entrega.' })
  async getDriverFeed(@Param('id') id: string) {
    return this.driversService.getAvailableFeedForDriver(id);
  }

  @Get(':id/active-order')
  @ApiOperation({
    summary: 'Obtener la orden actualmente activa del conductor para navegación en vivo',
    description: 'Devuelve la orden en curso (ASSIGNED, ARRIVED_AT_PICKUP o IN_TRANSIT) para la pantalla de navegación GPS.',
  })
  @ApiParam({ name: 'id', description: 'UUID del conductor', example: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' })
  @ApiResponse({ status: 200, description: 'Orden activa o null si no tiene entrega en curso.' })
  async getActiveOrder(@Param('id') id: string) {
    return this.driversService.getActiveOrderForDriver(id);
  }

  @Get(':id/wallet')
  @ApiOperation({
    summary: 'Consultar saldo de billetera e historial de pagos por entregas',
    description: 'Devuelve el balance acumulado y transacciones generadas por cada entrega completada.',
  })
  @ApiParam({ name: 'id', description: 'UUID del conductor', example: 'c8716b1e-6240-4b2a-8c01-7faef83151cf' })
  @ApiResponse({ status: 200, description: 'Balance e historial de transacciones.' })
  async getDriverWallet(@Param('id') id: string) {
    return this.driversService.getDriverWallet(id);
  }
}
