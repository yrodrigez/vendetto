import { postgresConfig } from "../config";
import { Pool } from 'pg'

const cleanEnvVar = (str?: string) =>
  (str ?? "").replace(/^"+|"+$/g, "").trim();

const {
  user,
  password,
  host,
  port,
  database,
  ssl
} = postgresConfig;

if (!user || !password || !host || !port || !database) {
  throw new Error('Missing PostgreSQL configuration');
}

const cleanUser = cleanEnvVar(user);
const cleanPass = cleanEnvVar(password);
const cleanHost = cleanEnvVar(host);
const cleanPort = cleanEnvVar(port);
const cleanDb   = cleanEnvVar(database);

console.log('Connecting to Postgres at', `${cleanHost}:${cleanPort}/${cleanDb}`);
console.log('Postgres SSL:', ssl);
console.log('Postgres User:', cleanUser);

const connectionString =
  `postgresql://${cleanUser}:${cleanPass}@${cleanHost}:${cleanPort}/${cleanDb}`;

// Enmascarar user/pass en los logs
console.log(
  'Postgres connectionString:',
  connectionString.replace(/\/\/.*:.*@/, '//****:****@')
);

const pool = new Pool({
  connectionString,
  ssl: ssl ? { rejectUnauthorized: false } : false,
});

export async function safeQuery<T>(fn: () => Promise<T>): Promise<{ data: T, error: undefined } | { data: undefined, error: any }> {
  try {
    const data = await fn();
    return { data, error: undefined };
  } catch (error) {
    return { error, data: undefined };
  }
}

export default pool;
