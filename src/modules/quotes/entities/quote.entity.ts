import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('quotes')
@Index(['tenantId', 'createdAt'])
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'text' })
  pickupAddress: string;

  @Column({ type: 'double precision' })
  pickupLat: number;

  @Column({ type: 'double precision' })
  pickupLng: number;

  @Column({ type: 'text' })
  dropoffAddress: string;

  @Column({ type: 'double precision' })
  dropoffLat: number;

  @Column({ type: 'double precision' })
  dropoffLng: number;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  distanceKm: number;

  @Column({ type: 'int' })
  durationMinutes: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  basePrice: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 1.0 })
  surgeMultiplier: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  driverPayout: number;

  @Column({ type: 'varchar', length: 10, default: 'BOB' })
  currency: string;

  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
