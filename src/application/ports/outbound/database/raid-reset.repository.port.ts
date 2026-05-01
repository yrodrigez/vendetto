import { RaidReset } from "@/domain/raid/models";

export interface RaidResetRepositoryPort {
  findOpenReservations(): Promise<RaidReset[]>;
  updateReservationsClosed(resetId: string): Promise<void>;
}