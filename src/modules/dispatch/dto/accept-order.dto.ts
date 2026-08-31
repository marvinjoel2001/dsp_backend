import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptOrderDto {
  @ApiProperty({
    description: 'ID de la orden ofertada a aceptar',
    example: 'ord_8f912a7b',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    description: 'UUID del conductor que acepta la orden',
    example: 'c8716b1e-6240-4b2a-8c01-7faef83151cf',
  })
  @IsUUID()
  @IsNotEmpty()
  driverId: string;
}

export class RejectOrderDto {
  @ApiProperty({
    description: 'ID de la orden rechazada',
    example: 'ord_8f912a7b',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    description: 'UUID del conductor que declina',
    example: 'c8716b1e-6240-4b2a-8c01-7faef83151cf',
  })
  @IsUUID()
  @IsNotEmpty()
  driverId: string;

  @ApiProperty({
    description: 'Motivo del rechazo de la oferta',
    example: 'Distancia excesiva / Batería baja',
    required: false,
  })
  reason?: string;
}

export class ManualAssignDto {
  @ApiProperty({
    description: 'ID de la orden a asignar manualmente por el despachador',
    example: 'ord_8f912a7b',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    description: 'ID o UUID del conductor asignado manualmente',
    example: 'c8716b1e-6240-4b2a-8c01-7faef83151cf',
  })
  @IsString()
  @IsNotEmpty()
  driverId: string;
}
