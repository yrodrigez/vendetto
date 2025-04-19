import {createServerComponentClient} from "../supabase";

export async function saveBroadlog(data: {
    text: string,
    to: string,
    last_event: 'success' | 'error',
    channel: 'discord'
}[]) {
    const supabase = createServerComponentClient({schema: 'open_campaign'})

    const {error, data: broadlogIds} = await supabase
        .from('broadlog')
        .insert(data)
        .select('id')

    if(error) {
        console.error('Error saving broadlog', error)
        return {
            error
        }
    }
    return {
        error,
        broadlogIds
    }
}