import { DiscordApiPort } from "@/application/ports/outbound/discord-api.port";
import { MemberRepositoryPort } from "@/application/ports/outbound/database/member-repository.port";

export class FindCandidatesForClassRoleUseCase {
    constructor(
        private readonly memberRepository: MemberRepositoryPort,
        private readonly discordApi: DiscordApiPort,
    ) { }
    async execute({ guildId, className }: { guildId: string, className: string }): Promise<{ insert: { discordUserId: string, characterName: string }[], remove: { discordUserId: string, characterName: string }[] }> {
        const usersInRole = await this.discordApi.findMembersInRole(guildId, className);
        console.log(`Users in role "${className}":`, usersInRole.map(user => ({ id: user.id, nickname: user.nickname ?? user.user.username })));
        const userIdsInRole = usersInRole.map(user => user.id);

        const membersFromDB = await this.memberRepository.findAllSelectedCharactersDiscord()
        const classMembers = membersFromDB.filter(member => member.character.class.toLocaleLowerCase() === className.toLocaleLowerCase());
        const classMembersCandidates = classMembers.map(member => member.discordId);

        const toInsert = classMembersCandidates.filter(candidate => !userIdsInRole.includes(candidate));
        const toRemove = userIdsInRole.filter(userId => !classMembersCandidates.includes(userId));

        return {
            insert: membersFromDB.filter(member => toInsert.includes(member.discordId)).map(member => ({ discordUserId: member.discordId, characterName: member.character.name })),
            remove: toRemove.map(userId => {
                const dbMember = membersFromDB.find(member => member.discordId === userId);
                const discordMember = usersInRole.find(user => user.id === userId);
                return {
                    discordUserId: userId,
                    characterName: dbMember?.character.name ?? discordMember?.nickname ?? discordMember?.user.username ?? 'unknown',
                };
            }),
        }
    }
}