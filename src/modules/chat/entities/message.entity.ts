import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Chat } from "./chat.entity";
import { User } from "src/modules/user/entities/user.entity";

@Entity('message')
export class Message {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    text: string;

    @Column({ nullable: true })
    senderId: string;
    @ManyToOne(() => Chat,chat=>chat.messages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'chatId' })
    chat: Chat;
    @ManyToOne(()=>User,{onDelete:'CASCADE'})
    sender:User

    @Column()
    chatId: string;

    @Column({ default: false })
    isRead: boolean;
    @CreateDateColumn()
    created_at: Date;
}