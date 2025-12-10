
import {type SupabaseClient, createClient as createServerClient} from "@supabase/supabase-js";
import { getEnvironmentVariable } from "../infrastructure/environment";

export function createServerComponentClient(options?: { schema: string }): SupabaseClient {

    const environment = getEnvironmentVariable();

    return createServerClient(
        environment.supabaseUrl,
        environment.supabaseAnnonKey,
        {db: {schema: options?.schema ? options.schema : 'public'}}
    ) as SupabaseClient
}
