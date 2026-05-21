import { DiscordMembersRepositoryPort } from "@/application/ports/outbound/database/discord-members-repository.port";
import { MemberRepositoryPort } from "@/application/ports/outbound/database/member-repository.port";
import { UsersRepositoryPort } from "@/application/ports/outbound/database/users-repository.port";
import { DiscordApiPort } from "@/application/ports/outbound/discord-api.port";

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

        const realUsers = allDiscordUsers.filter(user => !user.user.bot);
        console.log(`Found ${allDiscordUsers.length} total members in Discord guild, ${realUsers.length} of them are real users (non-bots).`);
        console.log(`Found ${selectedCharacters.length} selected characters in the database.`);

        const discordUserIds = realUsers.map(user => user.id);
        const databaseMembers = await this.discordMembersRepository.findAllByUserIds(discordUserIds);
        const databaseMemberIds = new Set(databaseMembers.map(member => member.discord_user_id));
        console.log(`Found ${databaseMembers.length} members in the database linked to Discord accounts.`);

        const usersLinkedToDiscordAccounts = await this.usersRepository.findAllByDiscordIds(discordUserIds);
        const usersLinkedToDiscordAccountIds = new Set(usersLinkedToDiscordAccounts.map(link => link.discordId));
        console.log(`Found ${usersLinkedToDiscordAccounts.length} users in the database linked to Discord accounts.`);

        const payload = realUsers.map(discordUser => {
            try {
                if (databaseMemberIds.has(discordUser.id)) {
                    const existingMember = databaseMembers.find(member => member.discord_user_id === discordUser.id);
                    console.log(`Discord user ${discordUser.id} already exists in database with member ID ${existingMember?.member_id}. Skipping.`);
                    return; // Skip to next user
                }

                const existsByDiscordId = usersLinkedToDiscordAccountIds.has(discordUser.id);
                if (existsByDiscordId) {
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
                return ({
                    discordUserId: discordUser.id,
                    memberId,
                    discordUser: { id: discordUser.id, username: discordUser.user.username },
                    memberName,
                    guildId,
                });
            } catch (error: any) {
                console.error(`Error processing Discord user ${discordUser.id} (${discordUser.user.username}):`, error.message || error);
            }
        }).filter(x => !!x);

        if (payload.length === 0) {
            console.log('No new Discord members to insert into the database. Exiting.');
            return;
        }
        
        console.log(`Inserting ${payload.length} new Discord members into the database...`);
        const insertedMembers = await this.discordMembersRepository.insertMany(payload);
        if (insertedMembers.length > 0) {
            console.log(`Successfully upserted ${insertedMembers.length} new Discord members into the database.`);
        } else {
            console.log(`No new Discord members were inserted into the database.`);
        }
    }
}