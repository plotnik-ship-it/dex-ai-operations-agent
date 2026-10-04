# Dex capability map and independent implementation

Reviewed on October 4, 2026 by reading local GroupDeck source. There are **33 declared tools** in functions/src/support/dexTools.js, with dispatcher cases at lines 3377–3452. This inventory establishes code presence, not production deployment, correctness or uniform authorization guarantees. Earlier pasted audit notes were historical context, not authoritative evidence. No GroupDeck files were modified.

The demo imports none of those handlers. Its Node/TypeScript agent, PostgreSQL RLS, local embeddings, pgvector retrieval, approval service, durable queue, tracing and fictional fixtures are independent implementations. No Firebase configuration, agency/customer records, production secrets or network calls to GroupDeck are required. The machine-readable companion is [dex-capability-map.json](../fixtures/dex-capability-map.json).

| Real Dex tool | Declaration line | Independent demo relationship |
| --- | ---: | --- |
| get_group_review | 42 | Reference only; no demo implementation |
| get_group_tasks | 50 | Reference only; no demo implementation |
| get_group_rates | 58 | Reference only; no demo implementation |
| get_group_list | 66 | Reference only; no demo implementation |
| get_group_analytics | 75 | Reference only; no demo implementation |
| get_pending_payments | 89 | Combined in list_bookings_requiring_attention |
| get_missing_documents | 103 | Combined in list_bookings_requiring_attention |
| get_booking_details | 117 | Reference only; no demo implementation |
| draft_payment_reminder | 136 | Concept → prepare_reminder_draft |
| draft_custom_message | 165 | Reference only; no demo implementation |
| get_follow_up_candidates | 194 | Reference only; no demo implementation |
| get_daily_briefing | 213 | Reference only; no demo implementation |
| get_upcoming_deadlines | 222 | Concept → independent contract-source retrieval |
| draft_create_booking | 236 | Reference only; no demo implementation |
| draft_payment_link | 278 | Reference only; no demo implementation |
| get_cross_group_analytics | 305 | Reference only; no demo implementation |
| search_travelers | 319 | Reference only; no demo implementation |
| get_communication_history | 333 | Reference only; no demo implementation |
| generate_group_report | 355 | Reference only; no demo implementation |
| get_cabin_status | 369 | Reference only; no demo implementation |
| get_payment_risk | 384 | Reference only; no demo implementation |
| draft_welcome_email | 398 | Reference only; no demo implementation |
| get_checkin_status | 416 | Reference only; no demo implementation |
| get_revenue_forecast | 430 | Reference only; no demo implementation |
| draft_record_payment | 445 | Reference only; no demo implementation |
| draft_assign_cabin | 475 | Reference only; no demo implementation |
| draft_edit_booking | 497 | Reference only; no demo implementation |
| get_agency_insights | 524 | Reference only; no demo implementation |
| generate_agency_report | 539 | Reference only; no demo implementation |
| send_voucher | 554 | Reference only; no demo implementation |
| draft_create_automation | 573 | Reference only; no demo implementation |
| draft_update_client_profile | 620 | Reference only; no demo implementation |
| get_travel_compliance | 695 | Reference only; no demo implementation |

## Concepts supported by source inspection

- Verified membership and agency scope: askSupportBot.js imports requireCallerTenantMembership; dexGroupScope.js checks the agency and staff role, then scopes agents to groups they created or were assigned. The demo independently uses session-derived identity and PostgreSQL row-level policies. Its assignment table does not reproduce GroupDeck group-creator semantics.
- Human review: askSupportBot.js captures pendingAction, persists an expiring action and exposes a separate execution path. dexFinancialActions.js, dexEmailActions.js and dexCreateAutomation.js have action-specific execution guards. The demo independently binds approval to a creator, exact payload hash, expiry and revalidated data, then creates one queue job. It does not implement payments, booking mutations or automation rules.
- Grounded operations: payments, documents and upcoming-deadline tools inspire the reminder workflow. The demo's MiniLM/pgvector retrieval and strict synthetic contract parser are new implementations. This review does not establish production vector RAG in GroupDeck.
- Safe logging: dexLogging.js explicitly excludes raw arguments and raw errors from its invocation/result loggers. The demo adds a separate sanitized trace store; it does not claim GroupDeck already records full arguments or complete model traces.
- Background work: GroupDeck has an automation dispatcher in functions/src/automation/dispatcher.js. The demo's delivery worker and PostgreSQL queue are independent. Model generation remains synchronous in the API request.

## Interview claim boundaries

Say: “I built an independent approval-gated reminder agent inspired by an existing multi-tenant travel operations product, with executable safety evaluations and reconstructable traces.”

Do not claim: 33 demo tools, a GroupDeck production security audit, production vector RAG, global exactly-once email delivery, or a deployed AWS integration. The bounded demo exposes three operational tools plus stop. Existing production tools are architectural references, not coverage credited to this evaluation suite.
