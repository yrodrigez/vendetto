import { ResetChannelRepositoryPort } from "@/application/ports/outbound/reset-channel-repository.port";
import { ResetMessagesRepositoryPort } from "@/application/ports/outbound/reset-messages-repository.port";
import { DatabaseClient } from "@/infrastructure/database/db";
import { DiscordEvent } from "./event.interface";
import { ClientEvents, Events, Message } from "discord.js";

export class ResetChannelMessageEvent implements DiscordEvent {
    public readonly name: keyof ClientEvents = Events.MessageCreate;

    constructor(
        private readonly resetChannelRepository: ResetChannelRepositoryPort,
        private readonly resetMessagesRepository: ResetMessagesRepositoryPort,
        private readonly databaseClient: DatabaseClient,
    ) { }

    async execute(message: Message): Promise<void> {
        if (message.author.bot) return;

        const channelMapping = await this.resetChannelRepository.findByChannelId(message.channel.id);
        if (!channelMapping) return;

        const member = await this.findSelectedMember(message.author.id);
        if (!member) return;

        await this.resetMessagesRepository.insert({
            resetId: channelMapping.resetId,
            characterId: member.id,
            content: message.content,
            source: 'discord',
        });
    }

    private async findSelectedMember(discordUserId: string): Promise<{ id: number } | null> {
        const query = `
            SELECT m.id
            FROM ev_auth.oauth_providers p
            JOIN public.ev_member m ON m.user_id = p.user_id AND m.is_selected = true
            WHERE p.provider_user_id = $1
              AND p.provider LIKE '%discord%'
            LIMIT 1
        `;
        const results = await this.databaseClient.query<{ id: number }>(query, [discordUserId]);
        return results.length > 0 ? results[0] : null;
    }
}
