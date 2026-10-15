# Migration Runbook — Supabase · Neon · Google Sheets → a Pucho OS's PostgreSQL

> Moving an existing data source into a generated Pucho OS's PostgreSQL. One
> procedure per source. Part 4 is the verification every migration passes
> regardless of source. Part 5 holds the two prompts to hand an AI agent — one
> for plan mode, one for build mode — written to be short on tokens and precise
> on constraints.
>
> **A v3 OS becoming v4.** A v3 OS kept its data in Google Sheets or behind
> PostgREST/Supabase; a v4 OS is generated from the same `os.yaml` as a
> Next.js + PostgreSQL app. A Sheets-backed v3 OS moves by §3.0; a
> PostgREST/Supabase-backed one by §1, its tables mapping 1:1 onto the
> generated ones.
>
> Companion to `standards/fullstack-build-standard.md` (the standard every
> generated OS implements). The target schema is the OS's generated
> `app/db/schema.sql`, created by `npm run db:migrate`; its entities and
> columns are listed in `docs/05-schema.md`, and the database itself is set
> up per `docs/db-setup.md`. Nothing below depends on Next.js: a bespoke
> build that lands on its own `db/schema.sql` follows the same procedure.

---

## 0 · Rules that hold for every source

1. **Never migrate into a live database.** Restore into a fresh one, verify,
   then cut over. A half-migrated production database has no clean rollback.
2. **The source stays read-only and stays alive** until the new one has served
   real traffic for an agreed period. Do not delete anything on migration day.
3. **Count before, count after, reconcile per table.** A migration is not done
   because it ran; it is done because the numbers match and the mismatches are
   explained.
4. **Migrate data, not opinions.** Constraints, defaults, triggers and indexes
   come from *your* `db/schema.sql` — in a Pucho OS, the one generated from
   `os.yaml` — not from whatever the old system had.
5. **Load, then constrain.** Import into permissive staging, transform, then
   apply keys and constraints. Constraints during load produce a thousand
   failures at once and no partial progress.
6. **Idempotent, resumable, logged.** Every step can be re-run. Each writes what
   it did and how many rows.
7. **Secrets in the environment**, never in a script, never in chat. The source
   connection string is a credential. The target's goes in `app/.env` (the
   `DB_*` block or `DATABASE_URL`), the same file the app and
   `npm run db:migrate` read.

---

## 1 · Supabase → PostgreSQL

Supabase **is** PostgreSQL, so this is a dump and restore. The work is in what
you deliberately leave behind.

### 1.1 What does not come with you

| Leave behind | Why |
|---|---|
| `auth`, `storage`, `realtime`, `vault`, `graphql`, `supabase_functions`, `_realtime`, `pgbouncer`, `extensions`, `cron`, `net`, `supabase_migrations` | Platform-internal. They will not work and are not yours. |
| **RLS policies** | They call `auth.uid()` / `auth.role()`, which do not exist off Supabase. **A policy that silently stops applying is a data leak, not an inconvenience.** Drop them, and enforce access on the server (`standards/fullstack-build-standard.md` §14 — Route Handlers and Server Actions, not RLS). |
| **Storage objects** | Files live in object storage, not in the database. `storage.objects` holds only pointers. Copy the bucket separately — in a Pucho OS, uploads live in PostgreSQL, in the `files` table as `bytea` (standard §19.4), within `FILES_MAX_MB` / `FILES_CAP_MB`. |
| Edge functions, cron jobs, webhooks | Re-express as Pucho AI Studio workflows or Route Handlers. |
| Roles and grants | `--no-owner --no-privileges`. Your target has its own roles. |

**A v3 PostgREST/Supabase-backed OS** maps its tables 1:1 onto the v4 ones:
the same entities, the same column names lower-cased (`docs/05-schema.md`
lists them). The column mapping in the plan (§5.1) is then mostly EXACT, and
every row that is not is the interesting part.

### 1.2 Users are the hard part

