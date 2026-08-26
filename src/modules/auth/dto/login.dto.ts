import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Nombre de usuario o correo electrónico',
    example: 'admin',
  })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Contraseña de acceso',
    example: 'admin',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
