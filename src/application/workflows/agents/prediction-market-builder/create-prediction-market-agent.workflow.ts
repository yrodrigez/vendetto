import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/database/workflow-run-repository.port";
import { WorkflowRepositoryPort } from "@/application/ports/outbound/database/workflow-scheduler-repository.port";
import { DiscordChannelLoggerPort } from "@/application/ports/outbound/discord-channel-logger.port";
import { ExecutePredictionMarketAgentUseCase } from "@/application/usecases/agents/execute-prediction-market-agent.usecase";
import type { GetUpcomingResetsUseCase, GetUpcomingResetsUseCaseOutput } from "@/application/usecases/raid-resets/get-upcoming-resets.usecase";
import { Retryable, Schedule, Step, WorkflowName, WorkflowWithSchedule } from "../../workflow";

type CreatePredictionMarketAgentWorkflowInput = {
    guildId: string;
};

@WorkflowName('Agent: Create Prediction Markets for Upcoming Raids')
@Schedule('0 0 * * *', { isRecurring: true, isRunningOnStartup: true }) // runs every day at midnight
export class CreatePredictionMarketAgentWorkflow extends WorkflowWithSchedule<CreatePredictionMarketAgentWorkflowInput> {

    constructor(
        private readonly agent: ExecutePredictionMarketAgentUseCase,
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
        const upcomingResets = await this.getUpcomingResetsUseCase.execute();
        this.logger.log(this.input.guildId, `Upcoming resets with participants: ${JSON.stringify(upcomingResets.map(r => ({ name: r.name, participantCount: r.participants.length })), undefined, 2)}`);
        return upcomingResets;
    }

    @Step('create-prediction-markets', 1)
    @Retryable({ maxRetries: 3, delayMs: 1000 })
    async createPredictionMarkets(upcomingResets: GetUpcomingResetsUseCaseOutput) {
        console.log('Executing agent with upcoming resets:', upcomingResets);
        const results = await this.agent.execute(upcomingResets);
        results.forEach(result => {
            if (result.error) {
                this.logger.log(this.input.guildId, `Error processing reset ${result.resetId}: ${result.error}`);
            } else {
                this.logger.log(this.input.guildId, `Result for reset ${result.resetId}: ${result.result}`);
            }
        });

        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
            throw new Error(`Errors occurred while creating prediction markets for some resets: ${errors.map(e => `Reset ID ${e.resetId}: ${e.error}`).join('; ')}`);
        }

        this.logger.log(this.input.guildId, `Finished processing prediction markets for upcoming resets.`);
        return results;
    }
}