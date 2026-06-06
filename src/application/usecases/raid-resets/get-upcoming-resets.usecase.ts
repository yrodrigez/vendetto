import { RaidResetRepository } from "@/domain/raid/raid-reset.repository";

export class GetUpcomingResetsUseCase {
    constructor(private raidResetRepository: RaidResetRepository) { }

    async execute() {
        const resets = await this.raidResetRepository.getUpcomingRaids();
        const withParticipants = await Promise.all(resets.map(async (reset) => {
            const participants = await this.raidResetRepository.findResetParticipants(reset.id);
            return { ...reset, participants };
        }));
        return withParticipants;
    }
}