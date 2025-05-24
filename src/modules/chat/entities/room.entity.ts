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
import { User } from 'src/modules/user/entities/user.entity';

@Entity('room')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ default: true })
  isActive: boolean;
  @Column()
  senderId:string
  @Column()
  receiverId:string
  @OneToMany(() => Message, (message) => message.room, { cascade: true })
  messages: Message[];
  @CreateDateColumn()
  created_at: Date;
  @UpdateDateColumn()
  updated_at: Date;
  @OneToOne(() => Message)
  @JoinColumn({ name: 'lastMessageId' })
  lastMessage: Message;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'receiverId' })
  receiver: User;
}
