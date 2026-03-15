import moment from "moment";
import { User } from "discord.js";
import { ProcessDeliveryUseCase } from "@/application/usecases/delivery/ProcessDeliveryUseCase";
import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/workflow-run-repository.port";
import { WorkflowSchedulerRepositoryPort } from "@/application/ports/outbound/workflow-scheduler-repository.port";
import { IRaidSignupNotifierRepositoryPort, RaidSignupDto, RaidRoleCountsDto } from "@/application/ports/outbound/raid-signup-notifier-repository.port";
import {
    Retryable,
    Schedule,
    Step,
    WorkflowName,
    WorkflowWithSchedule
} from "@/application/workflows/workflow";
import { DeliveryRepositoryPort } from "@/application/ports/outbound/delivery/delivery-repository.port";

export type RaidSignupNotifierInput = {
    seedList: User[] | string[];
}

@WorkflowName('Campaign: Raid Signup Notifier')
@Schedule('0 * * * *')
export class RaidSignupNotifierWorkflow extends WorkflowWithSchedule<RaidSignupNotifierInput> {
    private readonly timeWindowSeconds = 3600; // 1 hour
    private readonly communicationCode = 'raid_signup_notifier';

    private newSignups: RaidSignupDto[] = [];
    private raidCounts: Record<string, Record<string, Record<string, number>>> = {};

    constructor(
        private readonly notifierRepository: IRaidSignupNotifierRepositoryPort,
        private readonly processDeliveryUseCase: ProcessDeliveryUseCase,
        workflowRepository: WorkflowRunRepositoryPort,
        schedulerRepository: WorkflowSchedulerRepositoryPort,
        context: string,
        private readonly deliveryRepository: DeliveryRepositoryPort
    ) {
        super(workflowRepository, schedulerRepository, context);
    }

    @Step('fetch-signups', 0)
    @Retryable()
    async fetchSignups() {
        // Fetch all recent signups in the 1-hour window
        const recentSignups = await this.notifierRepository.findRecentSignups(this.timeWindowSeconds);

        if (!recentSignups.length) {
            console.log('No new raid signups to notify about');
            this.newSignups = [];
            return;
        }

        // Fetch previously notified strings from the Broadlog to handle deduplication
        const notifiedData = await this.notifierRepository.findNotifiedTexts(this.communicationCode, this.timeWindowSeconds);
        const notifiedTexts = notifiedData.map(text => text.toLowerCase());

        // Deduplicate
        this.newSignups = recentSignups.filter(signup => {
            const signupIdentifier = `${signup.characterName.toLowerCase()} ${signup.raidName.toLowerCase()}`;
            return !notifiedTexts.some(text => text.includes(signupIdentifier));
        });

        if (!this.newSignups.length) {
            console.log('All recent signups have already been notified');
        }
    }

    @Step('fetch-counts', 1)
    @Retryable()
    async fetchCounts() {
        if (!this.newSignups.length) return;

        // Extract unique active raid IDs to group by
        const raidIds = Array.from(new Set(this.newSignups.map(s => s.raidId)));

        const countsData = await this.notifierRepository.findRaidCounts(raidIds);

        // Organize counts by raid
        this.raidCounts = {};
        countsData.forEach(row => {
            this.raidCounts[row.raidId] ||= {};
            this.raidCounts[row.raidId][row.status] ||= {};
            this.raidCounts[row.raidId][row.status][row.role] = row.count;
        });
    }

    @Step('process-delivery', 2)
    @Retryable()
    async processDelivery() {
        if (!this.newSignups.length) return;

        // Group the new signups by raid
        const raidSignups: Record<string, {
            raidName: string,
            raidDate: Date,
            time: string,
            raidId: string,
            signups: RaidSignupDto[]
        }> = {};

        this.newSignups.forEach(signup => {
            const raidKey = signup.raidId;
            if (!raidSignups[raidKey]) {
                raidSignups[raidKey] = {
                    raidName: signup.raidName,
                    raidDate: signup.raidDate,
                    time: signup.time,
                    raidId: signup.raidId,
                    signups: []
                };
            }
            raidSignups[raidKey].signups.push(signup);
        });

        // Generate dynamic Discord string
        let content = '🐙 **New Raid Signups Alert** 🐙\n\n';
        Object.values(raidSignups).forEach(raid => {
            const counts = this.raidCounts[raid.raidId] || {};
            content += '**Current Raid Status:**\n';
            Object.entries(counts).forEach(([status, roles]) => {
                const emoji = status === 'confirmed' ? '✅' : status === 'late' ? '⏰' : '❓';
                const rolesList = Object.entries(roles)
                    .map(([roleName, cnt]) => `${roleName}: ${cnt}`)
                    .join(', ');
                content += `${emoji} ${status}: ${rolesList}\n`;
            });
            content += '\n';

            const formattedDate = moment(raid.raidDate).format('dddd, D MMMM');
            content += `📅 **${raid.raidName}** on ${formattedDate}\n`;
            content += '```\n';
            raid.signups.forEach(signup => {
                const statusEmoji = signup.status === 'confirmed' ? '✅' : '❓';
                content += `${statusEmoji} ${signup.characterName} (${signup.characterClass}) - ${signup.status} (${signup.role})\n`;
            });

            content += '```\n';
            content += `🔗 [View Raid Details](<https://www.everlastingvendetta.com/raid/${raid.raidId}>)\n\n`;
        });

        const delivery = await this.deliveryRepository.findDeliveryByName('raidSignupNotifier'); // Ensure this ID exists or replace with hardcoded `6` if strictly required as in legacy
        if (!delivery) {
            throw new Error('Delivery not found');
        }
        const deliveryId = delivery.id;

        const { successful, failed } = await this.processDeliveryUseCase.execute({
            id: deliveryId || 6, // Provided fallback to match `id: 6` in legacy code
            target: this.input.seedList.map(x => ({ discordId: x as string })),
            targetData: [],
            targetMapping: {
                targetName: 'user',
                identifier: 'discordId',
            },
            message: {
                communicationCode: this.communicationCode,
                targetMapping: { targetName: 'user' },
                content: content
            }
        });

        console.log(`Delivery ${this.communicationCode} successful:`, successful.length);
        console.log(`Delivery ${this.communicationCode} failed:`, failed.length);
    }
}
