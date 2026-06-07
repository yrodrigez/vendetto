import { PredictionMarketBuilderAgent } from "@/adapters/ai/agents/prediction-market-builder/prediction-market-builder.agent";
import { GetUpcomingResetsUseCaseOutput } from "../raid-resets/get-upcoming-resets.usecase";
import { FindPredictionMarketsByResetIdUseCase } from "../prediction-markets/find-prediction-markets-by-reset-id.usecase";

type ExecutePredictionMarketAgentUseCaseOutput = {
    resetId: string;
    result: string;
    error?: string;
}[];

export class ExecutePredictionMarketAgentUseCase {
    constructor(
        private readonly agent: PredictionMarketBuilderAgent,
        private readonly findPredictionMarketsByResetIdUseCase: FindPredictionMarketsByResetIdUseCase,
    ) { }
    async execute(input: GetUpcomingResetsUseCaseOutput): Promise<ExecutePredictionMarketAgentUseCaseOutput> {
        const MAX_MARKETS_PER_RESET = 3;
        const MIN_PARTICIPANTS_PER_RESET = 15;
        const results = await Promise.all(input.map(async reset => {
            const markets = await this.findPredictionMarketsByResetIdUseCase.execute(reset.id);
            const hasThreeOrMoreMarkets = markets ? markets.length >= MAX_MARKETS_PER_RESET : false;
            const hasAtLeastParticipats = reset.participants && reset.participants.length > MIN_PARTICIPANTS_PER_RESET;
            if (hasThreeOrMoreMarkets) {
                return { resetId: reset.id, result: `Reset ${reset.name} already has 3 or more prediction markets, skipping creation.` };

            }

            if (!hasAtLeastParticipats) {
                return { resetId: reset.id, result: `Reset ${reset.name} has not enough participants, skipping prediction market creation.` };
            }

            try {
                const normalizedParticipants = reset.participants.map(p => ({ name: p.name, role: p.role.includes('tank') ? 'Tank' : p.role.includes('healer') ? 'Healer' : p.role.includes('rdps') ? 'Ranged DPS' : 'Melee DPS' }));
                const remainingSlots = MAX_MARKETS_PER_RESET - (markets ? markets.length : 0);
                const result = await this.agent.run(reset.id, reset.name, reset.raid_date, reset.time, normalizedParticipants, remainingSlots);
                return { resetId: reset.id, result: `Agent result for reset ${reset.name}: ${result.text.trim()}` };
            } catch (error) {
                return { resetId: reset.id, result: `Error creating prediction market for reset ${reset.name}`, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }));

        return results;
    }
}