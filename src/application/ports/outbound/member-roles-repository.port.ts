export interface MemberRolesRepositoryPort {
    findRolesForMember(discordId: string): Promise<string[]>
    isUserInRoles(discordId: string, roleNames: string[]): Promise<boolean>
}