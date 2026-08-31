import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OrderStatus {
  CREATED = 'CREATED',
  SEARCHING_DRIVER = 'SEARCHING_DRIVER',
  ASSIGNED = 'ASSIGNED',
  ARRIVED_AT_PICKUP = 'ARRIVED_AT_PICKUP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

@Entity('delivery_orders')
export class DeliveryOrder {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string; // e.g. ord_8f912a7b

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  driverId: string;

  @Column({ type: 'uuid', nullable: true })
  quoteId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  merchantReference: string;

  @Column({ type: 'uuid', nullable: true })
  delegatedDspId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  dspStatus?: string; // 'OFFERED' | 'ACCEPTED' | 'ASSIGNED' | 'REJECTED'

  @Column({ type: 'varchar', length: 30, default: 'MOTORCYCLE', nullable: true })
  vehicleType?: string; // 'MOTORCYCLE' | 'BICYCLE' | 'CAR'

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  dspPayout?: number;

  @Column({ type: 'timestamptz', nullable: true })
  delegatedAt?: Date;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.CREATED,
  })
  status: OrderStatus;

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

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  driverPayout: number;

  @Column({ type: 'text', nullable: true })
  packageNotes: string;

  @Column({ type: 'varchar', length: 64 })
  trackingToken: string;

  @Column({ type: 'text', nullable: true })
  proofPhotoUrl: string;

  @Column({ type: 'text', nullable: true })
  signatureSvg: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
