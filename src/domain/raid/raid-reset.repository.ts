import { RaidParticipant, RaidReset } from "./models";

export interface RaidResetRepository {
    findRaidReset(resetId: string): Promise<RaidReset | null>;
    findParticipants(resetId: string): Promise<RaidParticipant[]>;
}
