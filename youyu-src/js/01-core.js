/* =========================================================
   01 · 基础工具、格式化、图标
   ========================================================= */
'use strict';

const APP_NAME = '有余';
const APP_VERSION = '6.5.34';
const IS_DESKTOP = document.documentElement.getAttribute('data-layout') === 'desktop';
const PC_HREF = 'pc/index.html';
const MOBILE_HREF = /\/pc\//.test(location.pathname) ? '../index.html' : 'index.html';
// 沿用旧存储键，避免改名后已有本地账本丢失
const STORE_KEY = 'yingji.portfolio.v1';
const DEMO_STORE_KEY = 'yingji.demo.v1';
const THEME_KEY = 'yingji.theme.v1';
const SCHEMA = 3;
const DAY_MS = 86400000;

const CURRENCY_META = {
  CNY:  { name: '人民币', symbol: '¥',   short: 'CNY', defaultRate: 1,     locale: 'zh-CN' },
  USD:  { name: '美元',   symbol: '$',   short: 'USD', defaultRate: 7.12,  locale: 'en-US' },
  HKD:  { name: '港币',   symbol: 'HK$', short: 'HKD', defaultRate: 0.912, locale: 'zh-HK' },
  JPY:  { name: '日元',   symbol: 'JP¥', short: 'JPY', defaultRate: 0.0475,locale: 'ja-JP' },
  EUR:  { name: '欧元',   symbol: '€',   short: 'EUR', defaultRate: 7.76,  locale: 'de-DE' },
  GBP:  { name: '英镑',   symbol: '£',   short: 'GBP', defaultRate: 9.08,  locale: 'en-GB' },
  USDT: { name: 'USDT',   symbol: '₮',  short: 'USDT',defaultRate: 7.11,  locale: 'en-US' }
};

const ASSET_CLASSES = {
  cash:      { name: '现金',       short: '现金', color: '#8e9aaf', group: 'cash' },
  moneyFund: { name: '货币基金',   short: '货基', color: '#43d6b0', group: 'cash' },
  bondFund:  { name: '债券基金',   short: '债基', color: '#5b8cff', group: 'income' },
  bond:      { name: '债券',       short: '债券', color: '#7c9cff', group: 'income' },
  deposit:   { name: '银行存款',   short: '定存', color: '#38bdf8', group: 'income' },
  equityFund:{ name: '股票基金',   short: '股基', color: '#ff9f45', group: 'equity' },
  stock:     { name: '股票',       short: '股票', color: '#ff5d6c', group: 'equity' },
  etf:       { name: 'ETF',        short: 'ETF',  color: '#b18cff', group: 'equity' },
  gold:      { name: '黄金',       short: '黄金', color: '#f2c45c', group: 'alt' },
  crypto:    { name: '加密资产',   short: '加密', color: '#f7931a', group: 'alt' },
  other:     { name: '其他',       short: '其他', color: '#9ca3af', group: 'other' }
};

const DEFAULT_ACCOUNT_TYPES = [
  { id: 'payment', name: '支付账户', color: '#1677ff', builtin: true },
  { id: 'cash',    name: '现金',     color: '#c69236', builtin: true },
  { id: 'bank',    name: '银行账户', color: '#c23b32', builtin: true },
  { id: 'fund',    name: '基金账户', color: '#ff6b35', builtin: true },
  { id: 'deposit', name: '存款',     color: '#6d7cff', builtin: true },
  { id: 'broker',  name: '证券账户', color: '#b18cff', builtin: true }
];

const DEFAULT_INSTRUMENT_TYPES = Object.keys(ASSET_CLASSES).map(id => ({
  id,
  name: ASSET_CLASSES[id].name,
  short: ASSET_CLASSES[id].short,
  color: ASSET_CLASSES[id].color,
  group: ASSET_CLASSES[id].group,
  builtin: true
}));

function defaultAccountTypes() { return DEFAULT_ACCOUNT_TYPES.map(t => Object.assign({}, t)); }
function defaultInstrumentTypes() { return DEFAULT_INSTRUMENT_TYPES.map(t => Object.assign({}, t)); }

