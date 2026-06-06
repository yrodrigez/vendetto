import { CreatedPredictionMarketOutput, CreatePredictionMarketInput, CreatePredictionMarketOutcomeInput, PredictionMarketRepositoryPort } from "@/application/ports/outbound/database/prediction-markets-repository.port";

export class CreatePredictionMarketUseCase {
    constructor(private predictionMarketsRepository: PredictionMarketRepositoryPort) { }

    async execute(market: CreatePredictionMarketInput, outcomes: CreatePredictionMarketOutcomeInput[]): Promise<CreatedPredictionMarketOutput> {
        if (market.type === 'MULTIPLE_CHOICE' && (!outcomes || outcomes.length < 2)) {
            throw new Error('MULTIPLE_CHOICE markets require at least 2 outcomes');
        }

        const finalOutcomes = market.type === 'YES_NO'
            ? [{ label: 'YES' }, { label: 'NO' }]
            : outcomes!.map(outcome => ({ label: outcome.label }));

        return await this.predictionMarketsRepository.createPredictionMarket({
            ...market,
            created_by: '62ce813a-04b5-4f76-9c5d-a3e7f9559f28'
        }, finalOutcomes);
    }
}