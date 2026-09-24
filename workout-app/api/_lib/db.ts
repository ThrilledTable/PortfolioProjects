import { Pool, PoolClient } from 'pg';
import { HttpError } from './http';

/**
 * One pool per warm lambda. `global` is used deliberately: Vercel may reuse a
 * container across invocations, and a fresh pool per request would exhaust
 * Postgres connections under any load at all.
 */
declare global {
  // eslint-disable-next-line no-var
  var __workoutPool: Pool | undefined;
}

/** Whether a database URL is present at all, without throwing when it is not. */
export function isDatabaseConfigured(): boolean {
  return Boolean(
    process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL
  );
}

function connectionString(): string {
  const url =
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL;
  if (!url) {
    // Reached whenever the project has no database attached yet, which is a
    // setup state rather than a crash -- say so instead of a blank 500.
    throw new HttpError(
      503,
      'not_configured',
      'Backup is not set up on this server yet.'
    );
  }
  return url;
}

export function pool(): Pool {
  if (!global.__workoutPool) {
    const url = connectionString();
    global.__workoutPool = new Pool({
      connectionString: url,
      // Hosted Postgres (Neon, Supabase, Vercel) terminates TLS with a cert
      // chain the lambda does not carry. A local dev database has no TLS.
      ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return global.__workoutPool;
}

export async function query<T>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await pool().query(text, params);
  return result.rows as T[];
}

/** Runs `fn` inside a transaction, rolling back if it throws. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
