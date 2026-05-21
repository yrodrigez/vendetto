import {
    NewsDigestGenerationPort,
    NewsDigestInput
} from "@/application/ports/outbound/news-digest-generation.port";
import { getEnvironment } from "@/infrastructure/environment";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import moment from "moment";
import { readResourceFile } from "@/util/file-resource-helper";
import Mustache from "mustache";


type VercelAiProvider = 'ollama' | 'openai' | 'anthropic';

export class VercelAiNewsDigestGenerationAdapter implements NewsDigestGenerationPort {
    private readonly provider: VercelAiProvider;
    private ollamaBaseUrl: string;
    private ollamaModel: string;
    private anthropicModel: string;
    private openaiModel: string;
    private anthropicApiKey: string;
    private openaiApiKey: string;
    constructor() {
        const env = getEnvironment();
        this.provider = env.selectedAIProvider as VercelAiProvider;
        this.ollamaBaseUrl = env.aiProviders.ollama.baseUrl;
        this.ollamaModel = env.aiProviders.ollama.model;
        this.anthropicModel = env.aiProviders.anthropic.model;
        this.openaiModel = env.aiProviders.openai.model;
        this.anthropicApiKey = env.aiProviders.anthropic.apiKey;
        this.openaiApiKey = env.aiProviders.openai.apiKey;
    }
    async generateDigest(input: NewsDigestInput): Promise<string | null> {
        try {
            const result = await generateText({
                model: this.createModel(),
                system: this.buildSystemPrompt(),
                prompt: this.buildUserPrompt(input),
                temperature: 0.8,
                maxOutputTokens: 1200,
            });

            return result.text.trim() || null;
        } catch (error: any) {
            console.error(`Vercel AI news digest generation failed: ${error.message ?? String(error)}`);
            return null;
        }
    }

    private createModel() {
        const provider = this.getProvider();

        if (provider === 'openai') {
            const openai = createOpenAI({ apiKey: this.openaiApiKey });
            return openai(this.openaiModel);
        }

        if (provider === 'anthropic') {
            const anthropic = createAnthropic({ apiKey: this.anthropicApiKey });
            return anthropic(this.anthropicModel);
        }

        const ollama = createOpenAICompatible({
            name: 'ollama',
            baseURL: this.toOpenAiCompatibleBaseUrl(this.ollamaBaseUrl),
        });
        return ollama(this.ollamaModel);
    }

    private getProvider(): VercelAiProvider {
        return this.provider
    }

    private toOpenAiCompatibleBaseUrl(baseUrl: string): string {
        const normalized = baseUrl.replace(/\/+$/, '');
        return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`;
    }

    private buildSystemPrompt(): string {
        return readResourceFile(__dirname, './prompts/vendetto-news.system-prompt.md');
    }

    private buildUserPrompt(input: NewsDigestInput): string {
        const text = readResourceFile(__dirname, './prompts/vendetto-news.user-prompt.md');
        return Mustache.render(text, {
            guildName: input.guildName,
            since: moment(input.since).format('YYYY-MM-DD'),
            to: moment(input.until).format('YYYY-MM-DD'),
            resetsData: this.formatRaidResets(input),
            lootData: this.formatLoot(input),
            newsData: this.formatNews(input),
        }).trim();
    }

    private formatRaidResets(input: NewsDigestInput): string {
        if (!input.raidResets.length) return 'None.';

        return input.raidResets
            .map(reset => `- ${reset.raidName} at ${moment(reset.raidDatetime).calendar()} loot history link: https://www.everlastingvendetta.com/raid/${reset.resetId}/loot`)
            .join('\n');
    }

    private formatLoot(input: NewsDigestInput): string {
        if (!input.lootHistory.length) return ''

        const totalItems = input.lootHistory.length

        const byRaid = new Map<string, number>()
        const byCharacter = new Map<string, number>()

        for (const loot of input.lootHistory) {
            byRaid.set(loot.raidName, (byRaid.get(loot.raidName) ?? 0) + 1)
            byCharacter.set(loot.characterName, (byCharacter.get(loot.characterName) ?? 0) + 1)
        }

        const topCharacters = [...byCharacter.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([characterName, count]) => `- ${characterName}: ${count} item${count === 1 ? '' : 's'}`)
            .join('\n')

        const raidSummary = [...byRaid.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([raidName, count]) => `- ${raidName}: ${count} item${count === 1 ? '' : 's'}`)
            .join('\n')

        const notableItems = input.lootHistory
            .filter(loot =>
                /tsunami|world breaker|serpent-coil|talon|vanquished|pattern|plans|belt|boots|helm|leggings/i.test(loot.itemName)
            )
            .slice(0, 10)
            .map(loot => `- ${loot.itemName} (${loot.characterName}, ${loot.raidName})`)
            .join('\n')

        return [
            'Loot summary data:',
            `Total loot entries: ${totalItems}`,
            '',
            'Loot by raid:',
            raidSummary,
            '',
            'Top loot receivers:',
            topCharacters,
            '',
            'Possible notable loot highlights:',
            notableItems || '- No obvious highlights detected.',
            '',
            'Instruction: summarize this loot. Do not list every item. Mention that the full loot list is available on the site.'
        ].join('\n')
    }

    private formatNews(input: NewsDigestInput): string {
        return ''
        if (!input.newsMessages.length) return 'None.';

        return input.newsMessages
            .map(message => [
                `- ${moment(message.createdAt).format('dddd')} by ${message.authorName}`,
                `  ${message.content.replace(/\s+/g, ' ').trim()}`,
                `  ${message.url}`,
            ].join('\n'))
            .join('\n');
    }
}
