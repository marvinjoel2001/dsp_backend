import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({
    description: 'UUID de cotización previa generada con /v1/quotes (vigencia de 15 minutos). Si se envía, calcula automáticamente el precio y coordenadas.',
    example: '32df9e8e-d9f7-4148-8cf4-fcf629cbbe70',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  quoteId?: string;

  @ApiProperty({
    description: 'Referencia interna del comercio o tienda (ej: Número de ticket o pedido de e-commerce)',
    example: 'TIENDA-9941',
    required: false,
  })
  @IsOptional()
  @IsString()
  merchantReference?: string;

  @ApiProperty({
    description: 'Dirección física de recogida (requerido si no se proporciona quoteId)',
    example: 'Av. Principal #450, Centro',
    required: false,
  })
  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @ApiProperty({
    description: 'Latitud de recogida (-90 a 90)',
    example: -17.7833,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat?: number;

  @ApiProperty({
    description: 'Longitud de recogida (-180 a 180)',
    example: -63.1821,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng?: number;

  @ApiProperty({
    description: 'Dirección física de entrega (requerido si no se proporciona quoteId)',
    example: 'Calle Comercio #12, Zona Norte',
    required: false,
  })
  @IsOptional()
  @IsString()
  dropoffAddress?: string;

  @ApiProperty({
    description: 'Latitud de entrega (-90 a 90)',
    example: -17.7950,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  dropoffLat?: number;

  @ApiProperty({
    description: 'Longitud de entrega (-180 a 180)',
    example: -63.1700,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  dropoffLng?: number;

  @ApiProperty({
    description: 'Notas o instrucciones de entrega para el repartidor',
    example: 'Tocar el timbre 2B y entregar en recepción.',
    required: false,
  })
  @IsOptional()
  @IsString()
  packageNotes?: string;

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
    description: 'ID de la asociación DSP asignada (opcional)',
    example: 'd9b2d63d-a412-4c28-98e3-057bf89d3112',
    required: false,
  })
  @IsOptional()
  @IsString()
  dspPartnerId?: string;
}
