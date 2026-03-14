import { DiscordEvent } from "@/infrastructure/discord/events/event.interface";
import { ClientEvents, Events, GuildMember } from "discord.js";
import { FindDiscordNicknameCandidatesUseCase } from "../usecases/discord/find-discord-nickname-candidates.usecase";

import { DiscordChannelLoggerPort } from "../ports/outbound/discord-channel-logger.port";
import { UpdateDiscordNicknameToCharacterNameUseCase } from "../usecases/discord/update-discord-nickname.usecase";

export class UpdateUserNicknameOnLoginEvent implements DiscordEvent {
    public readonly name: keyof ClientEvents = Events.GuildMemberAdd;
    public readonly once = false;
    constructor(
        private readonly findNicknameCandidatesUseCase: FindDiscordNicknameCandidatesUseCase,
        private readonly updateNicknameUseCase: UpdateDiscordNicknameToCharacterNameUseCase,
        private readonly logger: DiscordChannelLoggerPort,
    ) { }
    async execute(member: GuildMember): Promise<void> {
        const candidates = await this.findNicknameCandidatesUseCase.execute();
        if (candidates.length === 0) {
            console.log(`No nickname candidates found for user ${member.user.tag} in guild ${member.guild.name}`);
            this.logger.log(member.guild.id, `No nickname candidates found for user ${member.user.toString()} on login.`).catch(console.error);
            return;
        }

        const candidate = candidates.find(c => c.discordUserId === member.user.id);
        if (!candidate) {
            console.log(`No nickname candidate found for user ${member.user.tag} in guild ${member.guild.name}`);
            this.logger.log(member.guild.id, `No nickname candidate found for user ${member.user.toString()} on login.`).catch(console.error);
            return;
        }

        this.logger.log(member.guild.id, `Nickname candidate found for user ${member.user.toString()} on login: ${candidate.characterName}`).catch(console.error);
        const { error } = await this.updateNicknameUseCase.execute(member.user.id, candidate.characterName, member.guild.id);
        if (error) {
            console.error(`Failed to update nickname for user ${member.user.tag} in guild ${member.guild.name}:`, error);
            this.logger.log(member.guild.id, `Failed to update nickname for user ${member.user.toString()} on login.`).catch(console.error);
        } else {
            console.log(`Successfully updated nickname for user ${member.user.tag} in guild ${member.guild.name}`);
            this.logger.log(member.guild.id, `Successfully updated nickname for user ${member.user.toString()} on login.`).catch(console.error);
        }
    }
}