export interface DiscordMembersRepositoryPort {
    insert(params: {
        discordUserId: string,
        memberId: number,
        discordUser: { id: string, username: string },
        memberName: string,
        guildId: string,
    }): Promise<{ id: number, discord_user_id: string, member_id: number }>;

    existsByDiscordUserId(discordUserId: string): Promise<boolean>;
    findByDiscordUserId(discordUserId: string): Promise<{ id: number, discord_user_id: string, member_id: number } | null>;

}