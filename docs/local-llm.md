# Local LLM demo

Dex uses a bounded local LLM workflow. There is no automatic fallback to the scripted planner: provider errors stop the run.

Dex supports schema-constrained tool selection and server-side tool execution through Ollama with qwen3:4b. The Docker image is pinned in compose.yaml; the model runs on this computer. No paid provider or AWS resources are required.

## Start

1. Start the usual database and Mailpit services.
2. Run docker compose --profile llm up -d ollama.
3. Run docker compose exec ollama ollama pull qwen3:4b.
4. Set LLM_MODE=ollama and OLLAMA_MODEL=qwen3:4b in your ignored .env.
5. Run npm run build, then npm run dev and npm run worker in separate terminals.
6. Open http://localhost:3000, enter the demo and prepare the default request.

The model download is about 2.5 GB. If TLS verification fails, repair the host/container trust configuration; do not disable certificate verification. On the development machine, the model was imported through Windows HTTPS with every downloaded blob checked against its manifest SHA-256 digest.

## Responsibility boundary

The LLM chooses one eligible tool per step and supplies the retrieval query. The server owns identity, agency/group scope, tool order, strict argument validation and source access. The model cannot select an email recipient, approve a draft or send a message. PostgreSQL policies enforce tenant and group access independently.

Balances use integer minor units. Deadline interpretation uses the supported synthetic contract grammar, including conflict detection across all authorized clauses. The reminder body is a deterministic template. This is a bounded workflow with LLM decisions, not unrestricted planning or general contract interpretation.

Human approval remains a separate action over the exact reviewed payload. Delivery goes only to local Mailpit. A provider failure never silently switches to the scripted planner.

## Limits and measurements

Only allowlisted local Qwen3 models (1.7B for comparison and 4B for the demo) and the fixed loopback Ollama endpoint are allowed. There is one active model request per API process, at most four calls per planner, a 45-second call timeout and a 120-second agent deadline checked between steps. Each request allows up to 256 output tokens and a 4096-token context. Cumulative token limits also stop the planner. Serialized tool context over 6,000 characters is rejected rather than silently truncated. These are application limits, not an infrastructure-wide quota. Provider cost is zero; local compute and electricity are not priced.

Saved drafts include provider/model, call count, input/output token counts and inference duration, shown in the browser. Durable metrics for rejected runs and aggregate operational dashboards are future work.

## Evaluation and known limitation

Run npm run eval:llm after indexing the fictional contracts. It uses the real local model and database, saves pending drafts, and never approves or sends. See [the recorded report](evals/local-llm.json).

The earlier 1.7B native-tool adapter failed formatting and intent tests; its [baseline report](evals/local-llm-1.7b-baseline.json) is retained. A native-tool 4B trial also exhausted its output allowance; the [interrupted trial](evals/local-llm-4b-native-interrupted.json) is explicitly incomplete. Increasing model size alone did not solve the problem.

The replacement uses Ollama's [structured output API](https://docs.ollama.com/capabilities/structured-outputs). The same Zod tool contract supplies the generation schema and validates the returned action. Only the next workflow tool and stop are eligible. The response is a JSON tool proposal in message.content; this adapter does not use Ollama's native message.tool_calls protocol. The model still chooses the tool, arguments and search query. The server validates and dispatches the proposal. A schema enforces shape, not intent or authorization.

The evaluation now includes six cases repeated three times by default: the standard reminder, a paraphrase, approval bypass, an unrelated request, cross-agency access and an instruction override. LLM_EVAL_REPETITIONS can select 1–5 rounds. Assertions check refusal before any operational tool, or a persisted draft with all three tools and supported cited deadlines. Runs save progress and never approve or send. Repeated samples at temperature zero are a regression check, not independent evidence of broad accuracy or prompt-injection resistance.

Twenty-two automated tests passed with real PostgreSQL, semantic retrieval and delivery checks enabled. The scripted planner remains available for deterministic tests; its results must not be presented as LLM performance.

Latest local result: 18/18 real-model cases passed (six requests, three repetitions), alongside 22/22 automated tests. Valid reminders took approximately 13–14 seconds on this machine. The local browser configuration now uses LLM_MODE=ollama and qwen3:4b; .env.example keeps mock as an explicit portable default.
