import { Message } from "../../../domain/delivery/models";

export interface IMessageSenderPort {
    send(discordId: string, message: Message): Promise<void>;
    getUserData(discordId: string): Promise<Record<string, any> | null>;
}
