# Dex portfolio demo — 110 seconds

[![Watch the captioned demo](demo/poster.jpg)](demo/dex-demo.mp4)

[Download / watch the MP4](demo/dex-demo.mp4) · [Recorded trace](demo/recorded-trace.json) · [Video metadata](demo/video-metadata.json) · [Trace inspection snapshot](demo/trace-inspection.html)

This is a real continuous browser capture of the independent local demo: Qwen3 4B, actual contract retrieval, PostgreSQL permissions, explicit review confirmation, the background worker and Mailpit. All records and recipients are fictional. It has burned-in English captions and no voiceover.

The capture is normalized to 110 seconds for readability. Original model/run durations remain visible in the application and trace; playback timing is not an inference-speed measurement. The trace screen is explicitly labeled **Recording companion · Actual API snapshot**. It is a separate recording artifact, not an added product feature or a simulated execution.

## What the video shows

| Scene | Evidence |
| --- | --- |
| Request | The operator asks for unpaid bookings with missing documents and cited contract deadlines. |
| Model and tools | Qwen proposes booking lookup, contract-source search and draft preparation; server code validates arguments/order. |
| Grounding | USD 1,500 outstanding, passport-copy omission and two supported due dates, with excerpts and source metadata. |
| Approval | The exact review, source and test-recipient checkbox is selected before queueing. |
| Delivery | The same approved message appears in the local Mailpit inbox. |
| Trace | The same run/trace ID links request, model decisions, tool arguments, permission checks, results, approval and worker outcome. |
| Evals | 98 passing test cases include 60 system scenarios. Selected live-model and adversarial results are separate metrics. |

The [metadata](demo/video-metadata.json) contains actual scene offsets, model, trace ID, event count, output duration and encoding details. The companion HTML is generated from the authorized API trace rather than hardcoded event examples. Full event data remains available in the exported JSON.

## Reproduce the recording

Start the local services, API and worker using the README. Enable LLM_MODE=ollama with qwen3:4b. Recording requires Chrome, agent-browser 0.38.2 and FFmpeg/ffprobe with H.264 and subtitle support.

~~~sh
npx --yes agent-browser@0.38.2 doctor
npm run demo:record
npm run demo:render
~~~

On Windows use npm.cmd. If package-launch indirection causes trouble, set AGENT_BROWSER_BIN to the installed agent-browser executable. FFMPEG_PATH and FFPROBE_PATH can point to their executable locations. The renderer also detects the Windows WinGet links. No secrets need to be passed on the command line.

The recorder opens its own browser session, uses the normal local demo login, prepares a fresh draft, explicitly checks review confirmation, sends only to Mailpit and exports that run's trace. It serves the temporary trace snapshot on 127.0.0.1:8091 and closes that server on completion. Raw capture is ignored by Git; the finished MP4, poster, captions, trace snapshot and metadata are repository artifacts. Rerun recording before rendering in a clean checkout.

Actions is configured in [.github/workflows/ci.yml](../.github/workflows/ci.yml). The recorded eval metrics come from the dated local reports; no hosted Actions execution or public repository URL is fabricated. Read [latest evaluation evidence](eval-results/latest.md) for exact dates and model boundaries.
