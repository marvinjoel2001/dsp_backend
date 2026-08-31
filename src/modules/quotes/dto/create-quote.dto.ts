import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateQuoteDto {
  @ApiProperty({
    description: 'Dirección legible de origen o recogida',
    example: 'Av. San Martín #123, Equipetrol, Santa Cruz',
  })
  @IsString()
  @IsNotEmpty()
  pickupAddress: string;

  @ApiProperty({
    description: 'Latitud de origen (-90 a 90)',
    example: -17.7833,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat: number;

  @ApiProperty({
    description: 'Longitud de origen (-180 a 180)',
    example: -63.1821,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng: number;

  @ApiProperty({
    description: 'Dirección legible de destino o entrega',
    example: 'Calle Los Pinos #450, Barrio Sirari',
  })
  @IsString()
  @IsNotEmpty()
  dropoffAddress: string;

  @ApiProperty({
    description: 'Latitud de destino (-90 a 90)',
    example: -17.7950,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  dropoffLat: number;

  @ApiProperty({
    description: 'Longitud de destino (-180 a 180)',
    example: -63.1700,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  dropoffLng: number;

  @ApiProperty({
    description: 'Multiplicador opcional de tarifa dinámica (Surge) por alta demanda o clima (ej: 1.25)',
    example: 1.0,
    required: false,
    default: 1.0,
  })
  @IsOptional()
  @IsNumber()
  surgeMultiplier?: number;

  @ApiProperty({
    description: 'Tipo de vehículo solicitado: MOTORCYCLE | BICYCLE | CAR',
    example: 'MOTORCYCLE',
    required: false,
    default: 'MOTORCYCLE',
  })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiProperty({
    description: 'ID de la asociación DSP si la orden está delegada a una flota específica',
    example: 'd9b2d63d-a412-4c28-98e3-057bf89d3112',
    required: false,
  })
  @IsOptional()
  @IsString()
  dspPartnerId?: string;
}
