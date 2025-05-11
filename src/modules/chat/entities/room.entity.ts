import {
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
  ManyToOne,
  JoinColumn,
  Index,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { PrimaryGeneratedColumn } from 'typeorm';
import { Entity } from 'typeorm';
import { Message } from './message.entity';
import { User } from '../../user/entities/user.entity';
import { RoomTypeEnum } from '../enums/type.enum';

@Entity('room')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name: string;
  @Column({ default: true })
  isActive: boolean;
  @Column({ type: 'enum', enum: RoomTypeEnum })
  type: string;
  @ManyToMany(() => User, (user) => user.rooms, { onDelete: 'CASCADE' })
  @JoinTable({
    name: 'chat_participants',
    joinColumn: { name: 'chatId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
  })
  participants: User[];
  @OneToMany(() => Message, (message) => message.room, { cascade: true })
  messages: Message[];
  @CreateDateColumn()
  created_at: Date;
  @UpdateDateColumn()
  updated_at: Date;
  @OneToOne(() => Message)
  @JoinColumn({ name: 'lastMessageId' })
  lastMessage: Message;
}
