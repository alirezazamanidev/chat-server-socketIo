import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";

import { User } from "src/modules/user/entities/user.entity";
import { Room } from "./room.entity";

@Entity('message')
export class Message {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    text: string;
    @Column({ nullable: true })
    senderId: string;
    @ManyToOne(() => Room,chat=>chat.messages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'roomId' })
    room:Room;
    
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'senderId' }) 
    sender: User;
    
    @Column()
    roomId: string;

    @Column({ default: false })
    isRead: boolean;
    @CreateDateColumn({
        type: "timestamp",
        transformer: {
          from: (value: Date) => value,
          to: () => new Date().toUTCString(),
        },
      })
      created_at: Date;
}