import type { CreatePredictionMarketUseCase } from '@/application/usecases/prediction-markets/create-prediction-market.usecase';
import { FindPredictionMarketsByResetIdUseCase } from '@/application/usecases/prediction-markets/find-prediction-markets-by-reset-id.usecase';
import { GetPopularPredictionMarketsUseCase } from '@/application/usecases/prediction-markets/get-popular-prediction-markets.usecase';
import { tool } from 'ai';
import { z } from 'zod';

export function buildCreatePredictionMarketTool(usecase: CreatePredictionMarketUseCase) {
    return tool({
        description: 'Creates a new prediction market',
        inputSchema: z.object({
            resetId: z.string().describe('The ID of the reset associated with this prediction market'),
            title: z.string().describe('The title of the prediction market').max(80),
            description: z.string().describe('A detailed description of the prediction market').max(255),
            type: z.enum(['YES_NO', 'MULTIPLE_CHOICE']).default('YES_NO').describe('The type of the prediction market'),
            outcomes: z.array(z.object({
                label: z.string().describe('The label for the outcome').max(50)
            })).describe('The possible outcomes for the prediction market. Required if type is MULTIPLE_CHOICE').optional(),
            closesAt: z.string().describe('The ISO date string when the market closes'),
        }),
        outputSchema: z.object({
            id: z.string().describe('The ID of the created prediction market'),
            error: z.string().describe('Error message if the creation failed').optional(),
        }),
        execute: async ({ resetId, title, description, type, outcomes, closesAt }) => {
            try {
                const marketInput = {
                    reset_id: resetId,
                    title,
                    description,
                    type: type ?? 'YES_NO',
                    closes_at: new Date(closesAt),
                    created_by: 'system', // This should ideally come from the authenticated user context
                };
                const result = await usecase.execute(marketInput, (outcomes ?? []));
                return { id: result.id };
            } catch (error) {
                console.error('Error creating prediction market:', error);
                return { id: '', error: error instanceof Error ? error.message : 'Unknown error creating prediction market' };
            }
        }
    });
}

export function buildFindPredictionMarketsByResetIdTool(usecase: FindPredictionMarketsByResetIdUseCase) {
    return tool({
        description: 'Finds prediction markets by reset ID',
        inputSchema: z.object({
            resetId: z.string().describe('The ID of the reset to find prediction markets for'),
        }),
        outputSchema: z.object({
            markets: z.array(z.object({
                id: z.string().describe('The ID of the prediction market'),
                title: z.string().describe('The title of the prediction market'),
            })),
            error: z.string().describe('Error message if the retrieval failed').optional(),
        }),
        execute: async ({ resetId }) => {
            try {
                const result = await usecase.execute(resetId);
                return { markets: (result ?? []) };
            } catch (error) {
                console.error('Error finding prediction markets:', error);
                return { markets: [], error: error instanceof Error ? error.message : 'Unknown error finding prediction markets' };
            }
        }
    });
}

export function buildFindPopularPredictionMarketsTool(usecase: GetPopularPredictionMarketsUseCase) {
    return tool({
        description: 'Retrieves a list of popular prediction markets',
        inputSchema: z.object({}).optional().describe('No input required for this tool'),
        outputSchema: z.object({
            markets: z.array(z.object({
                title: z.string().describe('The title of the prediction market'),
                description: z.string().describe('A detailed description of the prediction market'),
                totalParticipants: z.number().describe('The total number of participants in the prediction market'),
            })),
            error: z.string().describe('Error message if the retrieval failed').optional(),
        }),
        execute: async () => {
            try {
                const result = await usecase.execute();
                return { markets: result };
            } catch (error) {
                console.error('Error finding popular prediction markets:', error);
                return { markets: [], error: error instanceof Error ? error.message : 'Unknown error finding popular prediction markets' };
            }
        }
    });
}