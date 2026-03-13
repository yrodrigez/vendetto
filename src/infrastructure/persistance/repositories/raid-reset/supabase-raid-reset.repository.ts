import { createServerComponentClient } from "@/supabase";
import { RaidParticipant, RaidReset } from "@/domain/raid/models";
import { RaidResetRepository } from "@/domain/raid/raid-reset.repository";

export class SupabaseRaidResetRepository implements RaidResetRepository {
    async findRaidReset(resetId: string): Promise<RaidReset | null> {
        const supabase = createServerComponentClient();
        const { data: reset, error } = await supabase
            .from('raid_resets')
            .select('id, name, raid:ev_raid(name, id), raid_date, end_date, time, end_time')
            .eq('id', resetId)
            .single<{
                id: string,
                name: string,
                raid: {
                    id: string,
                    name: string
                },
                raid_date: string,
                end_date: string,
                time: string,
                end_time: string
            }>();

        if (error) {
            console.error('Error fetching raid reset', error);
            return null;
        }

        return reset;
    }

    async findParticipants(resetId: string): Promise<RaidParticipant[]> {
        const supabase = createServerComponentClient();
        const { data: participants, error } = await supabase
            .from('ev_raid_participant')
            .select('member_id, raid:raid_resets!inner(name, raid_date)')
            .eq('raid_id', resetId)
            .gte('raid_resets.raid_date', new Date().toISOString())
            .neq('details->>status', 'declined')
            .neq('details->>status', 'benched');

        if (error) {
            console.error('Error fetching participants', error);
            return [];
        }

        if (!participants.length) {
            return [];
        }

        const { data: discordUsers, error: discordError } = await supabase
            .from('discord_members')
            .select('*')
            .in('member_id', participants.map(p => p.member_id));

        if (discordError) {
            console.error('Error fetching discord users', discordError);
            return [];
        }

        return discordUsers.map(user => ({
            id: user.discord_user_id,
            name: user.name,
            //@ts-ignore
            raidName: participants[0].raid.name
        }));
    }
}
