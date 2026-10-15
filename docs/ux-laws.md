# UX laws — seven rules every app screen follows

**Why:** good UX lowers how much the user must think. These rules apply to every page, modal, form and
flow the skill builds, for any client. Use them when you decide the OS (step 2), when you write
`src/custom/**` (step 4), and when you review the screenshots (step 8). `ui_check.py` measures what a DOM
can measure (the **U** checks). The rest is your judgement, and step 9 must say you checked it.

| # | Law | What it means here | Build rule | Gate |
|---|-----|--------------------|------------|------|
| 1 | **Fitts** — big, near targets are easy to hit | The main action is the easiest thing to click | A primary button is at least 32px tall on desktop and 40px on a phone. It goes where the eye ends: the right end of the header or the modal footer. Put no small icon-only button beside it as the main path. On a phone, every tap target is at least 32px. (The gate skips the × clear icon inside a field and the on/off switch.) | U1 fail · U1b warn |
| 2 | **Hick** — more choices, slower decisions | Every extra option costs time | A page header has 3 actions or fewer; put the rest in a menu or on the record. A select with more than 7 options gets search. Offer defaults, not choices (period presets, a pre-filled status). Do not show a choice the role cannot use. | U3 warn |
| 3 | **Zeigarnik** — unfinished tasks stay in mind | Visible "not done yet" pulls people back to finish | Show what is left: "4 of 5 documents", a needs-action count, an open-items queue on the role's home. A stepper always says "Step n of m". | U5 fail |
| 4 | **Jakob** — users know other products | Familiar patterns need no learning | Use the kernel's standard places: search in the header, settings in the avatar menu, filters above the table, save at the bottom right of a form, destructive actions in red and confirmed. Do not rebuild login, search, settings or tables in `src/custom/**` to look different. Fonts and colour may change per client (`method/design-direction.md`); positions and behaviour may not. | R1 · H1 · T1 (existing) |
| 5 | **Goal gradient** — people speed up near the finish | Show progress, and start people part-way | Multi-step work shows a progress bar. Count the steps already done (a record created from an enquiry starts "2 of 5", not "0 of 5"). Put the shortest path first. Never add a step just to collect optional data. | U5 fail |
| 6 | **Von Restorff** — the different thing gets noticed | If everything shouts, nothing does | One primary (filled brand) button per page header, per modal and per card. Colour means status only (`toneOf`). At most one highlighted KPI or callout per view. Badges only for things that need action. | U2 fail |
| 7 | **Miller** — working memory is small | Group, chunk, one decision at a time | At most 7 sidebar items in one group for a role; group the rest (`pages[].group`). A form over 7 fields becomes sections or a stepper. KPI rows hold 4 or fewer. A table shows the few columns needed to decide; the rest go in the drawer. Long numbers are chunked (₹12,40,000 · +91 98765 43210). | U4 · U6 warn |

## How to use this

- **Step 2 (os.yaml):** count per role — nav items per group, header actions per page, fields per
  modal, KPIs per row. Fix the count in `os.yaml` before you scaffold. Mark the one main action on a
  page with `primary: true` on its modal; the kernel makes the others secondary.
- **Step 4 (custom code):** a custom component follows the same seven rules. Use the kernel
  primitives (`Progress`, `Callout`, `Chip`) instead of new widgets.
- **Step 8 (gate):** `ui_check.py` fails on U1, U2 and U5. It writes U1b, U3, U4 and U6 as warnings in
  `report.json`. Fix a warning, or write in the build log why the client needs it (for example, a
  regulator requires 12 fields on one form).
- **Step 9 (review):** look at the screenshots with this table. The gate cannot judge laws 3, 4 and 5
  beyond the stepper, so say in the review that you checked them.

## Anti-patterns (reject on sight)

- Two filled buttons side by side ("Save" and "Save & send" both primary).
- A pricing or plan screen with more than 3 options, or options that multiply (plans × add-ons × billing).
- A 15-field form with no sections.
- A sidebar with 10 items and no groups.
- A progress bar that starts at 0 when work is already done.
- A custom search box, settings page or date picker that behaves unlike the kernel's.
- Everything bold, everything coloured, every card with a badge.
