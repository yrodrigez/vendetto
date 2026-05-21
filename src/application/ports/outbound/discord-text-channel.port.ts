export type DiscordTextMessage = {
    id: string;
    authorName: string;
    content: string;
    createdAt: Date;
    url: string;
};

export interface DiscordTextChannelPort {
    findTextChannelByName(guildId: string, channelName: string): Promise<string | null>;
    findRecentMessages(channelId: string, since: Date): Promise<DiscordTextMessage[]>;
    sendMessage(channelId: string, content: string): Promise<void>;
}
