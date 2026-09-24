import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

// OWASP's current scrypt floor. Node's default maxmem (32MB) is not enough
// headroom for N=2^17, so it is raised explicitly alongside the parameters.
const PARAMS = { N: 131072, r: 8, p: 1 };
const KEYLEN = 64;
const maxmemFor = (N: number, r: number) => 256 * N * r * 2;

/**
 * Encodes the parameters alongside the hash so they can be raised later
 * without invalidating existing passwords -- verify reads whatever each stored
 * hash was made with.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEYLEN, {
    ...PARAMS,
    maxmem: maxmemFor(PARAMS.N, PARAMS.r),
  });
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  // A malicious or corrupt row must not be able to make us allocate unbounded
  // memory, so anything past the parameters we would ever choose is rejected.
  if (N > 262144 || r > 16 || p > 4) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], 'base64');
    expected = Buffer.from(parts[5], 'base64');
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  try {
    const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N,
      r,
      p,
      maxmem: maxmemFor(N, r),
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
