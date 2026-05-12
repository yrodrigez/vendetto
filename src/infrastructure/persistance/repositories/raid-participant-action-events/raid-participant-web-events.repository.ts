import {
    IRaidParticipantActionEventsRepositoryPort,
    RaidParticipantActionEvent,
    RaidParticipantActionEventName,
} from "@/application/ports/outbound/database/raid-participant-action-events-repository.port";
import { DatabaseClient } from "@/infrastructure/database/db";
import { readResourceFile } from "@/util/file-resource-helper";

type RaidParticipantActionEventRow = {
    discord_user_id: string;
    member_id: number;
    member_name: string;
    event_name: RaidParticipantActionEventName;
    created_at: Date;
    reset_id: string | null;
    raid_name: string | null;
    raid_date: string | null;
    from_reset_id: string | null;
    from_raid_name: string | null;
    from_raid_date: string | null;
    to_reset_id: string | null;
    to_raid_name: string | null;
    to_raid_date: string | null;
    previous_role: string | null;
    new_role: string | null;
    previous_status: string | null;
    new_status: string | null;
};

function mapRaidParticipantActionEvent(row: RaidParticipantActionEventRow): RaidParticipantActionEvent {
    return {
        discordUserId: row.discord_user_id,
        memberId: row.member_id,
        memberName: row.member_name,
        eventName: row.event_name,
        createdAt: row.created_at,
        resetId: row.reset_id,
        raidName: row.raid_name,
        raidDate: row.raid_date,
        fromResetId: row.from_reset_id,
        fromRaidName: row.from_raid_name,
        fromRaidDate: row.from_raid_date,
        toResetId: row.to_reset_id,
        toRaidName: row.to_raid_name,
        toRaidDate: row.to_raid_date,
        previousRole: row.previous_role,
        newRole: row.new_role,
        previousStatus: row.previous_status,
        newStatus: row.new_status,
    };
}

export class RaidParticipantWebEventsRepository implements IRaidParticipantActionEventsRepositoryPort {
    constructor(private readonly databaseClient: DatabaseClient) { }

    async findRecentEvents(timeWindowSeconds: number, exclusionWindowSeconds: number = timeWindowSeconds): Promise<RaidParticipantActionEvent[]> {
        const query = readResourceFile(__dirname, '/sql/find-recent-events.sql');
        const results = await this.databaseClient.query<RaidParticipantActionEventRow>(query, [timeWindowSeconds, exclusionWindowSeconds]);
        return results.map(mapRaidParticipantActionEvent);
    }
}
