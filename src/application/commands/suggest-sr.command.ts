import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { DiscordCommand } from "../../infrastructure/discord/commands/command.interface";
import { SuggestSrRepository, UnreceivedItem } from "../../infrastructure/persistance/repositories/suggest-sr/suggest-sr.repository";
import { OllamaService } from "../../infrastructure/ollama.service";
import { BisSearchService } from "../../infrastructure/bis-search.service";
import { CLASS_COLORS, CLASS_ARMOR, ROLE_PRIMARY_STATS, NEGATIVE_STATS } from "./suggest-sr.config";

interface SuggestionContext {
    className: string;
    role: string;
    bisItemNames: string[];
    bisContext: string;
    statPriority: string;
}

export class SuggestSrCommand implements DiscordCommand {
    public data = new SlashCommandBuilder()
        .setName('suggest-sr')
        .setDescription('Get AI-powered soft reserve suggestions based on your loot history');

    constructor(
        private readonly suggestSrRepository: SuggestSrRepository,
        private readonly ollamaService: OllamaService,
        private readonly bisSearchService: BisSearchService,
    ) {}

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const member = await this.suggestSrRepository.getMemberByDiscordId(interaction.user.id);
        if (!member) {
            await interaction.editReply({ content: 'Could not find your linked character. Make sure you have a selected character in the webapp.' });
            return;
        }

        const roleInfo = await this.suggestSrRepository.getMemberRoleInfo(member.memberId);
        if (!roleInfo) {
            await interaction.editReply({ content: 'Could not find your raid role info. Make sure you have signed up for at least one raid.' });
            return;
        }

        const allItems = await this.suggestSrRepository.getUnreceivedItems(member.characterName);
        if (allItems.length === 0) {
            await interaction.editReply({ content: `**${member.characterName}** has received all available raid items. Nothing left to reserve!` });
            return;
        }

        const context = this.buildSuggestionContext(roleInfo.className, roleInfo.role, parseInt(process.env.TBC_CURRENT_PHASE || '5', 10));
        const relevantItems = this.filterRelevantItems(allItems, context);
        const rankedItems = this.rankByScore(relevantItems.length > 0 ? relevantItems : allItems, context);
        const topPicks = rankedItems.slice(0, 3);

