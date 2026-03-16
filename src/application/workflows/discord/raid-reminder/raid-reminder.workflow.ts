import { DeliveryRepositoryPort } from "@/application/ports/outbound/delivery/delivery-repository.port";
import { DiscordChannelLoggerPort } from "@/application/ports/outbound/discord-channel-logger.port";
import { IRaidReminderCandidateRepositoryPort, RaidReminderCandidate } from "@/application/ports/outbound/raid-reminder-candidate-repository.port";
import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/workflow-run-repository.port";
import { WorkflowRepositoryPort } from "@/application/ports/outbound/workflow-scheduler-repository.port";
import { ProcessDeliveryUseCase } from "@/application/usecases/delivery/ProcessDeliveryUseCase";
import {
    Retryable,
    Schedule,
    Step,
    WorkflowName,
    WorkflowWithSchedule
} from "@/application/workflows/workflow";
import { readResourceFile } from "@/util/file-resource-helper";
import { User } from "discord.js";
import moment from "moment";

export type RaidReminderInput = {
    seedList: User[] | string[];
    guildId: string;
}

@WorkflowName('Campaign: Raid Reminder')
@Schedule('30 17 * * *') // 17:30 daily Madrid time
export class RaidReminderWorkflow extends WorkflowWithSchedule<RaidReminderInput> {
    private candidatesData: RaidReminderCandidate[];
    private content: string;

    constructor(
        private readonly candidateRepository: IRaidReminderCandidateRepositoryPort,
        private readonly processDeliveryUseCase: ProcessDeliveryUseCase,
        private readonly logger: DiscordChannelLoggerPort,
        workflowExecutionRepository: WorkflowRunRepositoryPort,
        workflowRepository: WorkflowRepositoryPort,
        context: string,
        private readonly deliveryRepository: DeliveryRepositoryPort
    ) {
        super(workflowRepository, workflowExecutionRepository, context);
        this.content = readResourceFile(__dirname, '/content.md');
        this.candidatesData = [];
    }

    @Step('verify-content', 0)
    async verifyContent() {
        if (!this.content) {
            throw new Error('Content for raid reminder not found');
        }
    }

    @Step('fetch-candidates', 1)
    @Retryable()
    async fetchCandidates() {
        const data = await this.candidateRepository.findAll({
            communicationCode: 'raidReminder'
        });

        if (!data?.length) {
            console.log('No members to notify for raid reminder');
            this.candidatesData = [];
            return;
        }

        console.log(`Found ${data.length} reminder candidates`);
        this.candidatesData = data;
    }

    @Step('process-delivery', 2)
    @Retryable()
    async processDelivery() {
        const data = this.candidatesData;
        if (!data?.length) {
            await this.logger.log(this.input.guildId, 'No members to notify for raid reminder').catch(err => console.error('Failed to log to channel:', err));
            return;
        }

        const target = data.map((p: RaidReminderCandidate) => ({ discordId: p.discordUserId }));
        const targetData = data.map((p: RaidReminderCandidate) => ({
            discordId: p.discordUserId,
            characterName: p.characterName,
            raidName: p.raidName,
            raidDate: moment(p.raidDate).format('dddd, Do [at] h:mm A'),
            raidId: p.raidId,
        }));

        const delivery = await this.deliveryRepository.findDeliveryByName('raidReminder');
        if (!delivery) {
            throw new Error('Delivery not found');
        }
        const deliveryId = delivery.id;
        const defaultRaidId = targetData?.[0]?.raidId;
        if (!defaultRaidId) {
            throw new Error('Raid ID not found in candidate data');
        }
        const communicationCode = `raidReminder_${defaultRaidId}`;

        const { successful, failed } = await this.processDeliveryUseCase.execute({
            id: deliveryId,
            target: target,
            targetData: targetData,
            targetMapping: {
                targetName: 'user',
                identifier: 'discordId',
            },
            message: {
                seedList: this.input.seedList,
                communicationCode,
                targetMapping: { targetName: 'user' },
                content: this.content.trim(),
            }
        });

        const summary = `Delivery ${communicationCode} successful: ${successful.length}, failed: ${failed.length}`;
        console.log(summary);

        if (this.input.guildId) {
            await this.logger.log(this.input.guildId, summary).catch(err => console.error('Failed to log to channel:', err));
        }
    }
}
