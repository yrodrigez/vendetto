import {createServerComponentClient} from "../supabase";

export async function findDeliveryByName(name: string) {
    const supabase = createServerComponentClient({schema: 'open_campaign'})
    const {data: delivery, error: deliveryError} = await supabase.from('deliveries').select('id')
        .eq('name', name)
        .single<{ id: number }>()

    if (deliveryError) {
        console.error('Error fetching delivery ID:', deliveryError);
        throw new Error('No delivery ID found.')
    }

    if (!delivery) {
        throw new Error('No delivery ID found.')
    }
    return delivery.id;
}