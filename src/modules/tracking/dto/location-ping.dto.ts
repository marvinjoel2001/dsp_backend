import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LocationPingDto {
  @ApiProperty({
    description: 'Identificador único UUID del conductor o repartidor',
    example: 'c8716b1e-6240-4b2a-8c01-7faef83151cf',
  })
  @IsString()
  @IsNotEmpty()
  driverId: string;

  @ApiProperty({
    description: 'Latitud GPS actual del conductor (-90 a 90)',
    example: -17.7833,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({
    description: 'Longitud GPS actual del conductor (-180 a 180)',
    example: -63.1821,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty({
    description: 'Rumbo / orientación en grados (0 a 360)',
    example: 180,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  heading?: number;

  @ApiProperty({
    description: 'Velocidad estimada en km/h',
    example: 32.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  speed?: number;

  @ApiProperty({
    description: 'ID de la orden activa si el conductor se encuentra en curso de entrega',
    example: 'ord_8f912a7b',
    required: false,
  })
  @IsOptional()
  @IsString()
  orderId?: string;
}
