import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dsp_partners')
export class DspPartner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string; // Ej: "Asociación Motos Los Rápidos"

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string; // Ej: "DSP-RAPIDOS"

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  contactName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contactPhone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  city: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  payoutPerOrder: number; // Tarifa pactada por entrega para la asociación

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
