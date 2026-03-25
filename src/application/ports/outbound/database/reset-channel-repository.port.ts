export type ResetChannel = {
    id: number;
    resetId: string;
    channelId: string;
    guildId: string;
    raidName?: string;
    raidDatetime?: string;
}

export interface ResetChannelRepositoryPort {
    findByResetId(resetId: string): Promise<ResetChannel | null>;
    findByChannelId(channelId: string): Promise<ResetChannel | null>;
    findAllActive(): Promise<ResetChannel[]>;
    findExpired(): Promise<ResetChannel[]>;
    insert(data: { resetId: string; channelId: string; guildId: string }): Promise<void>;
    deleteByResetId(resetId: string): Promise<void>;
}
