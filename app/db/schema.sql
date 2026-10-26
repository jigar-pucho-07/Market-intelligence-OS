-- db/schema.sql — GENERATED from os.yaml by pucho-os (2026-10-26). Idempotent: apply, then apply again.
-- Entity tables are named after os.yaml entities; columns are the declared names in lower case.

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


CREATE TABLE IF NOT EXISTS "reports" (
  "report_id" text PRIMARY KEY,
  "report_date" date,
  "created_at" timestamptz,
  "trigger" text,
  "status" text,
  "sentiment" text,
  "confidence_level" text,
  "confidence_pct" numeric,
  "driver_1" text,
  "driver_2" text,
  "driver_3" text,
  "sensex_outlook" text,
  "sensex_range" text,
  "sensex_reason" text,
  "nifty_outlook" text,
  "nifty_range" text,
  "nifty_reason" text,
  "banknifty_outlook" text,
  "banknifty_range" text,
  "banknifty_reason" text,
  "fno_view" text,
  "vix_expectation" text,
  "fno_reason" text,
  "midsmall_outlook" text,
  "midsmall_focus" text,
  "midsmall_reason" text,
  "commodity_outlook" text,
  "commodity_reason" text,
  "sectors" text,
  "risks" text,
  "view_positional" text,
  "view_intraday" text,
  "view_longterm" text,
  "view_fno" text,
  "articles_analyzed" numeric,
  "category_breakdown" text,
  "source_status" text,
  "model" text,
  "whatsapp_message" text,
  "message_length" numeric,
  "sent_at" timestamptz,
  "sent_count" numeric,
  "failed_count" numeric,
  "error_message" text,
  _seq bigserial
);
CREATE UNIQUE INDEX IF NOT EXISTS "reports_report_date_uq" ON "reports" ("report_date");
CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports" ("status");
CREATE INDEX IF NOT EXISTS "reports_created_at_idx" ON "reports" ("created_at");

CREATE TABLE IF NOT EXISTS "published_reports" (
  "report_id" text PRIMARY KEY,
  "report_date" date,
  "published_at" timestamptz,
  "sentiment" text,
  "confidence_level" text,
  "confidence_pct" numeric,
  "driver_1" text,
  "driver_2" text,
  "driver_3" text,
  "sensex_outlook" text,
  "sensex_range" text,
  "sensex_reason" text,
  "nifty_outlook" text,
  "nifty_range" text,
  "nifty_reason" text,
  "banknifty_outlook" text,
  "banknifty_range" text,
  "banknifty_reason" text,
  "fno_view" text,
  "vix_expectation" text,
  "fno_reason" text,
  "midsmall_outlook" text,
  "midsmall_focus" text,
  "midsmall_reason" text,
  "commodity_outlook" text,
  "commodity_reason" text,
  "sectors" text,
  "risks" text,
  "view_positional" text,
  "view_intraday" text,
  "view_longterm" text,
  "view_fno" text,
  "articles_analyzed" numeric,
  "whatsapp_message" text,
  _seq bigserial
);
CREATE UNIQUE INDEX IF NOT EXISTS "published_reports_report_date_uq" ON "published_reports" ("report_date");
CREATE INDEX IF NOT EXISTS "published_reports_published_at_idx" ON "published_reports" ("published_at");

CREATE TABLE IF NOT EXISTS "news_articles" (
  "article_id" text PRIMARY KEY,
  "fetched_at" timestamptz,
  "report_id" text,
  "source" text,
  "category" text,
  "impact" text,
  "title" text,
  "summary" text,
  "published_at" timestamptz,
  "link" text,
  _seq bigserial
);
CREATE INDEX IF NOT EXISTS "news_articles_fetched_at_idx" ON "news_articles" ("fetched_at");

