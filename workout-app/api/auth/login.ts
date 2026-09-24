import { query } from '../_lib/db';
import { ApiRequest, ApiResponse, clientIp, guardMethod, HttpError, jsonBody, sendError } from '../_lib/http';
import { verifyPassword } from '../_lib/passwords';
import { clearAttempts, consumeAttempt, LOGIN_BY_EMAIL, LOGIN_BY_IP } from '../_lib/rateLimit';
import { createSession, pruneSessions } from '../_lib/sessions';
import { normalizeEmail, readPassword } from '../_lib/validate';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!guardMethod(req, res, ['POST'])) return;
  try {
    const body = jsonBody(req);
    const email = normalizeEmail(body.email);
    const password = readPassword(body.password);

    // Per-email stops one account being ground down; per-IP stops one source
    // spreading its guesses across many accounts to stay under that limit.
    await consumeAttempt(LOGIN_BY_IP, clientIp(req));
    await consumeAttempt(LOGIN_BY_EMAIL, email);

    const rows = await query<{ id: string; password_hash: string }>(
      'SELECT id, password_hash FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];
    // Hash against a dummy when the account is missing so the response time
    // does not say whether the address exists.
    const stored = user?.password_hash ?? 'scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA';
    const ok = await verifyPassword(password, stored);

    if (!user || !ok) {
      throw new HttpError(401, 'invalid_credentials', 'Invalid email or password.');
    }

    await clearAttempts(LOGIN_BY_EMAIL, email);
    const session = await createSession(user.id);
    void pruneSessions().catch(() => {});
    res.status(200).json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: user.id, email },
    });
  } catch (error) {
    sendError(res, error);
  }
}
