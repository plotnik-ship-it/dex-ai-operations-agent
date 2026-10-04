# Local setup and troubleshooting

Use the README quick start for a new checkout. The setup command creates a private local .env from .env.example, generates a random demo token and refuses to overwrite an existing file.

## Existing checkouts

If your .env predates the setup command, preserve it. Add the following local indexing setting if missing:

```dotenv
INDEX_DATABASE_URL=postgres://dex_migration:local_migration_password@localhost:5432/dex
```

Use Node's environment-file option explicitly for indexing:

```sh
npm run build
node --env-file=.env scripts/index-contracts.mjs
```

The standalone npm run index:contracts command expects INDEX_DATABASE_URL to be set in the shell; it does not load .env itself. The README command avoids that difference across shells.

Existing database volumes do not rerun initialization. Inspect which schema objects exist and apply only missing files from database/ in numerical order with the migration role. For example, if migrations 001–005 are present but agent_runs is absent, apply 006 only.

PowerShell example:

```powershell
Get-Content -Raw database/006-run-history.sql | docker compose exec -T postgres psql -U dex_migration -d dex -v ON_ERROR_STOP=1
Get-Content -Raw database/007-tracing.sql | docker compose exec -T postgres psql -U dex_migration -d dex -v ON_ERROR_STOP=1
```

POSIX shell example:

```sh
docker compose exec -T postgres psql -U dex_migration -d dex -v ON_ERROR_STOP=1 < database/006-run-history.sql
docker compose exec -T postgres psql -U dex_migration -d dex -v ON_ERROR_STOP=1 < database/007-tracing.sql
```

These scripts are not idempotent and there is no automatic migration ledger yet. Do not rerun applied migrations or remove volumes to migrate.

## Common issues

| Symptom | Check |
| --- | --- |
| npm blocked in PowerShell | Use npm.cmd, without changing the machine execution policy |
| Docker unavailable after WSL installation | Finish the required reboot and start Docker Desktop |
| Port already allocated | Check existing local services; do not stop unrelated applications |
| Contract embeddings unavailable | Add INDEX_DATABASE_URL, build and run the explicit indexing command above |
| Scripted demo instead of local model | Set LLM_MODE=ollama and OLLAMA_MODEL=qwen3:4b, then restart the API |
| Local model unavailable | Start the llm Compose profile and download qwen3:4b |
| Certificate error downloading weights | Correct host/container trust; do not disable TLS verification |
| Model busy or slow | One model request is allowed per API process; avoid simultaneous evals and browser runs |
| Queued message does not become Sent | Start npm run worker; inspect the job status and expiry |
| Uncertain delivery | Inspect Mailpit before any recovery; no automatic resend is provided |
| Empty run history | History begins at migration 006; old drafts are not backfilled |
| Tests report skips | Use test:security for enabled local service tests after indexing |

## Offline demonstration

```sh
npm run demo:offline
```

This uses synthetic fixtures and PGlite. It does not demonstrate a live LLM or live SMTP delivery. The CLI demo:agent uses a scripted planner with real local embeddings and PostgreSQL; it requires DATABASE_URL in the shell. Use the browser with LLM_MODE=ollama to demonstrate actual model decisions.

## Stop local services

Stop the API and worker terminals with Ctrl+C. docker compose --profile llm stop stops the project containers while preserving volumes and downloaded weights. Do not use volume deletion as a routine shutdown or reset.
