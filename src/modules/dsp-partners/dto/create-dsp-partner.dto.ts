import { IsString, IsNotEmpty, IsEmail, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDspPartnerDto {
  @ApiProperty({ example: 'Asociación Motos Los Rápidos', description: 'Nombre de la asociación de motos o empresa DSP' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'DSP-RAPIDOS', description: 'Código único identificador' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'admin@losrapidos.com', description: 'Correo electrónico para acceso al panel admin' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '123456', description: 'Contraseña para acceder al panel admin' })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: 'Carlos Mendoza', description: 'Nombre del representante o contacto' })
  @IsString()
  @IsOptional()
  contactName?: string;

  @ApiPropertyOptional({ example: '+591 70012345', description: 'Teléfono de contacto o soporte' })
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'Santa Cruz', description: 'Ciudad o zona de cobertura' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 4.5, description: 'Tarifa acordada a pagar a la asociación por entrega' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  payoutPerOrder?: number;
}
