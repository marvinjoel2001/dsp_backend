import { IsString, IsNotEmpty, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType } from '../entities/driver.entity';

export class CreateDriverAdminDto {
  @ApiProperty({ example: 'Ramiro Vaca', description: 'Nombre completo del conductor' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '+591 71234567', description: 'Número de celular o WhatsApp' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'ramiro.vaca@gmail.com', description: 'Correo electrónico' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456', description: 'Contraseña de acceso para app conductor' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ example: '7894561 SC', description: 'Número de carnet de identidad' })
  @IsString()
  @IsOptional()
  ciNumber?: string;

  @ApiPropertyOptional({ example: 'Av. Banzer 4to Anillo', description: 'Dirección de domicilio' })
  @IsString()
  @IsOptional()
  homeAddress?: string;

  @ApiPropertyOptional({ enum: VehicleType, default: VehicleType.MOTORCYCLE, description: 'Tipo de vehículo' })
  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: VehicleType;

  @ApiPropertyOptional({ example: '4589-KLP', description: 'Número de placa del vehículo' })
  @IsString()
  @IsOptional()
  vehiclePlate?: string;

  @ApiPropertyOptional({ example: 'uuid-asociacion', description: 'ID de la asociación de motos o DSP (opcional si es flota propia)' })
  @IsString()
  @IsOptional()
  dspPartnerId?: string;
}
