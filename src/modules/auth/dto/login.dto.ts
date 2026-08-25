import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Correo electrónico registrado del usuario o conductor',
    example: 'alex.courier@fooddrive.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Contraseña de acceso (mínimo 6 caracteres)',
    example: 'password123',
  })
  @IsString()
  @MinLength(6)
  password: string;
}
