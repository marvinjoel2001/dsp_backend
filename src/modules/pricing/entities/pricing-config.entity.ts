import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DspPartner } from '../../dsp-partners/entities/dsp-partner.entity';

export interface DistanceBracket {
  fromKm: number;
  toKm: number;
  price: number;
  driverPayout: number;
}

@Entity('pricing_configs')
export class PricingConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  dspPartnerId?: string; // null = Flota General / Super Admin

  @ManyToOne(() => DspPartner, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dspPartnerId' })
  dspPartner?: DspPartner;

  @Column({ type: 'varchar', length: 30, default: 'MOTORCYCLE' })
  vehicleType: string; // 'MOTORCYCLE' | 'BICYCLE' | 'CAR' | 'ALL'

  @Column({ type: 'varchar', length: 150 })
  name: string; // Ej: "Tarifario Urbano Motos 2026"

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 5.0 })
  baseFare: number; // Tarifa base de arranque en Bs.

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 2.0 })
  baseDistanceKm: number; // Distancia incluida en la tarifa base (ej: 2 km)

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 2.5 })
  perKmBeyondBase: number; // Costo por km adicional cuando se supera el último tramo

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.3 })
  perMinuteRate: number; // Costo por minuto estimado de trayecto

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 80.0 })
  driverPayoutPercentage: number; // Porcentaje por defecto al chofer (ej: 80%)

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 8.0 })
  minPrice: number; // Precio mínimo de carrera

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxPrice?: number; // Precio tope opcional

  @Column({ type: 'jsonb', default: '[]' })
  brackets: DistanceBracket[]; // [{ fromKm: 0, toKm: 2, price: 10, driverPayout: 8 }, ...]

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
