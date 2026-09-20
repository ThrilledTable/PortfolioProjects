import { ApiRequest, ApiResponse, bearerToken, guardMethod, sendError } from '../_lib/http';
import { destroySession } from '../_lib/sessions';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!guardMethod(req, res, ['POST'])) return;
  try {
    const token = bearerToken(req);
    // Signing out is idempotent: an already-dead token still reports success,
    // so a client can always reach a signed-out state.
    if (token) await destroySession(token);
    res.status(200).json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
}
