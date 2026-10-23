// src/config/pages.js — generated from os.yaml pages[]. Do not edit; edit os.yaml.
export const PAGES = [
  {
    "id": "overview",
    "kind": "overview",
    "route": "/",
    "label": "Overview",
    "icon": "LayoutDashboard",
    "desc": "The month's numbers and charts first, then this morning's exceptions",
    "subtitle": "How the reports are landing, then what needs a person this morning",
    "greeting": "Here is the market desk this morning.",
    "covers": [
      "R27",
      "R13"
    ],
    "quick_links": false,
    "order": [
      "kpis",
      "charts",
      "queues"
    ],
    "queues": [
      {
        "metric": "ready_unsent",
        "action": "send_now",
        "action_label": "Send",
        "link": "/today",
        "entity": "reports",
        "label": "Reports not sent",
        "tone": "warn",
        "icon": "Send",
        "where": "Status=Ready"
      },
      {
        "metric": "failed_runs",
        "action": "rerun",
        "action_label": "Re-run",
        "link": "/pipeline",
        "entity": "reports",
        "label": "Failed runs (7 days)",
        "tone": "bad",
        "icon": "AlertTriangle",
        "where": "Status=Failed and Created_At in last 7 days"
      },
      {
        "metric": "failed_deliveries",
        "action": "retry",
        "action_label": "Retry",
        "link": "/deliveries",
        "entity": "deliveries",
        "label": "Failed deliveries (7 days)",
        "tone": "bad",
        "icon": "MessageSquareWarning",
        "where": "Status=Failed and Kind=Report and Sent_At in last 7 days"
      }
    ],
    "kpis": [
      {
        "metric": "reports_sent",
        "entity": "reports",
        "label": "Reports sent this month",
        "tone": "ok",
        "icon": "CheckCircle2",
        "formula": "count where Status=Sent and Report_Date in month",
        "filter": "Status=Sent and Report_Date in month",
        "alert": false
      },
      {
        "metric": "active_subs",
        "entity": "subscribers",
        "label": "Active subscribers",
        "tone": "info",
        "icon": "Users",
        "formula": "count where Status=Active",
        "filter": "Status=Active",
        "alert": false
      },
      {
        "metric": "failed_deliveries",
        "entity": "deliveries",
        "label": "Failed deliveries (7 days)",
        "tone": "bad",
        "icon": "MessageSquareWarning",
        "formula": "count where Status=Failed and Kind=Report and Sent_At in last 7 days",
        "filter": "Status=Failed and Kind=Report and Sent_At in last 7 days",
        "alert": true
      },
      {
        "metric": "news_today",
        "entity": "news_articles",
        "label": "News analysed today",
        "tone": "info",
        "icon": "Newspaper",
        "formula": "count where Fetched_At in last 1 days",
        "filter": "Fetched_At in last 1 days",
        "alert": false
      }
    ],
    "charts": [
      {
        "id": "ov-sentiment",
        "type": "trend",
        "title": "Market sentiment by week",
        "entity": "reports",
        "date": "Report_Date",
        "series": [
          "Sentiment"
        ],
        "days": 56,
        "bucket": "week"
      },
      {
        "id": "ov-news",
        "type": "breakdown",
        "title": "News analysed by category (30 days)",
        "entity": "news_articles",
        "group": "Category",
        "where": "Fetched_At in last 30 days",
        "style": "bar"
      }
    ],
    "recent": {
      "title": "Latest reports",
      "entity": "reports",
      "date": "Created_At",
      "limit": 6,
      "link": "/reports",
      "columns": [
        {
          "key": "Report_Date",
          "type": "date",
          "grow": true
        },
        {
          "key": "Sentiment",
          "type": "badge"
        },
        {
          "key": "Confidence_Pct",
          "header": "Confidence",
          "type": "number"
        },
        {
          "key": "Status",
          "type": "badge"
        }
      ]
    },
    "modals": [
      {
        "id": "send_now",
        "kind": "status",
        "title": "Send to subscribers",
        "flow": "BROADCAST",
        "action": "send",
        "entity": "reports",
        "submit": "Send to subscribers",
        "pending": "Sending to subscribers…",
        "success": "Sending — each delivery is logged",
        "covers": [
          "R9"
        ],
        "summary": [
          "Report_Date",
          "Sentiment",
          "Confidence_Pct"
        ],
        "intro": "Goes to every Active, opted-in subscriber's WhatsApp as the approved Daily Market Intelligence template."
      },
      {
        "id": "rerun",
        "kind": "status",
        "title": "Re-run report now",
        "flow": "MARKET_REPORT",
        "action": "rerun",
        "entity": "reports",
        "submit": "Re-run report",
        "pending": "Fetching the five sources…",
        "success": "The report is being prepared again — it turns Ready when done",
        "covers": [
          "R24"
        ],
        "summary": [
          "Report_Date",
          "Error_Message"
        ],
        "intro": "Fetches the five news sources again and rewrites this report. A report already sent is never re-run."
      },
      {
        "id": "retry",
        "kind": "status",
        "title": "Retry delivery",
        "flow": "BROADCAST",
        "action": "retry",
        "entity": "deliveries",
        "submit": "Send again",
        "pending": "Sending…",
        "success": "Delivery sent again",
        "covers": [
          "R27"
        ],
        "summary": [
          "Subscriber_Name",
          "Report_Date",
          "Error_Message"
        ],
        "intro": "Goes to the WhatsApp number on the subscriber's record, only if they are still Active."
      }
    ],
    "portal": "desk"
  },
  {
    "id": "today",
    "route": "/today",
    "label": "Today's report",
    "icon": "Sunrise",
    "desc": "The 6 AM report as subscribers will read it, with review, send and re-run",
    "subtitle": "Check this morning's view, change it if needed, and send it before the open",
    "entity": "reports",
    "covers": [
      "R13",
      "R15",
      "R16",
      "R17",
      "R18",
      "R19",
      "R20",
      "R23",
      "R24"
    ],
    "blocks": [
      {
        "type": "custom",
        "name": "MarketBrief",
        "covers": [
          "R13",
          "R15",
          "R16",
          "R17",
          "R19",
          "R20",
          "R23"
        ],
        "id": "today-custom"
      },
      {
        "type": "tabs",
        "tabs": [
          {
            "label": "Today's report",
            "blocks": [
              {
                "type": "table",
                "label": "Today's report",
                "where": "Report_Date in last 1 days",
                "columns": [
                  {
                    "key": "Report_Date",
                    "type": "date",
                    "sub": "Report_ID"
                  },
                  {
                    "key": "Sentiment",
                    "type": "badge"
                  },
                  {
                    "key": "Confidence_Pct",
                    "header": "Confidence",
                    "type": "number"
                  },
                  {
                    "key": "Articles_Analyzed",
                    "header": "News",
                    "type": "number"
                  },
                  {
                    "key": "Trigger",
                    "type": "tag"
                  },
                  {
                    "key": "Status",
                    "type": "badge"
                  },
                  {
                    "key": "Sent_Count",
                    "header": "Sent",
                    "type": "number"
                  }
                ],
                "actions": {
                  "row": [
                    "review",
                    "send_all",
                    "pdf"
                  ]
                },
                "empty": {
                  "title": "No report yet today",
                  "reason": "The 6:00 AM IST run has not written today's report yet (Mon–Fri only).",
                  "action": "run_now"
                }
              }
            ]
          },
          {
            "label": "Today's news",
            "covers": [
              "R18"
            ],
            "blocks": [
              {
                "type": "table",
                "entity": "news_articles",
                "label": "Today's news",
                "where": "Fetched_At in last 1 days",
                "covers": [
                  "R18"
                ],
                "segments": {
                  "column": "Category",
                  "all": "All news"
                },
                "columns": [
                  {
                    "key": "Title",
                    "type": "text",
                    "sub": "Summary",
                    "grow": true
                  },
                  {
                    "key": "Impact",
                    "type": "badge"
                  },
                  {
                    "key": "Source",
                    "type": "tag"
                  },
                  {
                    "key": "Published_At",
                    "header": "Published",
                    "type": "text",
                    "priority": "low"
                  }
                ],
                "search": [
                  "Title",
                  "Summary"
                ],
                "filters": [
                  "Source",
                  "Impact"
                ]
              }
            ]
          }
        ],
        "id": "today-tabs"
      }
    ],
    "modals": [
      {
        "id": "run_now",
        "kind": "create",
        "title": "Run report now",
        "flow": "MARKET_REPORT",
        "action": "run",
        "primary": true,
        "submit": "Run report now",
        "pending": "Fetching the five sources…",
        "success": "The report is being prepared — it appears here as Ready",
        "covers": [
          "R24"
        ],
        "fields": [
          {
            "key": "Trigger",
            "label": "Run type",
            "type": "select",
            "options": [
              "Manual"
            ],
            "default": "Manual",
            "required": true
          }
        ]
      },
      {
        "id": "review",
        "kind": "edit",
        "title": "Review & edit report",
        "direct": "patch",
        "covers": [
          "R24"
        ],
        "summary": [
          "Report_Date",
          "Status"
        ],
        "intro": "Edit before sending. A sent report is already with subscribers — edit it only to correct, then send again to update their copy.",
        "fields": [
          {
            "key": "Sentiment",
            "label": "Overall sentiment",
            "type": "select",
            "options": [
              "BULLISH",
              "CAUTIOUSLY BULLISH",
              "NEUTRAL",
              "CAUTIOUSLY BEARISH",
              "BEARISH"
            ],
            "required": true
          },
          {
            "key": "Confidence_Pct",
            "label": "Confidence %",
            "type": "number",
            "required": true
          },
          {
            "key": "Driver_1",
            "label": "Key driver 1",
            "type": "text",
            "required": true
          },
          {
            "key": "Driver_2",
            "label": "Key driver 2",
            "type": "text"
          },
          {
            "key": "Driver_3",
            "label": "Key driver 3",
            "type": "text"
          },
          {
            "key": "View_Intraday",
            "label": "Intraday view",
            "type": "textarea",
            "rows": 2
          },
          {
            "key": "View_FnO",
            "label": "F&O positioning view",
            "type": "textarea",
            "rows": 2
          }
        ]
      },
      {
        "id": "send_all",
        "kind": "status",
        "title": "Send to subscribers",
        "flow": "BROADCAST",
        "action": "send",
        "submit": "Send to subscribers",
        "pending": "Sending to subscribers…",
        "success": "Sending — each delivery is logged",
        "covers": [
          "R9",
          "R24"
        ],
        "summary": [
          "Report_Date",
          "Sentiment",
          "Confidence_Pct"
        ],
        "intro": "Goes to every Active, opted-in subscriber's WhatsApp as the approved Daily Market Intelligence template. Subscribers who already received this report are skipped."
      },
      {
        "id": "pdf",
        "kind": "document",
        "title": "Print report",
        "document": "report_pdf"
      }
    ],
    "actions": {
      "header": [
        "run_now"
      ],
      "row": [
        "review",
        "send_all",
        "pdf"
      ]
    },
    "portal": "desk"
  },
  {
    "id": "reports",
    "route": "/reports",
    "label": "Reports",
    "icon": "FileText",
    "desc": "Every daily report, its views and who received it",
    "subtitle": "Every daily report — open one to see its views, its news and its deliveries",
    "entity": "reports",
    "covers": [
      "R10",
      "R24"
    ],
    "blocks": [
      {
        "type": "table",
        "segments": {
          "column": "Status",
          "all": "All reports"
        },
        "period": {
          "column": "Report_Date",
          "presets": [
            "7d",
            "30d",
            "all"
          ],
          "default": "30d"
        },
        "views": [
          "table",
          "cards"
        ],
        "card": {
          "title": "Report_Date",
          "subtitle": [
            "Sentiment"
          ],
          "badge": "Status",
          "fields": [
            {
              "key": "Confidence_Pct",
              "label": "Confidence"
            },
            {
              "key": "Sent_Count",
              "label": "Sent"
            },
            {
              "key": "Articles_Analyzed",
              "label": "News"
            }
          ],
          "callout": {
            "column": "Driver_1",
            "label": "Top driver",
            "tone": "info"
          },
          "actions": [
            "send_all",
            "pdf"
          ]
        },
        "columns": [
          {
            "key": "Report_Date",
            "type": "date",
            "sub": "Report_ID"
          },
          {
            "key": "Sentiment",
            "type": "badge"
          },
          {
            "key": "Confidence_Level",
            "header": "Confidence",
            "type": "tag",
            "sub": "Confidence_Pct"
          },
          {
            "key": "Nifty_Outlook",
            "header": "Nifty 50",
            "type": "badge"
          },
          {
            "key": "Status",
            "type": "badge"
          },
          {
            "key": "Sent_Count",
            "header": "Sent",
            "type": "number"
          },
          {
            "key": "Failed_Count",
            "header": "Failed",
            "type": "number"
          },
          {
            "key": "Trigger",
            "type": "tag",
            "priority": "low"
          }
        ],
        "search": [
          "Report_ID",
          "Sentiment",
          "Driver_1"
        ],
        "filters": [
          "Sentiment",
          "Trigger"
        ],
        "actions": {
          "row": [
            "review",
            "send_all",
            "pdf"
          ]
        },
        "drawer": {
          "title_column": "Report_Date",
          "tabs": [
            {
              "label": "Analysis",
              "sections": [
                {
                  "type": "tiles",
                  "title": "Call",
                  "columns": [
                    "Sentiment",
                    "Confidence_Level",
                    "Confidence_Pct",
                    "Articles_Analyzed"
                  ]
                },
                {
                  "type": "fields",
                  "title": "Key market drivers",
                  "columns": [
                    "Driver_1",
                    "Driver_2",
                    "Driver_3"
                  ]
                },
                {
                  "type": "fields",
                  "title": "Segments",
                  "columns": [
                    "Sensex_Outlook",
                    "Sensex_Range",
                    "Nifty_Outlook",
                    "Nifty_Range",
                    "BankNifty_Outlook",
                    "BankNifty_Range",
                    "FnO_View",
                    "VIX_Expectation",
                    "MidSmall_Outlook",
                    "MidSmall_Focus",
                    "Commodity_Outlook"
                  ],
                  "hide_empty": true
                },
                {
                  "type": "callout",
                  "column": "Error_Message",
                  "title": "Why it failed",
                  "tone": "warn"
                }
              ]
            },
            {
              "label": "News",
              "sections": [
                {
                  "type": "related",
                  "entity": "news_articles",
                  "by": "Report_ID",
                  "title": "News analysed",
                  "columns": [
                    "Title",
                    "Category",
                    "Impact",
                    "Source"
                  ]
                }
              ]
            },
            {
              "label": "Deliveries",
              "sections": [
                {
                  "type": "related",
                  "entity": "deliveries",
                  "by": "Report_ID",
                  "title": "Deliveries",
                  "columns": [
                    "Subscriber_Name",
                    "Status",
                    "Sent_At",
                    "Error_Message"
                  ]
                }
              ]
            }
          ]
        },
        "empty": {
          "title": "No reports yet",
          "reason": "The first report is written by the 6:00 AM IST weekday run, or by Run report now on Today's report."
        },
        "id": "reports-table"
      }
    ],
    "modals": [
      {
        "id": "review",
        "kind": "edit",
        "title": "Review & edit report",
        "direct": "patch",
        "covers": [
          "R24"
        ],
        "summary": [
          "Report_Date",
          "Status"
        ],
        "intro": "Edit before sending. A sent report is already with subscribers — edit it only to correct, then send again to update their copy.",
        "fields": [
          {
            "key": "Sentiment",
            "label": "Overall sentiment",
            "type": "select",
            "options": [
              "BULLISH",
              "CAUTIOUSLY BULLISH",
              "NEUTRAL",
              "CAUTIOUSLY BEARISH",
              "BEARISH"
            ],
            "required": true
          },
          {
            "key": "Confidence_Pct",
            "label": "Confidence %",
            "type": "number",
            "required": true
          },
          {
            "key": "Driver_1",
            "label": "Key driver 1",
            "type": "text",
            "required": true
          },
          {
            "key": "Driver_2",
            "label": "Key driver 2",
            "type": "text"
          },
          {
            "key": "Driver_3",
            "label": "Key driver 3",
            "type": "text"
          },
          {
            "key": "View_Intraday",
            "label": "Intraday view",
            "type": "textarea",
            "rows": 2
          },
          {
            "key": "View_FnO",
            "label": "F&O positioning view",
            "type": "textarea",
            "rows": 2
          }
        ]
      },
      {
        "id": "send_all",
        "kind": "status",
        "title": "Send to subscribers",
        "flow": "BROADCAST",
        "action": "send",
        "submit": "Send to subscribers",
        "pending": "Sending to subscribers…",
        "success": "Sending — each delivery is logged",
        "covers": [
          "R9"
        ],
        "summary": [
          "Report_Date",
          "Sentiment",
          "Confidence_Pct"
        ],
        "intro": "Goes to every Active, opted-in subscriber's WhatsApp as the approved template. Subscribers who already received this report are skipped."
      },
      {
        "id": "pdf",
        "kind": "document",
        "title": "Print report",
        "document": "report_pdf"
      }
    ],
    "actions": {
      "header": [],
      "row": [
        "review",
        "send_all",
        "pdf"
      ]
    },
    "portal": "desk"
  },
  {
    "id": "news",
    "route": "/news",
    "label": "News feed",
    "icon": "Newspaper",
    "desc": "Every article the runs analysed, by category, impact and source",
    "subtitle": "The news behind each report — filter by category, impact or source",
    "entity": "news_articles",
    "covers": [
      "R3",
      "R4",
      "R5",
      "R6",
      "R18",
      "R19"
    ],
    "read_only": "Articles are written by the daily run from the five RSS feeds; nobody edits a news item",
    "blocks": [
      {
        "type": "kpis",
        "kpis": [
          {
            "metric": "news_today",
            "entity": "news_articles",
            "label": "News analysed today",
            "tone": "info",
            "icon": "Newspaper",
            "formula": "count where Fetched_At in last 1 days",
            "filter": "Fetched_At in last 1 days",
            "alert": false
          },
          {
            "label": "High impact today",
            "formula": "count where Impact=HIGH and Fetched_At in last 1 days",
            "icon": "Zap",
            "tone": "warn",
            "filter": "Impact=HIGH",
            "entity": "news_articles"
          }
        ],
        "id": "news-kpis"
      },
      {
        "type": "table",
        "segments": {
          "column": "Category",
          "all": "All news"
        },
        "period": {
          "column": "Fetched_At",
          "presets": [
            "today",
            "7d",
            "30d",
            "all"
          ],
          "default": "7d"
        },
        "columns": [
          {
            "key": "Title",
            "type": "text",
            "sub": "Summary",
            "grow": true
          },
          {
            "key": "Category",
            "type": "tag"
          },
          {
            "key": "Impact",
            "type": "badge"
          },
          {
            "key": "Source",
            "type": "tag"
          },
          {
            "key": "Fetched_At",
            "header": "Fetched",
            "type": "date",
            "time": true
          },
          {
            "key": "Report_ID",
            "header": "Report",
            "type": "id",
            "priority": "low"
          }
        ],
        "search": [
          "Title",
          "Summary"
        ],
        "filters": [
          "Source",
          "Impact"
        ],
        "drawer": {
          "title_column": "Title",
          "sections": [
            {
              "type": "tiles",
              "title": "Article",
              "columns": [
                "Source",
                "Category",
                "Impact",
                "Published_At"
              ]
            },
            {
              "type": "callout",
              "column": "Summary",
              "title": "Summary",
              "tone": "neutral"
            },
            {
              "type": "fields",
              "title": "Link",
              "columns": [
                "Link",
                "Report_ID"
              ]
            }
          ]
        },
        "empty": {
          "title": "No news in this period",
          "reason": "News is fetched by each report run; widen the period or run the report."
        },
        "id": "news-table"
      }
    ],
    "portal": "desk"
  },
  {
    "id": "pipeline",
    "route": "/pipeline",
    "label": "Pipeline",
    "icon": "Workflow",
    "desc": "The workflow steps, its configuration and every run with its source counts and errors",
    "subtitle": "How the 6 AM run is wired, and every run — re-run the ones that failed",
    "entity": "reports",
    "covers": [
      "R12",
      "R21",
      "R27",
      "R11",
      "R2"
    ],
    "blocks": [
      {
        "type": "custom",
        "name": "PipelineMap",
        "covers": [
          "R12",
          "R21"
        ],
        "id": "pipeline-custom"
      },
      {
        "type": "table",
        "label": "Run log",
        "segments": {
          "column": "Status",
          "all": "All runs"
        },
        "period": {
          "column": "Created_At",
          "presets": [
            "7d",
            "30d",
            "all"
          ],
          "default": "7d"
        },
        "columns": [
          {
            "key": "Created_At",
            "header": "Started",
            "type": "date",
            "time": true,
            "sub": "Report_ID"
          },
          {
            "key": "Trigger",
            "type": "tag"
          },
          {
            "key": "Status",
            "type": "badge"
          },
          {
            "key": "Articles_Analyzed",
            "header": "News",
            "type": "number"
          },
          {
            "key": "Source_Status",
            "header": "Sources",
            "type": "truncate"
          },
          {
            "key": "Error_Message",
            "header": "Error",
            "type": "truncate"
          }
        ],
        "search": [
          "Report_ID",
          "Error_Message",
          "Source_Status"
        ],
        "filters": [
          "Trigger"
        ],
        "actions": {
          "row": [
            "rerun"
          ]
        },
        "drawer": {
          "title_column": "Report_Date",
          "sections": [
            {
              "type": "tiles",
              "title": "Run",
              "columns": [
                "Trigger",
                "Status",
                "Articles_Analyzed",
                "Model"
              ]
            },
            {
              "type": "callout",
              "column": "Source_Status",
              "title": "Sources",
              "tone": "neutral"
            },
            {
              "type": "callout",
              "column": "Category_Breakdown",
              "title": "Categories",
              "tone": "neutral"
            },
            {
              "type": "callout",
              "column": "Error_Message",
              "title": "Error",
              "tone": "warn"
            }
          ]
        },
        "id": "pipeline-table"
      }
    ],
    "modals": [
      {
        "id": "rerun",
        "kind": "status",
        "title": "Re-run report now",
        "flow": "MARKET_REPORT",
        "action": "rerun",
        "submit": "Re-run report",
        "pending": "Fetching the five sources…",
        "success": "The report is being prepared again — it turns Ready when done",
        "covers": [
          "R24"
        ],
        "summary": [
          "Report_Date",
          "Error_Message"
        ],
        "intro": "Fetches the five news sources again and rewrites this report. A report already sent is never re-run."
      }
    ],
    "actions": {
      "header": [],
      "row": [
        "rerun"
      ]
    },
    "portal": "desk"
  },
  {
    "id": "subscribers",
    "route": "/subscribers",
    "label": "Subscribers",
    "icon": "Users",
    "desc": "Who receives the report by email",
    "subtitle": "Add, pause or remove subscribers — only people who opted in",
    "entity": "subscribers",
    "covers": [
      "R26"
    ],
    "blocks": [
      {
        "type": "kpis",
        "kpis": [
          {
            "metric": "active_subs",
            "entity": "subscribers",
            "label": "Active subscribers",
            "tone": "info",
            "icon": "Users",
            "formula": "count where Status=Active",
            "filter": "Status=Active",
            "alert": false
          },
          {
            "label": "Paused",
            "formula": "count where Status=Paused",
            "icon": "PauseCircle",
            "filter": "Status=Paused",
            "entity": "subscribers"
          },
          {
            "label": "Unsubscribed",
            "formula": "count where Status=Unsubscribed",
            "icon": "UserX",
            "filter": "Status=Unsubscribed",
            "entity": "subscribers"
          }
        ],
        "id": "subscribers-kpis"
      },
      {
        "type": "table",
        "segments": {
          "column": "Status",
          "all": "All subscribers"
        },
        "columns": [
          {
            "key": "Name",
            "type": "text",
            "sub": "City",
            "grow": true
          },
          {
            "key": "Email",
            "header": "Email"
          },
          {
            "key": "Status",
            "type": "badge"
          },
          {
            "key": "Opt_In_At",
            "header": "Opted in",
            "type": "date",
            "sub": "Opt_In_Source"
          },
          {
            "key": "WhatsApp",
            "header": "WhatsApp",
            "type": "phone",
            "priority": "low"
          },
          {
            "key": "Subscriber_ID",
            "type": "id",
            "priority": "low"
          }
        ],
        "search": [
          "Name",
          "WhatsApp",
          "City",
          "Email"
        ],
        "filters": [
          "City",
          "Opt_In_Source"
        ],
        "bulk": [
          "set_status",
          "delete_subscriber"
        ],
        "actions": {
          "row": [
            "edit_subscriber",
            "set_status",
            "delete_subscriber"
          ]
        },
        "drawer": {
          "title_column": "Name",
          "sections": [
            {
              "type": "fields",
              "title": "Contact",
              "columns": [
                "Email",
                "WhatsApp",
                "City",
                "Status",
                "Opt_In_At",
                "Opt_In_Source",
                "Notes"
              ]
            },
            {
              "type": "related",
              "entity": "deliveries",
              "by": "Subscriber_ID",
              "title": "Deliveries",
              "columns": [
                "Report_Date",
                "Kind",
                "Status",
                "Sent_At",
                "Error_Message"
              ]
            }
          ]
        },
        "empty": {
          "title": "No subscribers yet",
          "reason": "Add the first person who opted in to the daily report email.",
          "action": "add_subscriber"
        },
        "id": "subscribers-table"
      }
    ],
    "modals": [
      {
        "id": "add_subscriber",
        "kind": "create",
        "title": "Add subscriber",
        "direct": "insert",
        "primary": true,
        "submit": "Add subscriber",
        "success": "Subscriber added — they get the next report",
        "covers": [
          "R26"
        ],
        "fields": [
          {
            "key": "Name",
            "label": "Name",
            "type": "text",
            "required": true
          },
          {
            "key": "Email",
            "label": "Email",
            "type": "text",
            "required": true,
            "help": "The daily report is sent to this address"
          },
          {
            "key": "WhatsApp",
            "label": "WhatsApp number",
            "type": "text",
            "help": "Optional — with country code, e.g. +91 98765 43210"
          },
          {
            "key": "Opt_In_At",
            "label": "Opted in on",
            "type": "date",
            "required": true,
            "help": "The day the person agreed to receive the report"
          },
          {
            "key": "Opt_In_Source",
            "label": "How they opted in",
            "type": "select",
            "options": [
              "WhatsApp reply",
              "Web form",
              "Signed form",
              "Phone call"
            ],
            "required": true
          },
          {
            "key": "City",
            "label": "City",
            "type": "text"
          },
          {
            "key": "Status",
            "label": "Status",
            "type": "select",
            "options": [
              "Active",
              "Paused"
            ],
            "default": "Active",
            "required": true
          }
        ]
      },
      {
        "id": "edit_subscriber",
        "kind": "edit",
        "title": "Edit subscriber",
        "direct": "patch",
        "covers": [
          "R26"
        ],
        "summary": [
          "Name"
        ],
        "fields": [
          {
            "key": "Email",
            "label": "Email",
            "type": "text",
            "required": true
          },
          {
            "key": "WhatsApp",
            "label": "WhatsApp number",
            "type": "text",
            "help": "Optional"
          },
          {
            "key": "City",
            "label": "City",
            "type": "text"
          },
          {
            "key": "Notes",
            "label": "Notes",
            "type": "textarea",
            "rows": 2
          }
        ]
      },
      {
        "id": "set_status",
        "kind": "status",
        "title": "Pause",
        "resume or remove": null,
        "direct": "patch",
        "covers": [
          "R26"
        ],
        "summary": [
          "Name",
          "Email"
        ],
        "intro": "Unsubscribed is final — the person must opt in again as a new subscriber.",
        "fields": [
          {
            "key": "Status",
            "label": "Status",
            "type": "select",
            "options_status": true,
            "required": true
          }
        ]
      },
      {
        "id": "delete_subscriber",
        "kind": "edit",
        "title": "Delete subscriber",
        "direct": "delete",
        "covers": [
          "R26"
        ],
        "summary": [
          "Name",
          "Email"
        ],
        "intro": "Deletes from the database permanently. Past delivery history stays. This cannot be undone.",
        "submit": "Delete subscriber",
        "pending": "Deleting…",
        "success": "Subscriber deleted"
      }
    ],
    "actions": {
      "header": [
        "add_subscriber"
      ],
      "row": [
        "edit_subscriber",
        "set_status",
        "delete_subscriber"
      ]
    },
    "portal": "desk"
  },
  {
    "id": "deliveries",
    "route": "/deliveries",
    "label": "Deliveries",
    "icon": "MessageSquare",
    "desc": "Every WhatsApp sent, with its status — retry the failed ones",
    "subtitle": "Every WhatsApp the desk sent — retry a failed delivery",
    "entity": "deliveries",
    "covers": [
      "R10",
      "R27"
    ],
    "blocks": [
      {
        "type": "kpis",
        "kpis": [
          {
            "metric": "failed_deliveries",
            "entity": "deliveries",
            "label": "Failed deliveries (7 days)",
            "tone": "bad",
            "icon": "MessageSquareWarning",
            "formula": "count where Status=Failed and Kind=Report and Sent_At in last 7 days",
            "filter": "Status=Failed and Kind=Report and Sent_At in last 7 days",
            "alert": true
          },
          {
            "label": "Sent today",
            "formula": "count where Status=Sent and Sent_At in last 1 days",
            "icon": "CheckCircle2",
            "tone": "ok",
            "filter": "Status=Sent",
            "entity": "deliveries"
          }
        ],
        "id": "deliveries-kpis"
      },
      {
        "type": "table",
        "segments": {
          "column": "Status",
          "all": "All deliveries"
        },
        "period": {
          "column": "Sent_At",
          "presets": [
            "today",
            "7d",
            "30d",
            "all"
          ],
          "default": "7d"
        },
        "columns": [
          {
            "key": "Subscriber_Name",
            "header": "Subscriber",
            "type": "text",
            "sub": "Subscriber_ID"
          },
          {
            "key": "Report_Date",
            "header": "Report",
            "type": "date"
          },
          {
            "key": "Kind",
            "type": "tag"
          },
          {
            "key": "Status",
            "type": "badge"
          },
          {
            "key": "Attempts",
            "type": "number",
            "priority": "low"
          },
          {
            "key": "Sent_At",
            "header": "Sent",
            "type": "date",
            "time": true
          },
          {
            "key": "Error_Message",
            "header": "Error",
            "type": "truncate"
          },
          {
            "key": "Message_ID",
            "header": "WhatsApp id",
            "type": "id",
            "priority": "low"
          }
        ],
        "search": [
          "Subscriber_Name",
          "Error_Message",
          "Report_ID"
        ],
        "filters": [
          "Kind"
        ],
        "actions": {
          "row": [
            "retry"
          ]
        },
        "empty": {
          "title": "No deliveries in this period",
          "reason": "Deliveries are logged when a report is sent to subscribers."
        },
        "id": "deliveries-table"
      }
    ],
    "modals": [
      {
        "id": "retry",
        "kind": "status",
        "title": "Retry delivery",
        "flow": "BROADCAST",
        "action": "retry",
        "submit": "Send again",
        "pending": "Sending…",
        "success": "Delivery sent again",
        "covers": [
          "R27"
        ],
        "summary": [
          "Subscriber_Name",
          "Report_Date",
          "Error_Message"
        ],
        "intro": "Goes to the WhatsApp number on the subscriber's record, only if they are still Active and opted in."
      }
    ],
    "actions": {
      "header": [],
      "row": [
        "retry"
      ]
    },
    "portal": "desk"
  },
  {
    "id": "activity",
    "kind": "page",
    "route": "/activity",
    "label": "Activity",
    "icon": "History",
    "desc": "Every change by a person or a flow",
    "group": "Setup",
    "covers": [
      "R28"
    ],
    "read_only": "The audit log is written by the app for every change; nobody edits history",
    "blocks": [
      {
        "type": "kpis",
        "kpis": [
          {
            "label": "Changes today",
            "entity": "audit_log",
            "formula": "count where At in last 1 days",
            "icon": "History"
          },
          {
            "label": "Changes this week",
            "entity": "audit_log",
            "formula": "count where At in last 7 days",
            "icon": "CalendarDays"
          },
          {
            "label": "People active (7d)",
            "entity": "audit_log",
            "formula": "distinct Who where At in last 7 days",
            "icon": "Users"
          },
          {
            "label": "AI actions (7d)",
            "entity": "audit_log",
            "formula": "count where At in last 7 days and Flow!=direct",
            "icon": "Sparkles"
          }
        ],
        "id": "activity-kpis"
      },
      {
        "type": "table",
        "entity": "audit_log",
        "columns": [
          {
            "key": "At",
            "type": "date"
          },
          {
            "key": "Who",
            "type": "text"
          },
          {
            "key": "Action",
            "type": "tag"
          },
          {
            "key": "Entity",
            "type": "text"
          },
          {
            "key": "Record_ID",
            "type": "id"
          },
          {
            "key": "Summary",
            "type": "truncate"
          }
        ],
        "search": [
          "Who",
          "Record_ID",
          "Summary"
        ],
        "filters": [
          "Who",
          "Entity"
        ],
        "period": {
          "column": "At",
          "presets": [
            "today",
            "7d",
            "30d",
            "all"
          ],
          "default": "7d"
        },
        "segments": {
          "column": "Entity",
          "all": "All changes"
        },
        "drawer": {
          "placement": "center"
        },
        "sort": {
          "column": "At",
          "dir": "desc"
        },
        "id": "activity-table"
      }
    ],
    "entity": "audit_log",
    "export": true,
    "portal": "desk"
  },
  {
    "id": "me_today",
    "portal": "reader",
    "route": "/me",
    "label": "Today's report",
    "icon": "Sunrise",
    "desc": "This morning's report, as sent on WhatsApp, in full",
    "subtitle": "This morning's market outlook — read it before the 9:15 AM open",
    "entity": "published_reports",
    "covers": [
      "R25",
      "R13",
      "R15",
      "R16",
      "R17",
      "R18",
      "R23"
    ],
    "read_only": "Subscribers read the report; the analyst writes and sends it",
    "blocks": [
      {
        "type": "custom",
        "name": "MarketBrief",
        "covers": [
          "R13",
          "R15",
          "R16",
          "R17",
          "R23"
        ],
        "id": "me_today-custom"
      },
      {
        "type": "table",
        "entity": "news_articles",
        "label": "Today's news",
        "where": "Fetched_At in last 1 days",
        "covers": [
          "R18"
        ],
        "segments": {
          "column": "Category",
          "all": "All news"
        },
        "columns": [
          {
            "key": "Title",
            "type": "text",
            "sub": "Summary",
            "grow": true
          },
          {
            "key": "Impact",
            "type": "badge"
          },
          {
            "key": "Source",
            "type": "tag"
          }
        ],
        "search": [
          "Title"
        ],
        "id": "me_today-table"
      }
    ]
  },
  {
    "id": "me_reports",
    "portal": "reader",
    "route": "/me/reports",
    "label": "Past reports",
    "icon": "FileText",
    "desc": "Every report that was sent",
    "subtitle": "Every report that was sent — open one to read it again or print it",
    "entity": "published_reports",
    "covers": [
      "R25",
      "R23"
    ],
    "blocks": [
      {
        "type": "callout",
        "tone": "info",
        "title": "Market commentary",
        "not advice": null,
        "text": "AI-generated commentary from public news. Not investment advice and not a SEBI-registered research report. Trading involves risk — consult a SEBI-registered advisor before acting.",
        "id": "me_reports-callout"
      },
      {
        "type": "table",
        "period": {
          "column": "Report_Date",
          "presets": [
            "7d",
            "30d",
            "all"
          ],
          "default": "30d"
        },
        "views": [
          "cards",
          "table"
        ],
        "card": {
          "title": "Report_Date",
          "subtitle": [
            "Sentiment"
          ],
          "badge": "Sentiment",
          "id": false,
          "fields": [
            {
              "key": "Confidence_Pct",
              "label": "Confidence"
            },
            {
              "key": "Nifty_Outlook",
              "label": "Nifty 50"
            },
            {
              "key": "FnO_View",
              "label": "F&O"
            }
          ],
          "callout": {
            "column": "Driver_1",
            "label": "Top driver",
            "tone": "info"
          },
          "actions": [
            "pdf"
          ]
        },
        "columns": [
          {
            "key": "Report_Date",
            "type": "date"
          },
          {
            "key": "Sentiment",
            "type": "badge"
          },
          {
            "key": "Confidence_Pct",
            "header": "Confidence",
            "type": "number"
          },
          {
            "key": "Nifty_Outlook",
            "header": "Nifty 50",
            "type": "badge"
          },
          {
            "key": "FnO_View",
            "header": "F&O",
            "type": "tag"
          }
        ],
        "search": [
          "Sentiment",
          "Driver_1"
        ],
        "filters": [
          "Sentiment"
        ],
        "actions": {
          "row": [
            "pdf"
          ]
        },
        "drawer": {
          "title_column": "Report_Date",
          "sections": [
            {
              "type": "tiles",
              "title": "Call",
              "columns": [
                "Sentiment",
                "Confidence_Level",
                "Confidence_Pct"
              ]
            },
            {
              "type": "fields",
              "title": "Key market drivers",
              "columns": [
                "Driver_1",
                "Driver_2",
                "Driver_3"
              ]
            },
            {
              "type": "fields",
              "title": "Segments",
              "columns": [
                "Sensex_Outlook",
                "Sensex_Range",
                "Nifty_Outlook",
                "Nifty_Range",
                "BankNifty_Outlook",
                "BankNifty_Range",
                "FnO_View",
                "VIX_Expectation",
                "MidSmall_Outlook",
                "MidSmall_Focus",
                "Commodity_Outlook"
              ]
            },
            {
              "type": "fields",
              "title": "Market view",
              "columns": [
                "View_Positional",
                "View_Intraday",
                "View_LongTerm",
                "View_FnO"
              ]
            }
          ]
        },
        "empty": {
          "title": "No reports yet",
          "reason": "Reports appear here once the desk sends them, every trading morning."
        },
        "id": "me_reports-table"
      }
    ],
    "modals": [
      {
        "id": "pdf",
        "kind": "document",
        "title": "Print report",
        "document": "reader_pdf"
      }
    ],
    "actions": {
      "header": [],
      "row": [
        "pdf"
      ]
    }
  },
  {
    "id": "settings",
    "kind": "settings",
    "route": "/settings",
    "label": "Settings",
    "icon": "Settings",
    "desc": "Profile, password and theme",
    "covers": [
      "R28"
    ],
    "portal": "desk"
  },
  {
    "id": "users",
    "kind": "users",
    "route": "/users",
    "label": "Users & roles",
    "icon": "Users",
    "group": "Setup",
    "desc": "Everyone who can sign in, and what each role may open",
    "subtitle": "Add people, reset passwords, change roles",
    "portal": "desk",
    "kernel": true
  }
];
