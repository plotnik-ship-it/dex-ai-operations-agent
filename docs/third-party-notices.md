# Third-party dependencies and models

Reviewed October 4, 2026. The original project is published without a redistribution license, by the author's explicit choice. This does not change the licenses of third-party software.

The repository contains application source, fictional fixtures, evaluation evidence and a demo recording. It does not bundle node_modules, model weights, Docker images or downloaded caches. npm ci installs dependencies from package-lock.json and retains their distributed license files.

The lockfile declares MIT, Apache-2.0, BSD-3-Clause, ISC, BlueOak-1.0.0, MIT-0, 0BSD and MIT/CC0 options. Native sharp/libvips dependencies also include LGPL-3.0-or-later; lightningcss includes MPL-2.0. These components are not modified or redistributed here. A future binary/container distribution must separately review bundled notices and applicable source obligations. This inventory is not legal advice or a complete distribution compliance audit.

Models downloaded locally:

- [Qwen/Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B): Apache-2.0; accessed through the local Ollama qwen3:4b tag.
- [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2): Apache-2.0; ONNX embedding model based on sentence-transformers/all-MiniLM-L6-v2.

Docker Compose references upstream PostgreSQL/pgvector, Mailpit and Ollama images. Images are downloaded from upstream rather than included in this Git repository. Preserve their notices when redistributing images.
