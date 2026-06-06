import { PredictionMarketRecord, PredictionMarketRepositoryPort } from "@/application/ports/outbound/database/prediction-markets-repository.port";

export class FindPredictionMarketsByResetIdUseCase {
    constructor(private predictionMarketsRepository: PredictionMarketRepositoryPort) { }

    async execute(resetId: string): Promise<PredictionMarketRecord[] | null> {
        if (!resetId) {
            throw new Error('Reset ID is required');
        }
        const markets = await this.predictionMarketsRepository.findMarketsByResetId(resetId);
        return markets.length > 0 ? markets : null;
    }
}