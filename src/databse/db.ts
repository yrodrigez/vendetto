import {postgresConfig} from "../config";
import {Pool} from 'pg'

const {
    user,
    password,
    host,
    port,
    database,
    ssl
} = postgresConfig

if (!user || !password || !host || !port || !database) {
    throw new Error('Missing PostgreSQL configuration')
}

const pool = new Pool({
    connectionString: `postgresql://${user}:${password}@${host}:${port}/${database}`,
    ssl: ssl ? {rejectUnauthorized: false} : false,
})

export async function safeQuery<T>(fn: () => Promise<T>): Promise<{ data: T, error: undefined } | { data: undefined, error: any }> {
    try {
        const data = await fn()
        return { data, error: undefined }
    } catch (error) {
        return { error, data: undefined }
    }
}


export default pool
