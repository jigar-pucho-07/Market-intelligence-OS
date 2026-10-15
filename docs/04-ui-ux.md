# 04 — UI/UX · Market Intelligence

Read [frontend-design.md](frontend-design.md), [microanimations.md](microanimations.md) and [ux-laws.md](ux-laws.md) before custom UI work.
Use the generated tokens (`src/config/tokens.css`: the client's face, edges, canvas, radius — never a hex or a font name in a component), micro-interactions only from React Bits Micro ported per `docs/frontend-design.md`, white surfaces, quiet borders, and client brand #0B8F6A for focused accents. Compose declared blocks for the task; preserve client portals, data bindings, and role permissions.
The kernel's own primitives (`src/components/ui/primitives.jsx`: Chip, Avatar, Progress, Callout, Tile, ScoreRing, ViewToggle, MetaRow, TagList) and blocks are the component library; no external UI package is added.
Reuse central motion tokens for subtle feedback and transitions. Respect reduced motion and show truthful request states. Do not add gradients, hover lifts, decorative count-ups, or animation libraries.

## Frontend plan — complete during step 4
- Page hierarchy and density appropriate to each task.
- Selected reference patterns and their existing kernel/custom implementation.
- Client token choices, required states, and purposeful microanimations.

## Review evidence — pending until exercised
Record build/UI gate results, inspected desktop/phone screenshots, keyboard interaction, and observed normal/reduced-motion behaviour. Record limitations; automated geometry checks alone do not prove visual quality. Preserve hand-authored evidence separately before re-scaffolding this generated document.
