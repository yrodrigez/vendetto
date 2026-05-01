export interface RaidReset {
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
}

export interface RaidParticipant {
    id: string;
    name: string;
    raidName: string;
}