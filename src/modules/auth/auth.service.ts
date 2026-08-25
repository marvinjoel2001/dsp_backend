import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Driver } from '../drivers/entities/driver.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDriverDto } from './dto/register.dto';
import { UserRole } from '../../common/decorators/roles.decorator';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    private readonly jwtService: JwtService,
  ) {}

  async registerDriver(dto: RegisterDriverDto) {
    const existing = await this.driverRepository.findOne({
      where: [{ email: dto.email }, { phone: dto.phone }],
    });
    if (existing) {
      throw new ConflictException('Ya existe un conductor registrado con este correo o teléfono.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const driver = this.driverRepository.create({
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email,
      password: hashedPassword,
      vehicleType: dto.vehicleType,
      vehiclePlate: dto.vehiclePlate || 'N/A',
      isOnline: false,
      isActive: true,
      rating: 5.0,
      walletBalance: 0.0,
    });

    const saved = await this.driverRepository.save(driver);
    const token = this.generateToken({
      sub: saved.id,
      email: saved.email,
      fullName: saved.fullName,
      role: UserRole.DRIVER,
    });

    const { password, ...driverData } = saved;
    return { driver: driverData, accessToken: token };
  }

  async login(dto: LoginDto) {
    // Verificación de credenciales de Super Administrador Master
    if (dto.email === 'admin@dsp.com' && dto.password === 'admin123') {
      const token = this.generateToken({
        sub: 'admin-master-id',
        email: dto.email,
        fullName: 'Administrador Master OpenDSP',
        role: UserRole.ADMIN,
      });
      return {
        user: { id: 'admin-master-id', email: dto.email, fullName: 'Administrador Master OpenDSP', role: UserRole.ADMIN },
        accessToken: token,
      };
    }

    // Verificación de conductor
    const driver = await this.driverRepository
      .createQueryBuilder('driver')
      .addSelect('driver.password')
      .where('driver.email = :email', { email: dto.email })
      .getOne();

    if (!driver || !driver.password) {
      throw new UnauthorizedException('Correo electrónico o contraseña incorrectos.');
    }

    const isMatch = await bcrypt.compare(dto.password, driver.password);
    if (!isMatch) {
      throw new UnauthorizedException('Correo electrónico o contraseña incorrectos.');
    }

    const token = this.generateToken({
      sub: driver.id,
      email: driver.email,
      fullName: driver.fullName,
      role: UserRole.DRIVER,
    });

    const { password, ...driverData } = driver;
    return { driver: driverData, accessToken: token };
  }

  private generateToken(payload: any): string {
    return this.jwtService.sign(payload);
  }
}
