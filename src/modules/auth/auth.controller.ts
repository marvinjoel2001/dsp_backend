import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDriverDto } from './dto/register.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Auth (Autenticación)')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Inicio de sesión para Administradores y Conductores',
    description: 'Valida credenciales y genera un Token JWT (Bearer) para consumir las APIs protegidas.',
  })
  @ApiResponse({ status: 200, description: 'Autenticación exitosa. Retorna el token JWT y datos de perfil.' })
  @ApiResponse({ status: 401, description: 'Correo o contraseña incorrectos.' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register-driver')
  @ApiOperation({
    summary: 'Registro y onboarding de un nuevo conductor / repartidor',
    description: 'Registra al repartidor en la base de datos y le expide automáticamente su primer token JWT.',
  })
  @ApiResponse({ status: 201, description: 'Conductor registrado exitosamente.' })
  @ApiResponse({ status: 409, description: 'Ya existe un conductor con ese correo o número telefónico.' })
  async registerDriver(@Body() dto: RegisterDriverDto) {
    return this.authService.registerDriver(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Consultar información del usuario autenticado actual',
    description: 'Obtiene el perfil decodificado a partir del Bearer Token enviado en el header Authorization.',
  })
  @ApiResponse({ status: 200, description: 'Información del usuario autenticado.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente o expirado.' })
  async getMe(@CurrentUser() user: any) {
    return user;
  }
}
