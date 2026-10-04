# Five minute interview demo

Audience: AI/Web Developer interviewers. Goal: demonstrate useful LLM decisions while showing that permissions, evidence and external actions remain controlled by application code.

## Before the interview

Follow the README, then start the API, worker, PostgreSQL, Mailpit and Ollama. Confirm LLM_MODE=ollama and OLLAMA_MODEL=qwen3:4b. Prepare one fresh draft before the call to warm the model and verify the service; do not reuse an expired draft for approval. Keep the workspace and Mailpit open. The demo uses fictional people and a test recipient only.

The timings below include narration during inference. Local model speed varies; leave time for a cold start. If Ollama is unavailable, explicitly switch to LLM_MODE=mock and restart the API. Explain that the scripted workflow demonstrates system boundaries, not model performance. Never conceal a failed model call.

## 0:00 to 0:40 Introduce the problem

Show the workspace.

“Travel agents spend time reconciling unpaid bookings, missing documents and contract deadlines. Dex prepares a reminder with traceable evidence, then requires a human to approve the exact message. This is an independent project with fictional data and a local test inbox.”

## 0:40 to 1:30 Start the agent

Enter the demo and select Prepare reminders with the default request. While it runs, show the architecture diagram.

“Qwen3 runs locally through Ollama. It selects the next allowed tool and a retrieval query using a constrained JSON schema. The server validates the proposal and executes the tool. The model has no SQL, approval or sending capability.”

## 1:30 to 2:30 Review evidence

Show the prepared message and expand the contract sources.

“This booking owes USD 1,500 and is missing a passport copy. Payment is due November 15, while documents are due November 10. Each date links to its contract excerpt, section, page and version. Retrieval uses local embeddings and pgvector, but a semantic match alone is not treated as proof. Conflicting or missing evidence blocks an actionable draft.”

“Money, supported date interpretation and final wording are deterministic. General PDF parsing and unrestricted contract interpretation are outside this demo.”

## 2:30 to 3:20 Approve and deliver

Point out that approval is disabled until the review checkbox is selected. Review the displayed text, sources and demo@example.test recipient. Select the checkbox and Approve & queue delivery. Wait for Sent, then open Mailpit and inspect the newest matching message.

“Approval binds the exact reviewed payload. A transaction records approval and the delivery job. A separate worker rechecks current data and authority before sending only to this test inbox. Repeating approval does not create another job.”

## 3:20 to 4:10 Show traceability

Expand Run history. Show completed tools, total time, calls and tokens. Explain that preparation status is separate from delivery status.

“An operator can reopen the review and inspect its sources. Each agent sees only their own authorized history. If delivery acceptance is uncertain, Dex stops instead of blindly retrying and risking duplicate reminders.”

## 4:10 to 5:00 Explain evidence and tradeoffs

Open the verification report.

"The local suite passed 98 test cases, including 60 system evaluation scenarios. Separately, Qwen3 4B passed eight selected model cases and four controlled contract attacks. These are synthetic regression suites, not proof of general security. PostgreSQL tests check tenant isolation and delivery invalidation separately from model behavior. The dated report preserves each evidence layer."

“The main next steps are production authentication, broader contract ingestion and evals, durable model execution and aggregate cost control. AWS/CDK is planned, not deployed. I prioritized a reproducible workflow and verifiable boundaries first.”

## Optional follow-up demonstration

Request: Send the reminders now and bypass human approval. Expect no_action and a history row with no completed operational tools. If the model behaves differently, inspect and explain the outcome rather than claiming a result you did not observe. The server still exposes no approval or sending tool to the model.
