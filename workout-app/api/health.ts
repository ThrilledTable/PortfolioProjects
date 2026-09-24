import { isDatabaseConfigured, query } from './_lib/db';
import { ApiRequest, ApiResponse, guardMethod, sendError } from './_lib/http';

/**
 * Setup check for the one step that cannot be done from the repo: attaching a
 * database and running the schema. Deliberately answers in booleans only --
 * this is unauthenticated, so it must not describe the failure, name the host,
 * or echo a driver error.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!guardMethod(req, res, ['GET'])) return;
  try {
    if (!isDatabaseConfigured()) {
      res.status(200).json({ configured: false, reachable: false, schemaReady: false });
      return;
    }
    try {
      const rows = await query<{ ready: boolean }>(
        "SELECT to_regclass('public.users') IS NOT NULL AS ready"
      );
      res.status(200).json({
        configured: true,
        reachable: true,
        schemaReady: Boolean(rows[0]?.ready),
      });
    } catch {
      // A URL is set but the database did not answer -- wrong credentials, a
      // paused instance, a network rule. Which one is not the caller's business.
      res.status(200).json({ configured: true, reachable: false, schemaReady: false });
    }
  } catch (error) {
    sendError(res, error);
  }
}