const PALETTE = ['#ff9f45', '#5b8cff', '#b18cff', '#43d6b0', '#f2c45c', '#ff7aa2', '#7c9cff', '#ff5d6c', '#87c38f', '#c9a0ff'];
const GROUP_COLORS = ['#ff9f45', '#5b8cff', '#b18cff', '#43d6b0', '#f2c45c', '#ff7aa2', '#7c9cff', '#ff5d6c'];

function autoGroupColor(index) {
  const i = Number(index) || 0;
  const hue = (18 + i * 137.508) % 360;
  const light = 58 + (i % 3) * 4;
  return 'hsl(' + hue.toFixed(1) + ', 72%, ' + light + '%)';
}


/* ---------- basic ---------- */
function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function sum(arr, fn) { return (arr || []).reduce((s, x, i) => s + (fn ? Number(fn(x, i)) || 0 : Number(x) || 0), 0); }
function safeDiv(a, b, fallback) { return b ? a / b : (fallback === undefined ? 0 : fallback); }
function round(n, d) { const p = Math.pow(10, d || 0); return Math.round((Number(n) || 0) * p) / p; }
function uniq(arr) { return Array.from(new Set(arr || [])); }
function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
function applyTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  const theme = saved === 'light' || saved === 'dark'
    ? saved
    : (state && state.settings && state.settings.theme === 'light' ? 'light' : 'dark');
  if (state && state.settings) state.settings.theme = theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f5f7' : '#08090b');
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
}
function uid(prefix) { return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}
function stripHTML(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ''); }
function parseNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v == null ? '' : v).replace(/,/g, '').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function cleanText(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 80); }

