import { DeliveryRepositoryPort } from "@/application/ports/outbound/delivery/delivery-repository.port";
import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/workflow-run-repository.port";
import { WorkflowRepositoryPort } from "@/application/ports/outbound/workflow-scheduler-repository.port";
import { ProcessDeliveryUseCase } from "@/application/usecases/delivery/ProcessDeliveryUseCase";
import { Retryable, Step, WorkflowName, WorkflowWithRetries } from "@/application/workflows/workflow";
import { RaidResetRepository } from "@/domain/raid/raid-reset.repository";

export type InvitesStartedWorkflowInput = {
    resetId: string;
};

@WorkflowName('Invites Started Delivery')
export class InvitesStartedWorkflow extends WorkflowWithRetries<InvitesStartedWorkflowInput> {
    private participantsData: any[] = [];

    constructor(
        private readonly raidResetRepository: RaidResetRepository,
        private readonly processDeliveryUseCase: ProcessDeliveryUseCase,
        readonly workflowExcutionRepository: WorkflowRunRepositoryPort,
        readonly workflowRepository: WorkflowRepositoryPort,
        readonly guildId: string,
        readonly deliveryRepository: DeliveryRepositoryPort
    ) {
        super(workflowRepository, workflowExcutionRepository, guildId);
    }

    @Step('validate-reset', 0)
    async validateReset() {
        const { resetId } = this.input;
        const reset = await this.raidResetRepository.findRaidReset(resetId);
        if (!reset) {
            throw new Error(`Invalid reset ID: ${resetId}`);
        }

        const startDate = new Date(new Date(reset.raid_date + ' ' + reset.time).toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
        const endDate = new Date(new Date(reset.end_date + ' ' + reset.end_time).toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));

        if (now > endDate) {
            throw new Error('This reset has ended');
        }

        if (now < startDate) {
            const diff = startDate.getTime() - now.getTime();
            const diffMinutes = Math.floor(diff / 1000 / 60);
            if (diffMinutes > 120) {
                throw new Error('This reset is more than 2 hours away');
            }
        }
    }

    @Step('fetch-participants', 1)
    @Retryable()
    async fetchParticipants() {
        const participants = await this.raidResetRepository.findParticipants(this.input.resetId);

        if (participants.length === 0) {
            throw new Error('No participants found for this reset');
        }

        this.participantsData = participants;
    }

    @Step('process-delivery', 2)
    @Retryable()
    async processDelivery() {
        const participants = this.participantsData;

        // Ensure characterName is available in targetData so we can inject it
        const target = participants.map(p => ({ discordId: p.id }));
        const targetData = participants.map((p: any) => ({
            discordId: p.id,
            raidName: p.raidName,
            resetId: this.input.resetId,
            characterName: p.characterName || 'Champion'
        }));

        const delivery = await this.deliveryRepository.findDeliveryByName('invitesStarted');
        if (!delivery) {
            throw new Error('Delivery not found');
        }
        const deliveryId = delivery.id;

        const content = `*blub...* 🐙
            
Hey {{{targetData.characterName}}}. **{{{targetData.raidName}}}** invites are going out now!

The coiled shadows of the deep have loosened. Dive into the raid before the tides turn against us.

🔗 **[Review your Soft Reserves your (SRs) here](<https://www.everlastingvendetta.com/raid/{{{targetData.resetId}}}/soft-reserv>)**

*Vendetto*`;

        const { successful, failed } = await this.processDeliveryUseCase.execute({
            id: deliveryId,
            target,
            targetData,
            targetMapping: { targetName: 'user', identifier: 'discordId' },
            message: {
                targetMapping: { targetName: 'user' },
                content: content.trim(),
                communicationCode: 'invitesStarted'
            }
        });

        console.log(`InvitesStarted Workflow completed. Success: ${successful.length}, Failed: ${failed.length}`);
    }
}
