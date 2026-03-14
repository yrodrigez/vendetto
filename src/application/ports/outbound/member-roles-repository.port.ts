export interface MemberRolesRepositoryPort {
    findRolesForMember(discordId: string): Promise<string[]>
}