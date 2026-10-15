# Pucho OS frontend design — the visual system (v3.2)

Read before planning or implementing an app frontend. Generated projects receive this file as
`docs/frontend-design.md`. Apply it with `docs/microanimations.md` and the kernel. These are frontend
decisions, not new `os.yaml` fields (the fields are in `reference/os-schema.md`). Layout and
interaction also follow the seven UX laws in `docs/ux-laws.md` (skill: `method/ux-laws.md`).

## 1. Direction — minimal by decision

An OS is a place people work for hours. The screen should disappear behind the records, amounts,
people and statuses it shows. Four rules hold everywhere:

1. **One accent.** The client's `brand.color` is the only saturated colour that is not a status. It goes
   on the primary action, the selected state, the focus ring, a progress bar with no tone, and the
   current step. Never on navigation, table chrome, labels, icon tiles or KPI numbers.
2. **Colour is status.** Green, amber, red and blue mean healthy / waiting / needs action / in flight.
   They appear on badges, dots, callouts, kanban column marks, chart series that are statuses, and a
   KPI whose *meaning* is a status (`tone:`). A row of KPI cards in five colours says nothing; one red
   "Overdue" says everything. Zero overdue is not red.
3. **Depth is a hairline.** Surfaces are white on a near-white canvas with a 5–8 % black border and a
   1px/2px shadow you cannot name. Overlays (modal, drawer, popover) get one soft shadow. Nothing lifts
   on hover; hover changes a background or a border.
