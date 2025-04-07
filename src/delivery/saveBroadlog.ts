import {createServerComponentClient} from "../supabase";

export async function saveBroadlog(data: {
    text: string,
    to: string,
    last_event: 'success' | 'error',
    channel: 'discord'
}[]) {
    const supabase = createServerComponentClient({schema: 'open_campaign'})

    const {error} = await supabase
        .from('broadlog')
        .insert(data)

    if(error) {
        console.error('Error saving broadlog', error)
        return {
            error
        }
    }
    return {
        error
    }
}