Application tables reference `auth.users(id)`. That schema is not coming, so:

1. Export `auth.users` separately (`id, email, created_at`, and any metadata you
   rely on).
2. Materialise them into **your** `users` table, keeping the same UUIDs so every
   foreign key still resolves.
3. **Passwords do not transfer.** Supabase stores bcrypt hashes in
   `auth.users.encrypted_password`. Moving hashes couples you to their format
   and their reset flow. Issue one-time codes instead
   (`standards/fullstack-build-standard.md` §7) and have everyone set a
   credential once.

### 1.3 Procedure

```bash
# Use the DIRECT connection (port 5432), never the pooler (6543) — a pooled
# connection cannot hold the session state pg_dump needs.
export SRC="postgresql://postgres:PASS@db.PROJECT.supabase.co:5432/postgres?sslmode=require"
export DST="postgresql://USER:PASS@NEWHOST:5432/appdb?sslmode=require"

# 1. Structure only, public schema only — to READ, not to apply blindly.
pg_dump "$SRC" --schema=public --schema-only --no-owner --no-privileges \
        --file=01-source-structure.sql

# 2. Data only.
pg_dump "$SRC" --schema=public --data-only --no-owner --no-privileges \
        --disable-triggers --file=02-source-data.sql

# 3. The users, separately.
psql "$SRC" -c "\copy (SELECT id, email, created_at, raw_user_meta_data
                       FROM auth.users ORDER BY created_at) TO 'auth-users.csv' CSV HEADER"

# 4. Row counts BEFORE.
psql "$SRC" -c "SELECT relname, n_live_tup FROM pg_stat_user_tables
                WHERE schemaname='public' ORDER BY relname" > counts-before.txt

# 5. Apply YOUR schema to the empty target. Not the dumped structure.
#    In a Pucho OS: `npm run db:migrate` from app/, with $DST's values in app/.env.
psql "$DST" -f db/schema.sql

# 6. Load users first (foreign keys point at them), then the data.
#    Map auth.users → users with your own script, preserving ids.
psql "$DST" -f 02-source-data.sql

# 7. Reconcile (Part 4).
```

**Read `01-source-structure.sql`; do not apply it.** It carries Supabase's
opinions — RLS, `auth` references, their extensions. Your schema is the schema.

### 1.4 Traps

- The **pooler port (6543)** breaks `pg_dump`. Use 5432.
- `--disable-triggers` needs superuser on the target, or restore with tables
  empty and add foreign keys afterwards.
- Identity/serial sequences do not advance to match the data. **Reset them**, or
  the first insert collides:
  ```sql
  SELECT setval(pg_get_serial_sequence('public.t','id'), COALESCE(MAX(id),1)) FROM public.t;
  ```
- Extensions used by the data (`pgcrypto`, `uuid-ossp`, `postgis`) must exist on
  the target **before** the load.

---

## 2 · Neon → PostgreSQL

Also PostgreSQL, and cleaner than Supabase because Neon adds little to the
database itself. The traps are connection-level.

### 2.1 Procedure

```bash
# Direct endpoint, NOT the -pooler host.
export SRC="postgresql://user:PASS@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
export DST="postgresql://USER:PASS@NEWHOST:5432/appdb?sslmode=require"

# Neon autosuspends. Wake it first, or the dump fails on a cold start.
psql "$SRC" -c "SELECT 1;"

psql "$SRC" -c "SELECT relname, n_live_tup FROM pg_stat_user_tables
                WHERE schemaname='public' ORDER BY relname" > counts-before.txt

pg_dump "$SRC" --schema=public --no-owner --no-privileges \
        --format=custom --file=neon.dump

psql "$DST" -f db/schema.sql                       # your schema first (Pucho OS: npm run db:migrate)
pg_restore --dbname="$DST" --data-only --no-owner --disable-triggers neon.dump
```

### 2.2 Traps

