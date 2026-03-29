import { DiscordChannelPort } from "@/application/ports/outbound/discord-channel.port";
import { DiscordChannelLoggerPort } from "@/application/ports/outbound/discord-channel-logger.port";
import { ResetChannelRepositoryPort } from "@/application/ports/outbound/database/reset-channel-repository.port";
import { ActiveReset, ResetParticipantRepositoryPort } from "@/application/ports/outbound/database/reset-participant-repository.port";
import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/database/workflow-run-repository.port";
import { WorkflowRepositoryPort } from "@/application/ports/outbound/database/workflow-scheduler-repository.port";
import {
    Retryable,
    Schedule,
    Step,
    WorkflowName,
    WorkflowWithSchedule
} from "@/application/workflows/workflow";
import moment from "moment-timezone";
import { DiscordApiPort } from "@/application/ports/outbound/discord-api.port";

export type ResetChannelSyncInput = {
    guildId: string;
}

@WorkflowName('Reset Channel Sync')
@Schedule('0 * * * *', { isRunningOnStartup: true })
export class ResetChannelSyncWorkflow extends WorkflowWithSchedule<ResetChannelSyncInput> {
    private activeResets: ActiveReset[] = [];

    constructor(
        private readonly discordClient: DiscordApiPort,
        private readonly discordChannel: DiscordChannelPort,
        private readonly resetChannelRepository: ResetChannelRepositoryPort,
        private readonly raidResetRepository: ResetParticipantRepositoryPort,
        private readonly participantRepository: ResetParticipantRepositoryPort,
        private readonly logger: DiscordChannelLoggerPort,
        workflowExecutionRepository: WorkflowRunRepositoryPort,
        workflowRepository: WorkflowRepositoryPort,
        context: string,
    ) {
        super(workflowRepository, workflowExecutionRepository, context);
    }

    @Step('fetch-active-resets', 0)
    @Retryable()
    async fetchActiveResets() {
        this.activeResets = await this.raidResetRepository.findActiveResets();
        console.log(`Found ${this.activeResets.length} active resets`);
    }

    @Step('create-channels', 1)
    @Retryable()
    async createChannels() {
        for (const reset of this.activeResets) {
            const existing = await this.resetChannelRepository.findByResetId(reset.id);
            if (existing) continue;

            const [h, m, s] = reset.time.split(':').map(Number);
            const raidDatetime = moment(reset.raid_date).tz('Europe/Madrid').set({ hour: h, minute: m, second: s ?? 0 });
            const channelName = `${reset.raid.name}-${raidDatetime.format('DD-MMM-ha')}`.toLowerCase().replace(/\s+/g, '-');
            const channelId = await this.discordChannel.createTextChannel(this.input.guildId, {
                name: channelName,
                categoryName: 'raids',
                topic: `🐙 ${reset.raid.name} — ${raidDatetime.format('dddd, Do [at] h:mm A')} | May your rolls be high and your repairs be low.`,
                isPrivate: true,
            });

            await this.resetChannelRepository.insert({
                resetId: reset.id,
                channelId,
                guildId: this.input.guildId,
            });

            console.log(`Created channel ${channelName} (${channelId}) for reset ${reset.id}`);
        }
    }

    @Step('sync-subscribers', 2)
    @Retryable()
    async syncSubscribers() {
        const trackedChannels = await this.resetChannelRepository.findAllActive();

        for (const channel of trackedChannels) {
            const subscribers = await this.participantRepository.findSubscribedMembers(channel.resetId);
            const currentMembers = await this.discordChannel.getChannelMembers(channel.channelId);
            const guildMembers = await this.discordClient.findAllMembers(this.input.guildId);
            const currentMemberSet = new Set(currentMembers);

            for (const subscriber of subscribers) {
                if (!currentMemberSet.has(subscriber.discordUserId) && guildMembers.some(m => m.id === subscriber.discordUserId)) {
                    console.log(`Adding subscriber ${subscriber.discordUserId} to channel ${channel.channelId}`);
                    await this.discordChannel.addMemberToChannel(channel.channelId, subscriber.discordUserId);
                    const raidTime = channel.raidDatetime
                        ? moment(channel.raidDatetime).tz('Europe/Madrid').format('dddd, Do [at] h:mm A')
                        : '';
                    const greeting = raidTime
                        ? `*Blub!* 🐙 <@${subscriber.discordUserId}> has joined the raid! **${channel.raidName}** starts on **${raidTime}** — don't be late or we're pulling without you.`
                        : `*Blub!* 🐙 <@${subscriber.discordUserId}> has joined the raid! **${channel.raidName}** awaits.`;
                    await this.discordChannel.sendMessage(channel.channelId, greeting);
                } else if (!guildMembers.some(m => m.id === subscriber.discordUserId)) {
                    console.log(`Subscriber ${subscriber.discordUserId} not found in guild, skipping channel ${channel.channelId}`);
                }
            }
        }
    }

    @Step('cleanup-expired', 3)
    @Retryable()
    async cleanupExpired() {
        const expired = await this.resetChannelRepository.findExpired();

        const summaries: string[] = [];
        for (const channel of expired) {
            await this.discordChannel.deleteChannel(channel.channelId);
            await this.resetChannelRepository.deleteByResetId(channel.resetId);
            summaries.push(`Deleted channel ${channel.channelId} for reset ${channel.resetId}`);
        }

        if (summaries.length > 0 && this.input.guildId) {
            await this.logger.log(this.input.guildId, summaries.join('\n'))
                .catch(err => console.error('Failed to log to channel:', err));
        }
    }
}
