import { DiscordApiPort } from "@/application/ports/outbound/discord-api.port";

export class FindMembersInRoleUsecase {
    constructor(
        private readonly discordApi: DiscordApiPort,
    ) { }

    async execute(guildId: string, roleName: string): Promise<string[]> {
        const membersInRole = await this.discordApi.findMembersInRole(guildId, roleName);
        return membersInRole.map(member => member.id);
    }
}