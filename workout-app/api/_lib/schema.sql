-- Run once against the database before the API is used.
-- Safe to re-run: every statement is guarded.

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Only the SHA-256 of a session token is stored, so a database leak does not
-- hand out live sessions.
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash   text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions (expires_at);

-- One row per user holding their whole app state. `revision` increments on
-- every accepted push so a client can detect that another device got there
-- first instead of silently clobbering it.
CREATE TABLE IF NOT EXISTS backups (
  user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  revision     bigint NOT NULL DEFAULT 1,
  data         jsonb NOT NULL,
  device_label text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Feeds the rate limiter. Rows are pruned opportunistically on write.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id         bigserial PRIMARY KEY,
  bucket     text NOT NULL,
  happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_attempts_bucket_idx ON auth_attempts (bucket, happened_at);