        const aiExplanation = await this.getAiStrategy(context);
        const embed = this.buildEmbed(member.characterName, roleInfo, rankedItems, topPicks, aiExplanation);
        await interaction.editReply({ embeds: [embed] });
    }

    private buildSuggestionContext(className: string, role: string, phase: number): SuggestionContext {
        let bisItemNames: string[] = [];
        let bisContext = '';
        let statPriority = '';

        try {
            const searchResult = this.bisSearchService.search(className, role, phase);
            bisContext = searchResult.bisContext;
            statPriority = searchResult.statPriority;
            bisItemNames = this.extractBisItemNames(bisContext);
        } catch {
            // BIS search is optional
        }

        return { className, role, bisItemNames, bisContext, statPriority };
    }

    private extractBisItemNames(bisContext: string): string[] {
        if (!bisContext) return [];
        return bisContext.split('\n')
            .map(line => line.match(/^-\s*\w+:\s*(.+)$/))
            .filter((match): match is RegExpMatchArray => match !== null)
            .map(match => match[1].trim().toLowerCase());
    }

    // --- Filtering ---

    private filterRelevantItems(items: UnreceivedItem[], context: SuggestionContext): UnreceivedItem[] {
        return items.filter(item =>
            this.matchesClassRestriction(item, context.className)
            && this.isEquippableArmor(item, context.className)
            && this.hasRelevantStats(item, context)
        );
    }

    private matchesClassRestriction(item: UnreceivedItem, className: string): boolean {
        if (!item.parsedStats.classes?.length) return true;
        return item.parsedStats.classes.some(c => c.toLowerCase().includes(className.toLowerCase()));
    }

    private isEquippableArmor(item: UnreceivedItem, className: string): boolean {
        if (item.itemClass !== 'Armor' || item.itemSubclass === 'Miscellaneous') return true;
        const allowedArmor = CLASS_ARMOR[className.toLowerCase()] || [];
        return allowedArmor.length === 0 || allowedArmor.includes(item.itemSubclass);
    }

    private hasRelevantStats(item: UnreceivedItem, context: SuggestionContext): boolean {
        if (item.itemClass === 'Weapon' || item.itemSubclass === 'Miscellaneous') return true;

        const statText = this.getStatText(item);
        if (statText.length === 0) return true;

        if (this.isDominatedByNegativeStats(statText, context)) return false;

        const primaryStats = ROLE_PRIMARY_STATS[context.role] || ROLE_PRIMARY_STATS['dps'] || [];
        return primaryStats.some(stat => statText.includes(stat.toLowerCase()));
    }

    private isDominatedByNegativeStats(statText: string, context: SuggestionContext): boolean {
        const negativeStats = NEGATIVE_STATS[`${context.className.toLowerCase()}:${context.role}`] || [];
        if (negativeStats.length === 0) return false;

        const primaryStats = ROLE_PRIMARY_STATS[context.role] || ROLE_PRIMARY_STATS['dps'] || [];
        const negativeHits = negativeStats.filter(s => statText.includes(s.toLowerCase())).length;
        const positiveHits = primaryStats.filter(s => statText.includes(s.toLowerCase())).length;
        return negativeHits > positiveHits;
    }

    // --- Scoring ---

    private rankByScore(items: UnreceivedItem[], context: SuggestionContext): UnreceivedItem[] {
        return items
            .map(item => ({ item, score: this.calculateScore(item, context) }))
            .sort((a, b) => b.score - a.score)
            .map(s => s.item);
    }

    private calculateScore(item: UnreceivedItem, context: SuggestionContext): number {
        return this.bisMatchScore(item, context.bisItemNames)
            + this.phaseScore(item)
            + this.itemLevelScore(item)
            + this.qualityScore(item)
            + this.statMatchScore(item, context.role)
            + this.socketScore(item);
    }

    private bisMatchScore(item: UnreceivedItem, bisItemNames: string[]): number {
        const name = item.name.toLowerCase();
        const isBis = bisItemNames.some(bis => name.includes(bis) || bis.includes(name));
        return isBis ? 100 : 0;
    }

    private phaseScore(item: UnreceivedItem): number {
        return item.phase * 10;
    }

    private itemLevelScore(item: UnreceivedItem): number {
        return (item.parsedStats.itemLevel || 0) * 0.5;
    }

    private qualityScore(item: UnreceivedItem): number {
        if (item.quality >= 5) return 25;
        if (item.quality >= 4) return 15;
        if (item.quality >= 3) return 5;
        return 0;
    }

    private statMatchScore(item: UnreceivedItem, role: string): number {
        const primaryStats = ROLE_PRIMARY_STATS[role] || ROLE_PRIMARY_STATS['dps'] || [];
        const statText = this.getStatText(item);
        return primaryStats.filter(stat => statText.includes(stat.toLowerCase())).length * 5;
    }

    private socketScore(item: UnreceivedItem): number {
        return (item.parsedStats.sockets?.length || 0) * 3;
    }

    // --- AI ---

    private async getAiStrategy(context: SuggestionContext): Promise<string | null> {
        return this.ollamaService.explainStrategy(context.className, context.role, context.statPriority, context.bisContext);
    }

    // --- Embed ---

    private buildEmbed(
        characterName: string,
        roleInfo: { role: string; className: string },
        items: UnreceivedItem[],
        topPicks: UnreceivedItem[],
        aiExplanation: string | null,
    ): EmbedBuilder {
        const embed = new EmbedBuilder()
            .setTitle(`SR Suggestions for ${characterName}`)
            .setDescription(`**${roleInfo.className}** (${roleInfo.role}) — Items you haven't received yet:`)
            .setColor(CLASS_COLORS[roleInfo.className.toLowerCase()] || 0x9B59B6);

        this.addRecommendationField(embed, topPicks, aiExplanation);
        this.addPhaseFields(embed, items);

        const currentPhase = process.env.TBC_CURRENT_PHASE || '5';
        embed.setFooter({ text: `Phase ${currentPhase} • Filtered for your class and role • Items you have never received` });
        return embed;
    }

    private addRecommendationField(embed: EmbedBuilder, topPicks: UnreceivedItem[], aiExplanation: string | null): void {
        if (aiExplanation) {
            embed.addFields({ name: '\u2728 Vendetto Recommendation', value: aiExplanation.slice(0, 1024) });
        } else if (topPicks.length > 0) {
            const fallback = topPicks.map(i => `**${i.name}** _(${i.inventoryType} ${i.itemSubclass} — ${i.raidName})_`).join('\n');
            embed.addFields({ name: '\u2728 Top Picks', value: fallback.slice(0, 1024) });
        } else {
            return;
        }
        embed.addFields({ name: '\u200b', value: '───────────────────' });
    }

    private addPhaseFields(embed: EmbedBuilder, items: UnreceivedItem[]): void {
        const byPhase = new Map<number, UnreceivedItem[]>();
        for (const item of items) {
            const phase = item.phase || 0;
            if (!byPhase.has(phase)) byPhase.set(phase, []);
            byPhase.get(phase)!.push(item);
        }

        const sortedPhases = [...byPhase.keys()].sort((a, b) => b - a);
        for (const phase of sortedPhases) {
            const phaseItems = byPhase.get(phase)!;
            this.addSinglePhaseField(embed, phase, phaseItems);
        }
    }

    private addSinglePhaseField(embed: EmbedBuilder, phase: number, phaseItems: UnreceivedItem[]): void {
        const raidNames = [...new Set(phaseItems.map(i => i.raidName))].join(', ');
        const lines = phaseItems.slice(0, 8).map(i => this.formatItemLine(i)).join('\n');
        const remaining = phaseItems.length > 8 ? `\n_...and ${phaseItems.length - 8} more_` : '';

        embed.addFields({
            name: `Phase ${phase} — ${raidNames}`,
            value: (lines + remaining).slice(0, 1024),
            inline: false,
        });
    }

    private formatItemLine(item: UnreceivedItem): string {
        const statStr = item.parsedStats.stats?.join(', ') || '';
        const boss = item.bossName && item.bossName !== 'Unknown' ? ` [${item.bossName}]` : '';
        const qualityPrefix = item.quality >= 4 ? '🟣' : item.quality === 3 ? '🔵' : '🟢';
        return `${qualityPrefix} **${item.name}** _(${item.itemSubclass})_${boss}${statStr ? `\n\u2003${statStr}` : ''}`;
    }

    // --- Helpers ---

    private getStatText(item: UnreceivedItem): string {
        return [
            ...(item.parsedStats.stats || []),
            ...(item.parsedStats.equips || []),
        ].join(' ').toLowerCase();
    }
}
