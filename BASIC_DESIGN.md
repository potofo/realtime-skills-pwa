# Basic design / 基本設計書

## 1. Architecture
See `architecture.svg`. PWA frontend and Node.js backend share one Docker image. The browser holds the RealtimeSession and connects to OpenAI via WebRTC. The Node.js server has no AI agent or Realtime session of its own.

## 2. Components
| Component | Responsibility |
|---|---|
| `src/main.js` | Create RealtimeAgent, register `run_skill`, establish WebRTC, manage start/stop UI |
| `server.js` | Serve compiled PWA, create ephemeral client secret, supply agent instructions, execute allowlisted skill |
| `AGENTS.md` | Global voice agent policy and skill-selection instructions |
| `skills/current-time/SKILL.md` | Skill description and use guidance |
| `Dockerfile` | Build PWA and run Node.js server |

## 3. Interaction sequence
1. User opens HTTPS PWA, presses Start.
2. PWA fetches `/api/config` and POSTs `/api/token`.
3. Node loads `AGENTS.md` and `SKILL.md`; calls OpenAI `/v1/realtime/client_secrets` using standard API key.
4. PWA initializes `RealtimeAgent` and connects directly to OpenAI via WebRTC using ephemeral secret.
5. User asks for time. GPT-Realtime decides to call `run_skill`.
6. The tool executes in the browser SDK and POSTs `/api/skills/current-time` to Node.
7. Node runs an allowlisted JS function and returns UTC ISO timestamp.
8. Tool result is returned to GPT-Realtime, which speaks the answer.

## 4. API contracts
| Method | Path | Response |
|---|---|---|
| GET | `/api/config` | `{instructions: string}` |
| POST | `/api/token` | `{value: ephemeralClientSecret}` |
| POST | `/api/skills/current-time` | `{iso: string, timezone: 'UTC', note: string}` |

## 5. Skill registration
`SKILL.md` is instruction text, not executable code. The model reads its description and selects a fixed tool. The backend maintains an allowlist of handlers. To add skills, create a `skills/<name>/SKILL.md`, load its instructions, extend the tool's schema, and register a trusted handler. Do not evaluate model-generated code or arbitrary paths.

## 6. Security and deployment
- Keep OPENAI_API_KEY on server only; ephemeral client secret is passed to browser.
- Use TLS/HTTPS for iPhone microphone access and PWA.
- Before Internet exposure, require authentication on all API routes and rate limiting; enforce authorization server-side on every skill.
- For sensitive operations, prefer server-owned Realtime controls/sideband architecture rather than trusting browser tool registration.
- Protect against cross-origin access and CSRF according to chosen authentication strategy.

## 7. Known limitations
- No persistent conversation history across sessions.
- No automatic execution of arbitrary Agent Skills; demo demonstrates a compatible file layout and a manually bound tool.
- iPhone screen lock/background may interrupt audio; iOS PWA background playback not guaranteed.
- Realtime session duration and token validity are subject to service limits.
- End-to-end API connection is not tested here; validate with a real account and key.
