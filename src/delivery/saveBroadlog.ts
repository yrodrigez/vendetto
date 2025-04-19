import {createServerComponentClient} from "../supabase";

export async function saveBroadlog(deliveryId: number, data: {
    text: string,
    to: string,
    last_event: 'success' | 'error',
    channel: 'discord'
    communication_code: string
}[]) {
    const supabase = createServerComponentClient({schema: 'open_campaign'})

    const {error, data: broadlogIds} = await supabase
        .from('broadlog')
        .insert(data.map((broadlog) => ({
            ...broadlog,
            delivery_id: deliveryId
        })))
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