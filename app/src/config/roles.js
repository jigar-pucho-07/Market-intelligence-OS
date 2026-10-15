// src/config/roles.js — generated from os.yaml roles[].
export const ROLES = {"ADMIN": "admin", "ANALYST": "analyst", "SUBSCRIBER": "subscriber"};
export const ROLE_PERMISSIONS = {"admin": ["overview", "today", "reports", "news", "pipeline", "subscribers", "deliveries", "activity", "settings", "users"], "analyst": ["overview", "today", "reports", "news", "pipeline", "subscribers", "deliveries", "settings"], "subscriber": ["me_today", "me_reports", "settings"]};
export const ROLE_LABELS = {"admin": "Admin", "analyst": "Market Analyst", "subscriber": "Subscriber"};
export const ROLE_COLORS = {"admin": "bg-brand-500", "analyst": "bg-brand-500", "subscriber": "bg-brand-500"};
export const ROLE_HOME = {"admin": "/", "analyst": "/today", "subscriber": "/me"};
export const ROLE_DESC = {"admin": "Runs the desk, people and roles, and sees the audit log", "analyst": "Checks the 6 AM report, edits it, re-runs it and sends it to subscribers", "subscriber": "Reads today's report and past reports"};   // plain-language access description shown in Settings (audit M12)
export function homeFor(role) { return ROLE_HOME[role] ?? '/'; }
