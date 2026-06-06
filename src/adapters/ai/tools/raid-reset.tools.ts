

import { GetUpcomingResetsUseCase } from '@/application/usecases/raid-resets/get-upcoming-resets.usecase';
import { tool } from 'ai';
import { z } from 'zod';

export function buildGetUpcomingRaidsTool(usecase: GetUpcomingResetsUseCase) {
    return tool({
        description: 'Retrieves a list of upcoming raid resets',
        inputSchema: z.unknown().describe('No input required for this tool'),
        outputSchema: z.object({
            raids: z.array(z.object({
                id: z.string().describe('The ID of the raid reset'),
                name: z.string().describe('The name of the raid reset'),
                participants: z.array(z.object({
                    name: z.string().describe('The name of the participant'),
                })).describe('List of participants in the raid reset'),
            })),
            error: z.string().describe('Error message if the retrieval failed').optional(),
        }),
        execute: async () => {
            try {
                const result = await usecase.execute();

                return {
                    raids: result.map(reset => ({
                        id: reset.id,
                        name: reset.name,
                        participants: reset.participants.map(p => ({ name: p.name }))
                    })) ?? []
                };
            } catch (error) {
                console.error('Error fetching upcoming raids:', error);
                return { raids: [], error: error instanceof Error ? error.message : 'Unknown error fetching upcoming raids' };
            }
        }
    });
}