# Publication checklist

This checklist prepares Dex for a public portfolio repository. It is not a claim that publication, license review or a security audit has been completed.

- [x] Deliberately publish without a redistribution license, as explicitly chosen by the author on October 4, 2026.
- [x] Review dependency and downloaded model license/attribution requirements. See [notices](third-party-notices.md). Weights and caches stay out of Git.
- [x] Review the exact publication files. Include package-lock.json; exclude .env, node_modules, .cache, dist and credentials.
- [x] Gitleaks 8.30.1 scanned the 109-file publication snapshot with no findings before the initial commit. Additional checks found no personal paths or local token. Git history will be scanned before push.
- [ ] Rehearse the README from a fresh checkout on another machine or isolated environment. Current-machine checks do not prove a clean installation.
- [ ] Run npm run test:security with the demo worker stopped and inspect the evidence. Restart the worker afterwards.
- [ ] Run both LLM eval commands and preserve any failures. Keep deterministic tests and real-model scores separate.
- [x] Review the portfolio recording for personal paths, credentials and unrelated content; it captures only fictional local browser data.
- [x] Include a verified 110-second English-captioned demo with query, tools, approval, test delivery and correlated trace. See [video](demo-video.md).
- [ ] Create the remote repository and publish only when explicitly authorized. This preparation does not publish anything.

Local database passwords in .env.example and compose.yaml are disposable fixture credentials. They do not justify committing a real API key, personal token, production connection string or service account. Local demo authentication must not be exposed as production login.
