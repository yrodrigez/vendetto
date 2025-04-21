import {createServerComponentClient} from '../supabase';

export async function getUserRoles(userId: string): Promise<string[]> {
    const supabase = createServerComponentClient()

    const {data: discordMember, error: discordError} = await supabase
        .from('discord_members')
        .select('member_id, member:ev_member!inner(updated_at)')
        .eq('discord_user_id', userId)
        .order(`member(updated_at)`, {
            ascending: false,
        })
        .limit(1)
        .single()

    if (discordError) {
        console.error('Error fetching discord member:', discordError, userId)
        return []
    }

    if (!discordMember) {
        return []
    }

    const member_id = discordMember.member_id

    const {data, error} = await supabase
        .from('ev_member_role')
        .select('role')
        .eq('member_id', member_id)


    if (error) {
        console.error('Error fetching user roles:', error, userId, data)
        return []
    }

    if (!data) {
        return []
    }

    return data.map((role) => role.role)
}