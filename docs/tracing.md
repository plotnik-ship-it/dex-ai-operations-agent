# End-to-end tracing

Each admitted reminder run uses its UUID as traceId. Migration 007 creates an append-only event table. Application events are persisted immediately under the original caller's agency, creator and current group access, rather than buffered until the run finishes. The database assigns a monotonic sequence; timestamps are UTC and a span carries elapsed milliseconds. A trace is a sanitized diagnostic record, not a replay command.

## Event contract

| Stage | Evidence |
| --- | --- |
| Admission | user_request with bounded request text, group and planner mode; permission_check for authorized run creation |
| Model | model_started, model_decision with validated proposal and cumulative usage; model_error on an invalid proposal/provider failure |
| Tool dispatch | tool_selected with name, validated arguments and attempt=1 |
| Authorization | permission_check for each scoped booking read, source search/expansion and draft persistence |
| Tool completion | tool_result with bounded output and duration; tool_error with a controlled category |
| Agent completion | final_answer with draft text, source citations, status, cumulative model usage and total duration; run_error for safe termination |
| Human confirmation | permission_check for validated approval, approval_confirmed with draft/job correlation; approval_duplicate prevents another job; approval_denied for rejected reviews still visible to the actor |
| Worker | delivery_claimed, permission_check, delivery_attempt, delivery_result, delivery_finished; delivery_error or delivery_blocked on safe failure |
| Queue recovery | Durable job status, timestamps, outcomes and reason are returned alongside trace events, including stale sending → uncertain |

Model decisions contain the observable proposed action, not hidden reasoning or a chain of thought. Token counts, model identity, protocol and estimated provider cost come from the adapter when available. Usage is cumulative: **do not sum model_decision usage snapshots**. Use final_answer or the run's model_usage. A scripted planner has no token usage; zero local provider cost excludes hardware and power.

There are no automatic model/tool retries. attempt=1 and retries=0 make that policy explicit. Recovery from read/model failure is a new caller-requested run. SMTP failure or a lost response produces uncertain; repeat approval returns the original job and does not resend. The PostgreSQL/SMTP boundary does not provide global exactly-once delivery.

## Inspect a run

A successful reminder response includes runId and traceId, which are equal. The existing Run history lists the ID. While the API is running:

~~~sh
npm run trace -- <trace-uuid> group-a
~~~

The CLI uses the ignored .env token and the fixed loopback API; it never prints the credential. It retrieves:

~~~text
GET /groups/:groupId/runs/:runId/trace
Authorization: Bearer <local-demo-token>
~~~

The API returns traceId, run, ordered events and the current delivery job. It requires authentication; a foreign agency, another creator, revoked membership, unassigned group or mismatched group/run returns 404. The runtime can SELECT/INSERT trace rows but cannot UPDATE/DELETE them.

For the interview question “What happened yesterday at 2:15 PM?”:

1. Identify the admitted run in the caller's history using UTC started_at and its ID. The UI retains only the last 20 summaries; older rows remain in the database and can be queried under the same authorized runtime identity. No operator impersonation is implemented.
2. Retrieve the trace by that ID. Read sequence order rather than sorting duration or textual sequence values.
3. Compare the request and each validated model decision with tool arguments, authorized source IDs, balances and final draft. Check model usage and span duration to locate slow or failed stages.
4. Follow the draft ID to approval and the job ID to worker attempts and outcomes. A duplicate approval is an event, not another send.
5. Inspect uncertainty or missing final events alongside durable queue state. Never replay a send merely because telemetry is incomplete.

## Evidence to review

- [Live-model trace](evals/model-trace-example.json): real local Qwen decisions, controlled in-memory tools, tokens and draft evidence. No SMTP.
- [Persistent delivery trace](evals/delivery-trace-example.json): real local PostgreSQL, approval, worker and Mailpit; scripted planner and controlled retrieval. The isolated test agency is removed after export, so this file is an exported snapshot.
- [API trace verification](evals/api-trace-verification.json) and [HTTP execution snapshot](evals/api-trace-example.json): actual HTTP → local model → semantic retrieval → PostgreSQL → trace. This verification prepares a draft and does not approve or send. Reproduce with npm run verify:trace while the API and local services are running; the recorded plannerMode distinguishes a live model from scripted mode.
- tests/tracing.test.ts verifies chronological reconstruction, immutable rows, scoped endpoint access, sanitization and telemetry failure after sending.
- tests/delivery.test.ts exports a trace linking a real database run to actual test-inbox delivery.

These are separate evidence layers. The API verification proves live model and retrieval tracing; the delivery test proves approved local delivery tracing. No snapshot claims a production execution.

## Privacy, failures and limits

Known credential keys, Bearer values and email addresses are redacted; text length, array size and nesting are bounded. Raw provider responses, raw exception messages, stack traces and hidden reasoning are excluded from events. This is a demo sanitizer, not a comprehensive personal-data classifier; use fictional prompts and fixtures. Request/source snapshots are diagnostic and may be truncated or redacted. Exact approved content is independently bound by its payload hash, not by the sanitized trace.

A denied request before run creation has no tenant trace row; ordinary HTTP logs retain request/status metadata. If permission is revoked mid-run, RLS also prevents further trace writes and history completion. The last authorized event may therefore be the last stored event. A blocked job's durable state remains available to its original creator if authorization is restored. Foreign-draft rejection never writes into the foreign tenant.

Approval confirmation and its trace share one transaction: a trace insert failure rolls back the approval/job creation. Generation fails if required tracing fails. Worker trace writes are best effort and emit a safe write_unavailable log if they fail; they must not repeat SMTP or change a confirmed send to uncertain. Queue recovery may have a durable state transition without a corresponding trace event. The endpoint includes queue state to make that gap visible.

Legacy drafts without an existing accessible runId still work but have no correlated event stream. No retrospective traces are fabricated. Unexpected process death can leave a running row; there is no durable model job or automatic reconciliation. Trace storage has no automatic retention/deletion, export authorization across creators, pagination or global quota in this phase. Those are documented production gaps, not additional demo features.

## Local migration

Fresh volumes apply migrations 001–007 automatically. For an existing demo database with 001–006 already applied, run **once**:

~~~powershell
Get-Content -Raw database/007-tracing.sql | docker compose exec -T postgres psql -U dex_migration -d dex -v ON_ERROR_STOP=1
~~~

Rebuild and restart only the independent Dex API/worker. Do not run this migration against GroupDeck. Database schema changes do not affect GroupDeck's Firebase backend.