/* ---------- date ---------- */
function pad2(n) { return String(n).padStart(2, '0'); }
function dateKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate());
}
function todayKey() { return dateKey(new Date()); }
function parseDay(key) {
  if (key instanceof Date) return new Date(key.getFullYear(), key.getMonth(), key.getDate(), 12);
  const p = String(key || '').slice(0, 10).split('-').map(Number);
  return new Date(p[0] || 1970, (p[1] || 1) - 1, p[2] || 1, 12);
}
function addDays(key, n) {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
function addMonths(key, n) {
  const d = parseDay(key);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return dateKey(d);
}
function daysBetween(a, b) {
  return Math.round((parseDay(b || todayKey()) - parseDay(a)) / DAY_MS);
}
function startOfMonth(key) {
  const d = parseDay(key);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-01';
}
function endOfMonth(key) {
  const d = parseDay(key);
  return dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
}
function daysInMonth(key) {
  const d = parseDay(key);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
function weekStart(key) {
  const d = parseDay(key);
  d.setDate(d.getDate() - d.getDay());
  return dateKey(d);
}
function weekdayCN(key) { return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][parseDay(key).getDay()]; }
function monthCN(key) { const d = parseDay(key); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月'; }
function monthShort(key) { return (parseDay(key).getMonth() + 1) + '月'; }
function shortDate(key) {
  const d = parseDay(key);
  return (d.getMonth() + 1) + '/' + d.getDate();
}
function cnDate(key) {
  const d = parseDay(key);
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}
function dateRangeLabel(start, end) {
  const a = parseDay(start), b = parseDay(end);
  if (a.getFullYear() !== b.getFullYear()) return dateKey(a).replace(/-/g, '.') + ' – ' + dateKey(b).replace(/-/g, '.');
  return (a.getMonth() + 1) + '.' + a.getDate() + ' – ' + (b.getMonth() + 1) + '.' + b.getDate();
}
function nowISO() { return new Date().toISOString(); }

/* ---------- currency ---------- */
function currencyMeta(ccy) { return CURRENCY_META[ccy] || CURRENCY_META.CNY; }
function baseCurrency() { return (state && state.settings && state.settings.base) || 'CNY'; }
function baseMeta() { return currencyMeta(baseCurrency()); }
function rateCNY(ccy) {
  if (!state || !state.rates) return currencyMeta(ccy).defaultRate;
  const r = Number(state.rates[ccy]);
  return Number.isFinite(r) && r > 0 ? r : currencyMeta(ccy).defaultRate;
}
function fxToBase(ccy, date) {
  const base = baseCurrency();
  if (!ccy || ccy === base) return 1;
  const cur = rateCNY(ccy) / rateCNY(base);
  if (!date || !state || !state.fxHistory || !state.fxHistory[ccy]) return cur;
  const hist = fxAt(ccy, date);
  const baseHist = base === 'CNY' ? 1 : fxAt(base, date);
  return baseHist ? hist / baseHist : cur;
}
function convert(amount, from, to) {
  if (!from || !to || from === to) return Number(amount) || 0;
  return (Number(amount) || 0) * fxToBase(from) / fxToBase(to);
}
function baseRateNow(ccy) { return fxToBase(ccy); }
function symbolFor(ccy) { return currencyMeta(ccy).symbol; }

/* ---------- format ---------- */
function groupedNumber(n, decimals) {
  const abs = Math.abs(Number(n) || 0);
  const d = decimals == null ? (abs >= 1000 ? 0 : 2) : decimals;
  return abs.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtNumber(n, opts) {
  const o = opts || {};
  const v = Number(n) || 0;
  const sign = o.sign === true ? (v > 0 ? '+' : v < 0 ? '-' : '') : (v < 0 ? '-' : '');
  const abs = Math.abs(v);
  let body;
  if (o.compact && abs >= 100000000) body = (abs / 100000000).toFixed(2).replace(/\.?0+$/, '') + '亿';
  else if (o.compact && abs >= 10000) body = (abs / 10000).toFixed(abs >= 1000000 ? 1 : 2).replace(/\.?0+$/, '') + '万';
  else {
    const decimals = o.decimals == null ? (abs >= 1000 ? 0 : 2) : o.decimals;
    body = abs.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  return sign + body;
}
function fmtMoney(n, opts) {
  const o = opts || {};
  const ccy = o.currency || baseCurrency();
  const v = Number(n) || 0;
  const sym = o.noSymbol ? '' : symbolFor(ccy);
  const sign = o.sign ? (v > 0 ? '+' : v < 0 ? '-' : '') : (v < 0 ? '-' : '');
  if (state && state.settings && state.settings.hideAmounts && !o.reveal) return sign + sym + '••••';
  const compact = o.compact && Math.abs(v) >= 10000 && !o.full;
  const body = fmtNumber(Math.abs(v), { decimals: o.decimals == null ? 2 : o.decimals, compact: compact });
  return sign + sym + (o.space === false ? '' : '') + body;
}
function fmtPct(v, digits, signed) {
  const n = Number(v) || 0;
  const d = digits == null ? 2 : digits;
  const sign = signed === false ? '' : (n > 0 ? '+' : '');
  return sign + (n * 100).toFixed(d) + '%';
}
function fmtPctPoint(v, digits, signed) {
  const n = Number(v) || 0;
  const d = digits == null ? 1 : digits;
  return ((signed !== false && n > 0) ? '+' : '') + n.toFixed(d) + '%';
}
function fmtQty(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000000) return fmtNumber(v, { compact: true, decimals: 2 });
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
}
function fmtPrice(n, ccy) {
  const v = Number(n) || 0;
  const d = Math.abs(v) < 10 ? 4 : 2;
  return (ccy ? symbolFor(ccy) : '') + v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: d });
}
function fmtCost(n, ccy) {
  const v = Number(n) || 0;
  return (ccy ? symbolFor(ccy) : '') + v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
function pnlClass(v) { return Number(v) > 0.000001 ? 'gain' : Number(v) < -0.000001 ? 'loss' : 'flat'; }
function pnlText(v, opts) {
  const o = opts || {};
  return fmtMoney(v, { sign: true, compact: o.compact, decimals: o.decimals, currency: o.currency });
}
function pctText(v, digits) { return fmtPct(v, digits == null ? 2 : digits, true); }
function shortAmount(v) {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '亿';
  if (abs >= 10000) return (n / 10000).toFixed(abs >= 100000 ? 0 : 1).replace(/\.0$/, '') + '万';
  if (abs >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.abs(n) < 10 ? n.toFixed(abs < 1 ? 2 : 1) : String(Math.round(n));
}
function moneyShort(v) {
  if (state && state.settings && state.settings.hideAmounts) return '•••';
  const n = Number(v) || 0;
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return sign + shortAmount(Math.abs(n));
}
function absMoneyShort(v) { return shortAmount(Math.abs(Number(v) || 0)); }

/* ---------- icons ---------- */
const ICONS = {
  wallet: '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 16.5z"/><path d="M3 9h16.5a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1-1.5 1.5H16a2.5 2.5 0 0 0 0 5h4"/><circle cx="16.5" cy="14.5" r=".6" fill="currentColor" stroke="none"/>',
  chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M7.5 15.5v-4"/><path d="M12 15.5V8"/><path d="M16.5 15.5v-6"/><path d="M21 6l-4.5 4.5-3-2L8 14"/>',
  pie: '<path d="M21 12a9 9 0 1 1-9-9v9z"/><path d="M12 3a9 9 0 0 1 9 9h-9z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/>',
  scale: '<path d="M12 3v18M5 7h14"/><path d="M5 7l-3 6h6zM19 7l-3 6h6z"/><path d="M3 13a3 3 0 0 0 6 0M15 13a3 3 0 0 0 6 0"/>',
  sliders: '<path d="M4 6h8M16 6h4M4 12h3M11 12h9M4 18h10M18 18h2"/><circle cx="14" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 6.5"/>',
  chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  chevronDown: '<path d="M5 9l7 7 7-7"/>',
  chevronUp: '<path d="M5 15l7-7 7 7"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowUpRight: '<path d="M7 17L17 7M8 7h9v9"/>',
  arrowDownLeft: '<path d="M17 7L7 17M16 17H7V8"/>',
  arrowDown: '<path d="M12 4v16M6 14l6 6 6-6"/>',
  arrowUp: '<path d="M12 20V4M6 10l6-6 6 6"/>',
  swap: '<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/>',
  eye: '<path d="M2.3 12S5.8 5.5 12 5.5 21.7 12 21.7 12 18.2 18.5 12 18.5 2.3 12 2.3 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 6.7A9.8 9.8 0 0 1 12 6.5c5.8 0 9.4 5.5 9.4 5.5a17.4 17.4 0 0 1-3 3.7M6.3 8.2A17 17 0 0 0 2.6 12S6.2 18.5 12 18.5a9.8 9.8 0 0 0 4.6-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  more: '<circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  edit: '<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.7"/><path d="M20 4v7h-7"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  filter: '<path d="M4 5h16l-6.5 7.5V19l-3 1v-7.5z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 19h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<path d="M12 3l9 16H3z"/><path d="M12 9v4M12 16h.01"/>',
  sparkles: '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z"/>',
  coins: '<ellipse cx="9" cy="6" rx="5.5" ry="2.5"/><path d="M3.5 6v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V6"/><path d="M3.5 10v4c0 1.4 2.5 2.5 5.5 2.5 1 0 2-.2 2.8-.5"/><path d="M14.5 11.5c2.5.2 4.5 1.2 4.5 2.5v4c0 1.4-2.5 2.5-5.5 2.5s-5.5-1.1-5.5-2.5v-4c0-1.2 1.6-2.1 4-2.4"/>',
  bank: '<path d="M3 9l9-5 9 5"/><path d="M4 10v8M9 10v8M15 10v8M20 10v8M2 20h20M3 9h18"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4M9 13h6M9 17h6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/>',
  flag: '<path d="M5 21V4M5 5h10l-1.4 3L19 11H5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5z"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10h.01M18 14h.01"/>',
  fund: '<path d="M4 19V9M9 19V5M14 19v-7M19 19V8"/><path d="M3 21h18"/>',
  stock: '<path d="M4 18l5-7 4 3 7-9"/><path d="M15 5h5v5"/>',
  deposit: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  trendUp: '<path d="M4 17l6-6 4 4 6-8"/><path d="M14 7h6v6"/>',
  percent: '<path d="M19 5L5 19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'
};
function icon(name, cls) {
  const path = ICONS[name] || ICONS.info;
  return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>';
}

/* ---------- DOM ---------- */
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function setHTML(el, html) { if (el) el.innerHTML = html; }
function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts); }
function stop(ev) { if (ev) { ev.preventDefault(); ev.stopPropagation(); } }

/* ---------- tiny deterministic RNG ---------- */
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function gaussian(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
