# Import sheet (step 6 gate)
| flow | trigger | actions | webhook URL (paste) | test run ✔ |
|---|---|---|---|---|
| DAILY_SCHEDULE | schedule.every_day | trigger | | |
| MARKET_REPORT | webhook.catch_webhook | run, rerun | | |
| BROADCAST | webhook.catch_webhook | send, retry | | |
| DAILY_WATCHDOG | schedule.cron_expression | check | | |
| MARKET_ANALYSE | webhook.catch_webhook | run, rerun | | |
| MARKET_STORE | webhook.catch_webhook | store | | |
| MARKET_PUBLISH | webhook.catch_webhook | publish | | |

After import: confirm the model id in each askLlm node; select connections; in the constants node set `app_url` (this app's public origin) and `inbound_token` (the same value as the app's `INBOUND_TOKEN`); run one action from the test panel.

## Where the URLs go (step 7)
Never into the bundle. One environment variable per flow, on the server (`app/.env` locally, the portal's environment fields in production):

| flow | variable |
|---|---|
| MARKET_REPORT | `WEBHOOK_MARKET_REPORT` |
| BROADCAST | `WEBHOOK_BROADCAST` |
| MARKET_ANALYSE | `WEBHOOK_MARKET_ANALYSE` |
| MARKET_STORE | `WEBHOOK_MARKET_STORE` |
| MARKET_PUBLISH | `WEBHOOK_MARKET_PUBLISH` |
| codes by email | `WEBHOOK_AUTH_OTP` |
| flows → this app | `INBOUND_TOKEN` (shared secret; unset = closed) |
