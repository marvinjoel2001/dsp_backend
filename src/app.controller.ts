import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health (Estado del Servicio)')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Endpoint raíz de bienvenida' })
  @ApiResponse({ status: 200, description: 'Estado general del servicio.' })
  getRoot() {
    return {
      status: 'ok',
      service: 'Chiringuito DSP Backend API',
      version: '1.0.0',
      docs: '/api/docs',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Healthcheck para Render / Cloud Monitor' })
  @ApiResponse({ status: 200, description: 'Servicio en línea.' })
  getHealth() {
    return {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
