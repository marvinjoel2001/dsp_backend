import { Controller, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DispatchService } from './dispatch.service';
import { AcceptOrderDto, ManualAssignDto } from './dto/accept-order.dto';

@ApiTags('Dispatch (Matchmaking & Assignment)')
@Controller('v1/dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Post('orders/:id/match')
  @ApiOperation({ summary: 'Trigger matchmaking geo search for an order' })
  async triggerMatch(@Param('id') orderId: string) {
    return this.dispatchService.matchAndDispatch(orderId);
  }

  @Post('accept')
  @ApiOperation({ summary: 'Driver accepts offered delivery order' })
  @ApiResponse({ status: 200, description: 'Order atomically assigned to driver' })
  async acceptOffer(@Body() dto: AcceptOrderDto) {
    return this.dispatchService.acceptOffer(dto.orderId, dto.driverId);
  }

  @Post('manual-assign')
  @ApiOperation({ summary: 'Admin manual assignment override' })
  async manualAssign(@Body() dto: ManualAssignDto) {
    return this.dispatchService.manualAssign(dto.orderId, dto.driverId);
  }
}
