# Basic specification / 基本仕様書

## 1. Objective
Build a minimal iPhone-installable PWA capable of low-latency English or Japanese speech-to-speech interaction with GPT-Realtime and invoking Agent Skills defined by `SKILL.md` files. The sample use case is a phone order desk for the fictional pizza shop "Comet Pizza".

## 2. Requirements
| ID | Requirement | Implementation |
|---|---|---|
| R-01 | One Docker container | Multi-stage Dockerfile, one runtime image; runs with Docker Compose or `wslc` |
| R-02 | One Node.js backend process | Express serves PWA and API |
| R-03 | One AI model | One GPT-Realtime model selected by `REALTIME_MODEL` (e.g. `gpt-realtime`, `gpt-realtime-2.1`, `gpt-realtime-2.1-mini`); no secondary reasoning agent |
| R-04 | iPhone PWA | Web manifest + Safari + HTTPS; also works in desktop Chrome as a web page |
| R-05 | Realtime speech | Browser Agents SDK (`@openai/agents`) + WebRTC |
| R-06 | Skill invocation | Agent calls `run_skill`, browser forwards to allowlisted backend endpoint |
| R-07 | Instruction files | `AGENTS.md` and every `skills/*/SKILL.md` (loaded automatically) |
| R-08 | API key protection | Server issues ephemeral Realtime client secrets; the standard key never reaches the browser |
| R-09 | Extensibility | Add a `skills/<name>/SKILL.md`, extend the tool schema, and register a handler |
| R-10 | API provider | OpenAI, or Azure OpenAI when `AZURE_OPENAI_ENDPOINT` is set (model = deployment name) |
| R-11 | Data folder Q&A | Host `data/` mounted read-only at `/data`; agent can list, search, and read `.md` / `.txt` / `.csv` / `.json` files |
| R-12 | UI language | English / Japanese selector; default follows the browser language; the agent replies in the selected language |
| R-13 | Voice selection | User selects the voice (`marin`, `cedar`, `alloy`, …) before connecting; the voice name is also used as the staff name |
| R-14 | Session meter | Connected time counts up; estimated API cost is shown in USD (English) or JPY at 1 USD = 160 JPY (Japanese) |
| R-15 | Phone order skill | `comet-pizza-order` skill greets with shop and staff name and takes an order using `data/comet-pizza-menu.md` |

## 3. Out of scope (MVP)
- Arbitrary shell execution, full Agent Skills standard runtime, dynamic tool registration
- Login/SSO, multi-user data isolation, persistence, background audio guarantees
- Sending orders to a real kitchen or POS system; server-side price calculation
- SIP phone integration, production observability and rate limiting
- Exact billing: the on-screen cost is an estimate from list prices

## 4. Acceptance scenarios
1. Build the image and serve the PWA over HTTPS (or `http://localhost` for local testing).
2. iPhone Safari grants microphone permission and connects to Realtime.
3. After connecting, the agent speaks first and introduces Comet Pizza and its staff name.
4. The agent takes a pizza order (size, toppings, sides, drinks, set suggestion) and reads back the order and total once.
5. Voice question "今何時？" / "What time is it?" triggers `run_skill(current-time)` and a spoken response.
6. A question about the data folder triggers `data-search` / `data-read` and is answered from the file content.
7. Unknown skill names are rejected by the backend (404); paths outside the data folder are rejected (400).
8. Switching the language before connecting changes both the UI text and the agent's reply language.
9. While connected, the elapsed time increases every second and the cost increases after each response.
10. With `AZURE_OPENAI_ENDPOINT` set, tokens are issued by Azure OpenAI and WebRTC connects to the Azure endpoint.
11. Browser never receives `OPENAI_API_KEY` or `AZURE_OPENAI_API_KEY`.

## 5. Operational prerequisites
An OpenAI API key with Realtime access, or an Azure OpenAI resource with a Realtime model deployment; HTTPS reverse proxy; reachable Realtime endpoints; iOS Safari microphone permissions.
