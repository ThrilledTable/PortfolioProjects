import { createHash, randomBytes } from 'crypto';
import { query } from './db';
import { ApiRequest, bearerToken, unauthorized } from './http';

const SESSION_DAYS = 90;

/**
 * The token is high-entropy and never guessed, so a plain lookup by its digest
 * is safe; what matters is that the digest, not the token, is what we store.
 */
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export interface AuthedUser {
  id: string;
  email: string;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString('base64url');
  const rows = await query<{ expires_at: Date }>(
    `INSERT INTO auth_sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + ($3 || ' days')::interval)
     RETURNING expires_at`,
    [digest(token), userId, String(SESSION_DAYS)]
  );
  return { token, expiresAt: rows[0].expires_at.toISOString() };
}

export async function destroySession(token: string): Promise<void> {
  await query('DELETE FROM auth_sessions WHERE token_hash = $1', [digest(token)]);
}

/** Resolves the caller, or throws 401. Also refreshes `last_used_at`. */
export async function requireUser(req: ApiRequest): Promise<AuthedUser> {
  const token = bearerToken(req);
  if (!token) throw unauthorized();
  const rows = await query<{ id: string; email: string }>(
    `UPDATE auth_sessions
        SET last_used_at = now()
      WHERE token_hash = $1
        AND expires_at > now()
     RETURNING (SELECT id FROM users WHERE users.id = auth_sessions.user_id) AS id,
               (SELECT email FROM users WHERE users.id = auth_sessions.user_id) AS email`,
    [digest(token)]
  );
  const user = rows[0];
  if (!user?.id) throw unauthorized('Your session has expired. Sign in again.');
  return { id: user.id, email: user.email };
}

/** Removes expired rows. Called opportunistically on sign-in. */
export async function pruneSessions(): Promise<void> {
  await query('DELETE FROM auth_sessions WHERE expires_at < now()');
}
