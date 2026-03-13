import { Client, User } from "discord.js";
import { IMessageSenderPort } from "@/application/ports/delivery/IMessageSenderPort";
import { Message } from "@/domain/delivery/models";
import { getDiscordClient } from "./discord-api.adapter";

export class DiscordDeliveryAdapter implements IMessageSenderPort {
    private userCache = new Map<string, User>();


    async getUserData(discordId: string): Promise<Record<string, any> | null> {
        const client = await getDiscordClient();
        if (this.userCache.has(discordId)) {
            return this.userCache.get(discordId) as unknown as Record<string, any>;
        }

        try {
            const user = await client.users.fetch(discordId);
            this.userCache.set(discordId, user);
            return user as unknown as Record<string, any>;
        } catch (e) {
            console.error('Error fetching user: ', e);
            return null;
        }
    }

    async send(discordId: string, message: Message): Promise<void> {
        // Fetch or get from cache
        let user = this.userCache.get(discordId);

        if (!user) {
            const client = await getDiscordClient();
            user = await client.users.fetch(discordId).catch(() => undefined);
        }

        if (!user) {
            throw new Error(`User ${discordId} not found`);
        }

        const { content, embeds } = message;
        await user.send({
            content,
            embeds: embeds?.length ? embeds : undefined
        });
    }
}
