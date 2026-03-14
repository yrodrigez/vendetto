import { DeliveryRepositoryPort } from "@/application/ports/outbound/delivery/delivery-repository.port";
import { createServerComponentClient } from "@/supabase";

export class DeliveryRepository implements DeliveryRepositoryPort {
    private readonly supabase = createServerComponentClient({ schema: 'open_campaign' })

    async findDeliveryByName(name: string): Promise<{ id: number; name: string; } | null> {
        const { data: delivery, error } = await this.supabase
            .from('deliveries')
            .select('id, name')
            .eq('name', name)
            .single<{ id: number; name: string; }>()

        if (error) {
            console.error('Error fetching delivery by name:', error)
            return null
        }

        return delivery
    }

}