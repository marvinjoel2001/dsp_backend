import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('order_status_logs')
export class OrderStatusLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  orderId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  previousStatus: string;

  @Column({ type: 'varchar', length: 50 })
  newStatus: string;

  @Column({ type: 'varchar', length: 50 })
  changedBy: 'DRIVER' | 'MERCHANT' | 'SYSTEM' | 'ADMIN';

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
