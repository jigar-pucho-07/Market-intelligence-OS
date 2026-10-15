# Import sheet (step 6 gate)
| flow | trigger | actions | webhook URL (paste) | test run ✔ |
|---|---|---|---|---|
| DAILY_SCHEDULE | schedule.every_day | trigger | | |
| MARKET_REPORT | webhook.catch_webhook | run | | |
| BROADCAST | webhook.catch_webhook | send, retry | | |

After import: confirm the model id in each askLlm node; select connections; in the constants node set `app_url` (this app's public origin) and `inbound_token` (the same value as the app's `INBOUND_TOKEN`); run one action from the test panel.

## Where the URLs go (step 7)
Never into the bundle. One environment variable per flow, on the server (`app/.env` locally, the portal's environment fields in production):

| flow | variable |
|---|---|
| MARKET_REPORT | `WEBHOOK_MARKET_REPORT` |
| BROADCAST | `WEBHOOK_BROADCAST` |
| codes by email | `WEBHOOK_AUTH_OTP` |
| flows → this app | `INBOUND_TOKEN` (shared secret; unset = closed) |
