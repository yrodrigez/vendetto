export type PredictionMarketStatus = 'DRAFT' | 'OPEN' | 'LOCKED' | 'RESOLVED' | 'CANCELLED';
type MarketType = 'YES_NO' | 'MULTIPLE_CHOICE';
export interface PredictionMarketRecord {
    id: string;
    reset_id: string;
    title: string;
    description: string;
    status: PredictionMarketStatus;
    closes_at: Date;
    resolved_outcome_id: string | null;
    created_by: string;
    created_at: Date;
    updated_at: Date;
    type: MarketType;
};

export interface PredictionMarketOutcomeRecord {
    id: string;
    market_id: string;
    label: string;
    sort_order: number;
    created_at: Date;
};

export interface PredictionPledgeRecord {
    id: string;
    market_id: string;
    outcome_id: string;
    wallet_id: string;
    amount: number;
    status: 'ACTIVE' | 'CANCELLED' | 'WON' | 'LOST' | 'REFUNDED';
    created_at: Date;
    updated_at: Date;
};

export type PopularPredictionMarketRecord = Omit<PredictionMarketRecord, 'id' | 'created_by' | 'created_at' | 'updated_at' | 'resolved_outcome_id' | 'closes_at' | 'status' | 'closed_at'> & {
    total_participants: number;
};

export type PopularPredictionMarket = Omit<PopularPredictionMarketRecord, 'total_participants' | 'reset_id'> & {
    totalParticipants: number;
    resetId: string;
};

export type CreatedPredictionMarketOutput = PredictionMarketRecord & {
    outcomes: PredictionMarketOutcomeRecord[];
};

export type CreatePredictionMarketInput = Omit<PredictionMarketRecord, 'id' | 'created_at' | 'updated_at' | 'status' | 'resolved_outcome_id'> 
export type CreatePredictionMarketOutcomeInput = Omit<PredictionMarketOutcomeRecord, 'id' | 'created_at' | 'market_id' | 'sort_order'>;

export interface PredictionMarketRepositoryPort {
    getPopularPredictionMarkets(): Promise<PopularPredictionMarket[]>;
    createPredictionMarket(market: CreatePredictionMarketInput, outcomes: CreatePredictionMarketOutcomeInput[]): Promise<CreatedPredictionMarketOutput>;
    findMarketsByResetId(resetId: string): Promise<PredictionMarketRecord[]>;
}