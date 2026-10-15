# Pucho Full-Stack Build Standard — Next.js + PostgreSQL

> The standard every Pucho application on Next.js + PostgreSQL implements,
> whoever or whatever builds it. Two kinds of build follow it:
>
> - **A generated Pucho OS.** `pucho-os` generates every client OS from
>   `os.yaml` as a Next.js + PostgreSQL app that implements this standard. The
>   generated kernel is the **reference implementation**: where this file
>   says "the kernel", it names the file that already does the thing. The
>   scaffold copies this file into each OS as `docs/fullstack-build-standard.md`.
> - **A bespoke build** — a client application that is not an OS. It follows
>   every rule below by hand, using the kernel's files as the worked example.
>   Copy this file into the new repository as `docs/fullstack-build-standard.md`
>   and keep it there.
>
> **Companion:** `standards/db-migration-runbook.md` — moving an existing
> data source (Supabase, Neon, Google Sheets, a v3 Sheets- or PostgREST-backed
> OS) into a generated OS's PostgreSQL, with agent prompts.
>
> This is the Next.js rewrite of the original Express-based standard. Every
> rule below is unchanged in *intent* from that version; only the mechanism
> changes where Next.js gives a cleaner or stricter way to enforce it — each
> such change is called out as **Next.js note:**. Where a rule exists because
> something broke, the failure is named, because a rule without its reason
> gets dropped by the next person who finds it inconvenient.

---

## 0 · The six that are not negotiable

Everything below expands on these. If a build satisfies nothing else, it
satisfies these.

1. **Deterministic logic is code. A workflow does the model's work.** Screens,
   CRUD, auth, dates, totals, caps and every rule with a right answer live in
   code. A workflow writes words, reads a mailbox, calls an API, sends a
   message. Never ask a model for a number a function can compute.
2. **The server decides; the client displays.** Any value that carries
   consequence — a verdict, a total, an entitlement, a role — is computed on
   the server on every write, from the same code the UI used to preview it. A
   client may propose. It may never assert.
3. **Every app ships user and role management.** Not a later phase. §6.
4. **Secrets live in the environment, never in the repository or an archive.**
5. **Evidence, not intention.** A thing is done when its gate has produced an
   artefact. A build that compiled is not an app that works.
6. **The security baseline ships with the first release.** The seven controls
   in §19 — transport, passwords and sessions, authorization, input, secrets,
   headers and patching, PII encryption — are part of done, not a hardening
   phase after an incident.

---

## 1 · Shape of an application

```
Browser ── Next.js (App Router) ── Server Components render on the server
   │
   │  Server Actions (writes) · Route Handlers under /api/* (webhooks, health,
   │  anything a non-browser caller must reach) — same process, same port
   ▼
Next.js server (node, one process) ── recomputes every consequential value on write
   │
   ├──▶ PostgreSQL          the system of record
   └──▶ Pucho AI Studio     workflows: mail, documents, extraction, messaging
```

**One process, one port, in production — and Next.js gives you this by
default, in development too.** `next dev` already serves pages and API routes
from the same port; there is no separate frontend dev server and API dev
server to keep in sync, and no dev-proxy configuration that can drift from
production. The old standard's `API_PORT` vs `PORT` split does not exist here
— **Next.js note:** one fewer variable, one fewer way to misconfigure it.

A separate static host is acceptable only for an application that has no
server-side rules at all — and if it has none, question whether it needs a
backend or only a workflow.

### Where server logic lives — three mechanisms, one discipline

Next.js gives three places code can run on the server. Each has a job; do not
blur them.

| Mechanism | Use for | Notes |
|---|---|---|
| **Server Components** | Reads. A page reads data directly — no `fetch`, no client round-trip, no client-visible endpoint. | This *is* the client displaying, not deciding — the component only renders what the server already computed. |
| **Server Actions** | Writes from a form or a button inside the React tree. The default write path. | Runs on the server, colocated with the component that calls it; still recomputes every consequential value from the shared rules module, the same as any other server code. Treat a Server Action exactly like an API route for the purpose of rule 2 — it is server code, not client code, only because it is *invoked* from a client component. |
| **Route Handlers** (`app/api/**/route.ts`) | Anything a non-React caller must reach: health checks, a workflow's webhook receiver, a mobile client, a `curl` smoke test. | This is the only surface that must be plain HTTP with a stable JSON contract — everything in §14 about routes, status codes and payload rules applies here. |

**A Server Action is still "the client proposes, the server computes."**
Accepting a form's fields and recomputing the total server-side inside the
action is the same discipline as an Express route recomputing it — the
mechanism changed, rule 2 did not.

**A Server Action is also a public HTTP endpoint.** Anyone can call it, with
any arguments, without your UI. Check who is calling and whether they may,
inside the action, every time (§19.3).

### The shared rules module

Every app with rules gets a **pure module** — no network, no database, no
`Date.now()`, dates passed in as parameters — imported by Server Components,
Server Actions, Route Handlers, and any Client Component that wants live
preview feedback.

- The UI calls it for live feedback as someone types (a Client Component may
  import it directly — it is pure and has no server-only dependency).
- The server calls **the same code** on write (inside a Server Action or a
  Route Handler) and stores the result.

This is what makes rule 2 true rather than aspirational. It also means a rule
exists in exactly one file, so fixing it fixes it everywhere, and a test suite
can pin it without a database.

**Derived values are computed, never stored** — totals, statuses, durations,
anything recomputable from its parts. Store only what cannot be derived:
inputs, and a verdict that must be pinned to the rules as they stood when it
was made.

---

## 2 · The split — code or workflow

Before building anything, put every requirement in one of two columns. Get
this wrong and you will debug a probabilistic system for a deterministic
problem.

| Code | Workflow |
|---|---|
| Screens, navigation, forms | Reading an inbox or a channel |
| CRUD and validation | Sending mail, WhatsApp, a document |
| Authentication, sessions, permissions | Extraction from an image or a PDF |
| Dates, durations, money, caps, totals | Summarising, classifying, drafting |
| Any rule with a right answer | Calling a third-party API with no SDK |
| Anything a wrong answer makes unsafe | Scheduled syncs and digests |

**Tests for the boundary.** A step belongs in code if any is true:

- The same input must always give the same output.
- Being wrong costs money, access, or a legal position.
- A reviewer would want to read it as a rule, not a prompt.

**A workflow never decides.** It may fetch, transform and deliver. The moment a
result gates an action, the decision is the server's — a Server Action or
Route Handler, never a Studio flow.

> Worked example: a one-time sign-in code. The server (a Server Action)
> generates it, hashes it, stores it with an expiry, rate-limits it, renders
> the message and compares the answer in constant time. The workflow receives
> `{to, subject, body}` and sends the mail. Its only output is that the mail
> went. A workflow that minted or checked codes would put the security
> decision outside the process that enforces it.

---

## 3 · Required environment fields

Standard names, every app, so that one runbook works for all of them. This
table is the kernel's `app/.env.example`, field for field; a bespoke build
uses the same names.

| Field | Required | Default | Secret | Notes |
|---|---|---|---|---|
| `PORT` | — | `3000` (bundle: `80`) | | Next.js's own server reads this natively. CP Portal injects it; the bundle's `start.sh` falls back to 80 (§16). **The port the app logs must equal the port the portal routes to.** |
| `DB_HOST` | **yes** (deployed) | — | | Setting it selects the discrete form; `DATABASE_URL` is then ignored entirely. Injected by the portal. |
| `DB_PORT` | — | `5432` | | Injected by the portal. |
| `DB_NAME` | **yes** (deployed) | — | | Injected by the portal. |
| `DB_USER` | **yes** (deployed) | — | | Injected by the portal. |
| `DB_PASSWORD` | — | empty | **yes** | Empty is legal for trust auth. Injected by the portal. |
| `DB_SCHEMA` | — | `public` | | Sets `search_path` on every pooled connection. Injected by the portal. |
| `DB_SSL` | — | derived | | Derived from the host: local plain, remote encrypted. Override only for an unusual database. |
| `DB_SSL_CA` | prod | — | | The provider's CA bundle (PEM). Without it, TLS encrypts but does not verify the server — a release blocker in production (§19.1). |
| `DB_TIMEZONE` | — | `Asia/Kolkata` | | The zone timestamps are reported in — API answers and Studio's reads. Applied through the connection options (§13.2). |
| `DATABASE_URL` | dev | — | | The single-string development alternative. **`DB_HOST` wins outright** when both are present. |
| `APP_ORIGIN` | **yes** | — | | e.g. `https://app.client.com`. Used for the Origin check on cookie-authenticated Route Handlers (§19.2). An `https://` origin turns on HSTS and the `__Host-session` cookie; a plain `http://` origin (local work) uses a plain `session` cookie. |
| `AUTH_PEPPER` | **yes** | — | **yes** | Keys the HMAC of one-time codes (§19.2). |
| `WEBHOOK_<FLOW>` | per flow | unset | **yes** | One per flow the app calls. A URL is a door. **Unset = that flow's actions are SIMULATED by the app**, and the app's header says so (§8.5). |
| `WEBHOOK_AUTH_OTP` | — | unset | **yes** | The flow that delivers one-time sign-in codes by email. The app generates, hashes and checks the code; the flow only sends (§7). |
| `INBOUND_TOKEN` | — | unset | **yes** | Shared secret every flow presents when it calls the app (`/api/data`, `/api/jobs`). **Unset means closed (403), not open.** |
| `FILES_MAX_MB` | — | `10` | | Largest single upload (§19.4). |
| `FILES_CAP_MB` | — | `400` | | All uploads together — the Pucho DB plan's storage cap, minus headroom. Plan limits are OPEN (Q4). |
| `FIELD_ENC_KEYS` | if PII | — | **yes** | Versioned AES-256 keys, `v1:<base64>,v2:<base64>` (§19.7). Losing it loses the data. |
| `FIELD_ENC_CURRENT` | if PII | `v1` | | Key version used for new writes. |
| `BLIND_INDEX_KEY` | if PII | — | **yes** | Keys the searchable hash of encrypted fields (§19.7). |
| `DEMO_LOGINS` | demo only | unset | | Demo deployments only: the login page lists the seeded personas via `/api/personas`. **Never on a client's deployment.** |

No variable signs sessions: a session is an opaque random token stored hashed
(§19.2), so there is no session-signing secret to configure or leak.

**Rules.**

1. `DATABASE_URL` stays accepted as a single-string alternative for
   development. When both shapes are present, `DB_HOST` wins **outright** —
   reading half of one and half of the other is a bug that only appears in
   production.
2. **A bad value is refused loudly, never coerced.** `Number("")` is `0`, and
   binding to port `0` gives a *random* port: a healthy container the proxy
   can never reach, with a clean build log. Parse, validate, and say what was
   ignored.
