import { createServerComponentClient } from "@/supabase";
import { BroadlogRepositoryPort, BroadlogData } from "@/application/ports/outbound/delivery/broadlog-repository.port";

export class SupabaseBroadlogRepository implements BroadlogRepositoryPort {
    async saveBroadlog(deliveryId: number, data: BroadlogData[]): Promise<{ broadlogIds?: { id: string }[], error?: any }> {
        const supabase = createServerComponentClient({ schema: 'open_campaign' })

        const { error, data: broadlogIds } = await supabase
            .from('broadlog')
            .insert(data.map((broadlog) => ({
                ...broadlog,
                delivery_id: deliveryId
            })))
            .select('id')

        if (error) {
            console.error('Error saving broadlog', error)
            return { error }
        }
        return { error, broadlogIds: broadlogIds as { id: string }[] }
    }

    async registerBroadlogIdInUrl(broadlogId: string, urlId: string): Promise<void> {
        const supabase = createServerComponentClient({ schema: 'open_campaign' })

        const { error } = await supabase
            .from('urls')
            .update({ broadlog_id: broadlogId })
            .eq('id', urlId)

        if (error) {
            console.error('Error updating URL with broadlog ID', error)
        }
    }
}
