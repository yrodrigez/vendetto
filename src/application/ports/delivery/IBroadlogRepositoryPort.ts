export interface BroadlogData {
    text: string;
    to: string;
    last_event: 'success' | 'error';
    channel: 'discord';
    communication_code: string;
}

export interface IBroadlogRepositoryPort {
    saveBroadlog(deliveryId: number, data: BroadlogData[]): Promise<{ broadlogIds?: { id: string }[], error?: any }>;
    registerBroadlogIdInUrl(broadlogId: string, urlId: string): Promise<void>;
}
