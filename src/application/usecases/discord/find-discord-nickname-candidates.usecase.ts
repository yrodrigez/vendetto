import { DiscordNicknameCandidateRepositoryPort } from "@/application/ports/outbound/discord-nickname-candidate-repository.port";

export class FindDiscordNicknameCandidatesUseCase {
    constructor(
        private readonly discordNicknameCandidateRepository: DiscordNicknameCandidateRepositoryPort,
    ) { }

    async execute() {
        return await this.discordNicknameCandidateRepository.findSelectedMembersWithDiscordAccount();
    }
}
