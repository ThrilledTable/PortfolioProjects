/**
 * The slice of Vercel's request/response objects these handlers actually use.
 * Declaring it structurally rather than importing `@vercel/node` keeps the
 * functions runnable under a plain Node server, which is how they are tested.
 */
export interface ApiRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  end(): void;
}

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly extra?: Record<string, unknown>
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, 'bad_request', message);
export const unauthorized = (message = 'Not signed in.') =>
  new HttpError(401, 'unauthorized', message);

/** Sends whatever the handler threw, hiding details of anything unexpected. */
export function sendError(res: ApiResponse, error: unknown) {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: error.code, message: error.message, ...error.extra });
    return;
  }
  // An unexpected throw may carry a connection string or a query fragment, so
  // it goes to the server log and the client gets nothing specific.
  console.error('Unhandled API error:', error);
  res.status(500).json({ error: 'server_error', message: 'Something went wrong.' });
}

/** Rejects any method other than those listed, and answers CORS preflight. */
export function guardMethod(req: ApiRequest, res: ApiResponse, allowed: string[]): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', [...allowed, 'OPTIONS'].join(', '));
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return false;
  }
  if (!req.method || !allowed.includes(req.method)) {
    sendError(res, new HttpError(405, 'method_not_allowed', `Use ${allowed.join(' or ')}.`));
    return false;
  }
  return true;
}

/** Vercel parses JSON bodies for us; a string body means it did not. */
export function jsonBody(req: ApiRequest): Record<string, unknown> {
  const { body } = req;
  if (body === undefined || body === null || body === '') return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      throw badRequest('Body must be valid JSON.');
    }
  }
  if (typeof body !== 'object' || Array.isArray(body)) throw badRequest('Body must be a JSON object.');
  return body as Record<string, unknown>;
}

/**
 * Best-effort client address for rate limiting. x-forwarded-for is caller
 * controlled in general, but on Vercel the platform sets it, and the left-most
 * entry is the real client.
 */
export function clientIp(req: ApiRequest): string {
  const header = req.headers['x-forwarded-for'] ?? req.headers['x-real-ip'];
  const raw = Array.isArray(header) ? header[0] : header;
  return raw?.split(',')[0]?.trim() || 'unknown';
}

export function bearerToken(req: ApiRequest): string | null {
  const header = req.headers.authorization;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const match = /^Bearer (.+)$/i.exec(raw.trim());
  return match ? match[1] : null;
}
