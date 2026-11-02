# Realtime Skills PWA - minimal demonstration

One Docker container, one Node.js backend process, one GPT-Realtime agent. The PWA uses WebRTC to communicate with OpenAI; its SDK function tool calls the Node backend to run an allowlisted skill. This is **not** the SDK automatically executing arbitrary Agent Skills; `AGENTS.md` and `SKILL.md` are loaded as instructions, and a separately coded tool executes each skill.

## Start

```sh
cp .env.example .env
# Edit .env and set OPENAI_API_KEY
docker compose up --build -d
```

### Start with wslc (WSL Container CLI)

On Windows, you can build and run the container with `wslc` instead of Docker. `wslc` does not read `docker-compose.yaml`, so pass the equivalent options explicitly (PowerShell):

```powershell
Copy-Item .env.example .env
# Edit .env and set OPENAI_API_KEY (or the Azure OpenAI settings)
wslc build -t realtime-skills-pwa .
wslc run -d --name realtime-skills --env-file .env -p 127.0.0.1:3000:3000 -v "${PWD}\data:/data:ro" realtime-skills-pwa
```

Check logs, stop, and remove:

```powershell
wslc logs realtime-skills
wslc stop realtime-skills
wslc remove realtime-skills
```

`wslc run` has no restart policy option, so unlike Compose (`restart: unless-stopped`) the container is not restarted automatically. Run `wslc start realtime-skills` to start it again.

The Compose port is bound to 127.0.0.1:3000. For iPhone, publish it through your existing **HTTPS reverse proxy** with access control; open the HTTPS URL in Safari, allow microphone access, then tap `通話開始`. Use Safari Share > Add to Home Screen for PWA. Try saying "今何時？".

## Data folder

The host `data/` folder is mounted read-only at `/data` in the container (`DATA_DIR`). The agent can list, search, and read `.md`, `.txt`, `.csv`, and `.json` files there through the `data-list`, `data-search`, and `data-read` skills (`skills/data-files/SKILL.md`). Try asking "カフェの土曜日の営業時間は？" or "サーモスタットのE3エラーの対処法は？".

The sample files in `data/` are fictional content written for this project and released into the public domain (CC0 1.0). Replace them with your own files; the image does not include `data/`, so changes take effect without rebuilding. Paths outside the data folder are rejected.

## Directory

- `src/main.js`: browser RealtimeAgent / WebRTC and `run_skill` tool
- `server.js`: single Express backend; ephemeral tokens, config, allowlisted skill handler, static hosting
- `AGENTS.md`: agent-wide instructions
- `skills/current-time/SKILL.md`: example skill instructions
- `architecture.svg`: architecture diagram
- `BASIC_SPEC.md`: requirements
- `BASIC_DESIGN.md`: design

## Security / constraints

**Demonstration only; do not expose to the public Internet as-is.** Add authentication, rate limiting, per-user tool authorization, CSRF protections as applicable, and audit logging. A browser tool call is not a security boundary. Never expose `OPENAI_API_KEY` to the browser. The temporary client secret is short lived but must still be protected. Restrict API and skill endpoints at the reverse proxy. Do not run arbitrary shell commands from `SKILL.md`.

The current example uses one fixed allowlisted skill, not automatic discovery and execution of arbitrary skill scripts. The PWA manifest intentionally omits install icons to keep the demo minimal; add icons for polished installation. iOS may suspend audio when backgrounded or the screen is locked. Reconnect after session expiry/disconnection. The example has not been end-to-end verified with an OpenAI API key in this environment.

## Reference

- https://openai.github.io/openai-agents-js/ja/guides/voice-agents/quickstart/
- https://openai.github.io/openai-agents-js/guides/voice-agents/transport/

## Model note
The default model is `gpt-realtime` for broad compatibility. Set `REALTIME_MODEL` and the matching model in `src/main.js` if your account supports a newer model. The demo is not verified against a live API key.
