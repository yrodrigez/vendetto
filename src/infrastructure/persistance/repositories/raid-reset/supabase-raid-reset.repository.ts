import { RaidParticipant, RaidReset } from "@/domain/raid/models";
import { RaidResetRepository } from "@/domain/raid/raid-reset.repository";
import { createServerComponentClient } from "@/supabase";
import moment, { now } from "moment";

export class SupabaseRaidResetRepository implements RaidResetRepository {
    async findResetParticipants(resetId: string): Promise<RaidParticipant[]> {
        const supabase = createServerComponentClient();
        const { data: participants, error } = await supabase
            .from('ev_raid_participant')
            .select('member_id, raid:raid_resets!inner(name, raid_date), details, character_object:ev_member!inner(character)')
            .eq('raid_id', resetId)
            .gte('raid_resets.raid_date', new Date().toISOString())
            .eq('details->>status', 'confirmed')
            .overrideTypes<Array<{
                member_id: string;
                raid: {
                    name: string;
                    raid_date: string;
                };
                details: {
                    status: string;
                    role: string;
                };
                character_object: {
                    character: {
                        name: string;
                    };
                };
            }>>();

        if (error) {
            console.error('Error fetching participants', error);
            return [];
        }

        if (!participants.length) {
            return [];
        }

        return participants.map(p => ({
            id: p.member_id,
            raidName: p.raid.name,
            role: p.details.role,
            name: p.character_object.character.name,
        }));
    }
    async getUpcomingRaids(start: string, end: string): Promise<RaidReset[]> {
        const supabase = createServerComponentClient();

        const { data: resets, error } = await supabase
            .from('raid_resets')
            .select('id, name, raid:ev_raid(name, id), raid_date, end_date, time, end_time, reservations_closed')
            .gt('raid_date', start)
            .lt('raid_date', end)
            .overrideTypes<RaidReset[]>();

        if (error) {
            console.error('Error fetching upcoming raids', error);
            return [];
        }

        return resets;
    }
    async findRaidReset(resetId: string): Promise<RaidReset | null> {
        const supabase = createServerComponentClient();
        const { data: reset, error } = await supabase
            .from('raid_resets')
            .select('id, name, raid:ev_raid(name, id), raid_date, end_date, time, end_time, reservations_closed')
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
                end_time: string,
                reservations_closed: boolean
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
            .select('member_id, raid:raid_resets!inner(name, raid_date), details')
            .eq('raid_id', resetId)
            .gte('raid_resets.raid_date', new Date().toISOString())
            .eq('details->>status', 'confirmed')
            .overrideTypes<Array<{
                member_id: string;
                raid: {
                    name: string;
                    raid_date: string;
                };
                details: {
                    status: string;
                    role: string;
                };
            }>>();

        if (error) {
            console.error('Error fetching participants', error);
            return [];
        }

        if (!participants.length) {
            return [];
        }

        const { data: discordUsers, error: discordError } = await supabase
            .from('discord_members')
            .select('discord_user_id, name')
            .in('member_id', participants.map(p => p.member_id));

        if (discordError) {
            console.error('Error fetching discord users', discordError);
            return [];
        }

        return discordUsers.map(user => ({
            id: user.discord_user_id,
            name: user.name,
            //@ts-ignore
            raidName: participants[0].raid.name,
            role: participants.find(p => p.member_id === user.discord_user_id)?.details.role || 'unknown',
        }));
    }

    async findOpenReservations(): Promise<RaidReset[]> {
        const supabase = createServerComponentClient();
        const { data: resets, error } = await supabase
            .from('raid_resets')
            .select('id, name, raid_date, time, reservations_closed')
            .eq('reservations_closed', false)
            .overrideTypes<RaidReset[]>();

        if (error) {
            console.error('Error fetching open reservations', error);
            return [];
        }

        return resets;
    }

    async updateReservationsClosed(resetId: string): Promise<void> {
        const supabase = createServerComponentClient();
        const { error } = await supabase
            .from('raid_resets')
            .update({ reservations_closed: true })
            .eq('id', resetId);

        if (error) {
            console.error('Error updating reservations closed', error);
            throw new Error('Failed to update reservations closed status');
        }
    }
}
