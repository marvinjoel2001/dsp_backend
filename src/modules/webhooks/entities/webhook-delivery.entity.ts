import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum WebhookDeliveryStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 64 })
  orderId: string;

  @Column({ type: 'varchar', length: 100 })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ type: 'varchar', length: 255 })
  signature: string;

  @Column({
    type: 'enum',
    enum: WebhookDeliveryStatus,
    default: WebhookDeliveryStatus.PENDING,
  })
  status: WebhookDeliveryStatus;

  @Column({ type: 'int', default: 1 })
  attempts: number;

  @Column({ type: 'int', nullable: true })
  httpStatusCode: number;

  @Column({ type: 'text', nullable: true })
  responseBody: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'timestamptz', nullable: true })
  nextRetryAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
