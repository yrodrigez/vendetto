import { CreatedPredictionMarketOutput, CreatePredictionMarketInput, CreatePredictionMarketOutcomeInput, PopularPredictionMarket, PopularPredictionMarketRecord, PredictionMarketRecord, PredictionMarketRepositoryPort } from "@/application/ports/outbound/database/prediction-markets-repository.port";
import { DatabaseClient } from "@/infrastructure/database/db";
import { readResourceFile } from "@/util/file-resource-helper";

export class PredictionMarketsRepository implements PredictionMarketRepositoryPort {
    constructor(private dbClient: DatabaseClient) { }

    async getPopularPredictionMarkets(): Promise<PopularPredictionMarket[]> {
        const query = `
            SELECT 
                pm.reset_id,
                pm.title,
                pm.description,
                pm.type,
                COUNT(DISTINCT p.wallet_id) AS total_participants
            FROM evx.prediction_markets pm
            LEFT JOIN evx.prediction_pledges p ON pm.id = p.market_id
            GROUP BY pm.id
            ORDER BY total_participants DESC
            LIMIT 10;
        `;

        const results = await this.dbClient.query<PopularPredictionMarketRecord>(query);
        if (!results) {
            return [];
        }

        return results.map(row => ({
            resetId: row.reset_id,
            title: row.title,
            description: row.description,
            type: row.type,
            totalParticipants: Number(row.total_participants || 0),
        }));
    }

    async createPredictionMarket(market: CreatePredictionMarketInput, outcomes: CreatePredictionMarketOutcomeInput[]): Promise<CreatedPredictionMarketOutput> {
        const finalOutcomes = market.type === 'YES_NO'
            ? [{ label: 'Yes' }, { label: 'No' }]
            : outcomes

        const query = readResourceFile(__dirname, 'sql/insert-new-market.sql');

        const values = [
            market.reset_id,
            market.title,
            market.description,
            market.closes_at,
            market.created_by,
            market.type,
            finalOutcomes.map(outcome => outcome.label)
        ]

        const result = await this.dbClient.query<CreatedPredictionMarketOutput>(query, values)

        if (!result || result.length === 0) {
            throw new Error('Failed to create prediction market')
        }

        return result[0];
    }

    async findMarketsByResetId(resetId: string): Promise<PredictionMarketRecord[]> {
        const query = `
            SELECT  
                id,
                reset_id,
                title,
                description,
                status,
                closes_at,
                resolved_outcome_id,
                created_by,
                created_at,
                updated_at,
                type
            FROM evx.prediction_markets
            WHERE reset_id = $1
            ORDER BY created_at DESC;
        `;
        const results = await this.dbClient.query<PredictionMarketRecord>(query, [resetId]);
        return results || [];
    }
}