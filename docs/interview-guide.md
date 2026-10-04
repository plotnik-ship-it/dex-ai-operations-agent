# Interview guide

## Project introduction

“Dex turns a travel follow-up request into a cited reminder that a human must approve. I built it as a separate TypeScript application with PostgreSQL authorization, local retrieval and inference, a durable delivery worker, and explicit evaluations. All demonstration data is fictional.”

## Design questions

**Why use an LLM here?** It maps a user's request to a narrow workflow and supplies a retrieval query. I deliberately keep money, authority, approval and supported date validation in deterministic code.

**Is this native function calling?** The current Ollama adapter uses schema-constrained JSON proposals, validated and dispatched by the application. It does not use the native tool_calls response field. An earlier native-tool approach was unreliable with the small model; the recorded failures informed this design.

**Why RAG?** Contract answers need evidence tied to the correct agency, group and document version. MiniLM embeddings, pgvector and text ranking find relevant clauses. I then examine all authorized clauses in the small corpus for conflicts. Retrieval relevance alone does not establish correctness.

**Why PostgreSQL?** Operational data, transactions, tenant policies and a small vector corpus fit in one database. RLS enforces membership and group assignments under a restricted runtime role. Approximate vector indexing is deferred until corpus size and measurements justify it.

**What prevents a model from accessing another agency?** Identity comes from the server, not model arguments. Tools accept no arbitrary tenant override, and PostgreSQL policies constrain the data they can read. A schema shapes model output; it is not the authorization boundary.

**Why human approval?** Delivery is an external action. Approval binds the reviewed payload hash and expires. The worker rechecks current membership, booking data and contract evidence before sending to a fixed local test recipient.

**Why a separate worker?** Delivery must survive the lifetime of an API request. Approval and job insertion share a transaction. Model inference and indexing are not yet durable background jobs; I would not claim they are.

**Why not promise exactly-once email?** SMTP acceptance cannot be committed atomically with PostgreSQL. Concurrent approvals and job claims are deduplicated, but a crash after acceptance creates uncertainty. Dex marks the result uncertain and avoids automatic resend. Operator reconciliation is still needed.

**How is cost controlled?** The current provider runs locally, so measured provider cost is zero, excluding local compute. Calls, context, tokens, time and active requests are limited. Aggregate paid-provider budget reservation is future work.

**What does the evidence establish?** Thirty-six automated tests exercise code and local services. Eighteen model evaluations cover six requests repeated three times; four additional cases use controlled malicious or incomplete evidence. They are small regression suites, not a representative accuracy benchmark or proof against all prompt injection.

**What was reused from GroupDeck?** Domain concepts: agencies, assigned groups, bookings, payment/document follow-up and human approval. The implementation and data are independent. No live integration or shared credentials are present.

## Current limitations

Production identity, arbitrary PDF ingestion, general contract interpretation, durable inference execution, interrupted-run reconciliation and global budget controls are not implemented. Message wording uses a fixed English template. The demo accepts only the synthetic clause grammar for dates. History is limited to the latest 20 authorized runs. AWS/CDK is a future design direction, not deployed infrastructure.

## Next steps

First broaden the corpus and evaluation dataset, introduce production authentication, and define a document lifecycle. Then move inference to durable jobs and introduce aggregate quotas. CDK synthesis and cost review can follow before any paid deployment. A GroupDeck adapter would be a separate integration project with explicit authorization boundaries.