- **`-pooler` in the host** means PgBouncer. Dump from the direct endpoint.
- **Autosuspend**: the first connection after idle can take seconds or time out.
  Wake it, and give migration scripts a generous `connect_timeout`.
- `sslmode=require` is mandatory — Neon refuses plaintext.
- **Branches**: confirm which branch you are dumping. `main` is not always where
  production data lives.
- `neon_superuser` will not exist on the target: `--no-owner --no-privileges`.
- A **Neon compute size change mid-dump** can drop the connection. Dump to a
  file first (`--format=custom`), never pipe straight into the target.

---

## 3 · Google Sheets → PostgreSQL

**This is not a migration; it is an import with a data-cleaning project inside
it.** A sheet has no types, no keys, no constraints and no guarantee that column
C means the same thing on row 900 as on row 9. Budget accordingly.

### 3.0 A v3 Sheets-backed OS → v4

This is exactly how a v3 OS whose data lived in Google Sheets becomes a v4
OS on PostgreSQL. The schema already exists — it is the same `os.yaml` — so
the work is loading, not designing.

```bash
# 1. Create the tables from os.yaml, in an EMPTY database (app/.env points at it).
cd app && npm run db:migrate

# 2. Export each tab as CSV — values only (File → Download → CSV, per tab).
#    The header row must be the entity's declared columns (docs/05-schema.md).
#    A header that does not match is fixed in the CSV, never in the schema.

# 3. Load each tab into its entity's table, parents before children.
psql "$DST" -c "\copy \"<entity>\" (<col>, <col>, ...) FROM 'tab.csv' CSV HEADER"

# 4. Prove it.
npm run check:db
```

Then run the QA round (Part 4's "exercise the application", and the skill's
QA step) before anyone calls it done. The first administrator on a client's
database comes from `node scripts/db.mjs user`, never from seeded personas
(standard §6.4).

This is the one place rule 0.5 (load, then constrain) is short-cut: the
target tables are the OS's own and a v3 tab already carries their columns.
Profile each tab first anyway (3.1) — a v3 sheet is still a sheet. **When a
tab will not load cleanly, do not loosen the table: take that tab through the
staging route in 3.2.**

### 3.1 Profile before you write any schema

For each tab, answer in writing:

- Where does the data actually start? (Title rows, merged headers, blank rows.)
- Are headers unique, stable, and free of trailing spaces?
- Which columns are **formulas**? Export values, not formulas — and check for
  `#REF!`, `#N/A`, `#DIV/0!`.
- What is the real type of each column, across **every** row, not the first ten?
- What represents "nothing"? Blank, `-`, `NA`, `N/A`, `null`, `0`, `TBD` — often
  several in one column.
- Is there a natural key? Are there duplicates under it?
- Dates: `dd/mm/yyyy` or `mm/dd/yyyy`? **A column containing only days ≤ 12 is
  ambiguous and will silently transpose day and month.** Confirm against a known
  record; do not infer.
- Numbers: `₹`, `Rs.`, thousands separators, `(1,234)` for negative, trailing
  spaces, `1.2e3`, numbers stored as text.

### 3.2 Procedure

```bash
# 1. Export each tab as CSV — values only. File → Download → CSV, per tab.
#    (Or the Sheets API with valueRenderOption=UNFORMATTED_VALUE.)

# 2. Staging: EVERY column text. No constraints. Nothing is rejected at load.
```

```sql
CREATE SCHEMA IF NOT EXISTS staging;
CREATE TABLE staging.trips_raw (
  row_number  integer GENERATED ALWAYS AS IDENTITY,
  col_a text, col_b text, col_c text, col_d text   -- source order, source names
);
```

```bash
psql "$DST" -c "\copy staging.trips_raw(col_a,col_b,col_c,col_d) \
                FROM 'trips.csv' CSV HEADER"
```

