import { Column, CreateDateColumn, OneToMany, ManyToMany, JoinTable } from "typeorm";
import { PrimaryGeneratedColumn } from "typeorm";
import { Entity } from "typeorm";
import { Message } from "./message.entity";
import { User } from "../../user/entities/user.entity";
import { ChatType } from "../enums/type.enum";

@Entity('chat')
export class Chat {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ unique: true })
    key: string;

    @ManyToMany(() => User)
    @JoinTable({
        name: 'chat_participants',
        joinColumn: { name: 'chat_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' }
    })
    participants: User[];

    @Column({ default: true })
    isActive: boolean;
    @Column({ type: 'enum', enum: ChatType, default: ChatType.PRIVATE })
    type: ChatType;

    @OneToMany(() => Message, msg => msg.chat)
    messages: Message[];

    @CreateDateColumn()
    created_at: Date;
}