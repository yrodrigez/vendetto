import { createServerComponentClient } from "../../../supabase";
import { IUrlRegistrationPort } from "../../../application/ports/delivery/IUrlRegistrationPort";
import crypto from 'crypto';

function generateShortCode(length = 6) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
}

export class SupabaseUrlRepository implements IUrlRegistrationPort {
    async registerUrls(deliveryId: number, urls: string[]): Promise<{ id: string, url: string, deliveryId: number }[]> {
        if (!urls || urls.length === 0) {
            return []
        }

        const tableName = 'urls'
        const supabase = createServerComponentClient({ schema: 'open_campaign' })

        // delete urls older than 30 days
        await supabase.from(tableName).delete().lte('created_at', new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString())

        const { error, data } = await supabase
            .from(tableName)
            .insert(urls.map(url => ({ url, delivery_id: deliveryId, id: generateShortCode(8) })))
            .select('id, url, deliveryId: delivery_id')

        if (error) {
            console.error('Error saving urls', error)
            return []
        }

        return data as { id: string, url: string, deliveryId: number }[] || []
    }
}
