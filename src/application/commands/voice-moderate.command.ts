import {
    ChatInputCommandInteraction,
    GuildMember,
    MessageFlags,
    SlashCommandBuilder,
    TextChannel,
    VoiceBasedChannel,
    userMention,
} from 'discord.js'
import { DiscordCommand } from '@/infrastructure/discord/commands/command.interface'
import { NsfwAudioDetectorFactory } from '@/application/ports/outbound/audio/nsfw-audio-detector.port'
import { VoiceModerationRegistry } from '@/infrastructure/discord/voice-moderation-registry'
import { buildSessionFromVoiceChannel } from '@/infrastructure/discord/voice-moderation-session'

export class VoiceModerateCommand implements DiscordCommand {
    constructor(
        private readonly detectorFactory: NsfwAudioDetectorFactory,
        private readonly registry: VoiceModerationRegistry,
        private readonly targetLabels: string[],
        private readonly scoreThreshold: number,
    ) { }

    public data = new SlashCommandBuilder()
        .setName('voice-moderate')
        .setDescription('POC: join voice channel and alert on target sounds')
        .addSubcommand(sub =>
            sub.setName('start').setDescription('Start moderation in your current voice channel')
        )
        .addSubcommand(sub =>
            sub.setName('stop').setDescription('Stop moderation in this guild')
        )

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const sub = interaction.options.getSubcommand(true)
        if (sub === 'start') {
            await this.handleStart(interaction)
            return
        }
        if (sub === 'stop') {
            await this.handleStop(interaction)
            return
        }
    }

    private async handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildId = interaction.guildId
        if (!guildId) {
            await interaction.reply({ content: 'Guild-only command.', flags: MessageFlags.Ephemeral })
            return
        }

        const voiceChannel = (interaction.member as GuildMember)?.voice?.channel as VoiceBasedChannel | null
        if (!voiceChannel) {
            await interaction.reply({ content: 'Join a voice channel first.', flags: MessageFlags.Ephemeral })
            return
        }

        if (this.registry.get(guildId)) {
            await interaction.reply({
                content: 'Moderation already active in this guild. Use `/voice-moderate stop` first.',
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        const alertChannel = interaction.channel as TextChannel | null
        console.log(`[VoiceModerateCmd] starting guild=${guildId} channel=${voiceChannel.id} labels=${this.targetLabels.join(',')} threshold=${this.scoreThreshold}`)

        const session = buildSessionFromVoiceChannel(
            voiceChannel,
            this.targetLabels,
            this.scoreThreshold,
            this.detectorFactory,
            (alert) => {
                const msg = `Detected **${alert.label}** from ${userMention(alert.userId)} (score ${alert.score.toFixed(2)})`
                console.log(`[VoiceModerateCmd] alert -> ${msg}`)
                alertChannel?.send({ content: msg }).catch(err => {
                    console.warn('[VoiceModerateCmd] failed to post alert', err)
                })
            },
        )

        try {
            await session.start()
        } catch (err: any) {
            console.error('[VoiceModerateCmd] session.start failed', err)
            await interaction.editReply({ content: `Failed to start: ${err?.message ?? 'unknown error'}` })
            await session.stop().catch(() => { })
            return
        }

        this.registry.register(session)

        await interaction.editReply({
            content: `Moderation started in <#${voiceChannel.id}>. Watching for: ${this.targetLabels.join(', ')}`,
        })
    }

    private async handleStop(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildId = interaction.guildId
        if (!guildId) {
            await interaction.reply({ content: 'Guild-only command.', flags: MessageFlags.Ephemeral })
            return
        }

        const session = this.registry.get(guildId)
        if (!session) {
            await interaction.reply({ content: 'No active moderation session.', flags: MessageFlags.Ephemeral })
            return
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        await this.registry.unregister(guildId)
        await interaction.editReply({ content: 'Moderation stopped.' })
    }
}
