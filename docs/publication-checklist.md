# Publication checklist

This checklist prepares Dex for a public portfolio repository. It is not a claim that publication, license review or a security audit has been completed.

- [x] Deliberately publish without a redistribution license, as explicitly chosen by the author on October 4, 2026.
- [x] Review dependency and downloaded model license/attribution requirements. See [notices](third-party-notices.md). Weights and caches stay out of Git.
- [x] Review the exact publication files. Include package-lock.json; exclude .env, node_modules, .cache, dist and credentials.
- [x] Gitleaks 8.30.1 scanned the 109-file publication snapshot and the initial commit history with no findings before push. Additional checks found no personal paths or local token. See [audit](publication-audit.md).
- [ ] Rehearse the README from a fresh checkout on another machine or isolated environment. Current-machine checks do not prove a clean installation.
- [x] Run the complete security/integration suite and inspect evidence: 98/98 locally and on fresh hosted runners. Hosted workers are not independently running; the local demo worker remains available.
- [x] Run live-model and adversarial evals locally and on hosted infrastructure; preserve historical failures and report layers separately.
- [x] Review the portfolio recording for personal paths, credentials and unrelated content; it captures only fictional local browser data.
- [x] Include a verified 110-second English-captioned demo with query, tools, approval, test delivery and correlated trace. See [video](demo-video.md).
- [x] Create and push the independent public repository with explicit authorization: [GitHub](https://github.com/plotnik-ship-it/dex-ai-operations-agent).
- [x] Confirm the complete deterministic and integration suites pass on hosted infrastructure: [first run](https://github.com/plotnik-ship-it/dex-ai-operations-agent/actions/runs/37234584545), 98 tests with zero skips and 60/60 scenarios.
- [x] Confirm the manually dispatched live-model workflow passes on hosted infrastructure: [run](https://github.com/plotnik-ship-it/dex-ai-operations-agent/actions/runs/37234676710), 8/8 live-model and 4/4 adversarial cases.
- [ ] Pin the repository on the author's profile; browser sign-in is required.

Local database passwords in .env.example and compose.yaml are disposable fixture credentials. They do not justify committing a real API key, personal token, production connection string or service account. Local demo authentication must not be exposed as production login.
