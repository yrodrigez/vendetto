import { DiscordApiPort } from "@/application/ports/outbound/discord-api.port";
import { MemberRepositoryPort } from "@/application/ports/outbound/member-repository.port";
import { EvApiService } from "@/infrastructure/ev-api.service";

export class FindMembersShouldBeInGuildRoleUsecase {
    constructor(
        private readonly memberRepository: MemberRepositoryPort,
        private readonly discordApi: DiscordApiPort,
        private readonly evApi: EvApiService,
        private readonly discordRoleName: string = 'guildies',
    ) { }

    async execute({ guildId }: { guildId: string }): Promise<{ insert: { discordUserId: string, characterName: string }[], remove: { discordUserId: string, characterName: string }[] }> {
        const roleId = await this.discordApi.findAllRoles(guildId).then(roles => roles.find(role => role.name.toLocaleLowerCase() === this.discordRoleName.toLocaleLowerCase())?.id);
        if (!roleId) {
            throw new Error(`Role "${this.discordRoleName}" not found in guild ${guildId}`);
        }
        const membersInRole = await this.discordApi.findMembersInRole(guildId, this.discordRoleName);
        const memberIdsInRole = membersInRole.map(member => member.id);

        const allMembers = await this.discordApi.findAllMembers(guildId);
        const membersNotInRole = allMembers.filter(member => !memberIdsInRole.includes(member.id));
        const discordUserIdsNotInRole = membersNotInRole.map(member => member.id);


        const roster = await this.evApi.getRoster();
        const membersFromDB = await this.memberRepository.findAllInGuild('Everlasting Vendetta');

        const inRosterAndDB = membersFromDB.filter(member =>
            roster.some(rosterMember => rosterMember.name === member.character.name) &&
            allMembers.some(discordMember => discordMember.id === member.discordId)
        );

        const membersShouldBeInRole = membersFromDB.filter(member =>
            discordUserIdsNotInRole.includes(member.discordId) &&
            inRosterAndDB.some(inRosterAndDBMember => inRosterAndDBMember.discordId === member.discordId)
        );

        const uniqueMembersShouldBeInRole = membersShouldBeInRole.filter((member, index, self) =>
            index === self.findIndex(t => (
                t.discordId === member.discordId
            ))
        );

        const toRemove = membersInRole.filter(memberInRole =>
            !inRosterAndDB.some(inRosterAndDBMember => inRosterAndDBMember.discordId === memberInRole.id)
        ).map(memberInRole => ({ id: memberInRole.id, name: memberInRole.user.username }));

        return {
            insert: uniqueMembersShouldBeInRole.map(member => ({ discordUserId: member.discordId, characterName: member.character.name })),
            remove: toRemove.map(member => ({ discordUserId: member.id, characterName: member.name })),
        };

    }
}