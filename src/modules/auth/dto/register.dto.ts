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
    description: 'Número de Carnet de Identidad con complemento/expedido',
    example: '8945612 SC',
    required: false,
  })
  @IsOptional()
  @IsString()
  ciNumber?: string;

  @ApiProperty({
    description: 'Dirección de domicilio particular del conductor en Bolivia',
    example: 'Calle Los Jazmines #240, Barrio Sirari, Santa Cruz',
    required: false,
  })
  @IsOptional()
  @IsString()
  homeAddress?: string;

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

  @ApiProperty({
    description: 'URL de la fotografía facial (selfie) tomada con cámara',
    required: false,
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiProperty({
    description: 'URL del carnet de identidad escaneado/fotografiado',
    required: false,
  })
  @IsOptional()
  @IsString()
  idCardUrl?: string;

  @ApiProperty({
    description: 'URL de la licencia de conducir',
    required: false,
  })
  @IsOptional()
  @IsString()
  licenseUrl?: string;

  @ApiProperty({
    description: 'URL del certificado de seguro obligatorio SOAT',
    required: false,
  })
  @IsOptional()
  @IsString()
  soatUrl?: string;

  @ApiProperty({
    description: 'URL de la foto del vehículo',
    required: false,
  })
  @IsOptional()
  @IsString()
  vehiclePhotoUrl?: string;

  @ApiProperty({
    description: 'Firma digital capturada en pantalla (SVG)',
    required: false,
  })
  @IsOptional()
  @IsString()
  contractSignatureSvg?: string;

  @ApiProperty({
    description: 'Fecha y hora de aceptación del contrato',
    required: false,
  })
  @IsOptional()
  contractAcceptedAt?: Date;
}
