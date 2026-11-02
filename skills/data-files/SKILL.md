---
name: data-files
description: Answer questions using text files in the mounted data folder.
---
# Data Files

The server exposes a read-only data folder (`.md`, `.txt`, `.csv`, `.json`). Use it when the user asks about its contents, documents, or any topic the files may cover.

- `data-list`: call `run_skill` with `skill_name` = `data-list` (`query` and `file` = null) to get the relative paths of all files.
- `data-search`: call `run_skill` with `skill_name` = `data-search` and `query` set to space-separated **English** keywords (if the user speaks another language, translate the question into English keywords; the files are in English). Returns matching lines with file names and line numbers.
- `data-read`: call `run_skill` with `skill_name` = `data-read` and `file` set to a path returned by `data-list` or `data-search` to get the file content.

Typical flow: search first; if the snippets are not enough, read the relevant file. If you do not know which files exist, list them.
Answer in the conversation language based only on the returned content, and mention which file the answer came from. If nothing relevant is found, say so instead of guessing.
