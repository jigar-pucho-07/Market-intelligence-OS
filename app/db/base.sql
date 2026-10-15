-- db/base.sql — the tables every Pucho OS has, whatever os.yaml says: people, sessions, one-time codes, files, jobs.
-- Idempotent (standards §5): safe to apply twice. Entity tables follow in db/schema.sql, generated from os.yaml.
-- Roles (§19.1 least privilege) are created by scripts/db.mjs migrate when the connected user may create roles —
-- `app` (DML on every table), `studio_reader` (SELECT on entity tables only — never users, sessions, otp_codes, files).

CREATE TABLE IF NOT EXISTS users (
  id              text PRIMARY KEY,
  email           text NOT NULL UNIQUE,
  name            text NOT NULL,
  role            text NOT NULL,
  password_hash   text,                       -- $argon2id$… or NULL until the person sets one (one-time code sign-in still works)
  must_change_password boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  deactivated_at  timestamptz,
  deactivated_by  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash      text PRIMARY KEY,           -- SHA-256 of the opaque cookie token; the token itself is never stored
  user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  user_agent      text
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS otp_codes (
  email           text NOT NULL,
  code_hash       text NOT NULL,              -- HMAC-SHA256(code, AUTH_PEPPER)
  expires_at      timestamptz NOT NULL,
  attempts        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (email)
);

CREATE TABLE IF NOT EXISTS files (                -- uploads live in the database (D6), under the plan's storage cap
  id              text PRIMARY KEY,
  name            text NOT NULL,
  mime            text NOT NULL,
  size            bigint NOT NULL,
  data            bytea NOT NULL,
  entity          text,
  record_id       text,
  uploaded_by     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (                 -- a flow that runs longer than the sync window (async: true) is tracked here
  id              text PRIMARY KEY,
  flow            text NOT NULL,
  action          text NOT NULL,
  status          text NOT NULL DEFAULT 'queued', -- queued · done · failed
  payload         jsonb,
  result          jsonb,
  requested_by    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

CREATE TABLE IF NOT EXISTS signin_attempts (      -- sign-in rate limit per account and per address (§19.2)
  key             text PRIMARY KEY,
  count           integer NOT NULL DEFAULT 0,
  window_start    timestamptz NOT NULL DEFAULT now()
);

-- ALTERs below every CREATE (§5): a column added after the first release lands here, never above its table.
