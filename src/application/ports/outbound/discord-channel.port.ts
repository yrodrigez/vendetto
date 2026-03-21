export interface DiscordChannelPort {
    createTextChannel(guildId: string, options: {
        name: string;
        categoryName: string;
        topic?: string;
        isPrivate: boolean;
    }): Promise<string>;

    addMemberToChannel(channelId: string, memberId: string): Promise<void>;
    deleteChannel(channelId: string): Promise<void>;
    sendMessage(channelId: string, content: string): Promise<void>;
    getChannelMembers(channelId: string): Promise<string[]>;
}
