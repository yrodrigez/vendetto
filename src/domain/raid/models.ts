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
}

export interface RaidParticipant {
    id: string;
    name: string;
    raidName: string;
}
