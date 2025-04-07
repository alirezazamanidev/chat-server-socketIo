import { User } from "src/modules/user/entities/user.entity";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";


@Entity('connectedUser')
export class ConnectedUser {
    @Column()
    userId:string
    @Column()
    socketId:string
    @ManyToOne(() => User, (user) => user.connectedUsers)
    @JoinColumn([{ name: 'userId', referencedColumnName: 'id' }])
    user: User;
}