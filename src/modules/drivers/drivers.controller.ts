import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { ToggleOnlineDto } from './dto/update-driver-status.dto';

@ApiTags('Drivers (Fleet & Mobile API)')
@Controller('v1/drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  @ApiOperation({ summary: 'List all drivers in the fleet' })
  async getAllDrivers() {
    return this.driversService.getAllDrivers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get driver profile and details' })
  async getDriverById(@Param('id') id: string) {
    return this.driversService.getDriverById(id);
  }

  @Patch(':id/online')
  @ApiOperation({ summary: 'Toggle driver online/offline shift status' })
  async toggleOnline(@Param('id') id: string, @Body() dto: ToggleOnlineDto) {
    return this.driversService.toggleOnlineStatus(id, dto.isOnline);
  }

  @Get(':id/feed')
  @ApiOperation({ summary: 'Get available order feed for the driver app (Pickup / Delivery)' })
  async getDriverFeed(@Param('id') id: string) {
    return this.driversService.getAvailableFeedForDriver(id);
  }

  @Get(':id/active-order')
  @ApiOperation({ summary: 'Get currently active ride/order for live navigation' })
  async getActiveOrder(@Param('id') id: string) {
    return this.driversService.getActiveOrderForDriver(id);
  }

  @Get(':id/wallet')
  @ApiOperation({ summary: 'Get driver wallet balance and payout transaction history' })
  async getDriverWallet(@Param('id') id: string) {
    return this.driversService.getDriverWallet(id);
  }
}
