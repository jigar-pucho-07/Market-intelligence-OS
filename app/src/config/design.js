// src/config/design.js — GENERATED from os.yaml `brand:` + `design:` + `portals[].shell`. Do not edit; edit os.yaml.
// The shell (how navigation is laid out) and the look (tone, radius, density) are declared per client here;
// the token values themselves live in tokens.css. Components read DESIGN, never a literal.
export const DESIGN = {
  "shell": "sidebar",
  "shells": {
    "desk": "sidebar",
    "reader": "sidebar"
  },
  "sidebar": {
    "footer": "profile",
    "style": "light",
    "width": 260
  },
  "sidebar_styles": {},
  "header": {
    "style": "blur",
    "show_name": true
  },
  "powered_by": false,
  "tone": "pucho",
  "radius": "pucho",
  "density": "comfortable",
  "brand": {
    "name": "Market Intelligence",
    "color": "#0B8F6A",
    "logo": null,
    "icon": null
  }
};

// The shell for a portal: `sidebar` (a full-width nav rail) or `rail` (an icon rail with a section panel).
export function shellFor(portalId) { return DESIGN.shells?.[portalId] ?? DESIGN.shell ?? 'sidebar'; }
