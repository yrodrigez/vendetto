import {createServerComponentClient} from "../supabase";

export async function registerBroadlogIdInUrl(broadlogId: string, urlId: string) {
    const supabase = createServerComponentClient({schema: 'open_campaign'})

    const {error} = await supabase
        .from('urls')
        .update({broadlog_id: broadlogId})
        .eq('id', urlId)

    if (error) {
        console.error('Error updating URL with broadlog ID', error)
    }
}