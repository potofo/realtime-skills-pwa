import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Azure OpenAI is used when AZURE_OPENAI_ENDPOINT is set; otherwise OpenAI.
const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/+$/, '');
const apiKey = azureEndpoint ? process.env.AZURE_OPENAI_API_KEY : process.env.OPENAI_API_KEY;
const apiBase = azureEndpoint ? `${azureEndpoint}/openai/v1` : 'https://api.openai.com/v1';
const authHeaders = azureEndpoint ? { 'api-key': apiKey } : { Authorization: `Bearer ${apiKey}` };
const realtimeModel = process.env.REALTIME_MODEL || 'gpt-realtime';
const realtimeUrl = `${apiBase}/realtime/calls`;
// OpenAI list prices in USD per 1M tokens (https://developers.openai.com/api/docs/pricing).
// For Azure deployments with custom names, set REALTIME_PRICING_MODEL to the underlying model name.
const realtimePricing = {
  'gpt-realtime-2.1': { textIn: 4, textCached: 0.4, textOut: 24, audioIn: 32, audioCached: 0.4, audioOut: 64 },
  'gpt-realtime-2.1-mini': { textIn: 0.6, textCached: 0.06, textOut: 2.4, audioIn: 10, audioCached: 0.3, audioOut: 20 },
  'gpt-realtime': { textIn: 4, textCached: 0.4, textOut: 16, audioIn: 32, audioCached: 0.4, audioOut: 64 },
  'gpt-realtime-mini': { textIn: 0.6, textCached: 0.06, textOut: 2.4, audioIn: 10, audioCached: 0.3, audioOut: 20 },
};
const pricing = realtimePricing[process.env.REALTIME_PRICING_MODEL || realtimeModel] ?? null;
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const dataExtensions = new Set(['.md', '.txt', '.csv', '.json']);
const maxReadChars = 12000;

// Demo only: add authentication and rate limiting before exposing on the Internet.
app.get('/api/config', async (_req, res) => {
  try {
    const instructions = await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8');
    const dirs = (await fs.readdir(path.join(root, 'skills'), { withFileTypes: true })).filter((d) => d.isDirectory());
    const skills = await Promise.all(dirs.map((d) => fs.readFile(path.join(root, 'skills', d.name, 'SKILL.md'), 'utf8')));
    res.json({ instructions: `${instructions}\n\nAvailable skills:\n${skills.join('\n\n')}`, model: realtimeModel, realtimeUrl, pricing });
  } catch { res.status(500).json({ error: 'Unable to load instructions' }); }
});

app.post('/api/token', async (_req, res) => {
  if (!apiKey) return res.status(500).json({ error: `${azureEndpoint ? 'AZURE_OPENAI_API_KEY' : 'OPENAI_API_KEY'} is missing` });
  try {
    const response = await fetch(`${apiBase}/realtime/client_secrets`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: { type: 'realtime', model: realtimeModel } }),
    });
    const data = await response.json();
    if (!response.ok || !data.value) return res.status(502).json({ error: data.error?.message || 'Token issuance failed' });
    res.json({ value: data.value });
  } catch { res.status(502).json({ error: 'OpenAI API is unreachable' }); }
});

// Text files under DATA_DIR (recursive); symlinks are skipped.
async function listDataFiles() {
  const entries = await fs.readdir(dataDir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && dataExtensions.has(path.extname(e.name).toLowerCase()))
    .map((e) => path.relative(dataDir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
}

// Resolve a model-supplied relative path, rejecting anything outside DATA_DIR.
async function resolveDataFile(file) {
  if (typeof file !== 'string' || !file) throw new Error('file is required');
  const resolved = await fs.realpath(path.resolve(dataDir, file)).catch(() => { throw new Error('file not found'); });
  const realDataDir = await fs.realpath(dataDir);
  if (!resolved.startsWith(realDataDir + path.sep) || !dataExtensions.has(path.extname(resolved).toLowerCase())) {
    throw new Error('file is not allowed');
  }
  return resolved;
}

const handlers = {
  'current-time': async () => ({ iso: new Date().toISOString(), timezone: 'UTC', note: 'ISO time in UTC' }),
  'data-list': async () => ({ files: (await listDataFiles()).slice(0, 200) }),
  'data-search': async ({ query }) => {
    const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) throw new Error('query is required');
    const hits = [];
    for (const file of await listDataFiles()) {
      const lines = (await fs.readFile(path.join(dataDir, file), 'utf8')).split(/\r?\n/);
      lines.forEach((line, i) => {
        const score = terms.filter((t) => line.toLowerCase().includes(t)).length;
        if (score) hits.push({ file, line: i + 1, score, text: lines.slice(Math.max(0, i - 1), i + 2).join('\n') });
      });
    }
    hits.sort((a, b) => b.score - a.score);
    return { query, results: hits.slice(0, 8).map(({ score, ...hit }) => hit) };
  },
  'data-read': async ({ file }) => {
    const content = await fs.readFile(await resolveDataFile(file), 'utf8');
    return { file, content: content.slice(0, maxReadChars), truncated: content.length > maxReadChars };
  },
};
app.post('/api/skills/:name', async (req, res) => {
  const handler = Object.hasOwn(handlers, req.params.name) ? handlers[req.params.name] : null;
  if (!handler) return res.status(404).json({ error: 'Unknown skill' });
  try { res.json(await handler(req.body || {})); } catch (error) { res.status(400).json({ error: error.message || 'Skill execution failed' }); }
});

app.use(express.static(path.join(root, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`Listening on ${port}`));
