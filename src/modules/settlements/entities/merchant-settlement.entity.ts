import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('merchant_settlements')
export class MerchantSettlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amountPaid: number;

  @Column({ type: 'varchar', length: 50, default: 'QR_SIMPLE' })
  method: 'QR_SIMPLE' | 'BANK_TRANSFER' | 'CASH';

  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentReference?: string; // Número de transacción o comprobante

  @Column({ type: 'int', default: 0 })
  ordersCount: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
