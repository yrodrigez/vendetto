export type ResetSubscribedMember = {
    discordUserId: string;
}

export interface ResetParticipantRepositoryPort {
    findSubscribedMembers(resetId: string): Promise<ResetSubscribedMember[]>;
    findActiveResets(): Promise<ActiveReset[]>;
}

export type ActiveReset = {
    id: string;
    raid: { name: string };
    raid_date: string;
    time: string;
    end_date: string;
    end_time: string;
}