```sql
-- 3. Profile in SQL, not by eye.
SELECT count(*) AS rows,
       count(*) FILTER (WHERE col_c IS NULL OR btrim(col_c) = '') AS blank_c,
       count(DISTINCT col_a) AS distinct_a,
       min(length(col_d)) AS min_len_d, max(length(col_d)) AS max_len_d
FROM staging.trips_raw;

-- Everything that will NOT cast — look at these before transforming.
SELECT row_number, col_d FROM staging.trips_raw
WHERE btrim(col_d) <> '' AND col_d !~ '^-?[0-9]+(\.[0-9]+)?$';

-- 4. Transform explicitly. Never rely on an implicit cast.
INSERT INTO public.trips (id, name, started_on, amount)
SELECT gen_random_uuid(),
       btrim(col_a),
       to_date(btrim(col_b), 'DD/MM/YYYY'),                       -- format CONFIRMED, not guessed
       NULLIF(regexp_replace(col_d, '[₹,\s]', '', 'g'), '')::numeric(12,2)
FROM staging.trips_raw
WHERE btrim(coalesce(col_a,'')) <> ''                             -- drop trailing blank rows
ON CONFLICT DO NOTHING;
```

```sql
-- 5. Only now apply keys and constraints, and see what fails.
ALTER TABLE public.trips ADD CONSTRAINT trips_amount_nonneg CHECK (amount >= 0);
```

### 3.3 Rules

- **Keep `staging` after the migration.** When someone asks in three months why
  a figure is what it is, the raw row with its original row number is the answer.
- **Every rejected row is recorded, with its reason**, in a `migration_rejects`
  table. Rows that vanish silently are the failure mode here.
- **Never let a bad value become `0` or `NULL` quietly.** `NULLIF` and an
  explicit cast, or reject the row. A silent `0` becomes a wrong total nobody
  questions.
- People are not a key. `"R. Sharma"`, `"Sharma, R"` and `"r sharma "` are one
  person, and no `DISTINCT` will tell you so. Resolve identity by hand, once,
  into a mapping table.

---

## 4 · Verification — every source

Run these against source and target and **put the output in the migration
record.** "It looked right" is not a result.

```sql
-- 1. Row counts, per table.
SELECT 'trips' t, count(*) FROM trips
UNION ALL SELECT 'expenses', count(*) FROM expenses
ORDER BY 1;

-- 2. Money and totals — the numbers someone would notice.
SELECT date_trunc('month', created_at) m, count(*), sum(amount)
FROM expenses GROUP BY 1 ORDER BY 1;

-- 3. Referential integrity: must return zero rows.
SELECT e.id FROM expenses e LEFT JOIN trips t ON t.id = e.trip_id WHERE t.id IS NULL;

-- 4. Boundaries — the first and last records by time, compared by eye.
(SELECT * FROM expenses ORDER BY created_at ASC  LIMIT 5)
UNION ALL
(SELECT * FROM expenses ORDER BY created_at DESC LIMIT 5);

-- 5. Nulls where the source had values.
SELECT count(*) FILTER (WHERE amount IS NULL) null_amount,
       count(*) FILTER (WHERE created_at IS NULL) null_created
FROM expenses;

-- 6. Sequences advanced past the data.
SELECT last_value FROM <sequence>;
```

**Then exercise the application**, not just the database: sign in, open a list,
open a record, create one, and confirm a computed total matches the old system
for a record you picked in advance. In a Pucho OS, `npm run check:db` runs
first (password hashes, scope, refusals, deactivation), then the QA round.

### Cutover

- [ ] Source set read-only; announce a freeze window.
- [ ] Final incremental sync of anything written during the migration.
- [ ] Verification above re-run on the final data.
- [ ] Application pointed at the new database via environment variables only —
      **no code change**. Locally that is `app/.env`; deployed, the `DB_*`
      block the portal injects.
- [ ] Rollback: point the environment back. Confirm it works **before** you
      need it.
- [ ] Source retained read-only for an agreed period. Then, and only then,
      decommission.

---

