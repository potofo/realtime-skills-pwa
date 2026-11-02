import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';
import { tool } from '@openai/agents';
import { z } from 'zod';
import './style.css';

const start = document.querySelector('#start');
const stop = document.querySelector('#stop');
const status = document.querySelector('#status');
const voice = document.querySelector('#voice');
const lang = document.querySelector('#lang');
const elapsed = document.querySelector('#elapsed');
const cost = document.querySelector('#cost');
let session = null;

const JPY_PER_USD = 160;
const messages = {
  en: {
    language: 'Language', voice: 'Voice', start: 'Start call', stop: 'End', elapsed: 'Connected time', cost: 'Estimated API cost',
    idle: 'Not connected', connecting: 'Connecting...', connected: 'Connected: start speaking', disconnected: 'Disconnected',
    error: 'Error', fetchFailed: 'Failed to get configuration or token',
    hint: 'Ask "What time is it?" or about the files in the data folder.',
    costNote: 'Cost is estimated from token usage reported by the API (list prices, excluding tax).',
    respond: 'Respond naturally in English.',
  },
  ja: {
    language: '言語', voice: '音声', start: '通話開始', stop: '終了', elapsed: '接続時間', cost: 'API利用料金（概算）',
    idle: '未接続', connecting: '接続中...', connected: '接続中：話しかけてください', disconnected: '切断しました',
    error: 'エラー', fetchFailed: '設定またはトークンの取得に失敗しました',
    hint: '「今何時？」やデータフォルダー内のファイルについて話しかけてください。',
    costNote: `料金はAPIが返すトークン使用量から算出した概算です（定価・税別、1ドル=${JPY_PER_USD}円換算）。`,
    respond: 'Respond naturally in Japanese.',
  },
};
const t = (key) => messages[lang.value][key];

function restore(select, key, fallback) {
  try { select.value = localStorage.getItem(key) || fallback; } catch { select.value = fallback; }
  if (!select.value) select.selectedIndex = 0;
  select.addEventListener('change', () => { try { localStorage.setItem(key, select.value); } catch {} });
}
restore(voice, 'voice', voice.value);
restore(lang, 'lang', navigator.language?.toLowerCase().startsWith('ja') ? 'ja' : 'en');

// Status is stored as a key so it can be re-rendered when the language changes.
let statusKey = 'idle';
let statusDetail = '';
function setStatus(key, detail = '') { statusKey = key; statusDetail = detail; status.textContent = detail ? `${t(key)}: ${detail}` : t(key); }
function renderLanguage() {
  document.documentElement.lang = lang.value;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  setStatus(statusKey, statusDetail);
  renderCost();
}
lang.addEventListener('change', renderLanguage);

// Connected time and cost meter.
let startedAt = 0;
let timer = null;
let pricing = null;
let usd = 0;
function renderElapsed() {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const h = Math.floor(seconds / 3600);
  const mmss = `${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  elapsed.textContent = h ? `${h}:${mmss}` : mmss;
}
function renderCost() {
  if (!pricing) { cost.textContent = '-'; return; }
  cost.textContent = lang.value === 'ja'
    ? `¥${(usd * JPY_PER_USD).toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${usd.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}
// Prices are USD per 1M tokens; usage comes from each response.done event.
function addUsage(usage) {
  const input = usage.input_token_details || {};
  const cached = input.cached_tokens_details || {};
  const output = usage.output_token_details || {};
  const tokens = {
    textIn: (input.text_tokens || 0) - (cached.text_tokens || 0), textCached: cached.text_tokens || 0,
    audioIn: (input.audio_tokens || 0) - (cached.audio_tokens || 0), audioCached: cached.audio_tokens || 0,
    textOut: output.text_tokens || 0, audioOut: output.audio_tokens || 0,
  };
  usd += Object.entries(tokens).reduce((sum, [k, n]) => sum + (n * (pricing[k] || 0)) / 1e6, 0);
  renderCost();
}
function startMeter(config) {
  pricing = config.pricing;
  usd = 0;
  startedAt = Date.now();
  renderElapsed();
  renderCost();
  timer = setInterval(renderElapsed, 1000);
}
function stopMeter() { clearInterval(timer); timer = null; }

function resetControls() {
  stopMeter();
  stop.disabled = true; start.disabled = false; voice.disabled = false; lang.disabled = false;
}

const runSkill = tool({
  name: 'run_skill',
  description: 'Execute an allowlisted server-side skill. Available: current-time, data-list, data-search, data-read.',
  parameters: z.object({
    skill_name: z.enum(['current-time', 'data-list', 'data-search', 'data-read']),
    query: z.string().nullable().describe('English keywords for data-search; otherwise null'),
    file: z.string().nullable().describe('Relative file path from data-list for data-read; otherwise null'),
  }),
  execute: async ({ skill_name, query, file }) => {
    const response = await fetch(`/api/skills/${encodeURIComponent(skill_name)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, file }),
    });
    if (!response.ok) throw new Error(`Skill failed: ${response.status} ${(await response.json().catch(() => ({}))).error || ''}`);
    return JSON.stringify(await response.json());
  },
});

start.addEventListener('click', async () => {
  start.disabled = true;
  voice.disabled = true;
  lang.disabled = true;
  setStatus('connecting');
  try {
    const [configResponse, tokenResponse] = await Promise.all([
      fetch('/api/config'), fetch('/api/token', { method: 'POST' }),
    ]);
    if (!configResponse.ok || !tokenResponse.ok) throw new Error(t('fetchFailed'));
    const config = await configResponse.json();
    const token = await tokenResponse.json();
    const staffName = voice.value.charAt(0).toUpperCase() + voice.value.slice(1);
    const instructions = `${config.instructions}\n\nConversation language: ${t('respond')}\nYour staff name: ${staffName}`;
    const agent = new RealtimeAgent({ name: 'RealtimeSkills', instructions, tools: [runSkill], voice: voice.value });
    session = new RealtimeSession(agent, { model: config.model });
    session.on('transport_event', (event) => {
      if (event.type === 'response.done' && event.response?.usage && pricing) addUsage(event.response.usage);
    });
    await session.connect({ apiKey: token.value, url: config.realtimeUrl });
    session.transport.on('connection_change', (state) => {
      if (state === 'disconnected' && session) { session = null; resetControls(); setStatus('disconnected'); }
    });
    startMeter(config);
    setStatus('connected');
    // Let the agent speak first so it can greet the customer.
    session.transport.sendEvent({ type: 'response.create' });
    stop.disabled = false;
  } catch (error) {
    session?.close(); session = null;
    resetControls();
    setStatus('error', error.message);
  }
});
stop.addEventListener('click', () => {
  const current = session;
  session = null;
  current?.close();
  resetControls();
  setStatus('disconnected');
});

renderLanguage();
