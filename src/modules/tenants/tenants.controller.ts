import { Controller, Get, Post, Put, Patch, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

@ApiTags('Tenants (Comercios y Clientes B2B)')
@Controller('v1/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un nuevo comercio B2B (Genera Clave API única y Secreto de Webhook)',
    description: 'Crea el tenant y devuelve la clave API en texto plano (apiKeyRaw) por única vez para el comercio.',
  })
  @ApiResponse({ status: 201, description: 'Comercio creado exitosamente con sus credenciales de integración.' })
  @ApiResponse({ status: 409, description: 'Ya existe un comercio con ese correo electrónico.' })
  async createTenant(@Body() dto: CreateTenantDto) {
    return this.tenantsService.createTenant(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todos los comercios registrados en el sistema',
    description: 'Devuelve la lista de comercios con sus claves API enmascaradas y endpoints de webhook.',
  })
  @ApiResponse({ status: 200, description: 'Lista de comercios.' })
  async getAllTenants() {
    return this.tenantsService.getAllTenants();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalles y configuración de un comercio específico',
  })
  @ApiParam({ name: 'id', description: 'UUID del comercio', example: 'd3b07384-d113-4f59-994b-e3c3b069d27f' })
  @ApiResponse({ status: 200, description: 'Detalles del comercio.' })
  @ApiResponse({ status: 404, description: 'Comercio no encontrado.' })
  async getTenantById(@Param('id') id: string) {
    return this.tenantsService.getTenantById(id);
  }

  @Post(':id/regenerate-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Regenerar Clave API para un comercio (Invalida la anterior de inmediato)',
    description: 'Crea un nuevo token con prefijo dsp_live_ e invalida el hash previo para seguridad.',
  })
  @ApiParam({ name: 'id', description: 'UUID del comercio', example: 'd3b07384-d113-4f59-994b-e3c3b069d27f' })
  @ApiResponse({ status: 200, description: 'Nueva Clave API generada (apiKeyRaw).' })
  async regenerateApiKey(@Param('id') id: string) {
    return this.tenantsService.regenerateApiKey(id);
  }

  @Put(':id/webhooks')
  @ApiOperation({
    summary: 'Actualizar endpoint HTTPS de Webhooks y clave secreta de firma HMAC',
  })
  @ApiParam({ name: 'id', description: 'UUID del comercio', example: 'd3b07384-d113-4f59-994b-e3c3b069d27f' })
  @ApiResponse({ status: 200, description: 'Configuración de webhooks actualizada.' })
  async updateWebhook(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.tenantsService.updateWebhookConfig(id, dto);
  }

  @Patch(':id/toggle-status')
  @ApiOperation({
    summary: 'Activar o desactivar el acceso de un comercio a la API',
  })
  @ApiParam({ name: 'id', description: 'UUID del comercio', example: 'd3b07384-d113-4f59-994b-e3c3b069d27f' })
  @ApiResponse({ status: 200, description: 'Estado del comercio actualizado.' })
  async toggleStatus(@Param('id') id: string) {
    return this.tenantsService.toggleTenantStatus(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar datos generales de una tienda o comercio',
  })
  @ApiParam({ name: 'id', description: 'UUID del comercio' })
  async updateTenant(
    @Param('id') id: string,
    @Body() dto: { name?: string; email?: string; webhookUrl?: string },
  ) {
    return this.tenantsService.updateTenant(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar tienda o comercio de la plataforma',
  })
  @ApiParam({ name: 'id', description: 'UUID del comercio' })
  async deleteTenant(@Param('id') id: string) {
    return this.tenantsService.deleteTenant(id);
  }
}