## 5 · Prompts for an AI agent

Two prompts. The first produces a plan and writes nothing. The second executes
an approved plan. Written short: constraints, not prose.

### 5.1 PLAN MODE

```
ROLE: DB migration planner. PLAN ONLY — write no files, run no writes.

SOURCE: <supabase | neon | google-sheets>
SOURCE CONN: env var name only, never the value
TARGET: PostgreSQL 13+, conn in env
REPO: db/schema.sql is authoritative for the target
      (Pucho OS: app/db/schema.sql, generated from os.yaml — never edit it;
      entities and columns in docs/05-schema.md)

READ FIRST: standards/db-migration-runbook.md §<1|2|3>, db/schema.sql,
            docs/05-schema.md, docs/db-setup.md

DO (read-only):
1. Inventory source: tables, row counts, column types, nullability, FKs,
   sequences, extensions.
2. Map every source column -> target column. Mark: EXACT | TRANSFORM | DROP |
   MISSING-IN-TARGET | MISSING-IN-SOURCE.
3. List type coercions needing an explicit cast. Flag ambiguous dates
   (dd/mm vs mm/dd) as BLOCKING — do not guess.
4. List what is deliberately NOT migrated (RLS, auth schema, storage,
   platform internals) and what replaces each.
5. Identify natural keys; report duplicates under each.
6. Order the load by FK dependency.
7. State rollback.

OUTPUT (markdown, no code files):
- Inventory table: source table | rows | target table | action
- Column mapping table
- BLOCKING questions — things you must not decide alone
- Ordered step list with the verification query for each
- Risk list: what could silently corrupt, and the check that would catch it

RULES:
- No writes to either database. No DDL. No files.
- Never invent a column, type or default. Unknown -> a BLOCKING question.
- Ambiguous dates, currency formats and identity matching are ALWAYS blocking.
- Report counts you actually queried. Never estimate.
STOP after output. Await approval.
```

### 5.2 BUILD MODE

```
ROLE: DB migration executor. Execute the APPROVED plan only.

PLAN: <paste approved plan>
SOURCE CONN: env var, read-only
TARGET CONN: env var, EMPTY database
REPO: apply db/schema.sql — never the source's dumped structure

ORDER:
1. Apply db/schema.sql to target (Pucho OS: npm run db:migrate). Apply
   twice; prove idempotent.
2. Load into staging.* — all text, no constraints. Never reject at load.
3. Transform staging -> real tables with EXPLICIT casts per the plan.
   Unparseable row -> migration_rejects (row, column, raw value, reason).
   Never coerce a bad value to 0 or NULL silently.
4. Reset sequences past max(id).
5. Run every verification query from the plan. Print source vs target.
6. Report: per-table counts both sides, deltas, rejects, unexplained gaps.

RULES:
- Idempotent + resumable. Re-running must not duplicate.
- Never DROP or TRUNCATE anything in the source. Source is READ-ONLY.
- Never write into a non-empty target without explicit instruction.
- Never widen or drop a constraint to make a load pass. Reject the row and
  report it.
- Deviating from the plan requires STOPPING and asking first.
- Keep staging.* and migration_rejects. Do not clean up.
- Print every count you assert. No claim without a query behind it.

DONE = counts reconcile per table, rejects explained, app exercised
       (sign in, list, open, create, one total matched against the old system),
       and in a Pucho OS `npm run check:db` exits 0.
Report what you did NOT verify.
```

### 5.3 Using them

1. Plan prompt → read the output → **answer every BLOCKING question yourself**.
   They are blocking because a wrong guess corrupts data quietly.
2. Approve the plan in writing.
3. Build prompt with the approved plan pasted in.
4. Check the reconciliation yourself. **An agent reporting success is not
   verification** — read the counts.

**The one instruction that matters most in both:** *never widen or drop a
constraint to make a load pass.* A migration that "succeeded" by removing a
foreign key has moved the failure to a place nobody is looking.
