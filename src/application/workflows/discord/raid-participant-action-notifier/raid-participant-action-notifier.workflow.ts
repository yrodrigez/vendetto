import { IRaidParticipantActionEventsRepositoryPort, RaidParticipantActionEvent } from "@/application/ports/outbound/database/raid-participant-action-events-repository.port";
import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/database/workflow-run-repository.port";
import { WorkflowRepositoryPort } from "@/application/ports/outbound/database/workflow-scheduler-repository.port";
import { DeliveryRepositoryPort } from "@/application/ports/outbound/delivery/delivery-repository.port";
import { DiscordChannelLoggerPort } from "@/application/ports/outbound/discord-channel-logger.port";
import { ProcessDeliveryUseCase } from "@/application/usecases/delivery/ProcessDeliveryUseCase";
import { Retryable, Schedule, Step, WorkflowName, WorkflowWithSchedule } from "@/application/workflows/workflow";
import { readResourceFile } from "@/util/file-resource-helper";
import moment from "moment-timezone";

export type RaidParticipantActionNotifierInput = {
    guildId: string;
    seedList: string[] | { discordId: string }[];
}

@WorkflowName('Campaign: Raid Participant Action Notifier')
@Schedule('0 * * * *', { isRunningOnStartup: true }) // Every hour
export class RaidParticipantActionNotifierWorkflow extends WorkflowWithSchedule<RaidParticipantActionNotifierInput> {
    private readonly timeWindowSeconds = 3600;
    private readonly exclusionWindowSeconds = 3600;
    private readonly communicationCode = 'raid_participant_action_notifier';
    private readonly deliveryName = 'admin_action';

    private candidatesData: RaidParticipantActionEvent[] = [];
    private readonly content: string;

    constructor(
        private readonly eventsRepository: IRaidParticipantActionEventsRepositoryPort,
        private readonly processDeliveryUseCase: ProcessDeliveryUseCase,
        private readonly logger: DiscordChannelLoggerPort,
        workflowExecutionRepository: WorkflowRunRepositoryPort,
        workflowRepository: WorkflowRepositoryPort,
        context: string,
        private readonly deliveryRepository: DeliveryRepositoryPort,
    ) {
        super(workflowRepository, workflowExecutionRepository, context);
        this.content = readResourceFile(__dirname, '/content.md');
    }

    @Step('fetch-events', 0)
    @Retryable()
    async fetchEvents() {
        this.candidatesData = await this.eventsRepository.findRecentEvents(this.timeWindowSeconds, this.exclusionWindowSeconds);

        if (!this.candidatesData.length) {
            console.log('No raid participant action events to notify');
            return;
        }

        console.log(`Found ${this.candidatesData.length} raid participant action event notifications to send`);
    }

    @Step('process-delivery', 1)
    @Retryable()
    async processDelivery() {
        if (!this.candidatesData.length) {
            return;
        }

        const delivery = await this.deliveryRepository.findDeliveryByName(this.deliveryName);
        if (!delivery) {
            throw new Error(`Delivery not found: ${this.deliveryName}`);
        }

        const target = this.candidatesData.map(candidate => ({ discordId: candidate.discordUserId }));
        const targetData = this.candidatesData.map(candidate => ({
            discordId: candidate.discordUserId,
            memberName: candidate.memberName || 'raider',
            actionDescription: this.buildActionDescription(candidate),
            raidLinkResetId: this.resolveRaidLinkResetId(candidate),
        }));

        const { successful, failed } = await this.processDeliveryUseCase.execute({
            id: delivery.id,
            target,
            targetData,
            targetMapping: {
                targetName: 'user',
                identifier: 'discordId',
            },
            message: {
                communicationCode: this.communicationCode,
                targetMapping: { targetName: 'user' },
                content: this.content.trim(),
                seedList: this.input.seedList?.map(seed => typeof seed === 'string' ? seed : seed.discordId).filter(x => !!x) ?? [],
            }
        });

        const summary = `Delivery ${this.communicationCode}: ok=${successful.length}, fail=${failed.length}`;
        console.log(summary);

        if (this.input.guildId) {
            await this.logger.log(this.input.guildId, summary).catch(err => console.error('Failed to log to channel:', err));
        }
    }

    private buildActionDescription(candidate: RaidParticipantActionEvent): string {
        switch (candidate.eventName) {
            case 'raid_bench_player':
                return `you have been moved to the bench for ${this.formatRaidReference(candidate.raidName, candidate.raidDate)}.`;
            case 'raid_unbench_player':
                return `you have been taken off the bench for ${this.formatRaidReference(candidate.raidName, candidate.raidDate)}.`;
            case 'raid_remove_player':
                return `you have been removed from ${this.formatRaidReference(candidate.raidName, candidate.raidDate)}.`;
            case 'move_participant':
                return `you have been moved from ${this.formatRaidReference(candidate.fromRaidName, candidate.fromRaidDate)} to ${this.formatRaidReference(candidate.toRaidName, candidate.toRaidDate)}.`;
            default:
                return 'there has been an update to your raid signup.';
        }
    }

    private formatRaidReference(raidName: string | null, raidDate: string | null): string {
        const formattedDate = this.formatRaidDate(raidDate);
        if (raidName && formattedDate) {
            return `**${raidName}** on **${formattedDate}**`;
        }

        if (raidName) {
            return `**${raidName}**`;
        }

        if (formattedDate) {
            return `your raid on **${formattedDate}**`;
        }

        return 'your raid';
    }

    private formatRaidDate(raidDate: string | null): string | null {
        if (!raidDate) {
            return null;
        }

        return moment.tz(raidDate, 'Europe/Madrid').format('dddd, Do [at] h:mm A');
    }

    private resolveRaidLinkResetId(candidate: RaidParticipantActionEvent): string | null {
        if (candidate.eventName === 'move_participant') {
            return candidate.toResetId;
        }

        return candidate.resetId;
    }
}
