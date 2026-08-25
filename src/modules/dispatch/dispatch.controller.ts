import { Controller, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { DispatchService } from './dispatch.service';
import { AcceptOrderDto, ManualAssignDto } from './dto/accept-order.dto';

@ApiTags('Dispatch (Asignación y Matchmaking)')
@Controller('v1/dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Post('orders/:id/match')
  @ApiOperation({
    summary: 'Disparar búsqueda geoespacial de conductores cercanos para un pedido',
    description: 'Ejecuta el algoritmo de proximidad con Redis GEO (radio de 5 km) y bloquea atómicamente la oferta para el candidato.',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden a despachar', example: 'ord_8f912a7b' })
  @ApiResponse({ status: 200, description: 'Resultado de la búsqueda y conteo de candidatos encontrados.' })
  @ApiResponse({ status: 404, description: 'Orden no encontrada.' })
  async triggerMatch(@Param('id') orderId: string) {
    return this.dispatchService.matchAndDispatch(orderId);
  }

  @Post('accept')
  @ApiOperation({
    summary: 'Aceptación de oferta de despacho por parte de un repartidor',
    description: 'Asignación atómica del pedido al conductor, liberación de locks de Redis y despacho del Webhook order.assigned.',
  })
  @ApiResponse({ status: 200, description: 'Pedido asignado exitosamente al conductor.' })
  @ApiResponse({ status: 409, description: 'La orden ya no está disponible o fue tomada por otro conductor.' })
  async acceptOffer(@Body() dto: AcceptOrderDto) {
    return this.dispatchService.acceptOffer(dto.orderId, dto.driverId);
  }

  @Post('manual-assign')
  @ApiOperation({
    summary: 'Asignación manual de pedido por parte del despachador o administrador',
    description: 'Permite a un despachador anular la búsqueda automática y asignar directamente un repartidor específico.',
  })
  @ApiResponse({ status: 200, description: 'Pedido asignado manualmente con éxito.' })
  @ApiResponse({ status: 404, description: 'Orden o conductor no encontrado.' })
  async manualAssign(@Body() dto: ManualAssignDto) {
    return this.dispatchService.manualAssign(dto.orderId, dto.driverId);
  }
}
