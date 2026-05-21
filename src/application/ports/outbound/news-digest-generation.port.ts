import { DiscordTextMessage } from "@/application/ports/outbound/discord-text-channel.port";
import { WeeklyLootEntry, WeeklyRaidReset } from "@/application/ports/outbound/database/loot-history-repository.port";

export type NewsDigestInput = {
    guildName: string;
    since: Date;
    until: Date;
    raidResets: WeeklyRaidReset[];
    lootHistory: WeeklyLootEntry[];
    newsMessages: DiscordTextMessage[];
};

export interface NewsDigestGenerationPort {
    generateDigest(input: NewsDigestInput): Promise<string | null>;
}
