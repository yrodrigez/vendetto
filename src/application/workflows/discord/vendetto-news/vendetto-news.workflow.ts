import { LootHistoryRepositoryPort, WeeklyLootEntry, WeeklyRaidReset } from "@/application/ports/outbound/database/loot-history-repository.port";
import { MemberRepositoryPort } from "@/application/ports/outbound/database/member-repository.port";
import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/database/workflow-run-repository.port";
import { WorkflowRepositoryPort } from "@/application/ports/outbound/database/workflow-scheduler-repository.port";
import { DiscordTextChannelPort, DiscordTextMessage } from "@/application/ports/outbound/discord-text-channel.port";
import { NewsDigestGenerationPort } from "@/application/ports/outbound/news-digest-generation.port";
import { Retryable, Schedule, Step, WorkflowName, WorkflowWithSchedule } from "@/application/workflows/workflow";

export type VendettoNewsInput = {
    guildId: string;
    guildName: string;
};

const NEWS_CHANNEL_NAME = 'news';
const VENDETTO_NEWS_CHANNEL_NAME = 'vendetto-news';
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const DISCORD_MESSAGE_LIMIT = 2000;
const REALM_SLUG = 'spineshatter'; // TODO: make realm configurable

@WorkflowName('Vendetto News')
@Schedule('0 18 * * 2', { isRecurring: true }) // every Tuesday at 18:00
export class VendettoNewsWorkflow extends WorkflowWithSchedule<VendettoNewsInput> {
    private since: Date = new Date();
    private until: Date = new Date();
    private raidResets: WeeklyRaidReset[] = [];
    private lootHistory: WeeklyLootEntry[] = [];
    private newsMessages: DiscordTextMessage[] = [];

    constructor(
        private readonly lootHistoryRepository: LootHistoryRepositoryPort,
        private readonly discordChannel: DiscordTextChannelPort,
        private readonly newsDigestGeneration: NewsDigestGenerationPort,
        private readonly membersRepository: MemberRepositoryPort,
        workflowExecutionRepository: WorkflowRunRepositoryPort,
        workflowRepository: WorkflowRepositoryPort,
        context: string,
    ) {
        super(workflowRepository, workflowExecutionRepository, context);
    }

    @Step('fetch-weekly-raid-and-loot-data', 0)
    @Retryable()
    async fetchWeeklyRaidAndLootData() {
        this.until = new Date();
        this.since = new Date(this.until.getTime() - WEEK_IN_MS);

        const [raidResets, lootHistory] = await Promise.all([
            this.lootHistoryRepository.findRaidResetsSince(this.since),
            this.lootHistoryRepository.findLootHistorySince(this.since),
        ]);

        this.raidResets = raidResets;
        this.lootHistory = lootHistory;
    }

    @Step('fetch-weekly-news-messages', 1)
    @Retryable()
    async fetchWeeklyNewsMessages() {
        const newsChannelId = await this.discordChannel.findTextChannelByName(this.input.guildId, NEWS_CHANNEL_NAME);
        if (!newsChannelId) {
            console.warn(`Channel "${NEWS_CHANNEL_NAME}" not found for guild ${this.input.guildId}. Vendetto News will continue without external news.`);
            this.newsMessages = [];
            return;
        }

        this.newsMessages = await this.discordChannel.findRecentMessages(newsChannelId, this.since);
    }

    @Step('generate-news-digest', 2)
    @Retryable()
    async generateNewsDigest() {
        if (!this.hasWeeklyData()) {
            console.log('No weekly raid, loot, or news data found. Skipping Vendetto News digest.');
            return;
        }

        const message = await this.newsDigestGeneration.generateDigest({
            guildName: this.input.guildName,
            since: this.since,
            until: this.until,
            raidResets: this.raidResets,
            lootHistory: this.lootHistory,
            newsMessages: this.newsMessages,
        });

        if (!message) {
            console.warn('Vendetto News digest generation returned no content. Skipping Discord message.');
        }

        return message;
    }

    @Step('replace-names-with-ids', 3)
    @Retryable()
    async replaceNamesWithIds(message: string | null) {
        if (!message) return null;
        const names = Array.from(new Set([...message.matchAll(/@(\w+)/g)].map(m => m[1])));
        const members = await this.membersRepository.findDiscordIdsByCharacterNames(names, REALM_SLUG); // TODO: make realm configurable

        for (const member of members) {
            const mention = `@${member.character.name}`;
            const discordMention = `<@${member.discordId}>`;
            message = message.split(mention).join(discordMention);
        }
        
        return message;
    }

    @Step('publish-news-digest', 4)
    @Retryable()
    async publishNewsDigest(message: string | null) {
        if (!message) return;

        const targetChannelId = await this.discordChannel.findTextChannelByName(this.input.guildId, VENDETTO_NEWS_CHANNEL_NAME);
        if (!targetChannelId) {
            console.warn(`Channel "${VENDETTO_NEWS_CHANNEL_NAME}" not found for guild ${this.input.guildId}. Skipping Vendetto News post.`);
            return;
        }

        if (message.length <= DISCORD_MESSAGE_LIMIT) {
            await this.discordChannel.sendMessage(targetChannelId, this.toDiscordMessage(message));
        } else {
            console.warn('Generated Vendetto News digest exceeds Discord message limit. Sending truncated version.');
            for (let i = 0; i < message.length; i += DISCORD_MESSAGE_LIMIT) {
                const chunk = message.slice(i, i + DISCORD_MESSAGE_LIMIT);
                await this.discordChannel.sendMessage(targetChannelId, this.toDiscordMessage(chunk));
            }
        }

    }

    private hasWeeklyData(): boolean {
        return this.raidResets.length > 0 || this.lootHistory.length > 0 || this.newsMessages.length > 0;
    }

    private toDiscordMessage(content: string): string {
        if (content.length <= DISCORD_MESSAGE_LIMIT) return content;

        return `${content.slice(0, DISCORD_MESSAGE_LIMIT).trim()}`;
    }
}
