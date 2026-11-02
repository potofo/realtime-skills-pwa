---
name: current-time
description: Get the current UTC time from the server.
---
# Current Time

When asked about the current time, call `run_skill` with `skill_name` set to `current-time`.
The returned ISO timestamp is UTC. Convert it to Japan Standard Time (UTC+09:00) if the user requests Japan time.
