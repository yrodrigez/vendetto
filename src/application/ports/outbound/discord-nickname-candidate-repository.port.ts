import { DiscordNicknameCandidate } from "@/application/dto/discord-nickname-candidate.dto";

export interface DiscordNicknameCandidateRepositoryPort {
    findSelectedMembersWithDiscordAccount(): Promise<DiscordNicknameCandidate[]>
}