import type { PopularPredictionMarket, PredictionMarketRepositoryPort } from "@/application/ports/outbound/database/prediction-markets-repository.port";

export class GetPopularPredictionMarketsUseCase {
    constructor(private predictionMarketsRepository: PredictionMarketRepositoryPort) { }

    async execute(): Promise<PopularPredictionMarket[]> {
        const markets = await this.predictionMarketsRepository.getPopularPredictionMarkets();
        const POPULARITY_THRESHOLD = 10; // This threshold can be adjusted based on what is considered "popular"
        const popularMarkets = markets.filter(market => market.totalParticipants >= POPULARITY_THRESHOLD);
        return popularMarkets;
    }
}