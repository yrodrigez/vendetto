import { RaidResetRepository } from "@/domain/raid/raid-reset.repository";
import moment from "moment";

export type GetUpcomingResetsUseCaseOutput = Array<{
    id: string;
    name: string;
    raid: {
        id: string;
        name: string;
    };
    raid_date: string;
    end_date: string;
    time: string;
    end_time: string;
    reservations_closed: boolean;
    participants: Array<{
        id: string;
        name: string;
        raidName: string;
        role: string;
    }>;
}>;

export class GetUpcomingResetsUseCase {
    constructor(private raidResetRepository: RaidResetRepository) { }

    async execute(): Promise<GetUpcomingResetsUseCaseOutput> {
        const from = moment().format('YYYY-MM-DD');
        const to = moment().add(3, 'days').format('YYYY-MM-DD');
        const resets = await this.raidResetRepository.getUpcomingRaids(from, to);
        if (resets.length === 0) {
            return [];
        }
        const withParticipants = await Promise.all(resets.map(async (reset) => {
            const participants = await this.raidResetRepository.findResetParticipants(reset.id);
            return { ...reset, participants };
        }));
        return withParticipants;
    }
}