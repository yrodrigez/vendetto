import { PredictionMarketBuilderAgent } from "@/adapters/ai/agents/prediction-market-builder/prediction-market-builder.agent";
import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/database/workflow-run-repository.port";
import { WorkflowRepositoryPort } from "@/application/ports/outbound/database/workflow-scheduler-repository.port";
import { DiscordChannelLoggerPort } from "@/application/ports/outbound/discord-channel-logger.port";
import { FindPredictionMarketsByResetIdUseCase } from "@/application/usecases/prediction-markets/find-prediction-markets-by-reset-id.usecase";
import type { GetUpcomingResetsUseCase } from "@/application/usecases/raid-resets/get-upcoming-resets.usecase";
import { Retryable, Schedule, Step, WorkflowName, WorkflowWithSchedule } from "../../workflow";

type CreatePredictionMarketAgentWorkflowInput = {
    guildId: string;
};

@WorkflowName('Campaign: Close Reservations')
@Schedule('0 0 * * *', { isRecurring: true, isRunningOnStartup: true }) // runs every day at midnight
export class CreatePredictionMarketAgentWorkflow extends WorkflowWithSchedule<CreatePredictionMarketAgentWorkflowInput> {
    private upcomingResets: Awaited<ReturnType<GetUpcomingResetsUseCase['execute']>> = [];

    constructor(
        private readonly agent: PredictionMarketBuilderAgent,
        private readonly findPredictionMarketsByResetIdUseCase: FindPredictionMarketsByResetIdUseCase,
        private readonly getUpcomingResetsUseCase: GetUpcomingResetsUseCase,
        private readonly logger: DiscordChannelLoggerPort,
        workflowExecutionRepository: WorkflowRunRepositoryPort,
        workflowRepository: WorkflowRepositoryPort,
        context: string
    ) {
        super(workflowRepository, workflowExecutionRepository, context);
    }

    @Step('find-elegible-prediction-markets', 0)
    @Retryable({ maxRetries: 3, delayMs: 1000 })
    async findElegiblePredictionMarkets() {
        this.upcomingResets = await this.getUpcomingResetsUseCase.execute();
        this.logger.log(this.input.guildId, `Upcoming resets with participants: ${JSON.stringify(this.upcomingResets.map(r => ({ id: r.id, name: r.name, participantCount: r.participants.length, participants: r.participants.slice(0, 5) })))}`);
    }

    @Step('create-prediction-markets', 1)
    @Retryable({ maxRetries: 3, delayMs: 1000 })
    async createPredictionMarkets() {
        await Promise.all(this.upcomingResets.map(async reset => {
            const markets = await this.findPredictionMarketsByResetIdUseCase.execute(reset.id);
            const hasThreeOrMoreMarkets = markets ? markets.length >= 3 : false;
            const hasAtLeastParticipats = reset.participants && reset.participants.length > 15;
            if (hasThreeOrMoreMarkets) {
                this.logger.log(this.input.guildId, `Reset ${reset.name} already has 3 or more prediction markets, skipping creation.`);
                return;
            }
            if (!hasAtLeastParticipats) {
                this.logger.log(this.input.guildId, `Reset ${reset.name} has not enough participants, skipping prediction market creation.`);
                return;
            }
            // Call the agent to create prediction markets for this reset
            this.logger.log(this.input.guildId, `Creating prediction markets for reset ${reset.name} with ${reset.participants.length} participants.`);
            try {
                const result = await this.agent.run(reset.id, reset.name, reset.raid_date, reset.time, reset.participants.map(p => ({ name: p.name, role: p.role.includes('tank') ? 'Tank' : p.role.includes('healer') ? 'Healer' : p.role.includes('rdps') ? 'Ranged DPS' : 'Melee DPS' })));
                this.logger.log(this.input.guildId, `Agent result for reset ${reset.name}: ${result.text.trim()}`);
            } catch (error) {
                this.logger.log(this.input.guildId, `Error creating prediction market for reset ${reset.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                return;
            }

        }));

        this.logger.log(this.input.guildId, `Finished processing prediction markets for upcoming resets.`);
    }
}