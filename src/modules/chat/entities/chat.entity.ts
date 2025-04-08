import { Column, CreateDateColumn, OneToMany, ManyToMany, JoinTable } from "typeorm";
import { PrimaryGeneratedColumn } from "typeorm";
import { Entity } from "typeorm";
import { Message } from "./message.entity";
import { User } from "../../user/entities/user.entity";
import { RoomTypeEnum } from "../enums/type.enum";

@Entity('chat')
export class Chat {
    @PrimaryGeneratedColumn('uuid')
    id: string
    @Column({ default: true })
    isActive: boolean;
    @Column()
    senderId: string;
    @Column()
    receiverId: string;
    @OneToMany(() => Message, msg => msg.chat)
    messages: Message[];

    @CreateDateColumn()
    created_at: Date;
}