4. **Whitespace before boxes.** Group with spacing and a small uppercase section title before adding a
   card. Cards are for things that are one unit (a record, a person's day, a metric), never for a label.

## 2. Tokens — one set, three places that agree

`src/config/tokens.css` is generated per client from `brand:` + `design:` and is the **only** file that names a
colour or a size; `src/index.css` (`:root`) holds aliases, `tailwind.config.js` maps names to the variables and
`src/config/theme.js` (antd) gets the same hex. Kernel code never names a hex; a custom section should not either.
The values below are `tone: graphite` (the default). `tone: pastel` derives `--bg`, `--surface-2`, the lines, the
inks, the status softs and the stage ramp from the brand hue at fixed lightness; `radius: sharp | soft | round`
and `density: compact` rescale the radius and control rows. Whatever the tone, every ink and every ramp step
measures ≥ 4.5:1 on its surface (the scaffold darkens the ramp until it does).

| Token | Value (graphite) | Tailwind | Use |
|---|---|---|---|
| `--bg` | `#F6F7F8` | `app-canvas` | page canvas |
| `--surface` / `--surface-2` | `#fff` / `#F1F3F5` | `bg-white` / `bg-surface-2` | cards / subdued areas, tiles, table headers |
| `--line` / `--line-strong` | `#E3E6EA` / `#CDD2D8` | `border-surface-border` | dividers, card borders / control borders |
| `--ink` … `--ink-4` | `#15181C` `#3D444D` `#646C77` `#A3ABB5` | `text-ink`, `text-ink-2/3` (`gray-900/600/500` are the same values); `ink-4` = disabled only | text, secondary, labels & placeholders (5.31:1), disabled |
| `--primary`, `-strong`, `-soft`, `-tint`, `-line` | brand scale, or the ink scale when the brand is a red | `primary-500/600/50/100/300` | buttons, links, focus, selection |
| `--brand` | `brand.color` | `brand-500` | logo and the 3px active-nav marker — nowhere else |
| `--ok --warn --bad --info` (+ `-text`, `-soft`) | `#1E7B45 #9A5B0B #B42318 #1F5FAD` on `#E7F4EC #FDF1DC #FDECEA #E8F0FA` | `bg-ok`, `text-ok-text`, `bg-ok-soft` … | AA pairs: won / on track · due today / at risk / draft · overdue / lost / destructive · sent / info |
| `--stage-1 … -6` | `#8A94A3 → #1F3F7A` (AA-darkened) | `stage.js` | pipeline stages darken as they advance; Won green; Lost a hollow grey ring |
| `--nav-bg --nav-line --nav-ink --nav-ink-2 --nav-group --nav-active-bg --nav-active-ink` | light: surface-2 / tinted: brand tint / dark: brand near-black | `bg-nav`, `text-nav-ink` … | the sidebar or rail's own colours, per `design.sidebar.style` |
| `--chart-one`, `--cat-1 … -8` | `#3563A6`, a categorical set | `Charts.jsx` | one-series charts, series palette |
| `--radius-xs / -sm / (md) / -lg` | 6 / 8 / 10 / 12 px | `rounded-xs / -sm / -xl / -2xl` | chips & badges / controls, buttons, nav rows / cards / overlays |
| buttons | 8px radius, 40px (44 on phones) | `.ant-btn` | one primary per view; danger only for destructive |
| type | inside the app: Geist by default, IBM Plex by `design.font: plex` (`method/design-direction.md`); login: always IBM Plex Sans / Mono (all self-hosted), 600 headings, tabular numerals, 12px floor | `text-[24px]` h1 … `text-[12px]` caption | see §4 |
| motion | 120 / 200 / 280 / 420 ms, standard ease | `src/config/motion.js` | see microanimations.md |

Status words map to tones automatically (`toneOf()` in `src/components/ui/primitives.jsx`): a value
like "Overdue", "Pending", "Completed" or "In Progress" colours its badge, dot, callout and chart series
without any per-client configuration. Unknown words are neutral.

## 3. Primitives — the component library is the kernel

The kernel is the component library. After studying HeroUI v3 (Tailwind v4 + React Aria, soft pill
defaults, Apache/MIT licence ambiguity), shadcn/ui v4 (Base UI, vendored TSX) and Ant Design 6 in
September 2026, the decision is: **no second UI library**. antd 6 stays for the hard controls (Select,
DatePicker, Table pager, Segmented, Steps, Switch) under our tokens; everything else is a small,
vendored primitive in `src/components/ui/primitives.jsx`. What HeroUI and shadcn taught was adopted as
ideas — semantic tokens, a tone/variant vocabulary, a radius scale, chips with counts, skeleton
geometry — not as dependencies. A second library means two base layers, two date stacks and a
Tailwind v4 migration for nothing the client can see.

| Primitive | What it is | Where the kernel uses it |
|---|---|---|
| `Chip`, `ChipRow` | filter chip with optional count; `aria-pressed` is the selected state | table `segments`, `period` presets |
| `ViewToggle` | table / cards / board switch | table `views` |
| `Avatar` | initials on a neutral disc — people are not colour-coded | cards, kanban, person card, profile |
| `Progress` | 6px track; `value/of` or `pct`; tone `auto` = ok ≥ 80, warn ≥ 50, bad | KPI `progress`, card `progress`, `progress` section |
| `Callout` | tinted note with a label; renders nothing when empty | card `callout`, `callout` section / block |
| `Tile`, `Tiles` | label/value on a subdued surface | `tiles` section (specs, key figures) |
| `ScoreRing` | 0–max ring with label and bands | `score` section |
| `IconDisc` | icon on a tinted disc — only when a tone is declared | KPI `tone` |
| `MetaRow` | icon · label · value line | card `fields`, approvals `meta`, detail `meta` |
| `TagList` | comma-separated cell → chips | card `tags` |
| `StatusBadge` | flat tinted badge (unchanged) | everywhere a status is shown |

Buttons: antd `Button` (`type="primary"` = brand fill, default = white hairline, `danger` = red text on
white). CSS classes `.btn-primary / .btn-secondary / .btn-ghost / .btn-danger` exist for non-antd
markup and look identical. One primary per view.

## 4. Type and density

Inside the app: Geist by default for everything — UI, headings, numbers, ids and codes (tabular figures, no
second mono face) — self-hosted from `src/assets/fonts/geist` (variable, SIL OFL); `design.font: plex` keeps IBM
Plex Sans + Mono inside the app instead. The login page always keeps IBM Plex Sans / Mono from `@fontsource`. No request leaves the app for a font. The surface follows shadcn/ui and motion follows
React Bits Micro (`method/design-direction.md`). Headings 600: page
title 24px, drawer title 18px, section heading 16px, body 14px, control label 13px, caption 12px
(uppercase, 4 % tracking, `--ink-3`). Nothing renders below 12px (the gate scans for it). Numbers are
tabular everywhere; a KPI is 28px (20px in the strip). Tables: 12px uppercase headers, 13px rows, 40px
controls (44px on phones). Spacing rhythm is 4px: 8/12 inside a card, 16 between cards, 20 between blocks.

## 5. Patterns the kernel renders (chosen per OS in `os.yaml`)

These came from the Energy Mission LMS and RR Associates practice OS (Sep 2026) and were rebuilt on the
kernel, quieter. Compose; never copy a page.

- **Segments with counts** above a table (`segments:`) — "All 30 · Assigned 4 · Overdue 8". The chip
  counts are the table counts; clicking one filters. Use for a status or a department column.
- **Period presets** in the toolbar (`period:`) — Today / Yesterday / 7 days / 30 days / This month / All
  over a date column.
- **Three views of one table** (`views:`) — the same rows as a table, as **cards** (`card:` — avatar,
  title, badge, icon rows, progress, callout, tags, actions) or as a **board** (`kanban:` — one column per
  stage with a count, drag-and-drop writes the stage through `move`; `locked` stages show but accept no
  drop; on phones a "Move to…" select replaces the drag). Default with `view:`; the person can switch.
- **KPI extras** — `sub` (a second line, literal or formula), `progress` (done / total), `tone`
  (icon on a tinted disc for a status-meaning card), `filter` (clicking the card narrows the tables on
  the page — the selected card gets a brand border).
- **Charts** — `series:` on a breakdown for grouped bars (statuses colour themselves), `target:` for a
  benchmark line, a donut with a value/percent legend, `span:` to size a card on the six-column grid.
- **Verification queue** — `approvals` with `layout: cards`, `priority:` and `meta:` rows, two buttons in
  the client's words.
- **Record detail with a rail** — `detail.layout: rail`: record header (title, id, status, `meta` contact
  rows), main sections (`tiles`, `callout`, `related`, `timeline`, `custom`) and `rail` sections (`score`,
  `card` for the owner, `linked` latest related record with actions, `list` of matching rows). The same
  section vocabulary renders compact inside a `drawer`.
- **Stepper** — numbered discs with a `sub` line, a step `icon`/`heading`/`desc`, review step, "Next step".
- **Feed as a timeline** — `style: timeline` for an activity history with status dots.
- **Callout block** — a page-level note (`type: callout`, `tone`, `title`, `text`).
- **Grouped view** (`views: [grouped]`, `group:`) — the same rows sectioned under one coloured header per
  bucket with a count and a summary ("West Region · 5 states · RM: Mehul Shah"). For reference data the
  eye finds the bucket first; a flat table with a Region column makes it hunt. Colours come from the
  categorical scale, status values keep their status colour.
- **Every row opens** — a right drawer by default (id, status, "Open full page" when a detail exists, the
  record's fields, then its actions); `placement: center` for reference data; `drawer: false` to opt out.
  Row-action icons stay in the table only with `row_actions: inline`.
- **Reactive form panel** (`type: panel`) — a titled, tinted box inside a form that looks up another
  answer (State → the region_mapping row), shows what it found as a badge and rows, copies it into the
  payload and filters its own fields (`options_where`). The "Regional territory routing" pattern.
- **Two-column forms** — `columns: 2`, or automatic at ≥ 6 fields; a textarea, a panel or `span: 2` takes
  the row. Labels sit left-aligned above their control; the control fills the column; the form is
  centred in the modal; only the notes textarea resizes.
- **Builder** (`kind: builder`) — a document of priced lines: catalogue pick fills model / capacity /
  controller / specs and the price (price list first, base price fallback), specs are editable rows
  under a collapsed header, quantity × price, a global discount with the ₹100-rounded total, terms and
  notes, one big submit that saves and opens the PDF preview. The same declaration edits an existing
  document (`lines.from`, `item_action`).
- **Dropdowns open downward, always** — the kernel scrolls the panel to make room rather than flipping.
- **Graphite** — steel greys (`--ink` #15181C, `--ink-2` #3D444D, `--ink-3` #646C77 is the lightest text
  grey at 5.31:1, `--ink-4` for disabled only), `primary` = the brand or ink when the brand is a red, red
  reserved for overdue / lost / destructive, AA text-on-soft status pairs, a stage ramp for pipeline
  values, radius 6 chips · 8 controls · 10 cards · 12 overlays, border-only cards, shadow only on what
  floats, Geist inside the app (IBM Plex on the login) self-hosted, 14px body, 12px floor, tabular figures on every number.
- **Today queue / Needs action** — rows grouped under metric headings, most urgent first, contact actions
  (`tel:` / `wa.me` / `mailto:`), one verb per row; the drawer opens on the row. The rep's home and the
  manager's first screen.
- **Drawer in three zones** — name, "company · id", score pill; stage + due chip + owner; Call · WhatsApp ·
  Email, the primary verb, a stage button, ⋯; then tabs with counts; then the body with empties hidden.
- **KPI strip** — one 64px row above a list, every item a filter; tiles only where the numbers are the page.
- **Funnel** — cumulative "reached this stage or beyond" bars in the stage ramp with count, value and step
  conversion; the region chart is ranked horizontal bars; sources are weekly stacked bars.
- **Copy for people** — a one-line `subtitle` under the page title only where it helps; empty states say
  why and offer the next step; role cards describe access in plain words; a phase-2 page carries a
  `Preview` badge, not a build note in its name.
- **Charts you can read** — compact money on the axes (₹4.5L, ₹1.2Cr), axis width measured from the
  longest tick, category labels wrapped to two lines or rotated when the slot is narrow, and a one-measure
  bar with many or long categories drawn horizontal so every label is whole. Series colours are unique.

## 6. Anticipated asks (mini-SaaS backlog) — what is in, what is deferred

Every small business OS eventually asks for the same things. Those the kernel does today: search,
filters, segments, period presets, export CSV, three views, drag-and-drop stage change, row and header
actions, drawers, detail rails, documents with print/PDF, approvals, steppers, `{{user}}`-scoped pages,
header search and notifications, dark rail, mobile cards, reduced motion. Known asks **not yet in the
kernel** — use `custom` and open a kernel ticket when a client needs one: bulk actions on selected rows,
saved views, comments on a record, an audit log block, CSV import, column chooser, a notification
centre page (today: a `feed` over a notifications entity), inline edit in a table cell, per-user
dashboards beyond `{{user}}`. (Dark mode for the whole app is generated since v4.9 — `tokens.css` `[data-theme="dark"]`.)

## 7. States, responsiveness, accessibility

Unchanged from v3.1 and still the bar: truthful pending / empty / success / failure states (a queued
job is not done; no invented percentages); skeletons only while loading; keep entered values on
failure; a persistent record of an error, not just a toast. 1440 / 768 / 390 widths and 200 % zoom;
tables become cards under 640px; filters and chips scroll sideways rather than wrap into three rows;
44px touch targets; visible focus; labelled icon buttons; text beside colour; Escape closes the top
overlay and focus returns. Check contrast by measuring, not by token name.

**Images from Google Drive or another host** (`lh3.googleusercontent.com`, CDN links) often refuse a
request that carries a `localhost` or unknown referrer, so the picture is blank while the link opens fine in
a tab. Every `<img>` and `fetch()` of a stored image in custom UI sets `referrerPolicy="no-referrer"`.

## 8. Implementation and review

1. Read `docs/build-prompt.md`, this guide and the motion guide before custom UI work.
2. Compose blocks through `os.yaml`; implement only true extensions in `src/custom/**` using the
   primitives and tokens above. Do not add a UI package. Do not restyle generated geometry.
3. A shared visual change is a kernel change: `templates/app`, then every worked example regenerated
   and re-gated (`ui_check.py` desktop and `--mobile`), then the screenshots looked at.
4. `ui_check.py` measures geometry, roles, console, the brand fill on the primary button (B1), segment
   counts (G1), the three views (V1), the board (K1) and the rail (R2). It does not judge taste. Record
   in `docs/04-ui-ux.md` what you looked at and what remains unverified.
