export interface ResetMessagesRepositoryPort {
    insert(data: {
        resetId: string;
        characterId: number;
        content: string;
        source: 'discord' | 'web';
    }): Promise<void>;
}
