# Browser demo

1. Start Docker services with docker compose up -d --wait.
2. Build with npm run build, then start the API with npm run dev.
3. In a second terminal, run npm run worker.
4. Open http://localhost:3000 and select Enter demo workspace.
5. Select Prepare reminders. Review the exact subject, body, test destination and contract excerpts.
6. Select the review checkbox, then Approve & queue delivery.
7. The delivery status updates automatically. Open test inbox to inspect the Mailpit message.

The API and worker load .env. Existing database volumes need migrations through 005; semantic indexing must already be completed. The local development machine is configured.

## Local session boundary
The demo sign-in creates a one-hour, in-memory opaque session. The cookie is HttpOnly and SameSite=Strict. Requests that change state using that cookie must originate from the local app origin. Signing out revokes the server session. The bearer token remains server-side. Restarting the API clears browser sessions.

This is deliberately a loopback-only demo sign-in to one synthetic agent. It must be replaced with production authentication before hosting. No browser storage contains credentials. Only the current draft ID is kept in sessionStorage for refresh recovery.

## Verified on October 4, 2026
Desktop and 390-pixel mobile layouts were inspected with agent-browser. Preparation produced a cited reminder. Approval was disabled until the review checkbox was selected. Approval queued one job; the worker delivered it to local Mailpit and the browser showed Sent. No browser errors were reported.

The automated suite passed 25 tests, including cross-origin session rejection, cookie attributes, logout revocation, payload-bound approval and delivery edge cases.

## Current scope
React/Vite interface, local semantic retrieval, optional Qwen3 4B planner, evidence review, explicit approval and background test delivery. Production hosting remains future work. See local-llm.md to enable the real model; the current development instance uses it.

Verified with the local model: the default request prepared one reminder, displayed cited deadlines and Qwen3 usage (three calls, 1,580 tokens, approximately 14 seconds), and kept approval disabled until explicit confirmation. No browser console errors were reported.

## Run history

The workspace lists your latest 20 runs for the current trip. Expand a row for completed tool timings, model token usage, duration and sanitized failure category. Open review & sources restores the saved draft and current delivery status. Run status describes preparation, not delivery. Refusals and failures are persisted even when no draft exists. History begins with migration 006; earlier drafts are not backfilled.

Existing volumes: apply missing migrations through database/007-tracing.sql with the migration role once, then rebuild and restart the API. Fresh volumes apply them automatically. Row-level security requires the original creator, matching agency and current group access. A crash or lost permission can leave an unfinished row; automatic reconciliation and pagination beyond 20 rows are not yet implemented. The separate trace store captures sanitized request and output snapshots; raw provider output and stack traces are excluded. See [tracing](tracing.md).
