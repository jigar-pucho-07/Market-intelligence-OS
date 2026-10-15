-- db/roles.sql — GENERATED. Run by scripts/db.mjs migrate (ignored, with a note, when the connected user cannot create roles).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app') THEN CREATE ROLE app NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'studio_reader') THEN CREATE ROLE studio_reader NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO app, studio_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app;
GRANT SELECT ON "reports" ,"published_reports" ,"news_articles" ,"subscribers" ,"deliveries" ,"audit_log" TO studio_reader;
-- studio_reader deliberately has NO grant on users, sessions, otp_codes, files, jobs, signin_attempts.
-- To use them: CREATE USER <app_login> WITH PASSWORD '…' IN ROLE app;  CREATE USER <studio_login> WITH PASSWORD '…' IN ROLE studio_reader;
