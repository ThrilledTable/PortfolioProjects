import { createHash } from 'crypto';
import { query } from './db';
import { HttpError } from './http';

export interface Limit {
  /** Distinguishes the counters, e.g. 'login:ip'. */
  name: string;
  max: number;
  windowSeconds: number;
}

/** Emails are hashed into the bucket key so the attempts table holds no addresses. */
function bucketKey(limit: Limit, subject: string): string {
  const digest = createHash('sha256').update(subject).digest('base64url').slice(0, 22);
  return `${limit.name}:${digest}`;
}

/**
 * Counts one attempt and throws 429 once `max` is exceeded within the window.
 * Postgres-backed rather than in-memory because each lambda invocation may be
 * a different container, which makes an in-process counter close to useless.
 */
export async function consumeAttempt(limit: Limit, subject: string): Promise<void> {
  const bucket = bucketKey(limit, subject);
  const rows = await query<{ recent: string }>(
    `WITH inserted AS (
       INSERT INTO auth_attempts (bucket) VALUES ($1) RETURNING bucket
     )
     SELECT count(*)::text AS recent
       FROM auth_attempts
      WHERE bucket = $1
        AND happened_at > now() - ($2 || ' seconds')::interval`,
    [bucket, String(limit.windowSeconds)]
  );
  const recent = Number(rows[0]?.recent ?? 0);
  if (recent > limit.max) {
    throw new HttpError(
      429,
      'rate_limited',
      'Too many attempts. Wait a few minutes and try again.'
    );
  }
}

/** Clears a subject's counter, e.g. after a sign-in that succeeded. */
export async function clearAttempts(limit: Limit, subject: string): Promise<void> {
  await query('DELETE FROM auth_attempts WHERE bucket = $1', [bucketKey(limit, subject)]);
}

/**
 * Drops rows no window could still be counting. Called opportunistically so
 * the table does not need a scheduled job.
 */
export async function pruneAttempts(): Promise<void> {
  await query("DELETE FROM auth_attempts WHERE happened_at < now() - interval '1 day'");
}

export const LOGIN_BY_EMAIL: Limit = { name: 'login:email', max: 10, windowSeconds: 900 };
export const LOGIN_BY_IP: Limit = { name: 'login:ip', max: 40, windowSeconds: 900 };
export const REGISTER_BY_IP: Limit = { name: 'register:ip', max: 5, windowSeconds: 3600 };
