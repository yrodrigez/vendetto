import { DiscordMembersRepositoryPort } from "@/application/ports/outbound/database/discord-members-repository.port";
import { UsersRepositoryPort } from "@/application/ports/outbound/database/users-repository.port";
import { DiscordApiPort } from "@/application/ports/outbound/discord-api.port";
import { MemberRepositoryPort } from "@/application/ports/outbound/database/member-repository.port";

export class InsertDiscordMembersUseCase {
    constructor(
        private readonly discordAPI: DiscordApiPort,
        private readonly discordMembersRepository: DiscordMembersRepositoryPort,
        private readonly usersRepository: UsersRepositoryPort,
        private readonly charactersRepository: MemberRepositoryPort,
    ) { }

    private sanitizeUsername(username: string): string {
        // Discord usernames can be up to 32 characters long and can contain letters, numbers, and underscores
        // We'll replace any invalid characters with underscores and trim the username to 32 characters
        return username
            //to lowercase
            .toLocaleLowerCase()
            // replace invalid characters with spaces (we will trim and replace multiple spaces with a single space later)
            .replace(/[^a-z0-9_]/g, ' ')
            //trim
            .trim()
            // replace multiple spaces with a single space
            .replace(/\s+/g, ' ')
    }

    async execute({ guildId }: { guildId: string }): Promise<void> {
        console.log(`Starting Discord members synchronization for guild ${guildId}...`);
        const allDiscordUsers = await this.discordAPI.findAllMembers(guildId);
        const selectedCharacters = await this.charactersRepository.findAllSelectedCharacters();

        await Promise.all(allDiscordUsers.map(async discordUser => {
            try {
                const existingMember = await this.discordMembersRepository.findByDiscordUserId(discordUser.id);
                if (existingMember) {
                    console.log(`Discord user ${discordUser.id} already exists in database with member ID ${existingMember.member_id}. Skipping.`)
                    return; // Skip to next user
                }
                const existsByDiscordId = await this.usersRepository.existsByDiscordId(discordUser.id);
                if (existsByDiscordId) {
                    //console.log(`Discord user ${discordUser.id} is already linked to a user account in the database. Skipping.`)
                    return; // Skip to next user
                }

                const matchingCharacter = selectedCharacters.find(character => (
                    this.sanitizeUsername(discordUser.user.username).indexOf(this.sanitizeUsername(character.name)) !== -1 ||
                    (discordUser.nickname && (this.sanitizeUsername(discordUser.nickname).indexOf(this.sanitizeUsername(character.name)) !== -1))
                ));

                if (!matchingCharacter) {
                    console.log(`No matching character found for Discord user ${discordUser.id} (${discordUser.user.username}). Skipping.`)
                    return; // Skip to next user
                }

                const memberId = matchingCharacter.id;
                const memberName = matchingCharacter.name;
                console.log('\x1b[34m%s\x1b[0m', `Linking Discord user ${discordUser.id} (${discordUser.user.username}) to character ${memberName} (ID: ${memberId}).`);
                await this.discordMembersRepository.insert({
                    discordUserId: discordUser.id,
                    memberId,
                    discordUser: { id: discordUser.id, username: discordUser.user.username },
                    memberName,
                    guildId,
                });
            } catch (error: any) {
                console.error(`Error processing Discord user ${discordUser.id} (${discordUser.user.username}):`, error.message || error);
            }
        }));

    }
}