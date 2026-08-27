import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
}

@Entity('driver_withdrawals')
export class DriverWithdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  driverId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 50, default: 'BANK_TRANSFER' })
  method: 'BANK_TRANSFER' | 'QR_PAYMENT';

  @Column({ type: 'varchar', length: 255 })
  accountHolder: string;

  @Column({ type: 'varchar', length: 255 })
  accountNumberOrPhone: string;

  @Column({ type: 'text', nullable: true })
  qrPhotoUrl?: string;

  @Column({
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PENDING,
  })
  status: WithdrawalStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentReference?: string;

  @Column({ type: 'text', nullable: true })
  adminNotes?: string;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
