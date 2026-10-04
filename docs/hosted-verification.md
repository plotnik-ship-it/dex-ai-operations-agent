# Hosted verification

Verified October 4, 2026 in the public repository's GitHub Actions, using fresh ubuntu-latest runners and Node 24.

Evaluated source commit: [9aeaadd418e54694f123fc59f2184bea1333f7c6](https://github.com/plotnik-ship-it/dex-ai-operations-agent/commit/9aeaadd418e54694f123fc59f2184bea1333f7c6).

| Run | Trigger | Result |
| --- | --- | --- |
| [37234584545](https://github.com/plotnik-ship-it/dex-ai-operations-agent/actions/runs/37234584545) | Initial push | 60/60 scenarios; 98 tests, zero failures and skips |
| [37234676710](https://github.com/plotnik-ship-it/dex-ai-operations-agent/actions/runs/37234676710) | Manual dispatch, live_model=true | Both jobs passed; 60/60 scenarios; 98 tests with zero failures/skips; Qwen3 4B 8/8; adversarial safety 4/4 and quality 4/4 |

The manual run's reliability-evidence-37234676710 and live-model-evidence-37234676710 artifacts were downloaded and the current raw reports copied to docs/evals/. Their merged snapshot is [latest evidence](eval-results/latest.md); its immutable history entry includes the complete input reports and SHA-256 hashes. The merged report was generated locally after retrieval, with the hosted workflow ID attached; it is not a newly executed local evaluation. Original hosted job summaries retain their own layer timestamps.

Installation, build, migrations, contract indexing, PostgreSQL/pgvector, semantic retrieval, approval/delivery integration and Mailpit were exercised without local workstation dependencies. Model weights were freshly downloaded into the hosted Ollama container. The model suites use controlled in-memory operational tools, not the live database or SMTP, and therefore measure a different layer from the integration tests.

This is evidence for the tested commit and synthetic fixtures. It is not a guarantee about future commits or production behavior. Actions does not deploy AWS or use a paid inference provider. The full README's interactive browser walkthrough has been verified locally; a separate fresh-machine human walkthrough remains optional follow-up.
