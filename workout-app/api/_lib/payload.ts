import { badRequest, HttpError } from './http';

/** Vercel caps a request body at ~4.5MB; stay under it with room to spare. */
export const MAX_PAYLOAD_BYTES = 4_000_000;

/**
 * A deliberately shallow check. The server is a safe place to put a blob, not
 * an authority on the app's domain model -- validating every field here would
 * mean a client that adds one would start getting rejected by an API it cannot
 * redeploy in step with. So: confirm the top-level shape, cap the size, and
 * let the client own the rest.
 */
export function assertBackupPayload(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw badRequest('`data` must be an object.');
  }
  const data = value as Record<string, unknown>;

  for (const key of ['exercises', 'mesocycles', 'sessions'] as const) {
    if (!Array.isArray(data[key])) throw badRequest(`\`data.${key}\` must be an array.`);
  }
  if (typeof data.settings !== 'object' || data.settings === null || Array.isArray(data.settings)) {
    throw badRequest('`data.settings` must be an object.');
  }
  if (data.active !== null && (typeof data.active !== 'object' || Array.isArray(data.active))) {
    throw badRequest('`data.active` must be an object or null.');
  }

  const bytes = Buffer.byteLength(JSON.stringify(data), 'utf8');
  if (bytes > MAX_PAYLOAD_BYTES) {
    throw new HttpError(413, 'payload_too_large', 'That is more workout data than the sync accepts.');
  }
  return data;
}

export function readRevision(value: unknown): number {
  if (value === undefined || value === null) throw badRequest('`baseRevision` is required.');
  const revision = typeof value === 'string' ? Number(value) : value;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) {
    throw badRequest('`baseRevision` must be a non-negative integer.');
  }
  return revision;
}

export function readDeviceLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const label = value.trim().slice(0, 60);
  return label.length > 0 ? label : null;
}
