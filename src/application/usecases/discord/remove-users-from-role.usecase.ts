import { DiscordApiPort } from "@/application/ports/outbound/discord-api.port";

export class RemoveUsersFromRoleUsecase {
    constructor(
        private readonly discordApi: DiscordApiPort,
    ) { }
    async execute(guildId: string, roleName: string, memberIds: string[]): Promise<void> {
        const roleId = await this.discordApi.findAllRoles(guildId).then(roles => roles.find(role => role.name === roleName)?.id);
        if (!roleId) {
            throw new Error(`Role "${roleName}" not found in guild ${guildId}`);
        }
        await this.discordApi.removeMembersFromRole(guildId, roleId, memberIds);
    }
}