3. **`NEXT_PUBLIC_*` is compiled into the bundle.** *(Next.js note: this
   replaces Vite's `VITE_*` — same rule, same danger, different prefix.)* It
   is public to anyone with devtools and changing it needs a rebuild, not a
   restart. **Never put a secret behind a `NEXT_PUBLIC_` name** — `npm run
   check` enforces this (§19.5).
4. A new variable means three places: `.env`, `.env.example` (name and
   comment, never a value), and this table in the app's own `docs/SOP.md`
   (§18).

---

## 4 · Secrets

- `.gitignore` covers `.env` **and `.env.*`**, with `!.env.example` tracked. A
  `.env.backup` holds the same secrets as `.env`. Also ignore `.next/` (build
  cache — never contains secrets by design, but never worth shipping either).
- No `.env` in the bundle. `npm run package` refuses to produce one that
  contains any `.env` file (§16) — and still, **inspect the archive before
  sending it.**
- Secrets go in the portal's environment fields, never inside an upload.
- A secret that has been pasted into a chat, a ticket or a log is burnt.
  Rotate it.
- Never log a secret, never return one in a response, never put one in a URL.

---

## 5 · Database

**PostgreSQL 13+.** No ORM required; plain SQL is preferred for anything whose
shape matters.

### Schema file rules

- Idempotent throughout — `IF NOT EXISTS`, `ON CONFLICT`. Re-applying must be
  safe.
- **Migration statements go below every `CREATE TABLE`.** The file is applied
  as one statement; an `ALTER` against a table that does not exist yet aborts
  the whole file and nothing is created. This has happened; it silently
  worked on every machine that already had the table.
- Ship the schema with the app, so the deployed bundle can apply it itself.
  In a generated OS that is `db/schema.sql` — generated as one file: the
  kernel's own tables from `db/base.sql` first, then one table per `os.yaml`
  entity — followed by `db/roles.sql`, both applied by `npm run db:migrate`
  (`node scripts/db.mjs migrate`).
- **Verify against an empty database, then apply it again**, before shipping.

### Deletion

**Work out what cascades before writing a delete.** A user row referenced by
`ON DELETE CASCADE` takes every record they ever created with it — an
administrator tidying up a leaver destroys the audit trail.

> **Default: deactivate, never delete.** `is_active`, `deactivated_at`,
> `deactivated_by`. The row stays, the history stays, the account stops
> working. A hard delete, if it exists at all, is a separate deliberate action
> refused while dependent records exist.

### Attribution

Anything that changes what the organisation pays, owes or permits gets an
audit row: who, what field, from what, to what, when.

---

## 6 · User and role management — compulsory

**Every Pucho app ships this.** It is not a phase two.

**In a generated OS** the kernel ships §6.1 exactly — create, deactivate and
reactivate, reset credential, change role; admin-only; an audit row for each —
and §6.4. It does **not** ship §6.2–6.3's hierarchy and approver rules: an OS
models teams as entities (a `team_members` entity) and scopes self-service
roles with `{{user}}`, decided in `os.yaml`. The §6.3 rules that need no
hierarchy are enforced in `src/app/actions.ts`: nobody changes their own role
or deactivates themselves, and the last active administrator cannot be
deactivated or demoted. §6.2–6.3 in full remain the rule for a bespoke build
that has a reporting hierarchy.

### 6.1 What exists from day one

- A `users` table with `is_active`, and an audit table.
- Create, edit, deactivate, reactivate, reset credential.
- An administrator role, defined by the app's own hierarchy where it has one.
- A screen behind that role, hidden — route and navigation — from everyone
  else. The server refuses regardless; the UI simply does not offer it.
  *(Next.js note: refuse the route itself on the server by role, in addition
  to the page not linking to it — not a client-side `if`. In the kernel the
  catch-all Server Component checks the role→page map before it loads a row;
  `proxy.ts` (Next 16; `middleware.ts` before it) only redirects the signed-out (§19.3).)*

### 6.2 A role is not one field

*(Bespoke builds. A generated OS uses teams-as-entities and `{{user}}` scope
instead — see above.)*

Do not build a general-purpose role system over fields that carry domain
meaning. Separate, at minimum:

| Kind | Example | Editable? |
|---|---|---|
| **Entitlement level** — drives what things cost or permit | `level` | Yes, but only within a **closed set** the domain defines |
| **Functional role** — a job in a process | `is_accounts` | Yes |
| **Authority** — may approve, may sign off | `can_approve` | Yes |
| **Hierarchy** — who reports to whom | `manager_id` | Yes, with the rules below |
| **Label** — display only | `title` | Free text, and **deliberately inert** |

An entitlement level is a domain concept with consequences, not a tag. Never
let it become free text, and never let a UI offer a value the domain does not
define.

### 6.3 Rules the server must refuse to break

*(Bespoke builds with a hierarchy. The kernel enforces only the last two
bullets' no-hierarchy form — see §6.)*

Hierarchy fails **silently** — a cycle raises nothing, it just returns a chain
with people missing, and work routes to the wrong person or to nobody.

- No cycles: nobody may be their own ancestor.
- Someone with reports cannot be deactivated until they are reassigned.
- Everyone who needs an approver must resolve to one.
- The last holder of a role nothing else can perform cannot be removed or
  demoted.
- **Nobody may change their own entitlement level, authority or functional
  role** — whatever their role. An administrator could otherwise widen their
  own permissions with nothing to notice.

**Write these as assertions before the Server Actions exist**, failing on the
current build. They are the part that breaks quietly, so they are the part
that gets pinned first.

### 6.4 Credentials

- Never seed a password equal to a username, and never list working
  credentials on a login screen. Demo pickers are deleted when real auth
  lands, not later.
- An administrator issues a credential with `must_change_password`; better,
  they issue nothing and the person receives a one-time code (§7).
- The first administrator comes from a bootstrap command that takes an
  address and sends an invitation — in a generated OS, `node scripts/db.mjs
  user <email> <name> <role>` (`npm run user:create`). **No credential is
  ever written into a seed file for a client's database.** With no
  administrator present, admin routes refuse and say to run it — they do not
  open up.
- Demo personas (`db/seed/users.json`) are seeded **only on a demo
  database**, and listed on the login page only where `DEMO_LOGINS` is set
  (§3). A client's database gets `npm run db:seed -- --no-personas` or no seed
  at all.

---

## 7 · Authentication

**A session must be unforgeable before anything else is worth building.** An
app whose session is a header the server believes has no authentication — it
has impersonation with extra steps. Any administration screen on top of that
turns impersonation into privilege escalation that persists.

Minimum: an opaque, random session token in a `__Host-` cookie (`HttpOnly`,
`Secure`, `SameSite=Lax`), stored hashed in a `sessions` table so the server can
revoke it — never `localStorage`. Passwords are hashed with argon2id. The exact
pattern is §19.2. **Next.js note:** set the cookie with the `cookies()` API inside
a Server Action or Route Handler, never a Client Component. `proxy.ts` (`middleware.ts` before Next 16) may
redirect signed-out users early, but that is a convenience, not the check —
every Server Action and Route Handler authorizes itself (§19.3).

**Implemented in the kernel** by `src/lib/auth.ts`: argon2id, hashed opaque
sessions, one-time codes, and sign-in rate limiting. The cookie is
`__Host-session` when `APP_ORIGIN` is `https://`, and a plain `session` cookie
for a plain `http://` origin during local work (§3).

### One-time codes by email — the standard pattern

| Step | Where |
|---|---|
| Generate (CSPRNG), hash, store with expiry | **server** (Server Action) |
| Decide who may request, and how often | **server** |
| Render the message | **server** |
| **Deliver it** | **workflow** |
| Compare in constant time, count attempts, consume | **server** (Server Action) |

Six digits, ten minutes, single use, five attempts, rate-limited per identity
and per address. In a generated OS the delivering flow is `WEBHOOK_AUTH_OTP`. `request-code` answers **identically** whether or not the
address is known — anything else makes it a membership oracle. The code is
never logged, never returned, never placed in a URL.

**Keep password sign-in alongside it.** Passwordless-only means a mail outage
locks out the whole organisation, including whoever would fix it.

---

## 8 · Workflows — Pucho AI Studio

Unchanged by the frontend rewrite — this layer is framework-agnostic.

### 8.1 What a workflow is allowed to be

A workflow is a **delivery and extraction mechanism**, and a place to put the
model's judgement. It is never the system of record and never the decision.

- Triggered by a webhook the server calls, by a schedule, or by an inbound
  channel.
- It may read, transform, call, and send.
- **It may not hold state another system needs**, and it may not be the only
  place a rule exists.
- A flow that writes into the application's own database is wrong: a row
  would land without the server-side validation every other row goes
  through. It calls the app's Route Handler instead (§14, §15), which applies
  the same rules as a human's request.
- **Reading is allowed; writing is not (D4).** Studio's `postgres` tool may
  read the app database through the `studio_reader` role — `SELECT` on entity
  tables only, never `users`, `sessions`, `otp_codes` or `files`. Every write
  goes through the app's Route Handlers.

### 8.2–8.4 Authoring, the contract gate, and done — documented in the skill

How a flow is authored (the golden exports, `schemaVersion` `"7"`, bracket-only
references, portable connections), how its capability contract is gated
(`validate_flow.py --contract`, exit 2 is UNVERIFIED and never a pass), and
what must be true before a flow is called done (imported, connections attached
by a human, one real test run, credits estimated, no secrets in the JSON) are
documented once, in the `pucho-os` skill — not repeated here, so they cannot
drift:

- `SKILL.md` § The flow layer — what the flow layer is and how it is built.
- `flow/workflow-rules.md` — the authoring rules and the done checklist.
- `method/webhook-contract.md` — the seam below, field by field.

A bespoke build that uses Studio flows follows the same three files.

### 8.5 The seam with the app

- **The app calls a flow** server-side through `WEBHOOK_<FLOW>`, one URL per
  flow, held in the environment. The URL is a secret and never reaches the
  browser.
- **When a flow is not wired** (`WEBHOOK_<FLOW>` unset), the app applies the
  action's declared `effect:` from `os.yaml` itself, through the DAL, and marks
  the result **SIMULATED** — the header says so and `/api/health` reports
  `workflows wired n/n`. One writer per state: once the URL is set, the app
  stops applying the effect and the flow owns the write.
- **A flow calling the app** writes through `POST` / `PATCH /api/data/<entity>`
  with `Authorization: Bearer INBOUND_TOKEN` and `X-Flow: <FLOW>` (which names
  the writer in the audit row). **Unset token means closed (403).**
- **The DAL writes the audit row for every write**, whoever asked — a person
  through a Server Action, or a flow through `/api/data`.
- **Long actions** (`async: true` in `os.yaml`) get a `jobs` row; the flow
  reports back with `POST /api/jobs/<id>`.
- A flow is never given the identity of a person. The server resolves who a
  request concerns from its own data, so a flow cannot choose whose record it
  touches.
- What a flow produces is a **proposal** until a person or a rule accepts it.
  In a bespoke build, extraction lands in a staging table, not the live one.
  **In a generated OS the staging decision is an OS-level one**, made in
  `os.yaml`: an inbox or parked entity, or a status value that a person or a
  rule moves on — not a generic staging table.

---

## 9 · Frontend standard

- **Measure contrast; a token name is not evidence.** Text at 4.5:1, large
  text and non-text UI at 3:1, measured with alpha composited against the
  real backdrop. Opacity-based "muted" text almost always fails.
- **Secondary text is a named token, never an opacity.** An opacity has no
  name, so every new component re-invents one.
- Nothing renders below **12px**.
- Check **1440 / 768 / 390** and 200% zoom. No horizontal overflow; nothing
  overlapping; every page scrollable when its content is taller than the
  glass.
- Colour is never the only signal. Visible focus. Labelled icon buttons.
- Honour `prefers-reduced-motion` globally.
- One brand accent; colour means status, not decoration.
- **Next.js note:** use `next/font` (self-hosted, no request leaves the app —
  same rule this skill already applies to its OS-kernel builds) and
  `next/image` for anything raster; both are defaults, not options.

---

## 10 · Build, release, deploy

### 10.1 The gate

Each line is a script that exists in a generated OS (or in the `pucho-os`
skill beside it). A bespoke build carries the app-side ones with the same
names.

| Command | Produces |
|---|---|
| `npm run check` | the static security checks. **The gate.** S1 no secret-shaped `NEXT_PUBLIC_` name · S2 no string-built SQL · S3 no unreviewed `dangerouslySetInnerHTML` · S4 no secret value from `.env` in `.next/static` · S5 no persona password in the bundle (unless a demo build) · S6 `npm audit` high/critical. S4/S5 need a build first. |
| `npm run check:db` | the above, plus the assertions against a real database: A1 a stored password hash starts `$argon2id$` · A2 a scoped role sees only its own rows · A3 a non-admin / no-token caller is refused · A4 deactivation ends sessions |
| `npm run build` | `next build` with `output: 'standalone'` in `next.config.js` — the whole app, frontend and server, as one deployable unit |
| `python <pucho-os>/scripts/ui_check.py` | every page opened and asserted, desktop **and** `--mobile` |
| `python <pucho-os>/scripts/security_scan.py --stage <stage>` | the delivery security audit, including the bundle searches (§19.5) |
| `python <pucho-os>/flow/validate_flow.py --contract` + `flow/flow_sim.mjs` | each flow's structure and capability contract gated, then simulated against the app's contract (§8) |

*(Next.js note: there is no separate `build:server` / `build:all` split — one
`next build` compiles everything, because there was only ever one process.)*

### 10.2 Deploy-ready on day one

Ten rules. Each one is a failure that actually happened on the Express
version of this standard; every one still applies here. Items 6–10 were
written for a Docker image; CP Portal runs an uploaded bundle on its own Node
(D3, §16), so they are restated for the bundle — the lesson in each is
unchanged.

1. **One process, one port.** Next.js serves the API and the bundle
   together, natively — nothing to configure.
2. **Parse the port; refuse a bad value loudly.** `""` must not become `0`.
   Next.js's own server does this correctly by default; only re-derive it
   yourself if you wrap `server.js` with custom logic.
3. **Log what was resolved at startup, without secrets** — port, database
   host, name, schema, TLS, which variable shape was used. Most of a
   deployment's mystery disappears in those three lines. In the kernel this is
   `src/instrumentation.ts` → `instrumentation-node.ts`.
4. **Two health endpoints.** Liveness touches nothing; readiness checks the
   database and reports what it tried. Orchestrators get **liveness** — point
   them at readiness and a database blip pulls a working process out of
   rotation and reports a bad gateway.
5. **A bad configuration must not kill the process at import.** Log it,
   start, fail the requests that need it. A process that dies before it
   listens tells the operator only "502".
6. **Compile before packaging.** The bundle starts with `node server.js` —
   the `server.js` that `next build` with `output: 'standalone'` emits — via
   `start.sh`. A TypeScript loader, a `.bin` shim or `npm` in the start command
   is a thing a developer machine cannot honestly test on the portal's behalf.
7. **`server.js` and `start.sh` at the bundle root.** `npm run package` lays
   the zip out that way. A wrapper folder is the bundle's equivalent of the
   Dockerfile-in-a-subfolder failure (`failed to read dockerfile`): the
   platform looks at the root and finds nothing to start.
8. **No `.env` in the bundle.** Ever. The packager refuses to produce one.
9. **Know which port the portal expects.** `start.sh` exports `PORT` with a
   default of 80 and binds `HOSTNAME=0.0.0.0`. Whether the portal injects
   `PORT` or fixes it at 80 is OPEN (Q1); the startup line says which one the
   process actually used.
10. **Keep the bundle boring.** No wrapper process manager, no install step,
    no extra start logic until the minimum is green. Go green with
    `node server.js`, then add one thing at a time, verifying each.

### 10.3 Definition of done

- [ ] `npm run check` — **exit code checked directly**, not a piped `tail`.
- [ ] `npm run build` — exit 0.
- [ ] `npm run package` — exit 0; `dist/<slug>-portal.zip` produced.
- [ ] The **artefact** unpacked and started against a real database,
      answering: liveness, `/`, a hashed asset, a client-side route, a
      sign-in.
- [ ] Schema applied to an empty database, then applied again
      (`npm run db:migrate` twice).
- [ ] Every flow gated, imported and test-run once.
- [ ] Bundle root inspected: `server.js` and `start.sh` present, `.env`
      absent.
- [ ] Security release gate (§19.8) ticked, or each open item in Known-broken
      with a consequence and a date.
- [ ] **What was not verified, stated plainly.** "It runs on my machine" is
      not evidence about the portal.

### 10.4 When a deployment will not come up

1. **Read the process log** — the portal's release log, not the build log.
   The build succeeding tells you nothing. An empty log means the process is
   not running, and nothing inside the bundle matters. (Where the portal
   shows release logs is OPEN, Q1.)
2. **Compare the logged port with the port the portal routes to.** Most
   common cause by a distance.
3. `curl` it: a nonsense path returning **502 rather than 404** means the
   route exists and the backend is unreachable — proxy-to-process, not
   application.
4. Only then change the bundle.

**Do not ship a new artefact in place of a diagnosis.** Five were shipped on
one project (the Express-era build behind this standard) against a symptom
never observed directly; each added a variable instead of removing one.

---

## 11 · Documents every repository carries

| File | Holds |
|---|---|
| `CLAUDE.md` | how to work in this repo — architecture, conventions, gates, known-broken |
| `Decision.md` | why the code is shaped this way; one `D-nnn` per non-trivial choice |
| `Planning.md` | phases, checkpoints, corrections |
| `Context.md` | a session log, including what was **not** done and why |
| `docs/fullstack-build-standard.md` | this file, copied in |
| `docs/db-migration-runbook.md` | copied in only when a migration is in scope |
| `docs/SOP.md` | this standard, applied to this app: its fields, its flows, its risks (§18) |
| `.env.example` | every variable by name, with a comment, never a value |

`Decision.md`, `Planning.md` and `Context.md` are what a **hand-built**
repository carries. A **generated OS** does not get them: its decisions live
in `docs/00-decisions.md`, and the scaffold generates the rest of its docs set
(§12) — `CLAUDE.md`, `docs/SOP.md`, `docs/security.md` (with Known-broken),
`docs/auth.md`, `docs/db-setup.md`, `docs/05-schema.md`, and both standards
copied in.

**Known-broken is a section, not a secret.** Anything insecure, unfinished or
deliberately deferred is written down with its consequence, so nobody
rediscovers it and nobody ships it by accident.

---

## 12 · Day one — the repository skeleton

This is the layout `pucho-os` generates for every OS. A bespoke build keeps
the same shape for the parts it has (`src/lib/*`, `scripts/*`, `db/*`, the
`api/` routes) and leaves out what is OS-specific (`src/config/*`, the
kernel folders).

```
<os>/
├── CLAUDE.md                      how to work here — generated
├── docs/
│   ├── 00-decisions.md            why the OS is shaped this way (§11)
│   ├── SOP.md                     this app's application of the standard (§18)
│   ├── security.md                the §19 posture, with Known-broken
│   ├── auth.md                    sign-in, sessions, codes, the first admin
│   ├── db-setup.md                local and deployed database, roles
│   ├── 05-schema.md               every entity, column and type
│   ├── fullstack-build-standard.md   this file, copied
│   └── db-migration-runbook.md       the companion, copied
└── app/
    ├── .env.example               every variable by name, never a value (§3)
    ├── .gitignore                 .env AND .env.* ; .next/ ; !.env.example
    ├── next.config.js             output: 'standalone' + security headers (§19.6)
    ├── package.json · package-lock.json   lockfile committed (§19.6)
    ├── tsconfig.json
    ├── db/
    │   ├── base.sql               the kernel's tables: users, sessions, otp_codes, files, jobs, signin_attempts
    │   ├── schema.sql             GENERATED: base.sql + the os.yaml entities; idempotent; ALTERs below every CREATE TABLE
    │   ├── roles.sql              GENERATED: the app and studio_reader roles (§19.1)
    │   └── seed/
    │       ├── *.csv              demo rows, one file per entity
    │       ├── users.json         demo personas — demo databases only (§6.4)
    │       └── manifest.json      load order
    ├── scripts/
    │   ├── db.mjs                 migrate | seed | reset | user — the same resolver as src/lib/db.ts
    │   ├── check.mjs              the gate: S1–S6, and A1–A4 with --db (§10.1)
    │   └── package.mjs            the CP Portal bundle (§16)
    └── src/
        ├── proxy.ts               redirects only (http→https, signed-out→/login) — NOT authorization (§19.3)
        ├── instrumentation.ts     + instrumentation-node.ts: the startup line (§13.4)
        ├── app/
        │   ├── layout.tsx
        │   ├── login/page.tsx
        │   ├── [[...path]]/page.tsx   the catch-all Server Component: authorises, then loads rows
        │   ├── actions.ts         Server Actions — the default write path (§1)
        │   └── api/
        │       ├── ping/          liveness
        │       ├── health/        readiness
        │       ├── data/[entity]/ flows write here, INBOUND_TOKEN (§8.5)
        │       ├── files/[id]/    authorised file serving (§19.4)
        │       ├── jobs/[id]/     async action callbacks (§8.5)
        │       └── personas/      the demo picker, only with DEMO_LOGINS
        ├── lib/
        │   ├── db.ts              connection resolver (§13) + the globalThis pool
        │   ├── auth.ts            argon2id, sessions, one-time codes, rate limit (§7, §19.2)
        │   ├── dal.ts             requireUser-style access, scope, DTO rows, audit, files (§19.3)
        │   ├── crypto.ts          field encryption + blind index (§19.7)
        │   ├── flows.ts           calls WEBHOOK_<FLOW>, or SIMULATES the effect (§8.5)
        │   └── routes.js · router.jsx · data-context.jsx
        ├── config/                GENERATED from os.yaml — never hand-edited
        │   ├── os.config.js · pages.js · nav.js · roles.js · access.js
        │   └── tokens.css · theme.js · design.js · i18n.js
        ├── module/ · components/ · screens/ · hooks/ · i18n.jsx · index.css   the kernel
        └── custom/**              AUTHORED — the only place hand-written app code goes
```

**`.gitignore` first, before any secret exists.**

```gitignore
.env
.env.*
!.env.example
node_modules
.next/
*.log
```

`.env.*` matters: a `.env.backup` or `.env.production` holds the same secrets
as `.env` and is otherwise committed.

### `.env.example` — copy this

This is the kernel's `app/.env.example`. A bespoke build copies it and drops
the lines it has no use for.

```bash
# ─────────────────────────────────────────────────────────────────────────────
# Copy to .env and fill in. NEVER commit .env.
# ─────────────────────────────────────────────────────────────────────────────

# ── Database ─────────────────────────────────────────────────────────────────
# Two accepted shapes. DB_HOST decides: set it and the DB_* variables are used
# and DATABASE_URL is IGNORED COMPLETELY. Never half of each.
#
# 1. Development — one URL:
DATABASE_URL=postgres://postgres@localhost:5432/app_dev
#
# 2. Deployment — the discrete form CP Portal / Pucho DB injects. Leave unset locally:
# DB_HOST=
# DB_PORT=5432
# DB_NAME=
# DB_USER=
# DB_PASSWORD=
# DB_SCHEMA=public
#
# TLS is derived from the host: localhost plain, anything else encrypted.
# Production verifies the certificate against DB_SSL_CA (§19.1).
# DB_SSL=
# DB_SSL_CA=
# DB_TIMEZONE=Asia/Kolkata   # the zone timestamps are reported in

# ── Server ───────────────────────────────────────────────────────────────────
# Next.js reads PORT natively. The portal bundle's start.sh defaults it to 80.
PORT=3000
# https:// turns on HSTS and the __Host-session cookie; http:// (local) uses a
# plain session cookie. The Origin check compares against it (§19.2).
APP_ORIGIN=http://localhost:3000
# Keys the HMAC of one-time sign-in codes (§19.2). Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
AUTH_PEPPER=

# ── Workflows (Pucho AI Studio) ──────────────────────────────────────────────
# One per flow the app calls. A webhook URL is a door: treat it as a secret.
# Unset = that flow's actions are SIMULATED by the app, and the header says so.
# WEBHOOK_<FLOW>=
# The flow that delivers one-time sign-in codes by email.
# WEBHOOK_AUTH_OTP=
# Shared secret every flow presents when it calls THIS app (/api/data, /api/jobs).
# UNSET MEANS CLOSED (403), not open.
# INBOUND_TOKEN=

# ── Files (stored in PostgreSQL, D6) ─────────────────────────────────────────
# FILES_MAX_MB=10    # one file
# FILES_CAP_MB=400   # all files together — the plan's storage cap, minus headroom

# ── Field-level encryption (only if the app stores sensitive PII, §19.7) ────
# FIELD_ENC_KEYS=v1:<base64 32 bytes>
# FIELD_ENC_CURRENT=v1
# BLIND_INDEX_KEY=<base64 32 bytes>

# ── Demo deployments only ────────────────────────────────────────────────────
# DEMO_LOGINS=true   # the login page lists the seeded personas. NEVER on a client's deployment.

# ── Build-time only ──────────────────────────────────────────────────────────
# NEXT_PUBLIC_* is COMPILED INTO THE BUNDLE. Public to anyone with devtools, and
# a change needs a rebuild, not a restart. NEVER put a secret behind a
# NEXT_PUBLIC_ name (npm run check enforces it).
```

**Adding a variable later means three places:** `.env`, `.env.example`, and
the app's `docs/SOP.md` table. If it is only in one, the next person deploys
without it.

### Local PostgreSQL

```bash
# 1. Install PostgreSQL 13+ and make sure it is running
psql --version

# 2. Create the database
createdb app_dev
#    or, if createdb is not on PATH:
psql -U postgres -c "CREATE DATABASE app_dev;"

# 3. Prove you can reach it BEFORE touching the app
psql -U postgres -d app_dev -c "SELECT version();"

# 4. Put the URL in .env
#    DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/app_dev

# 5. Apply the schema, then the demo rows
npm run db:migrate && npm run db:seed

# 6. Confirm
psql -U postgres -d app_dev -c "\dt"
```

**Step 3 is not optional.** If `psql` cannot connect, the app will not either,
and you will spend the next hour reading application code instead of fixing a
`pg_hba.conf` line.

---

## 13 · Connecting the database

### 13.1 One resolver, two shapes

**Write this once, in `src/lib/db.ts`, and let everything import it** —
Server Components, Server Actions, Route Handlers, the init script, any CLI.
Two places resolving the connection independently is how a seed lands in one
database while the server reads another.

**In a generated OS this section is `src/lib/db.ts`**, in spirit verbatim —
the resolver, the pool, the configuration guard and the startup line below.
`scripts/db.mjs` applies the same rules (`DB_HOST` wins outright) for
migrate and seed.

```ts
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|::1|host\.docker\.internal|db|postgres)$/i;

const env = (k: string) => {
  const v = process.env[k];
  return v == null || v.trim() === '' ? undefined : v.trim();
};

// TLS from the host, not from a variable nobody is told to set. Managed
// databases refuse unencrypted connections; local ones rarely offer TLS.
function wantsSsl(host: string): boolean {
  const explicit = env('DB_SSL');
  if (explicit != null) return ['1','true','require','yes','on'].includes(explicit.toLowerCase());
  return !LOCAL_HOST.test(host);
}

export function resolveDbConfig() {
  const schema = env('DB_SCHEMA') ?? 'public';
  const host = env('DB_HOST');

  if (host) {                               // discrete form wins OUTRIGHT
    const database = env('DB_NAME');
    const user = env('DB_USER');
    if (!database) throw new Error('DB_HOST is set, so DB_NAME is required too.');
    if (!user) throw new Error('DB_HOST is set, so DB_USER is required too.');
    return { host, port: Number(env('DB_PORT') ?? 5432), database, user,
             password: env('DB_PASSWORD') ?? '', schema,
             ssl: wantsSsl(host), source: 'DB_* variables' as const };
  }

  const url = new URL(env('DATABASE_URL') ?? 'postgres://postgres@localhost:5432/app_dev');
  return { host: url.hostname, port: Number(url.port || 5432),
           database: decodeURIComponent(url.pathname.slice(1)),
           user: decodeURIComponent(url.username),
           password: decodeURIComponent(url.password),
           schema, ssl: wantsSsl(url.hostname), source: 'DATABASE_URL' as const };
}
```

**`DB_HOST` decides, all or nothing.** A platform that sets both shapes must
not leave the app reading half of each — that bug appears only in production.

### 13.2 The pool, and the schema

```ts
export function poolOptions(cfg: DbConfig): pg.PoolConfig {
  return {
    host: cfg.host, port: cfg.port, database: cfg.database,
    user: cfg.user, password: cfg.password,
    // Applies to every connection the pool opens, INCLUDING replacements.
    // A `SET search_path` after connecting misses them.
    // search_path and the session time zone (DB_TIMEZONE, default Asia/Kolkata)
    // both travel as connection options, so every pooled connection has them.
    options: [cfg.schema === 'public' ? '' : `-c search_path=${cfg.schema},public`,
              `-c TimeZone=${process.env.DB_TIMEZONE || 'Asia/Kolkata'}`].filter(Boolean).join(' '),
    // Verify the server certificate against the provider's CA (§19.1).
    // Without DB_SSL_CA this only encrypts — fine locally, a release blocker
    // in production. A PEM in an env var may need "\n" turned back into newlines.
    ...(cfg.ssl ? { ssl: process.env.DB_SSL_CA
          ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true }
          : { rejectUnauthorized: false } } : {}),
  };
}
```

**Validate `DB_SCHEMA` before interpolating it** — it goes into a connection
option string. Allow `^[A-Za-z_][A-Za-z0-9_$]*$` and reject anything else.
`DB_TIMEZONE` goes into the same string: strip it to a time-zone name's
characters before use, as the kernel does.

**Next.js note — the singleton the dev server needs.** `next dev`'s hot
reload re-executes route modules on every edit; a pool created at module
scope without a guard opens a fresh set of connections on every save until
the database refuses new ones. Cache it on `globalThis` in development:

```ts
declare global { var __pgPool: pg.Pool | undefined }

export const pool =
  process.env.NODE_ENV === 'production'
    ? new pg.Pool(poolOptions(dbConfig))
    : (globalThis.__pgPool ??= new pg.Pool(poolOptions(dbConfig)));
```

This is the same shape Next.js's own docs recommend for Prisma; it applies to
any pooled connection.

### 13.3 A bad configuration must not kill the process

```ts
export let dbConfigError: string | null = null;

function safeResolve() {
  try { return resolveDbConfig(); }
  catch (err) {
    dbConfigError = err instanceof Error ? err.message : String(err);
    console.error(`DATABASE CONFIGURATION INVALID — data requests will fail: ${dbConfigError}`);
    return { host: '0.0.0.0', port: 1, database: 'unconfigured', user: 'unconfigured',
             password: '', schema: 'public', ssl: false, source: 'DB_* variables' as const };
  }
}
export const dbConfig = safeResolve();
```

If this throws at import, the process dies **before anything listens**, and
the only thing the operator sees is `502 Bad Gateway` — which says nothing
about the missing variable that caused it.

### 13.4 Say what you connected to

```ts
export const describeDb = (c: DbConfig) =>
  `${c.user}@${c.host}:${c.port}/${c.database} (schema ${c.schema}${c.ssl ? ', ssl' : ''}) via ${c.source}`;
```

Print it at startup — in `instrumentation.ts` (`register()`), which Next.js
runs once per server start regardless of which route is hit first. The kernel
splits it: `src/instrumentation.ts` imports `src/instrumentation-node.ts` on
the Node runtime only, and that file prints the line. **Never
the password.** Half of all deployment mysteries end the moment this line is
read.

### 13.5 Local → deployed: the switch

Nothing in the code changes. Only the environment.

| | Local | Deployed |
|---|---|---|
| Variables | `DATABASE_URL` | `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` `DB_SCHEMA` |
| TLS | off (host is local) | on (host is not local) |
| Startup line says | `via DATABASE_URL` | `via DB_* variables` |

**To point local development at the deployed database**, add the `DB_*`
block to `.env` and restart. `DB_HOST` being present is what switches it. **A
watcher does not re-read `.env` — restart the process.**

> ⚠️ Doing that means every local experiment writes to the real database.
> There is no scratch copy any more. Decide deliberately.

### 13.6 Applying the schema to the real database

```bash
# 1. Prove you can reach it, from wherever will run the migration
psql "postgresql://USER:PASS@HOST:5432/DBNAME?sslmode=require" -c "SELECT 1;"

# 2. Apply
psql "postgresql://USER:PASS@HOST:5432/DBNAME?sslmode=require" -f db/schema.sql

# 3. Apply AGAIN — it must be idempotent
psql "...same..." -f db/schema.sql

# 4. Confirm
psql "...same..." -c "\dt"
```

**In a generated OS, steps 2 and 3 are `npm run db:migrate`, run twice** with
the deployed `DB_*` block in `app/.env` (§13.5) — it applies `db/schema.sql`
and `db/roles.sql` through the same resolver and `search_path` as the app. On
the portal, the bundle carries `scripts/db.mjs` for the same job (§16.2).

**If `DB_SCHEMA` is not `public`** and you apply with `psql`, the tables land
in the wrong place unless you set the path first:

```sql
CREATE SCHEMA IF NOT EXISTS your_schema;
SET search_path = your_schema;
\i db/schema.sql
```

### 13.7 Database mistakes and their fix

| Symptom | Cause | Fix |
|---|---|---|
| `no pg_hba.conf entry … no encryption` | Managed DB requires TLS; connected in the clear | Derive TLS from the host (13.1). RDS, Cloud SQL, Neon, Supabase all require it |
| `relation "x" does not exist` on a fresh DB | `ALTER TABLE` above its `CREATE TABLE`; the file is applied as one statement and rolled back | Move every `ALTER` below all `CREATE TABLE`s |
| Seed lands somewhere the app cannot see | Two resolvers, or `DB_SCHEMA` not applied | One resolver, shared (13.1); `options: -c search_path` (13.2) |
| Works locally, fails deployed | `DATABASE_URL` set locally, `DB_*` deployed, and the code read the wrong one | `DB_HOST` decides outright |
| Tables exist but app says they do not | Applied into `public` while the app uses another schema | 13.6 |
| Pool exhausted after a burst of hot-reload saves | No `globalThis` guard on the dev pool | 13.2 |

---

## 14 · Building the API — Route Handlers and Server Actions

### 14.1 The port

Next.js's own server (`next start`, or the `server.js` from `output:
'standalone'`) already reads `PORT` correctly and refuses to bind to an
invalid value. Only re-derive this yourself if a custom `server.js` wraps the
Next.js request handler — and if you do, apply the same discipline as the
Express standard:

```ts
function portFrom(...names: string[]): number {
  for (const name of names) {
    const raw = (process.env[name] ?? '').trim();
    if (raw === '') continue;                       // "" is NOT a port
    const value = Number(raw);
    if (Number.isInteger(value) && value > 0 && value < 65536) return value;
    console.error(`Ignoring ${name}="${raw}" — not a usable port number.`);
  }
  return 3000;
}
```

### 14.2 Listen, and say so

If using a custom server, bind to `0.0.0.0` explicitly and log it:

```ts
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Next.js listening on 0.0.0.0:${PORT}`);
  console.log(`Database: ${describeDb(dbConfig)}`);
});
```

Bound to `localhost` inside a container, the listener is invisible to the
proxy in another network namespace — reported as a bad gateway. Plain `next
start` already binds `0.0.0.0` — this only matters if you replace it.

### 14.3 Two health endpoints, never one

```ts
// app/api/ping/route.ts — liveness: is this process answering HTTP? Touches nothing else.
export async function GET() {
  return Response.json({ ok: true });
}
```

```ts
// app/api/health/route.ts — readiness: can it actually serve data? For humans and dashboards.
export async function GET() {
  if (dbConfigError) return Response.json({ ok: false, error: dbConfigError }, { status: 503 });
  try {
    await pool.query('SELECT 1');
    return Response.json({ ok: true, database: describeDb(dbConfig) });
  } catch (err) {
    return Response.json(
      { ok: false, database: describeDb(dbConfig), error: err instanceof Error ? err.message : 'unreachable' },
      { status: 503 },
    );
  }
}
```

**In the kernel** both exist exactly so, `force-dynamic`, and `/api/health`
also reports `workflows` wired n/n and whether inbound calls are open
(`INBOUND_TOKEN` set) or closed — so one `curl` shows what is simulated.

**Orchestrators and proxies get `/api/ping`.** Point them at `/api/health` and
a database blip pulls a working container out of rotation — which the
operator sees as a bad gateway rather than the database error that caused it.

**Next.js note — force these dynamic.** A Route Handler with no request-time
input can be statically evaluated at build time and cached; add `export const
dynamic = 'force-dynamic'` to both, or a readiness check answers with the
build-time snapshot forever.

### 14.4 Route and payload rules — Route Handlers

- **Every response is JSON**, including errors: `{ "error": "message" }`. One
  error shape means one handler on the client.
- **The client proposes, the server computes.** Accept only what a person
  typed. Recompute every consequential value from the shared rules module
  and store *that*. If a client can send `amount`, a client can send the
  wrong `amount`.
- **Scope every read to the caller.** A record they may not see returns
  **404**, not 403 — 403 confirms it exists.
- **Validate on the server even when the form already did.** The form is a
  convenience; the Server Action or Route Handler is the boundary. Zod,
  `.strict()`, placeholders in every query (§19.4).
- Group route handlers by resource; keep data access in its own module; keep
  rules in the shared one.

### 14.5 The same rules apply inside a Server Action

A Server Action is not exempt from any of §14.4 because it is not reached by
`fetch`. Validate its arguments as if they came from an attacker — they did
not arrive through a typed form, they arrived through a network boundary that
happens to be invisible in the source code. Recompute from the shared rules
module; never trust a value the client passed just because it matches what
the form would have sent.

### 14.6 Identity

- A session is an **opaque token** the server issues, stores hashed and can
  revoke (§19.2). Never a plain id the server believes: that is impersonation
  with extra steps, and any admin screen on top of it becomes privilege
  escalation.
- `proxy.ts` (Next 16's name for middleware) may redirect signed-out users early, but it is not
  authorization — it has been bypassed before (§19.3). Every Server Action and
  Route Handler calls `requireUser()` and checks ownership itself.
- **A workflow is not a person.** It authenticates with a shared token
  (`INBOUND_TOKEN`) against a Route Handler, and the subject is resolved
  server-side from the payload — never sent by the caller. Otherwise a flow
  chooses whose record it touches.
- **Unset token means the endpoint is closed (403)**, never open.

### 14.7 API mistakes and their fix

| Symptom | Cause | Fix |
|---|---|---|
| 502 on every path, build fine | Custom server on a random port (`""` → `0`) | 14.1 |
| 502, container healthy | Health check queries the DB; task restarted forever | 14.3 |
| 502, container never started | Config threw at import | 13.3 |
| 502 from inside a container only | Custom server bound to `localhost` | 14.2 |
| A readiness check always reports the build-time result | Route Handler statically optimized | 14.3 `force-dynamic` |
| Anyone can act as anyone | Identity is a header the server trusts | 14.6 |
| A Server Action trusts a client-computed total | Treated the action as exempt from server validation | 14.5 |

---

## 15 · Connecting frontend and backend

### 15.1 Reads — Server Components

**No `fetch`, no client-visible endpoint, no CORS.** A Server Component reads
directly from `src/lib/db.ts` or a query module (in the kernel, through
`src/lib/dal.ts`, so scope and DTOs apply — §19.3). This is the default and the
preferred path — it is also the most literal reading of "one origin": there
is no second hop to have an origin at all.

### 15.2 Writes from the browser — Server Actions

- **All mutation from a Client Component goes through a Server Action**,
  colocated with (or imported into) the component that calls it.
- Pages call the action directly (`<form action={createExpense}>` or an
  `onClick` that calls it); there is no separate `src/lib/api.ts` fetch
  wrapper to maintain for this path — Next.js's own `action` binding is that
  wrapper.
- One place to add the session (the action reads `cookies()` itself); one
  place to turn a thrown error into a message the form displays
  (`useFormState`/`useActionState`).

### 15.3 A non-React caller — Route Handlers

- A workflow, a mobile client, or a smoke test needs stable JSON on a stable
  URL. That is what `app/api/**/route.ts` is for — see §14.

### 15.4 From a workflow to the app

- The flow calls a documented Route Handler with `INBOUND_TOKEN` in a header
  — in a generated OS, `POST` / `PATCH /api/data/<entity>` with `X-Flow`
  (§8.5).
- It sends **facts, not decisions** — an address, a vendor, an amount, a
  file.
- The server resolves the subject and applies its rules. What arrives is a
  **proposal**: it lands in a staging table and becomes real only when a
  person or a rule accepts it. In a generated OS "staging" is an OS-level
  decision in `os.yaml` — an inbox or parked entity, or a status value — not
  a generic staging table (§8.5).
- **Idempotent on a natural key** (`user + source + external_id`), so a retry
  adds information and never a duplicate.

### 15.5 From the app to a workflow

- The URL lives in the environment, one variable per flow, and is a secret.
- Send an **already-rendered** payload. The flow chooses nothing.
- Treat the call as best-effort: log the failure, surface it as "could not
  send", and never leave a half-committed state behind.
- **No secret travels in the payload.** No hashes, no tokens, no raw
  credentials — a code goes out, its hash stays home.

### 15.6 Connection mistakes and their fix

| Symptom | Cause | Fix |
|---|---|---|
| A page fetches its own API for data it could read directly | Reads written as Route Handlers out of Express habit | Read in the Server Component (15.1) |
| A flow writes a row with no validation | Flow talks to the database | Flows call a Route Handler (15.4) |
| Duplicate records after a retry | Ingest not idempotent | Natural key (15.4) |
| A flow can act as any user | Caller supplies the identity | Resolve server-side (14.6) |
| A webhook URL in the repo | Treated as config, not a secret | Environment only (15.5) |

---

## 16 · Deploying

CP Portal runs an **uploaded bundle on its own Node** — no Dockerfile, no
image (decision D3). The bundle below is the most portable shape there is:
`node server.js`, zero install. **The exact upload contract is OPEN (Q1)** —
the start command, whether the portal runs `npm install` or expects
`node_modules` in the upload, the Node version, whether `PORT` is injected or
fixed at 80, the upload's shape, the injected variable names, whether there
is a persistent disk, and where release logs are. Until the first real deploy
answers them, everything in §16.2–16.3 is **UNVERIFIED** and says so in the
app's `docs/SOP.md`.

### 16.1 Before you build the bundle

- [ ] `npm run check` — **check the exit code directly**, not a piped `tail`.
- [ ] `npm run build` — `next build`, `output: 'standalone'` set.
- [ ] Schema applied to an **empty** database, then **again** (13.6).
- [ ] Run the artefact against a real database: liveness, `/`, a hashed
      asset, a client-side route, a sign-in.
- [ ] `npm run package` — exit 0; the bundle contains **no `.env`** (the
      packager refuses otherwise — still, look).

### 16.2 The bundle — keep it boring

```bash
npm run build      # next build, output: 'standalone' → .next/standalone/server.js
npm run package    # → dist/<slug>-portal.zip
```

`dist/<slug>-portal.zip`, at its root:

| Entry | What it is |
|---|---|
| `server.js` | the standalone server `next build` emits, with its traced dependencies |
| `.next/static/` | hashed client assets |
| `public/` | static files |
| `db/` | `base.sql`, `schema.sql`, `roles.sql`, seed files (persona accounts only in a `--demo` bundle) |
| `scripts/db.mjs` | migrate · seed · reset · user — run against the portal's database |
| `start.sh` | `export PORT="${PORT:-80}"`, `export HOSTNAME="0.0.0.0"`, `exec node server.js` |
| `PORTAL-README.md` | how to start it, what it reads, first-start steps, the smoke test |

- **Compile before packaging.** `output: 'standalone'` produces a
  self-contained `server.js` with only the dependencies actually used — no
  TypeScript loader, `.bin` shim or `npm` in the start command to fail
  differently on a developer machine and on the portal.
- **The packager refuses a bundle containing any `.env`.** Secrets go in the
  portal's environment fields (§16.3), never in the upload.
- **Bind `0.0.0.0`, default port 80.** `start.sh` does both. A process bound
  to `localhost` is invisible to the portal's proxy.
- **No wrapper, no install step, to begin with.** Go green with
  `node server.js`, then add one thing at a time, verifying each.
- **First start, once:** `node scripts/db.mjs migrate` against the portal's
  database (idempotent), then `node scripts/db.mjs user <email> <name> admin`
  for the first administrator (§6.4). Never seed personas on a client's
  database.

### 16.3 Portal settings

| Setting | Value |
|---|---|
| Upload | `dist/<slug>-portal.zip` — `server.js` and `start.sh` at its root |
| Start command | `./start.sh` (or `node server.js`) — UNVERIFIED (Q1) |
| **Port** | **equal to the port the app logs at startup** — injected `PORT`, or 80 by default |
| Health check path | `/api/ping` |
| Injected by the portal | `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` `DB_SCHEMA` `PORT` |
| Its environment fields | `APP_ORIGIN`, `AUTH_PEPPER`, `WEBHOOK_*`, `INBOUND_TOKEN`, `DB_SSL_CA` — and the PII keys if §19.7 applies |

> A `PORT` the portal injects **overrides** `start.sh`'s default of 80. If the
> portal routes to 80 but injects `PORT=3000`, the app listens on 3000 and
> the proxy on 80 gets nothing. The startup line says which port won.

### 16.4 Smoke test

```bash
curl -i https://your-domain/api/ping      # {"ok":true}     app reachable
curl -i https://your-domain/api/health    # {"ok":true,...} database reachable
curl -I https://your-domain/              # 200             app served
```

### 16.5 When it will not come up

**In this order. The first two cost seconds and settle most cases.**

1. **Read the PROCESS log** — the portal's release log, not the build log. A
   successful build tells you nothing. **Empty log = the process is not
   running**, and nothing inside the bundle matters.
2. **Compare the port the app logged with the port the portal routes to.**
   Most common cause by a distance.
3. `curl` a nonsense path. **502 rather than 404** means the route exists
   and the backend is unreachable: proxy-to-process, not application.
4. Only then change the bundle.

> **Do not ship a new artefact in place of a diagnosis.** Five were shipped
> on one project against a symptom never observed directly. Each added a
> variable instead of removing one. One log line would have ended it.

---

## 17 · The mistakes ledger

Every one of these actually happened on the Express-era build behind this
standard, or is the documented Next.js equivalent of one that would. Symptom
→ cause → the line that prevents it.

| # | Symptom | Cause | Prevention |
|---|---|---|---|
| 1 | `failed to read dockerfile` | `Dockerfile` inside a folder in the archive | Root of the archive, always — for the portal bundle, `server.js` and `start.sh` at the zip's root (16.2) |
| 2 | Build fine, no UI | A custom server never wired up Next.js's own request handler | 16.2 — let `next start` / `server.js` serve everything |
| 3 | 502 everywhere, healthy build | A custom server's port env parsed to `0` | 14.1 |
| 4 | 502, container restarting | `HEALTHCHECK` queried the DB; task killed forever | 14.3 — the portal's health check is `/api/ping`, never `/api/health` (16.3) |
| 5 | 502, container dead | Config threw at module import | 13.3 |
| 6 | `no pg_hba.conf entry … no encryption` | RDS requires TLS | 13.1 |
| 7 | `relation does not exist` on a fresh DB | `ALTER` above its `CREATE TABLE` | 13.7 |
| 8 | Client error "Unexpected token <" | An ad-hoc Route Handler returned HTML on an error path | 14.4 — every response is JSON |
| 9 | Secrets nearly shipped in an archive | `.dockerignore` missing `.env` | `npm run package` refuses a bundle containing any `.env` (16.2); inspect it anyway (16.1) |
| 10 | `.env.backup` would have been committed | `.gitignore` had `.env` but not `.env.*` | 12 |
| 11 | Deleting a user would delete their records | `ON DELETE CASCADE` on the owning key | Deactivate, never delete |
| 12 | A gate "passed" that never ran | Piped `npm run check` into `tail`, read tail's exit code | Check the exit code directly |
| 13 | *(Next.js)* Pool exhausted in development after a handful of saves | Hot reload re-created the pool on every module re-execution | 13.2 — `globalThis` singleton |
| 14 | *(Next.js)* `/api/health` reports healthy forever, even with the DB down | The Route Handler was statically evaluated at build time | 14.3 — `export const dynamic = 'force-dynamic'` |
| 15 | *(Next.js)* A Server Action accepts a client-computed total | Treated as exempt from server-side validation because it is "not an API call" | 14.5 |

**The pattern behind most of them:** something that worked on a developer
machine was assumed to work on the platform, and a symptom was treated as a
guess to fix rather than a fact to observe. The two habits that prevent the
whole column:

> **Log what the process resolved, at startup.**
> **Read the log before changing anything.**

---

## 18 · The per-app `docs/SOP.md` — what to write for this app

`docs/SOP.md` is **this app's own application of this standard** — not a copy
of it. It names this app's actual entities, ports, tables and risks. Write it
once the schema and the first routes exist, and keep it current as they
change. It is not a generic template to fill in mechanically; it is the
document a new engineer reads first. Give it this shape (numbers are a
convention, not a requirement — see the reimbursement app's own `SOP.md` for
a filled example if one is available in this codebase):

1. **The system in one picture** — a diagram like §1's, with this app's real
   entities and its own rule module's name and location.
2. **Environments** — a table like §16.3, filled with this app's actual
   values (dev port, prod port, which platform), with every Q1 answer the
   first deploy settled and every one it did not marked UNVERIFIED.
3. **Secrets** — the subset of §4 this app actually has, plus anything this
   app added.
4. **Database** — local setup commands specific to this app's `db_dev` name;
   the actual table list with one line each on what it holds; the actual
   `ON DELETE` behaviour per foreign key, named.
5. **Build and release** — the actual `npm run` scripts this app defines and
   what each produces.
6. **Deployment** — the actual platform, actual port, actual health
   check path (should be `/api/ping` per §14.3 unless there is a stated
   reason otherwise).
7. **Where things go** — a short map from concept to file, for this app:
   where the rules module lives, where Server Actions live, where the
   webhook receivers live.
8. **Standing risks** — named, with their consequence, per this app. A demo
   login still enabled, a security tier not yet hardened, a migration not
   yet run against production — whatever is true and not yet fixed.
9. **Required fields** — §3's table, narrowed to what this app actually
   requires, plus any field this app added with the same three-place rule
   (§3 rule 4).
10. **Deploy-ready from day one** — this app's own copy of §10.2–§10.4,
    confirmed against its own gate output, not assumed from this document.
11. **Security posture** — which §19 controls are in place, which PII fields are
    encrypted and under which key version, where the keys are backed up, and
    any control deferred, with its consequence and date.

---

## 19 · Security baseline — seven controls, every app, before go-live

> Each control below is a release-gate item (§19.8), not advice. Where a
> control changes something written earlier in this file, this section wins
> and the earlier section points here. A control that cannot ship on day one
> is written into Known-broken with its consequence and a date — never left
> silently off. A bespoke build keeps that section in `CLAUDE.md`; a generated
> OS keeps it in `docs/security.md`.

### 19.1 Transport — HTTPS, verified database TLS, no database port outside the private network

**HTTPS only.** TLS terminates at the platform proxy. Plain-HTTP requests
(`x-forwarded-proto: http`) are redirected to HTTPS — at the proxy if it
supports it, otherwise in `proxy.ts`. Turn on HSTS (§19.6) only once
HTTPS is confirmed working on the domain: HSTS on a domain that cannot serve
HTTPS locks every visitor out for the whole `max-age`.

**Database TLS is verified, not just encrypted.** `rejectUnauthorized: false`
encrypts the connection but accepts *any* certificate — anything sitting in the
network path can present its own and read every query. In production, supply
the provider's CA bundle as `DB_SSL_CA` (PEM) and verify (§13.2 shows the pool
option). Running in production with TLS on and no CA logs
`DB TLS NOT VERIFIED — set DB_SSL_CA` at startup; it does not crash the process
(§13.3), but it blocks release (§19.8).

**No database port outside the Pucho private network.** PostgreSQL listens
only on the private network: the app and Studio's runners reach it, nothing
else. Whether Studio's runners and Pucho DB actually share that network is
OPEN (Q2) — **until it is confirmed, treat the port as private to the app.**

- Port 5432 is never published to the internet — no `-p 5432:5432` on a public
  host, and the firewall / security group admits only the private network.
- People reach the database through a bastion, an SSH tunnel or the provider's
  private console — never by opening the port "just for today".
- **Least privilege.** The app connects as a role that can only
  `SELECT/INSERT/UPDATE/DELETE` its own tables. Schema changes run as a
  separate owner role that the running app never holds. A SQL-injection bug in
  an app connected as the owner can drop every table; one connected as the app
  role cannot.
- **Studio reads, never writes (D4).** Studio's `postgres` tool connects as
  `studio_reader`: `SELECT` on entity tables only — never `users`, `sessions`,
  `otp_codes` or `files`. Every write a flow makes goes through the app's
  Route Handlers (§8.5), so it passes the same validation and audit.
- **The roles are generated.** `db/roles.sql` creates `app` and
  `studio_reader`; `npm run db:migrate` applies it. Whether a Pucho DB login
  may create roles at all is OPEN (Q5): when it cannot, the migrate script
  says so and does not pretend — record it in Known-broken with its
  consequence (the app then runs as the login it was given, which may own the
  schema).
- Separate database credentials per environment. Development never holds
  production credentials.

Proof: from outside the private network, `nc -zv <db-host> 5432` must fail.
Inside it, `studio_reader` selecting from `users` must be refused.

### 19.2 Passwords and sessions — argon2id, secure cookies

**Passwords are hashed with argon2id.** Never SHA-*, MD5, or anything written
from memory. OWASP's minimum parameters: memory 19 MiB, 2 iterations,
parallelism 1.

```ts
import 'server-only';
import { hash, verify } from '@node-rs/argon2';   // prebuilt binaries — no node-gyp at build time

// @node-rs/argon2 defaults to argon2id. Proof: every stored hash starts with $argon2id$.
const PARAMS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashPassword = (pw: string) => hash(pw, PARAMS);
export const checkPassword = (stored: string, pw: string) => verify(stored, pw);
```

- **Unknown user and wrong password look identical** — same message, and a
  dummy `verify` against a fixed hash for unknown users so the timing matches.
  Anything else turns sign-in into a membership oracle.
- Length 12–128. No composition rules. The upper bound exists because hashing
  a megabyte "password" is a denial of service.
- Rate-limit sign-in per account and per IP, with increasing back-off. The
  kernel counts **failures** per account and per address
  (`signin_attempts`); a successful sign-in clears that account's count.
- When the parameters are raised later, re-hash on the next successful sign-in.
- One-time codes (§7) are short-lived and attempt-limited, so they are stored as
  `HMAC-SHA256(code, AUTH_PEPPER)`, not argon2id.

**Sessions are opaque, server-side and revocable.**

- On sign-in, generate 32 random bytes (`crypto.randomBytes`), put the token in
  the cookie, and store only its **SHA-256** in a `sessions` table with
  `user_id`, `created_at`, `expires_at`, `last_seen_at`. A stateless signed
  cookie cannot be revoked; this can.
- **Deactivation (§6), password change and password reset delete every session
  for that user.** Otherwise a deactivated person keeps working until the
  cookie expires.
- Issue a new token on sign-in and on any change of role or authority — never
  reuse the pre-login one.
- Lifetime: sliding, refreshed on use, **30 days absolute maximum**. Sign-out
  deletes the row and clears the cookie.

**The cookie.** Its name follows `APP_ORIGIN` (§3), not `NODE_ENV`: an
`https://` origin gets `__Host-session`; a plain `http://` origin — local
work — gets a plain `session` cookie, because `__Host-` requires `Secure`,
which a plain-HTTP origin cannot honour.

```ts
const secureOrigin = (process.env.APP_ORIGIN ?? '').startsWith('https://');
const SESSION_COOKIE = secureOrigin ? '__Host-session' : 'session';

(await cookies()).set(SESSION_COOKIE, token, {
  httpOnly: true,          // no script can read it
  secure: secureOrigin,    // HTTPS only, wherever the origin is HTTPS
  sameSite: 'lax',         // not sent on cross-site POSTs
  path: '/',               // with no domain, required by the __Host- prefix
  maxAge: 60 * 60 * 24 * 30,
});
```

The `__Host-` prefix makes the browser refuse the cookie unless it is
`Secure`, has `Path=/` and has no `Domain` — so no subdomain can overwrite it.

> **Never `localStorage` or `sessionStorage`** for anything that grants access.
> Every script on the page can read them, so one XSS bug leaks every user's
> session. Any earlier guidance to keep the session in browser storage is
> superseded by this section.

**CSRF.** `SameSite=Lax` plus Next.js's own Origin-vs-Host check on Server
Actions covers browser writes. A Route Handler that mutates data using the
session cookie must also check `Origin === APP_ORIGIN`. Webhook routes do not
use cookies at all — they use `INBOUND_TOKEN` (§14.6).

### 19.3 Authorization — inside every Server Action and every Route Handler

**`proxy.ts` (middleware) is not authorization.** It is a convenient redirect for
signed-out users, and it has been bypassed outright: on unpatched Next.js,
CVE-2025-29927 let a crafted `x-middleware-subrequest` header skip middleware
entirely. Anything that relied on middleware alone was open.

**A Server Action is a public HTTP endpoint.** Anyone who can load the page can
call it, from `curl`, with any arguments. "The button only shows for admins"
protects nothing.

The pattern — one data-access layer, three checks, every time:

```ts
// src/lib/dal.ts
import 'server-only';

export async function requireUser(): Promise<SessionUser> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = token ? await findActiveSessionUser(sha256(token)) : null;  // also checks users.is_active
  if (!user) redirect('/sign-in');
  return user;
}

export function requireAuthority(user: SessionUser, flag: 'can_approve' | 'is_admin') {
  if (!user[flag]) throw new ForbiddenError();
}
```

```ts
// app/(app)/expenses/actions.ts
'use server';

export async function approveExpense(input: unknown) {
  const user = await requireUser();                          // 1. who is calling
  const parsed = ApproveExpense.safeParse(input);            // 2. what they sent (§19.4)
  if (!parsed.success) return { error: 'Invalid request' };
  const expense = await getExpenseForApprover(user, parsed.data.expenseId);
  if (!expense) return { error: 'Not found' };               // 3. may they — scoped query, 404 not 403
  requireAuthority(user, 'can_approve');
  // …only now act, recomputing from the rules module (§1)
}
```

- **Scope the query, not just the result.** `WHERE id = $1 AND owner_id = $2`
  (or the approver chain) — not "fetch any row, then check in JavaScript". A
  forgotten check then returns nothing instead of someone else's record.
- **Identity, role and ownership come from the session, never the payload.** A
  client that may send `userId` or `role` may send someone else's.
- **Return DTOs, not rows.** Props passed to a Client Component are serialised
  into the page. A whole `users` row passed as a prop ships its
  `password_hash` to the browser. Select and return only the fields the caller
  may see.
- **Pin it with assertions** (alongside §6.3, in `npm run check`): for every
  resource, user B asking for user A's record gets 404; a non-admin calling
  every admin action is refused.

**In the generated kernel the three checks are:**

1. **The page.** The catch-all Server Component (`src/app/[[...path]]/page.tsx`)
   checks the session, then the role→page map, before it loads a single row.
2. **The action.** `runAction` (`src/app/actions.ts`) checks the role→action
   map (`src/config/access.js`, generated from `os.yaml`) before anything is
   written.
3. **The data.** `src/lib/dal.ts` scopes self-service roles (`SCOPES` in
   `src/config/access.js`, from `{{user}}` in `os.yaml`) in the query itself,
   and returns DTO rows — strings — never a `users` row.

A record outside the caller's scope is **404**, never 403. `npm run check:db`
observes A2 (scope) and A3 (non-admin / no-token refused).

### 19.4 Input — parameterized queries and Zod

**SQL uses placeholders, always.**

```ts
await pool.query('SELECT id, title FROM trips WHERE id = $1 AND owner_id = $2', [id, user.id]);
```

- Never put a value into SQL with a template literal or string concatenation —
  not "just this once", not for a number.
- Identifiers (a sort column, a schema name) cannot be placeholders. Map them
  from an allowlist:

  ```ts
  const SORT = { date: 'created_at', amount: 'amount' } as const;
  const column = SORT[parsed.data.sort] ?? 'created_at';
  ```

- If a query builder or ORM is used, its raw escape hatches (`sql.raw`,
  `$queryRawUnsafe` and similar) are banned outside files reviewed for it;
  `npm run check` searches for them.

**Zod at every boundary** — Server Action arguments, Route Handler bodies and
query strings, route params, webhook payloads, upload metadata, and
environment variables.

```ts
export const CreateExpense = z.object({
  tripId: z.string().uuid(),
  category: z.enum(['travel', 'stay', 'food', 'other']),
  amount: z.coerce.number().positive().max(1_000_000),
  note: z.string().trim().max(500).optional(),
}).strict();   // unknown keys are rejected
```

- **`.strict()` is what stops mass assignment.** Without it, a client that adds
  `status: 'approved'` or `role: 'admin'` to a payload may get it written.
- `safeParse`, then return `{ error }` (a form error, or 400). Never echo raw
  input back, and never return a stack trace.
- The same schema may power the form's live feedback, but the server's parse is
  the boundary (rule 2).
- **Environment variables too:** `EnvSchema.safeParse(process.env)` at startup.
  On failure, log the *names* of the bad variables (never their values) and set
  the configuration error (§13.3) — do not throw.
- **Uploads (D6):** stored in PostgreSQL as `bytea`, in a `files` table (`id`,
  `name`, `mime`, `size`, `data`, `entity`, `record_id`, `uploaded_by`) —
  never on the server's disk, so a redeploy cannot lose them. Cap each file
  (`FILES_MAX_MB`) and all of them together (`FILES_CAP_MB`, under the plan's
  storage cap; plan limits are OPEN, Q4). Check the type from the file's magic
  bytes, not its extension or `Content-Type`. Serve only through the
  authorized Route Handler `/api/files/<id>` — signed-in callers only — with
  `Content-Disposition: attachment` for anything that is not an image.
- **Output:** React escapes by default. `dangerouslySetInnerHTML` is banned
  unless the HTML has passed through a sanitizer (DOMPurify) and the file is
  reviewed; `npm run check` searches for it.

### 19.5 Secrets — out of the repository, nothing secret behind `NEXT_PUBLIC_`

This extends §4.

- **`import 'server-only'`** is the first line of every module that reads a
  secret or the database (`src/lib/db.ts`, `src/lib/dal.ts`,
  `src/lib/auth.ts`, `src/lib/crypto.ts`). Importing one of them into a Client
  Component then fails the build instead of shipping the module to the browser.
- **The `NEXT_PUBLIC_` gate.** `npm run check` (S1) fails if any
  `NEXT_PUBLIC_` variable name matches
  `/(SECRET|KEY|TOKEN|PASSWORD|PEPPER|WEBHOOK|DATABASE|DB_)/i`.
- **After `next build`,** `npm run check` (S4) searches `.next/static` for the
  value of every secret in `.env` (any value longer than 8 characters), and
  (S5) for every demo persona's password unless this is a demo build — the
  picker is served by `/api/personas` at run time, never bundled.
  `security_scan.py` repeats both searches at delivery. A hit means a secret
  is in the bundle — rotate it, then fix the leak.
- **Secret scanning.** `gitleaks` in a pre-commit hook and in CI, and once over
  the full history when the repository is set up — **recommended, not shipped**
  by the scaffold; set it up per repository. A hit means **rotate** (§4) —
  deleting the commit does not un-leak it.
- A secret never goes into a Client Component prop, an error message, a log
  line or a URL.

### 19.6 Security headers and dependency patching

**Headers, in `next.config.js`:**

```js
const isProd = process.env.NODE_ENV === 'production';
const https = (process.env.APP_ORIGIN || '').startsWith('https://');   // §3

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,  // eval only for the dev server
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // HSTS only once the domain serves HTTPS (§19.1) — APP_ORIGIN says whether it does.
  ...(https ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

module.exports = {
  output: 'standalone',
  poweredByHeader: false,   // no X-Powered-By: Next.js
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
```

- **About `'unsafe-inline'` for scripts.** Next.js injects inline scripts for
  hydration. A strict CSP needs a per-request nonce set in `middleware.ts`,
  which forces every page to render dynamically. The baseline above still
  blocks third-party script origins, framing, plugins and foreign form
  targets. Apps that handle payments or high-sensitivity PII move to the
  nonce-based CSP, recorded in `Decision.md` (`docs/00-decisions.md` in a
  generated OS).
- Any origin the app genuinely needs (an analytics host, a map tile server) is
  added to the one directive that needs it, with a `Decision.md` line — never
  a wildcard.
- Proof: `curl -I https://<domain>/` shows every header above and no
  `X-Powered-By`.

**Dependency patching:**

- `package-lock.json` is committed; builds install with `npm ci`, so the
  bundle (§16.2) carries exactly the locked versions.
- `npm audit --omit=dev --audit-level=high` runs inside `npm run check` (S6); a high
  or critical finding fails the gate. A genuine false positive is recorded in
  `Decision.md` with its reason — never silenced globally.
- Dependabot or Renovate is on for every repository. **Next.js and React
  security releases are applied within 72 hours for critical, 7 days for
  high.** Both have shipped critical fixes — the middleware bypass above
  (CVE-2025-29927) and the React Server Components remote-code-execution flaw
  (CVE-2025-55182, December 2025). An app on a stale framework version is
  exposed no matter how good its own code is.
- There is no base image to rebuild: the portal runs the bundle on its own
  Node (D3), whose version is OPEN (Q1). Once the first deploy answers it,
  record it in `docs/SOP.md`; a bespoke build that does ship an image rebuilds
  it at least monthly, pinned to the major version.
- Every new dependency is a `Decision.md` line. Fewer packages, smaller attack
  surface.

### 19.7 Field-level encryption for sensitive PII

Database TLS protects the wire; disk encryption protects a stolen disk. Neither
protects against someone holding a database login, a leaked backup or a SQL
dump — which is how most personal data actually leaks. Sensitive fields are
encrypted in the app before they reach PostgreSQL.

**What gets encrypted:** government ID numbers (Aadhaar, PAN, passport,
driving licence), bank account numbers, health information, and anything a
client contract or India's DPDP Act 2023 treats as sensitive personal data.
**Not** names or the email used to sign in — those are protected by access
control (§19.3) and needed for search. **Card numbers are never stored at
all** — that is the payment provider's job, and storing them puts the whole app
in PCI scope.

**In a generated OS this is implemented** for every entity column declared
`encrypted:` in `os.yaml`: AES-256-GCM with the AAD `<entity>.<column>:<id>`,
a `<column>_bidx` blind-index column beside it for equality lookups, and
versioned keys from `FIELD_ENC_KEYS` / `FIELD_ENC_CURRENT`. Never on the id,
title, owner or stage column — the kernel lists, scopes and routes by those.
The code below is the shape `src/lib/crypto.ts` follows.

```ts
// src/lib/crypto.ts
import 'server-only';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

// FIELD_ENC_KEYS="v1:<base64 32 bytes>,v2:<base64 32 bytes>"   FIELD_ENC_CURRENT="v2"
const KEYS: Record<string, Buffer> = Object.fromEntries(
  (process.env.FIELD_ENC_KEYS ?? '').split(',').filter(Boolean).map((pair) => {
    const [version, b64] = pair.split(':');
    return [version, Buffer.from(b64, 'base64')];
  }),
);
const CURRENT = process.env.FIELD_ENC_CURRENT ?? 'v1';

// aad binds a ciphertext to where it lives, e.g. "employees.pan:<row uuid>".
// Copied into another row or column, it fails to decrypt instead of being misread.
export function encryptField(plain: string, aad: string): string {
  const iv = randomBytes(12);                                   // never reuse an IV with the same key
  const cipher = createCipheriv('aes-256-gcm', KEYS[CURRENT], iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [CURRENT, iv, cipher.getAuthTag(), ct].map((p) => (typeof p === 'string' ? p : p.toString('base64'))).join(':');
}

export function decryptField(stored: string, aad: string): string {
  const [version, iv, tag, ct] = stored.split(':');
  const decipher = createDecipheriv('aes-256-gcm', KEYS[version], Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}

// Equality search without decrypting every row: a keyed hash in its own column.
export function blindIndex(value: string): string {
  return createHmac('sha256', Buffer.from(process.env.BLIND_INDEX_KEY ?? '', 'base64'))
    .update(value.trim().toUpperCase())
    .digest('hex');
}
```

- **Keys live in the environment or a secret manager — never in the database,
  the repository or a SQL statement.** That rules out `pgcrypto` with the key
  passed in the query: the key lands in query logs and `pg_stat_statements`.
- **Rotation:** add `v2`, set `FIELD_ENC_CURRENT=v2`, re-encrypt existing rows
  in a background job, and remove `v1` only when
  `SELECT count(*) … WHERE col LIKE 'v1:%'` returns 0. Versioned ciphertext is
  what makes rotation possible without downtime.
- **Losing the key loses the data.** Back the keys up separately from database
  backups — a backup that holds both defeats the point.
- **Masked by default** (`XXXX-XXXX-1234`). The full value is shown only behind
  an authority check, and every reveal writes an audit row (§5).
- Decrypted values are never logged and never sent to a workflow unless that
  flow needs them — and if it does, the app's `docs/SOP.md` says so.
- Encrypted columns cannot be sorted, range-filtered or `LIKE`-searched.
  Equality only, through the blind index — and only for high-entropy values; a
  blind index over something with few possible values is guessable.

### 19.8 Security release gate

Every box ticked before go-live, or the unticked ones written into Known-broken
with a consequence and a date. Each line is something you **observe**, not
something you believe.

Where a script observes a line, the line names it; the rest are observed by
hand and the evidence goes in `docs/security.md`.

- [ ] `curl -I http://<domain>/` → redirect to HTTPS. `curl -I https://<domain>/`
      → CSP, HSTS, `nosniff`, frame and referrer headers present; no
      `X-Powered-By`. *(by hand)*
- [ ] From outside the private network, `nc -zv <db-host> 5432` fails; inside
      it, `studio_reader` cannot read `users`. *(by hand; Q2 open)*
- [ ] The startup log shows database TLS with the CA verified. *(the startup
      line, §13.4)*
- [ ] The app's database role is not the schema owner. *(`npm run db:migrate`
      reports whether `app` / `studio_reader` were created — Q5; if not,
      Known-broken)*
- [ ] A stored password hash begins with `$argon2id$`. *(`npm run check:db`
      A1)*
- [ ] In browser devtools: the session cookie is `__Host-session`, `HttpOnly`,
      `Secure`, `SameSite=Lax` — and nothing session-related is in
      `localStorage`. *(by hand, on the `https://` origin)*
- [ ] Deactivating a user ends their open session immediately.
      *(`npm run check:db` A4)*
- [ ] Authorization assertions pass: cross-user reads return 404 on every
      resource; a non-admin calling each admin action (with `curl` and a
      non-admin cookie) is refused. *(`npm run check:db` A2, A3;
      `ui_check.py` opens each role's pages)*
- [ ] `npm run check` is clean on: no string-built SQL (S2), no raw query
      escape hatches, no unreviewed `dangerouslySetInnerHTML` (S3), no
      secret-shaped `NEXT_PUBLIC_` name (S1), no secret value (S4) and no
      persona password (S5) in `.next/static`. *(`npm run check`;
      `security_scan.py` repeats the bundle searches)*
- [ ] `npm audit --omit=dev --audit-level=high` exits 0; Next.js and React are on
      their latest patched releases. *(`npm run check` S6)*
- [ ] `gitleaks` is clean on the full history. *(recommended; not shipped by
      the scaffold)*
- [ ] A sensitive PII column read raw with `psql` shows `v1:…` ciphertext, not
      the value. *(by hand, for each `encrypted:` column)*

---

## 20 · The brief for an AI agent on day one

Paste this at the start of a build, before any code exists.

> Build to the Pucho Full-Stack Build Standard (Next.js + PostgreSQL).
>
> **For a Pucho OS, do not hand-write this: `pucho-os` generates it from
> os.yaml; the brief applies to custom code in `src/custom/**` and to bespoke
> builds.**
>
> **Architecture.** One Next.js process serves pages, Server Actions and
> Route Handlers on one port — no separate API server. Reads happen in
> Server Components, straight from the database. Writes from the browser go
> through Server Actions. A Route Handler exists only for a caller outside
> the React tree: health checks, workflow webhooks, anything that needs a
> stable JSON URL. A pure rules module, imported by Server Components,
> Server Actions, Route Handlers and any Client Component that wants live
> preview, recomputes every consequential value on every write. Derived
> values are computed, never stored. The browser never talks to the
> database.
>
> **The split.** Deterministic logic is code. Workflows do extraction,
> messaging, documents and model judgement only. A workflow never decides
> and never writes to the database — it calls a Route Handler, which
> applies the same rules as a human request. Studio may read entity tables
> through a `studio_reader` role; it never writes there.
>
> **Configuration.** `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`,
> `DB_PASSWORD`, `DB_SCHEMA`, `DB_SSL`, `DB_SSL_CA`, `DB_TIMEZONE`,
> `APP_ORIGIN`, `AUTH_PEPPER`, `WEBHOOK_<FLOW>`, `INBOUND_TOKEN`,
> `FILES_MAX_MB`, `FILES_CAP_MB` (and `FIELD_ENC_KEYS`,
> `FIELD_ENC_CURRENT`, `BLIND_INDEX_KEY` when PII is stored). Next.js reads
> `PORT` natively; do not wrap it with a custom server unless there is a
> stated reason. Log the resolved port and database at startup, without the
> password. A bad configuration logs and starts; it does not throw at
> import.
>
> **Health.** Two Route Handlers, both `force-dynamic`: liveness that
> touches nothing, readiness that checks the database and reports what it
> tried. Orchestrators get liveness.
>
> **Database.** Idempotent schema; `ALTER` statements below every `CREATE
> TABLE`. A singleton pool cached on `globalThis` in development. Work out
> what cascades before writing a delete — default to deactivation. Audit
> anything that changes money, access or permission.
>
> **Users.** Ship user and role management from the start: create, edit,
> deactivate, reactivate, reset, behind an administrator role, with an audit
> trail, enforced in every Server Action and Route Handler (middleware only
> redirects; the UI only hides). Entitlement level,
> functional role, authority, hierarchy and display label are separate
> fields; the level is a closed set. Nobody may change their own level,
> authority or role. Write the hierarchy rules — no cycles, no orphaned
> reports, everyone resolving to an approver, the last role-holder protected
> — as failing assertions before the Server Actions exist.
>
> **Auth.** From the first commit: passwords hashed with argon2id; an opaque
> session token in a `__Host-` cookie (HttpOnly, Secure, SameSite=Lax), stored
> hashed in a sessions table and revoked on deactivation — never
> localStorage. Never seed a password equal to a username; never list
> credentials on a login screen. One-time codes by email where useful: the
> server generates, hashes, rate-limits and compares — the workflow only
> delivers.
>
> **Security baseline (§19).** HTTPS only; database TLS verified with the
> provider's CA; the database port never public and the app's DB role not the
> owner. Every Server Action and Route Handler calls `requireUser()`, checks
> authority and scopes its query to what the caller may see — middleware is not
> authorization. Placeholders in every query; Zod `.strict()` at every
> boundary. `import 'server-only'` on every module touching secrets or the
> database. CSP, HSTS, nosniff, frame and referrer headers; `poweredByHeader:
> false`. `npm audit` high/critical fails the gate; Next.js and React security
> releases applied within days. Sensitive PII encrypted with AES-256-GCM in the
> app, versioned keys from the environment, a blind index for lookups. Tick the
> §19.8 gate before go-live.
>
> **Secrets.** `.env` and `.env.*` ignored, `.env.example` tracked, nothing
> secret behind a `NEXT_PUBLIC_` name, no `.env` in any archive.
>
> **Deploy.** `next build` with `output: 'standalone'`, then `npm run
> package` → a CP Portal bundle started by `node server.js`, with `server.js`
> and `start.sh` at its root and no `.env` inside. Secrets go in the portal's
> environment fields. Keep the bundle boring — nothing beyond `node
> server.js` until it is green. The portal's upload contract is unverified
> until the first real deploy; say so.
>
> **Evidence.** Nothing is done until its gate has produced an artefact.
> Check exit codes directly. Run the built artefact against a real database
> before calling it ready. State plainly what you did not verify.


## Section 19 - v4.9 security additions (2026-10-14; from the insurance-OS test + security-checklist review)

- **F18 Dependency advisories - IMPLEMENTED.** `scripts/security_scan.py` runs `npm audit --omit=dev` in app/ and reports high/critical counts (warn-level, non-blocking). Keep dependencies patched; a build with high/critical advisories is flagged.
- **RLS - Database row-level security - IMPLEMENTED (v4.9).** `scaffold_os.py` `gen_rls_sql` generates `db/rls.sql` from the role scope map (the same `src/config/access.js` SCOPES): for every scoped entity, `ENABLE` + `FORCE ROW LEVEL SECURITY` and a `FOR ALL TO app` policy whose `USING`/`WITH CHECK` pass only when `current_setting('pucho.scope')` matches one of that entity's scope columns, or `pucho.unscoped='1'` (admin/flow/system). `db.mjs migrate` applies it after `roles.sql`. The DAL sets that context per transaction (`setScope` → `set_config(…, true)`) on every entity read and write, so Postgres refuses a cross-scope row even if a query ever skipped the DAL's own WHERE. `current_setting(…, true)` is NULL when unset → **fail-closed** (no context = no rows for the `app` role). The schema owner (dev superuser) bypasses RLS, so local development is unchanged; on a handed-over Pucho DB the app logs in as `app` and the policy bites. Proven: as the `app` role, `set_config('pucho.scope','<name>')` then `SELECT` returns only that person's rows; `pucho.unscoped='1'` returns all. The Postgres `UNIQUE` index (not visibility) is the reliable duplicate guard, and a `23505` violation is mapped to a 409 in the DAL, so dedupe holds even when a scoped pre-check cannot see the colliding row.
- **Webhook signature verification - IMPLEMENTED (v4.9).** `src/lib/auth.ts` `verifyWebhookSignature(provider, rawBody, header)` recomputes HMAC-SHA256 over the exact raw bytes with the provider secret `WEBHOOK_SECRET_<PROVIDER>` and compares constant-time against `x-webhook-signature` / `x-hub-signature-256` (`sha256=…`). The new `/api/hooks/<provider>` door reads the body with `req.text()` (never re-serialized), rejects `unconfigured`/`missing`/`mismatch` with **401**, and on a good signature writes the body to the entity mapped in os.yaml `webhooks:` through the same DAL + v4.9 guards (else acks 200). An unset secret = closed. Proven: a forged or missing signature → 401; the correctly-signed body → 200/201.