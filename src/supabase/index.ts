import dotenv from 'dotenv';
import {type SupabaseClient, createClient as createServerClient} from "@supabase/supabase-js";

dotenv.config();

export function createServerComponentClient(options?: { schema: string }): SupabaseClient {

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {db: {schema: options?.schema ? options.schema : 'public'}}
    ) as SupabaseClient
}
