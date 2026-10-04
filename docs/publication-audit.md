# Publication audit

Date: October 4, 2026.

Repository: https://github.com/plotnik-ship-it/dex-ai-operations-agent

## Pre-publication checks

- Reviewed the exact Git publication manifest: source, fictional fixtures, lockfile, docs, evaluation evidence and local demo media.
- Gitleaks 8.30.1 official Windows binary was downloaded from its upstream GitHub release and verified against the release SHA-256 checksum. A separate publication-only snapshot was scanned with redacted output: no findings. The first commit's Git history was also scanned: one commit, no findings.
- Additional content checks found no user-directory paths, personal email or copy of the ignored local demo token in the candidate files.
- .env, node_modules, dist, model caches and raw recording are excluded by Git. Disposable localhost database passwords are intentionally documented fixture credentials.
- The capability map contains GroupDeck tool names and source references, not imported handlers or customer records. The demo uses synthetic agencies, bookings, contracts and a fixed example.test mailbox.
- The final recording shows fictional browser content only. MP4 playback was decoded successfully and approval, sources and trace frames were inspected.
- The author explicitly chose no redistribution license. Dependencies and model licenses are inventoried in [third-party notices](third-party-notices.md).

These checks reduce publication risk; pattern scanning cannot prove that no secret or sensitive data exists. Hosted execution evidence will be recorded separately after GitHub Actions completes. No AWS resources or paid inference were deployed.
