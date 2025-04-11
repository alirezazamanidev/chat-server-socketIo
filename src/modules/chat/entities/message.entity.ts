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
    
    @ManyToOne(()=>User,{onDelete:'CASCADE'})
    sender:User

    @Column()
    roomId: string;

    @Column({ default: false })
    isRead: boolean;
    @CreateDateColumn()
    created_at: Date;
}