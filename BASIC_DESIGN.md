# Basic design / 基本設計書

## 1. Architecture
See `architecture.svg`. PWA frontend and Node.js backend share one Docker image. The browser holds the RealtimeSession and connects to OpenAI or Azure OpenAI via WebRTC. The Node.js server has no AI agent or Realtime session of its own. The host `data/` folder is mounted read-only into the container at `/data`.

## 2. Components
| Component | Responsibility |
|---|---|
| `index.html`, `src/style.css` | Screen: language and voice selectors, Start/End buttons, status, connected time, estimated cost |
| `src/main.js` | UI language (en/ja), voice selection, create RealtimeAgent, register `run_skill`, establish WebRTC, start the greeting, connected-time and cost meter |
| `server.js` | Serve compiled PWA, select OpenAI / Azure OpenAI, create ephemeral client secret, supply instructions and pricing, execute allowlisted skills, guard the data folder |
| `AGENTS.md` | Global voice agent policy and skill-selection instructions |
| `skills/current-time/SKILL.md` | Current time skill guidance |
| `skills/data-files/SKILL.md` | Data folder list / search / read guidance |
| `skills/comet-pizza-order/SKILL.md` | Comet Pizza phone order flow (greeting, order taking, single read-back) |
| `data/` | Read-only content for the agent (sample: Comet Pizza menu and other fictional documents, CC0) |
| `Dockerfile`, `docker-compose.yaml` | Build PWA and run Node.js server; mount `./data:/data:ro` |

## 3. Interaction sequence
1. User opens the HTTPS PWA, chooses language and voice, and presses Start.
2. PWA fetches `/api/config` and POSTs `/api/token`.
3. Node loads `AGENTS.md` and all `skills/*/SKILL.md`, and calls `{apiBase}/realtime/client_secrets` with the standard key (`Authorization: Bearer` for OpenAI, `api-key` for Azure OpenAI).
4. PWA appends the conversation language and staff name (voice name) to the instructions, creates `RealtimeAgent` with the selected voice, and connects via WebRTC to `realtimeUrl` with the ephemeral secret.
5. The connected-time meter starts, and the PWA sends `response.create` so the agent greets first.
6. Following the `comet-pizza-order` skill, the agent reads the menu with `run_skill(data-read, comet-pizza-menu.md)` and takes the order.
7. Whenever a skill is needed, the tool executes in the browser SDK and POSTs `/api/skills/<name>` with `{query, file}`.
8. Node runs the allowlisted JS function and returns JSON; the tool result is returned to GPT-Realtime, which speaks the answer.
9. On each `response.done` event, the PWA adds the reported token usage × price to the cost display.
10. End (or a disconnect) stops the meter; language and voice become selectable again.

## 4. API contracts
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/config` | - | `{instructions, model, realtimeUrl, pricing}` (`pricing`: USD per 1M tokens for `textIn`, `textCached`, `textOut`, `audioIn`, `audioCached`, `audioOut`, or `null`) |
| POST | `/api/token` | - | `{value: ephemeralClientSecret}` |
| POST | `/api/skills/current-time` | - | `{iso, timezone: 'UTC', note}` |
| POST | `/api/skills/data-list` | - | `{files: string[]}` (max 200) |
| POST | `/api/skills/data-search` | `{query}` (English keywords) | `{query, results: [{file, line, text}]}` (max 8) |
| POST | `/api/skills/data-read` | `{file}` | `{file, content, truncated}` (max 12,000 chars) |

Errors: unknown skill → 404 `{error}`; invalid input or file → 400 `{error}` (e.g. `file not found`, `file is not allowed`).

`run_skill` tool schema: `{skill_name: 'current-time' | 'data-list' | 'data-search' | 'data-read', query: string | null, file: string | null}`.

## 5. Configuration
| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI key (used when `AZURE_OPENAI_ENDPOINT` is not set) |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` | Azure OpenAI resource endpoint and key; setting the endpoint switches to Azure (`{endpoint}/openai/v1`) |
| `REALTIME_MODEL` | Model name (OpenAI) or deployment name (Azure); default `gpt-realtime` |
| `REALTIME_PRICING_MODEL` | Model name used for the cost estimate when the Azure deployment name differs |
| `DATA_DIR` | Data folder; `/data` in the container, `./data` locally |
| `PORT` | Listen port; default 3000 |

## 6. Skill registration
`SKILL.md` is instruction text, not executable code. The server concatenates every `skills/*/SKILL.md` into the instructions; the model reads them and selects the fixed `run_skill` tool. The backend maintains an allowlist of handlers. To add a skill, create `skills/<name>/SKILL.md`, extend the tool's `skill_name` enum, and register a trusted handler. Instruction-only skills (such as `comet-pizza-order`) need no handler. Do not evaluate model-generated code or arbitrary paths.

## 7. Data folder access
- Only regular files with `.md`, `.txt`, `.csv`, `.json` extensions under `DATA_DIR` are listed; symlinks are skipped.
- `data-read` resolves the real path and rejects anything outside `DATA_DIR` or with another extension.
- Search is a simple case-insensitive keyword match per line; the agent translates non-English questions into English keywords.
- The folder is mounted read-only and is not included in the image, so content changes need no rebuild.

## 8. UI language, voice and cost meter
- Language: `navigator.language` starting with `ja` → Japanese, otherwise English; the choice is stored in `localStorage`.
- Voice: stored in `localStorage`; language and voice are locked while connected because they are fixed at connect time.
- Cost: sum over `response.done` usage of (uncached text/audio input, cached text/audio input, text/audio output) × list price. JPY = USD × 160. Prices come from the server's table for the four supported models.

## 9. Security and deployment
- Keep `OPENAI_API_KEY` / `AZURE_OPENAI_API_KEY` on the server only; the ephemeral client secret is passed to the browser.
- Use TLS/HTTPS for iPhone microphone access and PWA.
- Before Internet exposure, require authentication on all API routes and rate limiting; enforce authorization server-side on every skill.
- For sensitive operations, prefer server-owned Realtime controls/sideband architecture rather than trusting browser tool registration.
- Protect against cross-origin access and CSRF according to chosen authentication strategy.
- Mount the data folder read-only and put only content that every user may hear into it.

## 10. Known limitations
- No persistent conversation history across sessions; orders are not sent anywhere.
- Order totals are calculated by the model and may be wrong.
- No automatic execution of arbitrary Agent Skills; demo demonstrates a compatible file layout and a manually bound tool.
- Keyword search may rank unrelated lines higher; the agent can read the whole file instead.
- The cost display is an estimate (list prices, excluding tax; Azure prices may differ) and increases only after each response.
- iPhone screen lock/background may interrupt audio; iOS PWA background playback not guaranteed.
- Chrome does not offer PWA installation because the manifest has no icons.
- Realtime session duration and token validity are subject to service limits.
