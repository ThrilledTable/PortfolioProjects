import { query } from '../_lib/db';
import { ApiRequest, ApiResponse, clientIp, guardMethod, HttpError, jsonBody, sendError } from '../_lib/http';
import { hashPassword } from '../_lib/passwords';
import { consumeAttempt, pruneAttempts, REGISTER_BY_IP } from '../_lib/rateLimit';
import { createSession } from '../_lib/sessions';
import { normalizeEmail, readNewPassword } from '../_lib/validate';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!guardMethod(req, res, ['POST'])) return;
  try {
    const body = jsonBody(req);
    const email = normalizeEmail(body.email);
    const password = readNewPassword(body.password);

    await consumeAttempt(REGISTER_BY_IP, clientIp(req));

    const passwordHash = await hashPassword(password);
    // ON CONFLICT rather than a SELECT-then-INSERT: two devices registering the
    // same address at once would both pass the check and one would 500.
    const rows = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email, passwordHash]
    );
    if (rows.length === 0) {
      // This does leak that an address is registered. For an app whose users
      // are a handful of people who know each other, a clear message beats
      // the enumeration hardening a public signup would need.
      throw new HttpError(409, 'email_taken', 'That email already has an account.');
    }

    const session = await createSession(rows[0].id);
    void pruneAttempts().catch(() => {});
    res.status(201).json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: rows[0].id, email },
    });
  } catch (error) {
    sendError(res, error);
  }
}
