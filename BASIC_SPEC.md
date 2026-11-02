# Basic specification / 基本仕様書

## 1. Objective
Build a minimal iPhone-installable PWA capable of low-latency Japanese speech-to-speech interaction with GPT-Realtime and invoking an Agent Skill defined by SKILL.md.

## 2. Requirements
| ID | Requirement | Implementation |
|---|---|---|
| R-01 | One Docker container | Multi-stage Dockerfile, one runtime image |
| R-02 | One Node.js backend process | Express serves PWA and API |
| R-03 | One AI model | GPT-Realtime 2.1 only; no secondary reasoning agent |
| R-04 | iPhone PWA | Web manifest + Safari + HTTPS |
| R-05 | Realtime speech | Browser Agents SDK + WebRTC |
| R-06 | Skill invocation | Agent calls `run_skill`, browser forwards to allowlisted backend endpoint |
| R-07 | Instruction files | `AGENTS.md`, `skills/current-time/SKILL.md` |
| R-08 | API key protection | Server issues ephemeral Realtime client secrets |
| R-09 | Extensibility | Add handler and skill description for each new skill |

## 3. Out of scope (MVP)
- Arbitrary shell execution, full Agent Skills standard runtime, dynamic tool registration
- Login/SSO, multi-user data isolation, persistence, background audio guarantees
- SIP phone integration, production observability and rate limiting

## 4. Acceptance scenarios
1. Build Docker image and serve PWA over HTTPS.
2. iPhone Safari grants microphone permission and connects to Realtime.
3. Voice question "今何時？" triggers `run_skill(current-time)` and a spoken response.
4. Unknown skill names are rejected by the backend.
5. Browser never receives the standard OPENAI_API_KEY.

## 5. Operational prerequisites
An OpenAI API account/key with Realtime access; HTTPS reverse proxy; reachable OpenAI Realtime endpoints; iOS Safari microphone permissions.
