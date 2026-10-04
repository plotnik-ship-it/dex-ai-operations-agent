# Approval and local delivery demo

All messages go to demo@example.test through Mailpit on 127.0.0.1:1025. SMTP host, port and envelope are fixed in the transport. No external email provider is configured.

## Setup
Apply migration 005 once to existing volumes. Fresh Docker volumes apply migrations 001–005 automatically.

Set DATABASE_URL to the runtime-role connection and WORKER_DATABASE_URL to the worker-role connection from .env.example. The API and worker commands load .env. Other scripts read shell environment variables. A local .env with a random demo authentication token has been created on the development machine and is gitignored.

## Review and send
1. Run npm run demo:agent to prepare a fresh draft and copy its draftId.
2. Run npm run review -- <draftId>. Read the exact messages, sources, destination and expiry.
3. Type APPROVE to queue delivery. Any other answer leaves it unapproved.
4. Run npm run worker -- --once to process one job, or npm run worker to poll continuously.
5. Open http://localhost:8025 to inspect the message.

API clients use GET /drafts/:draftId for review and POST /drafts/:draftId/approve with {"reviewHash":"<hash returned by review>","confirm":true}. Both require the authenticated creator. GET also returns delivery status and per-booking outcomes. No approval tool is exposed to the planner.

## Guarantees and limits
Approval binds the canonical payload hash. An advisory transaction lock serializes repeated approval; unique draft references enforce one approval and one job. Approval and queue creation commit atomically.

The worker role can read/update the queue but has no access to business tables. A separate runtime connection rechecks creator membership, group access, expiry, payload hash, booking balances/documents and contract evidence. Validation is point-in-time immediately before each SMTP operation; database updates and SMTP delivery cannot be one atomic transaction.

Jobs transition queued → sending → sent, blocked or uncertain. An ambiguous SMTP outcome or stale sending claim is not automatically retried. Exactly-once external delivery is not claimed. Manual reconciliation is required for uncertain outcomes. Multi-booking partial results are retained in outcomes.

Current limitations: browser/API/CLI review; no draft editing endpoint; no production identity provider; local LLM planning is available through the bounded Ollama adapter. A changed or expired draft requires creating and reviewing a new one.

## Tests
Set TEST_DATABASE_URL, INDEX_DATABASE_URL, WORKER_DATABASE_URL, SEMANTIC_EVAL=true and DELIVERY_EVAL=true; run npm test. The delivery test creates a separate fictional agency, simulates approval, exercises negative cases, sends one synthetic Mailpit message, and removes only its database fixtures. The message remains as visible test evidence.
