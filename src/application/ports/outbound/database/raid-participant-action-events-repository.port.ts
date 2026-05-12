export type RaidParticipantActionEventName =
    | 'raid_bench_player'
    | 'raid_unbench_player'
    | 'raid_remove_player'
    | 'move_participant'
    | 'raid_change_player_role'
    | 'raid_change_player_status';

export type RaidParticipantActionEvent = {
    discordUserId: string;
    memberId: number;
    memberName: string;
    eventName: RaidParticipantActionEventName;
    createdAt: Date;
    previousRole: string | null;
    newRole: string | null;
    previousStatus: string | null;
    newStatus: string | null;
    resetId: string | null;
    raidName: string | null;
    raidDate: string | null;
    fromResetId: string | null;
    fromRaidName: string | null;
    fromRaidDate: string | null;
    toResetId: string | null;
    toRaidName: string | null;
    toRaidDate: string | null;
};

export interface IRaidParticipantActionEventsRepositoryPort {
    findRecentEvents(timeWindowSeconds: number, exclusionWindowSeconds?: number): Promise<RaidParticipantActionEvent[]>;
}
