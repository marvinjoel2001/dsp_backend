import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { DspPartner } from './entities/dsp-partner.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { DeliveryOrder, OrderStatus } from '../orders/entities/order.entity';
import { CreateDspPartnerDto } from './dto/create-dsp-partner.dto';
import { UpdateDspPartnerDto } from './dto/update-dsp-partner.dto';

@Injectable()
export class DspPartnersService {
  constructor(
    @InjectRepository(DspPartner)
    private readonly dspPartnerRepo: Repository<DspPartner>,
    @InjectRepository(Driver)
    private readonly driverRepo: Repository<Driver>,
    @InjectRepository(DeliveryOrder)
    private readonly orderRepo: Repository<DeliveryOrder>,
  ) {}

  async findAll() {
    const partners = await this.dspPartnerRepo.find({
      order: { createdAt: 'DESC' },
    });

    // Enriquecer con conteo de motorizados y órdenes
    const enriched = await Promise.all(
      partners.map(async (partner) => {
        const driversCount = await this.driverRepo.count({
          where: { dspPartnerId: partner.id },
        });
        const ordersCount = await this.orderRepo.count({
          where: { delegatedDspId: partner.id },
        });
        return {
          ...partner,
          driversCount,
          ordersCount,
        };
      }),
    );

    return enriched;
  }

  async findById(id: string) {
    const partner = await this.dspPartnerRepo.findOne({ where: { id } });
    if (!partner) throw new NotFoundException('Asociación o DSP no encontrado');
    return partner;
  }

  async create(dto: CreateDspPartnerDto) {
    const existing = await this.dspPartnerRepo.findOne({
      where: [{ email: dto.email.toLowerCase().trim() }, { code: dto.code.toUpperCase().trim() }],
    });
    if (existing) {
      throw new ConflictException('Ya existe un DSP o Asociación con este correo o código.');
    }

    const hashedPassword = await bcrypt.hash(dto.password || '123456', 10);

    const partner = this.dspPartnerRepo.create({
      name: dto.name.trim(),
      code: dto.code.toUpperCase().trim(),
      email: dto.email.toLowerCase().trim(),
      password: hashedPassword,
      contactName: dto.contactName,
      contactPhone: dto.contactPhone,
      city: dto.city || 'Santa Cruz',
      payoutPerOrder: dto.payoutPerOrder || 4.5,
      isActive: true,
    });

    const saved = await this.dspPartnerRepo.save(partner);
    const { password, ...data } = saved;
    return data;
  }

  async update(id: string, dto: UpdateDspPartnerDto) {
    const partner = await this.findById(id);

    if (dto.name) partner.name = dto.name.trim();
    if (dto.code) partner.code = dto.code.toUpperCase().trim();
    if (dto.email) partner.email = dto.email.toLowerCase().trim();
    if (dto.contactName !== undefined) partner.contactName = dto.contactName;
    if (dto.contactPhone !== undefined) partner.contactPhone = dto.contactPhone;
    if (dto.city !== undefined) partner.city = dto.city;
    if (dto.payoutPerOrder !== undefined) partner.payoutPerOrder = dto.payoutPerOrder;
    if (dto.password) {
      partner.password = await bcrypt.hash(dto.password, 10);
    }

    const saved = await this.dspPartnerRepo.save(partner);
    const { password, ...data } = saved;
    return data;
  }

  async toggleActive(id: string) {
    const partner = await this.findById(id);
    partner.isActive = !partner.isActive;
    return this.dspPartnerRepo.save(partner);
  }

  async getDriversByDsp(dspPartnerId: string) {
    return this.driverRepo.find({
      where: { dspPartnerId },
      order: { isOnline: 'DESC', createdAt: 'DESC' },
    });
  }

  async getOrdersByDsp(dspPartnerId: string, status?: OrderStatus) {
    const query = this.orderRepo
      .createQueryBuilder('order')
      .where('order.delegatedDspId = :dspPartnerId', { dspPartnerId })
      .orderBy('order.createdAt', 'DESC');

    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    return query.getMany();
  }

  async getMetrics(dspPartnerId: string) {
    const totalDrivers = await this.driverRepo.count({
      where: { dspPartnerId },
    });
    const onlineDrivers = await this.driverRepo.count({
      where: { dspPartnerId, isOnline: true },
    });
    const totalOrders = await this.orderRepo.count({
      where: { delegatedDspId: dspPartnerId },
    });
    const deliveredOrders = await this.orderRepo.count({
      where: { delegatedDspId: dspPartnerId, status: OrderStatus.DELIVERED },
    });
    const inProgressOrders = await this.orderRepo.count({
      where: [
        { delegatedDspId: dspPartnerId, status: OrderStatus.ASSIGNED },
        { delegatedDspId: dspPartnerId, status: OrderStatus.IN_TRANSIT },
        { delegatedDspId: dspPartnerId, status: OrderStatus.ARRIVED_AT_PICKUP },
      ],
    });

    const partner = await this.findById(dspPartnerId);
    const accumulatedPayout = deliveredOrders * Number(partner.payoutPerOrder || 4.5);

    return {
      partner,
      totalDrivers,
      onlineDrivers,
      totalOrders,
      deliveredOrders,
      inProgressOrders,
      accumulatedPayout,
    };
  }
}
