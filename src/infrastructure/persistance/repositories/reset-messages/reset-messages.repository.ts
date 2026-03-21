import { ResetMessagesRepositoryPort } from "@/application/ports/outbound/reset-messages-repository.port";
import { DatabaseClient } from "@/infrastructure/database/db";

export class ResetMessagesRepository implements ResetMessagesRepositoryPort {
    constructor(private readonly databaseClient: DatabaseClient) { }

    async insert(data: {
        resetId: string;
        characterId: number;
        content: string;
        source: 'discord' | 'web';
    }): Promise<void> {
        const query = `
            INSERT INTO public.reset_messages (reset_id, character_id, content, source)
            VALUES ($1, $2, $3, $4)
        `;
        await this.databaseClient.query(query, [data.resetId, data.characterId, data.content, data.source]);
    }
}
