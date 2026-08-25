import { Controller, Get, Post, Put, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';

@ApiTags('Tenants (B2B Merchants)')
@Controller('v1/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new B2B Merchant Tenant (Generates API Key & Secret)' })
  @ApiResponse({ status: 201, description: 'Tenant created with apiKeyRaw' })
  async createTenant(@Body() dto: CreateTenantDto) {
    return this.tenantsService.createTenant(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all registered tenants' })
  async getAllTenants() {
    return this.tenantsService.getAllTenants();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific tenant' })
  async getTenantById(@Param('id') id: string) {
    return this.tenantsService.getTenantById(id);
  }

  @Post(':id/regenerate-key')
  @ApiOperation({ summary: 'Regenerate API Key for a tenant' })
  async regenerateApiKey(@Param('id') id: string) {
    return this.tenantsService.regenerateApiKey(id);
  }

  @Put(':id/webhooks')
  @ApiOperation({ summary: 'Update webhook endpoint and signing secret' })
  async updateWebhook(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.tenantsService.updateWebhookConfig(id, dto);
  }

  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Activate or deactivate a merchant tenant' })
  async toggleStatus(@Param('id') id: string) {
    return this.tenantsService.toggleTenantStatus(id);
  }
}