CREATE TABLE IF NOT EXISTS "subscribers" (
  "subscriber_id" text PRIMARY KEY,
  "name" text,
  "whatsapp" text,
  "email" text,
  "city" text,
  "status" text,
  "opt_in_at" date,
  "opt_in_source" text,
  "joined_at" timestamptz,
  "notes" text,
  _seq bigserial
);
CREATE INDEX IF NOT EXISTS "subscribers_status_idx" ON "subscribers" ("status");
CREATE INDEX IF NOT EXISTS "subscribers_joined_at_idx" ON "subscribers" ("joined_at");

CREATE TABLE IF NOT EXISTS "deliveries" (
  "delivery_id" text PRIMARY KEY,
  "sent_at" timestamptz,
  "kind" text,
  "report_id" text,
  "report_date" date,
  "subscriber_id" text,
  "subscriber_name" text,
  "sentiment" text,
  "status" text,
  "attempts" numeric,
  "message_id" text,
  "error_message" text,
  _seq bigserial
);
CREATE UNIQUE INDEX IF NOT EXISTS "deliveries_report_date_subscriber_id_kind_uq" ON "deliveries" ("report_date", "subscriber_id", "kind");
CREATE INDEX IF NOT EXISTS "deliveries_status_idx" ON "deliveries" ("status");
CREATE INDEX IF NOT EXISTS "deliveries_sent_at_idx" ON "deliveries" ("sent_at");

CREATE TABLE IF NOT EXISTS "audit_log" (
  "audit_id" text PRIMARY KEY,
  "at" timestamptz,
  "who" text,
  "flow" text,
  "action" text,
  "entity" text,
  "record_id" text,
  "summary" text,
  _seq bigserial
);
CREATE INDEX IF NOT EXISTS "audit_log_at_idx" ON "audit_log" ("at");

