# Delivery plan

1. Foundation: independent repository, local services, schema, synthetic fixtures, domain tests.
2. Authorization: sessions, memberships, assigned groups, RLS integration tests, deterministic operational tools.
3. RAG: contract ingestion, embeddings adapter, hybrid retrieval, validated citations and source viewer.
4. Agent: allowlisted tool registry, bounded orchestration, offline mock provider, draft review UI.
5. Delivery: immutable approval, transactional queue, worker, test inbox, stale-state and retry tests.
6. Reliability and portfolio: implemented 60-case matrix, scoped persistent traces, CI evidence upload, versioned reports and a captioned 110-second video. Live-model checks are reported separately. Hosted CI verification, global budget reservations, secret scan and license review remain future work.
7. AWS readiness: CDK synthesis/tests and cost assessment; deployment requires a later decision.

## Required release scenarios
Cross-agency and unassigned-group reads denied; no send without valid approval; altered or expired drafts denied; revoked membership denied by worker; duplicate approval does not duplicate delivery; contract prompt injection does not grant tools; unsupported deadlines cause abstention. The current adapter limits concurrent local model calls and per-run usage; global reserved budgets are not implemented.

## Evaluation reporting
Report booking selection accuracy, tool selection, citation support, abstention, latency, token usage, and estimated cost separately. Security and approval invariants must have zero violations in the release suite.
