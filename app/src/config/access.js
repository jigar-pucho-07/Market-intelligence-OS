// src/config/access.js — GENERATED from os.yaml roles[] × pages[]. What the server lets each role read and do:
//   ENTITY_ACCESS[role]   entities any page the role can open reads ('*' = every entity)
//   SCOPES[role][entity]  the column a self-service role is pinned to (every page it opens filters `Col={{user}}`)
//   ACTIONS[role]         'flow:<FLOW>.<action>' / 'direct:<op>:<entity>' keys declared on pages the role can open
//   PUBLIC_ENTITIES[page] / PUBLIC_ACTIONS[page]  what a `public: true` page may read and submit without a sign-in
export const ENTITY_ACCESS = {"admin": ["audit_log", "deliveries", "news_articles", "reports", "subscribers"], "analyst": ["deliveries", "news_articles", "reports", "subscribers"], "subscriber": ["news_articles", "published_reports"]};
export const SCOPES = {};
export const ACTIONS = {"admin": ["direct:insert:subscribers", "direct:patch:reports", "direct:patch:subscribers", "flow:BROADCAST.retry", "flow:BROADCAST.send", "flow:MARKET_REPORT.run"], "analyst": ["direct:insert:subscribers", "direct:patch:reports", "direct:patch:subscribers", "flow:BROADCAST.retry", "flow:BROADCAST.send", "flow:MARKET_REPORT.run"], "subscriber": []};
export const PUBLIC_ENTITIES = {};
export const PUBLIC_ACTIONS = {};
