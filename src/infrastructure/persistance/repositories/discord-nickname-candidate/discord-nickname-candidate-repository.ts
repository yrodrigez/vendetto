import { DatabaseClient } from "@/infrastructure/database/db";
import { readResourceFile } from "@/util/file-resource-helper";
import { DiscordNicknameCandidateMapper } from "./discord-nickname-candidate.mapper";
import { DiscordNicknameCandidateRepositoryPort } from "@/application/ports/outbound/discord-nickname-candidate-repository.port";

export class DiscordNicknameCandidateRepository implements DiscordNicknameCandidateRepositoryPort {
    constructor(private dbClient: DatabaseClient) { }
    async findSelectedMembersWithDiscordAccount() {
        const query = readResourceFile(__dirname, 'sql/find-discord-nickname-candidates.sql');

        const results = await this.dbClient.query<{
            member_id: string
            character_name: string
            discord_user_id: string
        }>(query);

        return results.map(DiscordNicknameCandidateMapper.toDomain);
    }
}