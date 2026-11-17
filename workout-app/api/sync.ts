import { query, transaction } from './_lib/db';
import { ApiRequest, ApiResponse, guardMethod, HttpError, jsonBody, sendError } from './_lib/http';
import { assertBackupPayload, readDeviceLabel, readRevision } from './_lib/payload';
import { requireUser } from './_lib/sessions';

interface BackupRow {
  revision: string;
  data: Record<string, unknown>;
  device_label: string | null;
  updated_at: Date;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!guardMethod(req, res, ['GET', 'POST'])) return;
  try {
    const user = await requireUser(req);
    if (req.method === 'GET') return await pull(user.id, res);
    return await push(user.id, req, res);
  } catch (error) {
    sendError(res, error);
  }
}

async function pull(userId: string, res: ApiResponse) {
  const rows = await query<BackupRow>(
    `SELECT revision::text AS revision, data, device_label, updated_at
       FROM backups WHERE user_id = $1`,
    [userId]
  );
  const row = rows[0];
  // Revision 0 means "nothing stored yet", which is what a fresh account and a
  // fresh device agree on, so the first push from either side is not a conflict.
  if (!row) {
    res.status(200).json({ revision: 0, data: null, updatedAt: null, deviceLabel: null });
    return;
  }
  res.status(200).json({
    revision: Number(row.revision),
    data: row.data,
    updatedAt: row.updated_at.toISOString(),
    deviceLabel: row.device_label,
  });
}

async function push(userId: string, req: ApiRequest, res: ApiResponse) {
  const body = jsonBody(req);
  const baseRevision = readRevision(body.baseRevision);
  const data = assertBackupPayload(body.data);
  const deviceLabel = readDeviceLabel(body.deviceLabel);

  const result = await transaction(async (client) => {
    // SELECT ... FOR UPDATE so two devices pushing at the same moment cannot
    // both read the same revision and both think they won.
    const existing = await client.query<{ revision: string }>(
      'SELECT revision::text AS revision FROM backups WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    const currentRevision = existing.rows[0] ? Number(existing.rows[0].revision) : 0;
    if (currentRevision !== baseRevision) return { conflict: true as const, currentRevision };

    const next = currentRevision + 1;
    await client.query(
      `INSERT INTO backups (user_id, revision, data, device_label, updated_at)
            VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id) DO UPDATE
            SET revision = EXCLUDED.revision,
                data = EXCLUDED.data,
                device_label = EXCLUDED.device_label,
                updated_at = now()`,
      [userId, next, JSON.stringify(data), deviceLabel]
    );
    return { conflict: false as const, revision: next };
  });

  if (result.conflict) {
    // The loser gets the server's version back in the same round trip, so it
    // can show the user what it would be overwriting without another request.
    const rows = await query<BackupRow>(
      `SELECT revision::text AS revision, data, device_label, updated_at
         FROM backups WHERE user_id = $1`,
      [userId]
    );
    throw new HttpError(409, 'conflict', 'This account was updated on another device.', {
      revision: Number(rows[0].revision),
      data: rows[0].data,
      updatedAt: rows[0].updated_at.toISOString(),
      deviceLabel: rows[0].device_label,
    });
  }

  res.status(200).json({ revision: result.revision });
}
