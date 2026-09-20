import { badRequest } from './http';

// Deliberately loose: the goal is to reject obvious junk and cap length, not
// to adjudicate RFC 5322. Delivery is never attempted, so a wrong guess here
// only locks someone out of their own account name.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_EMAIL_LENGTH = 254;
export const MIN_PASSWORD_LENGTH = 10;
// bcrypt-style truncation does not apply to scrypt, but an unbounded password
// is an unbounded amount of hashing work handed to an unauthenticated caller.
export const MAX_PASSWORD_LENGTH = 200;

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw badRequest('Email is required.');
  const email = value.trim().toLowerCase();
  if (email.length === 0) throw badRequest('Email is required.');
  if (email.length > MAX_EMAIL_LENGTH) throw badRequest('That email address is too long.');
  if (!EMAIL_RE.test(email)) throw badRequest('That does not look like an email address.');
  return email;
}

/** For sign-in: accept whatever is stored, only guard the size. */
export function readPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw badRequest('Password is required.');
  if (value.length > MAX_PASSWORD_LENGTH) throw badRequest('That password is too long.');
  return value;
}

/** For sign-up: enforce the minimum as well. */
export function readNewPassword(value: unknown): string {
  const password = readPassword(value);
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  return password;
}
