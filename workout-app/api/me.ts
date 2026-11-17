import { query } from './_lib/db';
import { ApiRequest, ApiResponse, guardMethod, sendError } from './_lib/http';
import { requireUser } from './_lib/sessions';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!guardMethod(req, res, ['GET'])) return;
  try {
    const user = await requireUser(req);
    const rows = await query<{ revision: string | null; updated_at: Date | null }>(
      'SELECT revision::text AS revision, updated_at FROM backups WHERE user_id = $1',
      [user.id]
    );
    res.status(200).json({
      user,
      backup: rows[0]
        ? { revision: Number(rows[0].revision), updatedAt: rows[0].updated_at?.toISOString() ?? null }
        : { revision: 0, updatedAt: null },
    });
  } catch (error) {
    sendError(res, error);
  }
}
