import { RaidParticipant, RaidReset } from "./models";

export interface RaidResetRepository {
    findRaidReset(resetId: string): Promise<RaidReset | null>;
    findParticipants(resetId: string): Promise<RaidParticipant[]>;
    getUpcomingRaids(start: string, end: string): Promise<RaidReset[]>;
    findResetParticipants(resetId: string): Promise<RaidParticipant[]>;
}
