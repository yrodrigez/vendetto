import { DiscordChannelPort } from "@/application/ports/outbound/discord-channel.port";
import { ResetChannelRepositoryPort } from "@/application/ports/outbound/reset-channel-repository.port";
import { createServerComponentClient } from "@/supabase";
import { DatabaseClient } from "@/infrastructure/database/db";

export class ResetMessagesRealtimeSubscription {
    constructor(
        private readonly discordChannel: DiscordChannelPort,
        private readonly resetChannelRepository: ResetChannelRepositoryPort,
        private readonly databaseClient: DatabaseClient,
    ) { }

    subscribe(): void {
        const supabase = createServerComponentClient();

        supabase
            .channel('reset-messages-inserts')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'reset_messages' },
                async (payload) => {
                    try {
                        const { id } = payload.new as { id: number };

                        const row = await this.fetchMessage(id);
                        if (!row || row.source !== 'web') return;

                        const channelMapping = await this.resetChannelRepository.findByResetId(row.reset_id);
                        if (!channelMapping) return;

                        const characterName = await this.resolveCharacterName(row.character_id);
                        const displayName = characterName ?? `Member #${row.character_id}`;

                        await this.discordChannel.sendMessage(
                            channelMapping.channelId,
                            `**${displayName}** said: "${row.content}"`,
                        );
                    } catch (error) {
                        console.error('Failed to relay reset message to Discord:', error);
                    }
                },
            )
            .subscribe();

        console.log('Subscribed to reset_messages realtime inserts');
    }

    private async fetchMessage(id: number): Promise<{
        reset_id: string;
        character_id: number;
        content: string;
        source: string;
    } | null> {
        const query = `SELECT reset_id, character_id, content, source FROM public.reset_messages WHERE id = $1`;
        const results = await this.databaseClient.query<{
            reset_id: string;
            character_id: number;
            content: string;
            source: string;
        }>(query, [id]);
        return results.length > 0 ? results[0] : null;
    }

    private async resolveCharacterName(characterId: number): Promise<string | null> {
        const query = `SELECT character->>'name' AS name FROM public.ev_member WHERE id = $1`;
        const results = await this.databaseClient.query<{ name: string }>(query, [characterId]);
        return results.length > 0 ? results[0].name : null;
    }
}