-- ── migrations: every ALTER below every CREATE (§5). A column added to os.yaml after go-live is added here on re-apply;
-- a renamed or removed column is a docs/migrations/<date>.md step (diff_os.py), never done silently.
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "report_date" date;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "created_at" timestamptz;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "trigger" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "sentiment" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "confidence_level" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "confidence_pct" numeric;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "driver_1" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "driver_2" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "driver_3" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "sensex_outlook" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "sensex_range" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "sensex_reason" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "nifty_outlook" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "nifty_range" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "nifty_reason" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "banknifty_outlook" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "banknifty_range" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "banknifty_reason" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "fno_view" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "vix_expectation" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "fno_reason" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "midsmall_outlook" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "midsmall_focus" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "midsmall_reason" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "commodity_outlook" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "commodity_reason" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "sectors" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "risks" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "view_positional" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "view_intraday" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "view_longterm" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "view_fno" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "articles_analyzed" numeric;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "category_breakdown" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "source_status" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "model" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "whatsapp_message" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "message_length" numeric;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "sent_at" timestamptz;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "sent_count" numeric;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "failed_count" numeric;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "error_message" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS _seq bigserial;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_trigger_v49_%' AND conname <> 'reports_trigger_v49_abeaa8ee' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_trigger_v49_abeaa8ee') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_trigger_v49_abeaa8ee" CHECK (("trigger" IN ('Schedule', 'Manual') OR "trigger" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_status_v49_%' AND conname <> 'reports_status_v49_b16a3934' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_status_v49_b16a3934') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_status_v49_b16a3934" CHECK (("status" IN ('Ready', 'Sent', 'Failed') OR "status" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_sentiment_v49_%' AND conname <> 'reports_sentiment_v49_1154c557' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_sentiment_v49_1154c557') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_sentiment_v49_1154c557" CHECK (("sentiment" IN ('BULLISH', 'CAUTIOUSLY BULLISH', 'NEUTRAL', 'CAUTIOUSLY BEARISH', 'BEARISH') OR "sentiment" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_confidence_level_v49_%' AND conname <> 'reports_confidence_level_v49_2fa23b69' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_confidence_level_v49_2fa23b69') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_confidence_level_v49_2fa23b69" CHECK (("confidence_level" IN ('HIGH', 'MEDIUM', 'LOW') OR "confidence_level" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_confidence_pct_v49_%' AND conname <> 'reports_confidence_pct_v49_3c496ad4' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_confidence_pct_v49_3c496ad4') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_confidence_pct_v49_3c496ad4" CHECK ("confidence_pct" >= 0 AND "confidence_pct" <= 100) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_sensex_outlook_v49_%' AND conname <> 'reports_sensex_outlook_v49_3c068eef' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_sensex_outlook_v49_3c068eef') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_sensex_outlook_v49_3c068eef" CHECK (("sensex_outlook" IN ('BULLISH', 'BEARISH', 'NEUTRAL', 'CAUTIOUS') OR "sensex_outlook" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_nifty_outlook_v49_%' AND conname <> 'reports_nifty_outlook_v49_a4c2fcdc' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_nifty_outlook_v49_a4c2fcdc') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_nifty_outlook_v49_a4c2fcdc" CHECK (("nifty_outlook" IN ('BULLISH', 'BEARISH', 'NEUTRAL', 'CAUTIOUS') OR "nifty_outlook" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_banknifty_outlook_v49_%' AND conname <> 'reports_banknifty_outlook_v49_74bd171a' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_banknifty_outlook_v49_74bd171a') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_banknifty_outlook_v49_74bd171a" CHECK (("banknifty_outlook" IN ('BULLISH', 'BEARISH', 'NEUTRAL', 'CAUTIOUS') OR "banknifty_outlook" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_fno_view_v49_%' AND conname <> 'reports_fno_view_v49_8bc4bda6' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_fno_view_v49_8bc4bda6') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_fno_view_v49_8bc4bda6" CHECK (("fno_view" IN ('BULLISH BIAS', 'BEARISH BIAS', 'RANGE-BOUND', 'VOLATILE') OR "fno_view" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_vix_expectation_v49_%' AND conname <> 'reports_vix_expectation_v49_e010c26c' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_vix_expectation_v49_e010c26c') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_vix_expectation_v49_e010c26c" CHECK (("vix_expectation" IN ('LOW', 'MEDIUM', 'HIGH') OR "vix_expectation" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_midsmall_outlook_v49_%' AND conname <> 'reports_midsmall_outlook_v49_a47a6cfa' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_midsmall_outlook_v49_a47a6cfa') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_midsmall_outlook_v49_a47a6cfa" CHECK (("midsmall_outlook" IN ('BULLISH', 'BEARISH', 'NEUTRAL', 'CAUTIOUS') OR "midsmall_outlook" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_commodity_outlook_v49_%' AND conname <> 'reports_commodity_outlook_v49_e494599a' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_commodity_outlook_v49_e494599a') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_commodity_outlook_v49_e494599a" CHECK (("commodity_outlook" IN ('BULLISH', 'BEARISH', 'NEUTRAL', 'CAUTIOUS') OR "commodity_outlook" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_articles_analyzed_v49_%' AND conname <> 'reports_articles_analyzed_v49_0f035e82' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_articles_analyzed_v49_0f035e82') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_articles_analyzed_v49_0f035e82" CHECK ("articles_analyzed" >= 0 AND "articles_analyzed" <= 40) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_message_length_v49_%' AND conname <> 'reports_message_length_v49_33b1dfb3' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_message_length_v49_33b1dfb3') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_message_length_v49_33b1dfb3" CHECK ("message_length" >= 0 AND "message_length" <= 4096) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_sent_count_v49_%' AND conname <> 'reports_sent_count_v49_e144e6a9' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_sent_count_v49_e144e6a9') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_sent_count_v49_e144e6a9" CHECK ("sent_count" >= 0) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname LIKE 'reports_failed_count_v49_%' AND conname <> 'reports_failed_count_v49_714726ed' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"reports"'::regclass AND conname = 'reports_failed_count_v49_714726ed') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_failed_count_v49_714726ed" CHECK ("failed_count" >= 0) NOT VALID; END IF;
END $$;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "report_date" date;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "published_at" timestamptz;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "sentiment" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "confidence_level" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "confidence_pct" numeric;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "driver_1" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "driver_2" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "driver_3" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "sensex_outlook" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "sensex_range" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "sensex_reason" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "nifty_outlook" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "nifty_range" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "nifty_reason" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "banknifty_outlook" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "banknifty_range" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "banknifty_reason" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "fno_view" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "vix_expectation" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "fno_reason" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "midsmall_outlook" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "midsmall_focus" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "midsmall_reason" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "commodity_outlook" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "commodity_reason" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "sectors" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "risks" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "view_positional" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "view_intraday" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "view_longterm" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "view_fno" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "articles_analyzed" numeric;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS "whatsapp_message" text;
ALTER TABLE "published_reports" ADD COLUMN IF NOT EXISTS _seq bigserial;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"published_reports"'::regclass AND conname LIKE 'published_reports_sentiment_v49_%' AND conname <> 'published_reports_sentiment_v49_1154c557' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'published_reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"published_reports"'::regclass AND conname = 'published_reports_sentiment_v49_1154c557') THEN
    ALTER TABLE "published_reports" ADD CONSTRAINT "published_reports_sentiment_v49_1154c557" CHECK (("sentiment" IN ('BULLISH', 'CAUTIOUSLY BULLISH', 'NEUTRAL', 'CAUTIOUSLY BEARISH', 'BEARISH') OR "sentiment" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"published_reports"'::regclass AND conname LIKE 'published_reports_confidence_level_v49_%' AND conname <> 'published_reports_confidence_level_v49_2fa23b69' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'published_reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"published_reports"'::regclass AND conname = 'published_reports_confidence_level_v49_2fa23b69') THEN
    ALTER TABLE "published_reports" ADD CONSTRAINT "published_reports_confidence_level_v49_2fa23b69" CHECK (("confidence_level" IN ('HIGH', 'MEDIUM', 'LOW') OR "confidence_level" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"published_reports"'::regclass AND conname LIKE 'published_reports_confidence_pct_v49_%' AND conname <> 'published_reports_confidence_pct_v49_3c496ad4' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'published_reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"published_reports"'::regclass AND conname = 'published_reports_confidence_pct_v49_3c496ad4') THEN
    ALTER TABLE "published_reports" ADD CONSTRAINT "published_reports_confidence_pct_v49_3c496ad4" CHECK ("confidence_pct" >= 0 AND "confidence_pct" <= 100) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"published_reports"'::regclass AND conname LIKE 'published_reports_fno_view_v49_%' AND conname <> 'published_reports_fno_view_v49_8bc4bda6' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'published_reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"published_reports"'::regclass AND conname = 'published_reports_fno_view_v49_8bc4bda6') THEN
    ALTER TABLE "published_reports" ADD CONSTRAINT "published_reports_fno_view_v49_8bc4bda6" CHECK (("fno_view" IN ('BULLISH BIAS', 'BEARISH BIAS', 'RANGE-BOUND', 'VOLATILE') OR "fno_view" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"published_reports"'::regclass AND conname LIKE 'published_reports_articles_analyzed_v49_%' AND conname <> 'published_reports_articles_analyzed_v49_0f035e82' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'published_reports', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"published_reports"'::regclass AND conname = 'published_reports_articles_analyzed_v49_0f035e82') THEN
    ALTER TABLE "published_reports" ADD CONSTRAINT "published_reports_articles_analyzed_v49_0f035e82" CHECK ("articles_analyzed" >= 0 AND "articles_analyzed" <= 40) NOT VALID; END IF;
END $$;
ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "fetched_at" timestamptz;
ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "report_id" text;
ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "source" text;
ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "impact" text;
ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "summary" text;
ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "published_at" timestamptz;
ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "link" text;
ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS _seq bigserial;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"news_articles"'::regclass AND conname LIKE 'news_articles_source_v49_%' AND conname <> 'news_articles_source_v49_35f880ce' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'news_articles', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"news_articles"'::regclass AND conname = 'news_articles_source_v49_35f880ce') THEN
    ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_source_v49_35f880ce" CHECK (("source" IN ('Economic Times Markets', 'Moneycontrol', 'Reuters India', 'Google Finance News', 'Global Market Cues') OR "source" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"news_articles"'::regclass AND conname LIKE 'news_articles_category_v49_%' AND conname <> 'news_articles_category_v49_b29bd3ea' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'news_articles', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"news_articles"'::regclass AND conname = 'news_articles_category_v49_b29bd3ea') THEN
    ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_category_v49_b29bd3ea" CHECK (("category" IN ('MACRO_ECONOMIC', 'BENCHMARK_INDEX', 'BANKING_SECTOR', 'IT_SECTOR', 'PHARMA_SECTOR', 'AUTO_SECTOR', 'COMMODITY', 'GLOBAL_CUES', 'FNO', 'GENERAL_MARKET') OR "category" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"news_articles"'::regclass AND conname LIKE 'news_articles_impact_v49_%' AND conname <> 'news_articles_impact_v49_0cd6898a' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'news_articles', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"news_articles"'::regclass AND conname = 'news_articles_impact_v49_0cd6898a') THEN
    ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_impact_v49_0cd6898a" CHECK (("impact" IN ('HIGH', 'MED', 'LOW') OR "impact" = '')) NOT VALID; END IF;
END $$;
ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "whatsapp" text;
ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "opt_in_at" date;
ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "opt_in_source" text;
ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "joined_at" timestamptz;
ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS _seq bigserial;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"subscribers"'::regclass AND conname LIKE 'subscribers_status_v49_%' AND conname <> 'subscribers_status_v49_d8ecee6b' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'subscribers', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"subscribers"'::regclass AND conname = 'subscribers_status_v49_d8ecee6b') THEN
    ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_status_v49_d8ecee6b" CHECK (("status" IN ('Active', 'Paused', 'Unsubscribed') OR "status" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"subscribers"'::regclass AND conname LIKE 'subscribers_opt_in_source_v49_%' AND conname <> 'subscribers_opt_in_source_v49_c4b68b09' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'subscribers', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"subscribers"'::regclass AND conname = 'subscribers_opt_in_source_v49_c4b68b09') THEN
    ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_opt_in_source_v49_c4b68b09" CHECK (("opt_in_source" IN ('WhatsApp reply', 'Web form', 'Signed form', 'Phone call') OR "opt_in_source" = '')) NOT VALID; END IF;
END $$;
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "sent_at" timestamptz;
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "kind" text;
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "report_id" text;
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "report_date" date;
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "subscriber_id" text;
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "subscriber_name" text;
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "sentiment" text;
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "attempts" numeric;
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "message_id" text;
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "error_message" text;
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS _seq bigserial;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"deliveries"'::regclass AND conname LIKE 'deliveries_kind_v49_%' AND conname <> 'deliveries_kind_v49_d592be4e' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'deliveries', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"deliveries"'::regclass AND conname = 'deliveries_kind_v49_d592be4e') THEN
    ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_kind_v49_d592be4e" CHECK (("kind" IN ('Report', 'Alert') OR "kind" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"deliveries"'::regclass AND conname LIKE 'deliveries_status_v49_%' AND conname <> 'deliveries_status_v49_c88f1a93' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'deliveries', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"deliveries"'::regclass AND conname = 'deliveries_status_v49_c88f1a93') THEN
    ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_status_v49_c88f1a93" CHECK (("status" IN ('Queued', 'Sent', 'Failed') OR "status" = '')) NOT VALID; END IF;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = '"deliveries"'::regclass AND conname LIKE 'deliveries_attempts_v49_%' AND conname <> 'deliveries_attempts_v49_e90b1ca9' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'deliveries', r.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"deliveries"'::regclass AND conname = 'deliveries_attempts_v49_e90b1ca9') THEN
    ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_attempts_v49_e90b1ca9" CHECK ("attempts" >= 0 AND "attempts" <= 3) NOT VALID; END IF;
END $$;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "at" timestamptz;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "who" text;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "flow" text;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "action" text;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "entity" text;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "record_id" text;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "summary" text;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS _seq bigserial;
