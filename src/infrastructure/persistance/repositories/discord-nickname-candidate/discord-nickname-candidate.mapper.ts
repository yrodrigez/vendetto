export class DiscordNicknameCandidateMapper {
    static toDomain(raw: { member_id: string; character_name: string; discord_user_id: string }) {
        return {
            memberId: raw.member_id,
            characterName: raw.character_name,
            discordUserId: raw.discord_user_id
        };
    }
}