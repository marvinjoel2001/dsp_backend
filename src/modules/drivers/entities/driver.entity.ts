import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum VehicleType {
  MOTORCYCLE = 'MOTORCYCLE',
  BICYCLE = 'BICYCLE',
  CAR = 'CAR',
}

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password?: string;

  @Column({
    type: 'enum',
    enum: VehicleType,
    default: VehicleType.MOTORCYCLE,
  })
  vehicleType: VehicleType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  vehiclePlate: string;

  @Column({ type: 'boolean', default: false })
  isOnline: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 5.0 })
  rating: number;

  @Column({ type: 'double precision', nullable: true })
  currentLat: number;

  @Column({ type: 'double precision', nullable: true })
  currentLng: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  walletBalance: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
