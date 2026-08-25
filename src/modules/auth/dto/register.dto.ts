import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleType } from '../../drivers/entities/driver.entity';

export class RegisterDriverDto {
  @ApiProperty({
    description: 'Nombre y apellido completos del repartidor',
    example: 'Carlos Mendoza',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    description: 'Número de teléfono móvil para contacto y WhatsApp',
    example: '+59170012345',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'Correo electrónico único para el inicio de sesión',
    example: 'carlos.mendoza@dsp.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Contraseña segura de acceso a la app móvil (mínimo 6 caracteres)',
    example: 'segura2026',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Tipo de vehículo utilizado para las entregas',
    enum: VehicleType,
    default: VehicleType.MOTORCYCLE,
    example: VehicleType.MOTORCYCLE,
  })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiProperty({
    description: 'Placa o número de registro del vehículo',
    example: '4589-KLT',
    required: false,
  })
  @IsOptional()
  @IsString()
  vehiclePlate?: string;
}
