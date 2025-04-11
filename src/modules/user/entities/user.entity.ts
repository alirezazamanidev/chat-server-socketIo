
import { Room } from "src/modules/chat/entities/room.entity";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToMany } from "typeorm";

@Entity('user')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'full_name', type: 'varchar', length: 100 })
    fullName: string;

    @Column({ unique: true, type: 'varchar', length: 50 })
    username: string;
    @Column({})
    avatar:string

    @Column({ name: 'hash_password', type: 'varchar' })
    hashPassword: string;
    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at: Date;
    
    @ManyToMany(() => Room, (room) => room.participants)
    rooms:Room[];
}