# Portfolio copy

Repository: https://github.com/plotnik-ship-it/dex-ai-operations-agent

## Resume bullets

- Built and evaluated an approval-gated AI operations agent with schema-constrained tool proposals, pgvector retrieval with citations, PostgreSQL row-level security, human-in-the-loop delivery, end-to-end tracing, 60 structured agent scenarios and 98 automated tests.
- Validated model behavior separately from deterministic system tests using Qwen3 4B, including live-model and adversarial evaluation suites with reproducible, versioned evidence; verified both model evaluations and the complete integration suite on GitHub-hosted infrastructure.

## LinkedIn project description

Dex AI Operations Agent is an independent TypeScript portfolio project for travel operations. It identifies unpaid bookings with missing documents, retrieves cited contract deadlines and prepares reminders for human review. Delivery requires explicit approval and goes only to a test inbox.

The project demonstrates tenant-scoped tools, PostgreSQL RLS, pgvector retrieval, a transactional delivery queue, bounded model usage and correlated traces from request through delivery. Reliability evidence includes 60 structured scenarios within 98 automated tests, with separate Qwen3 4B and adversarial evaluations. The repository includes a 110-second English-captioned demo and dated reports. All data is fictional.

## Interview opening

“I built an approval-gated AI operations agent, and I can show how I evaluate, secure, trace and constrain it. The model proposes permitted tools; the server validates their arguments and authority. Contract evidence supports the reminder, and a human must review the exact message before the worker can deliver it. I measure deterministic system behavior separately from actual model decisions.”

## Evidence boundaries

The 60 scenarios are included in the 98 test cases. They are not 60 live-model measurements. The LLM adapter uses schema-constrained JSON proposals rather than provider-native tool_calls. This is a fictional, local demo inspired by GroupDeck's domain concepts, not a production GroupDeck integration or an AWS deployment. Keep these distinctions when adapting this copy to an application.
