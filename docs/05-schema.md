# 05 — Data schema · Market Intelligence
PostgreSQL, one table per entity (`app/db/schema.sql`, idempotent — apply, then apply again). Column names are the declared names in lower case; the kernel reads every value as a string. The app writes through its DAL; a flow writes through `/api/data/<entity>` with `INBOUND_TOKEN`; Studio reads with `studio_reader` (SELECT on these tables only).

## reports
| column | type |
|---|---|
| Report_ID | text |
| Report_Date | date |
| Created_At | timestamptz |
| Trigger | text |
| Status | text |
| Sentiment | text |
| Confidence_Level | text |
| Confidence_Pct | numeric |
| Driver_1 | text |
| Driver_2 | text |
| Driver_3 | text |
| Sensex_Outlook | text |
| Sensex_Range | text |
| Sensex_Reason | text |
| Nifty_Outlook | text |
| Nifty_Range | text |
| Nifty_Reason | text |
| BankNifty_Outlook | text |
| BankNifty_Range | text |
| BankNifty_Reason | text |
| FnO_View | text |
| VIX_Expectation | text |
| FnO_Reason | text |
| MidSmall_Outlook | text |
| MidSmall_Focus | text |
| MidSmall_Reason | text |
| Commodity_Outlook | text |
| Commodity_Reason | text |
| Sectors | text |
| Risks | text |
| View_Positional | text |
| View_Intraday | text |
| View_LongTerm | text |
| View_FnO | text |
| Articles_Analyzed | numeric |
| Category_Breakdown | text |
| Source_Status | text |
| Model | text |
| WhatsApp_Message | text |
| Message_Length | numeric |
| Sent_At | timestamptz |
| Sent_Count | numeric |
| Failed_Count | numeric |
| Error_Message | text |

id: Report_ID (MIR-…) · status: Status ['Ready', 'Sent', 'Failed']

## published_reports
| column | type |
|---|---|
| Report_ID | text |
| Report_Date | date |
| Published_At | timestamptz |
| Sentiment | text |
| Confidence_Level | text |
| Confidence_Pct | numeric |
| Driver_1 | text |
| Driver_2 | text |
| Driver_3 | text |
| Sensex_Outlook | text |
| Sensex_Range | text |
| Sensex_Reason | text |
| Nifty_Outlook | text |
| Nifty_Range | text |
| Nifty_Reason | text |
| BankNifty_Outlook | text |
| BankNifty_Range | text |
| BankNifty_Reason | text |
| FnO_View | text |
| VIX_Expectation | text |
| FnO_Reason | text |
| MidSmall_Outlook | text |
| MidSmall_Focus | text |
| MidSmall_Reason | text |
| Commodity_Outlook | text |
| Commodity_Reason | text |
| Sectors | text |
| Risks | text |
| View_Positional | text |
| View_Intraday | text |
| View_LongTerm | text |
| View_FnO | text |
| Articles_Analyzed | numeric |
| WhatsApp_Message | text |

id: Report_ID (MIR-…) · status: — 

## news_articles
| column | type |
|---|---|
| Article_ID | text |
| Fetched_At | timestamptz |
| Report_ID | text |
| Source | text |
| Category | text |
| Impact | text |
| Title | text |
| Summary | text |
| Published_At | timestamptz |
| Link | text |

id: Article_ID (NWS-…) · status: — 

## subscribers
| column | type |
|---|---|
| Subscriber_ID | text |
| Name | text |
| WhatsApp | text |
| Email | text |
| City | text |
| Status | text |
| Opt_In_At | date |
| Opt_In_Source | text |
| Joined_At | timestamptz |
| Notes | text |

id: Subscriber_ID (SUB-…) · status: Status ['Active', 'Paused', 'Unsubscribed']

## deliveries
| column | type |
|---|---|
| Delivery_ID | text |
| Sent_At | timestamptz |
| Kind | text |
| Report_ID | text |
| Report_Date | date |
| Subscriber_ID | text |
| Subscriber_Name | text |
| Sentiment | text |
| Status | text |
| Message_ID | text |
| Error_Message | text |

id: Delivery_ID (DLV-…) · status: Status ['Queued', 'Sent', 'Failed']

## audit_log
| column | type |
|---|---|
| Audit_ID | text |
| At | timestamptz |
| Who | text |
| Flow | text |
| Action | text |
| Entity | text |
| Record_ID | text |
| Summary | text |

id: Audit_ID (AUD-…) · status: — 
