/* =========================================================
   12b · 行情匹配 / 搜索 / 报价同步
   数据源：新浪财经搜索（JSONP）+ 腾讯行情（CORS）
   ========================================================= */
const MARKET_SEARCH_TYPES = '11,21,22,23,31,41,81,201,202,203';
let marketSearchSeq = 0;

function marketFundClass(name) {
  const n = String(name || '');
  if (/货币|现金|理财|余额/.test(n)) return 'moneyFund';
  if (/债|固收|稳健|短债|纯债|存单/.test(n)) return 'bondFund';
  return 'equityFund';
}
function marketMetaFromSina(fields) {
  const type = String(fields[1] || '');
  const code = String(fields[2] || '').trim();
  const qcode = String(fields[3] || '').trim();
  let name = String(fields[4] || fields[0] || '').trim();
  if (!code || !qcode || !name) return null;
  if (MARKET_SEARCH_TYPES.split(',').indexOf(type) < 0) return null;
  let quoteCode = qcode;
  let marketType = '';
  let label = '';
  let currency = 'CNY';
  let cls = 'stock';
  let symbol = code;
  if (type === '41') {
    marketType = 'US';
    label = '美股';
    currency = 'USD';
    symbol = code.toUpperCase();
    quoteCode = 'us' + code.replace(/\..*$/, '').toUpperCase();
    cls = /ETF|指数|S&P|VANGUARD|ISHARES|SPDR|INVESCO/i.test(name) ? 'etf' : 'stock';
  } else if (type === '31') {
    marketType = 'HK';
    label = '港股';
    currency = 'HKD';
    quoteCode = 'hk' + code;
    cls = /ETF|指数/i.test(name) ? 'etf' : 'stock';
  } else if (qcode.indexOf('of') === 0) {
    marketType = 'FUND';
    label = '场外基金';
    quoteCode = 'jj' + code;
    cls = marketFundClass(name);
  } else if (qcode.indexOf('sh') === 0 || qcode.indexOf('sz') === 0) {
    marketType = type === '81' ? 'BOND' : (/ETF|LOF/i.test(name) || ['22', '23', '202', '203'].indexOf(type) >= 0 ? 'ETF' : 'A');
    label = type === '81' ? '债券' : (marketType === 'ETF' ? '场内基金' : 'A股');
    if (type === '81') cls = 'bond';
    else if (marketType === 'ETF') cls = /债|国债|转债|信用债/.test(name) ? 'bondFund' : 'etf';
    else cls = 'stock';
  } else {
    return null;
  }
  if (marketType === 'A' && (/^sh000/.test(quoteCode) || /^sz399/.test(quoteCode))) return null;
  return {
    provider: 'tencent', code: quoteCode, marketType, label, symbol, name,
    currency, cls, sourceType: type
  };
}
function parseSinaSuggest(raw, query) {
  const q = String(query || '').trim().toLowerCase();
  const map = new Map();
  String(raw || '').split(';').forEach(part => {
    if (!part) return;
    const fields = part.split(',');
    const meta = marketMetaFromSina(fields);
    if (!meta) return;
    const existing = map.get(meta.code);
    if (!existing) { map.set(meta.code, meta); return; }
    const rank = q => q.indexOf('sh') === 0 || q.indexOf('sz') === 0 ? 2 : q.indexOf('of') === 0 ? 1 : 0;
    if (rank(meta.code) > rank(existing.code)) map.set(meta.code, meta);
  });
  const priority = { A: 1, FUND: 2, ETF: 3, US: 4, HK: 5, BOND: 6 };
  const score = meta => {
    if (!q) return 0;
    const name = String(meta.name || '').toLowerCase();
    const sym = String(meta.symbol || '').toLowerCase();
    let n = 0;
    if (sym === q || name === q) n += 200;
    if (sym.indexOf(q) === 0) n += 80;
    if (name.indexOf(q) === 0) n += 60;
    else if (name.indexOf(q) >= 0) n += 30;
    if (String(meta.code || '').toLowerCase().indexOf(q) >= 0) n += 20;
    return n;
  };
  return Array.from(map.values()).sort((a, b) => (score(b) - score(a)) || ((priority[a.marketType] || 9) - (priority[b.marketType] || 9))).slice(0, 10);
}
function marketSearch(query) {
  const q = String(query || '').trim();
  if (!q) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const seq = ++marketSearchSeq;
    const script = document.createElement('script');
    script.charset = 'gbk';
    script.src = 'https://suggest3.sinajs.cn/suggest/type=' + MARKET_SEARCH_TYPES + '&key=' + encodeURIComponent(q) + '&_=' + Date.now();
    let settled = false;
    const cleanup = () => { try { script.remove(); } catch (e) {} };
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      if (seq !== marketSearchSeq) { resolve([]); return; }
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('行情搜索超时')), 9000);
    script.onload = () => {
      const raw = window.suggestvalue || '';
      finish(resolve, parseSinaSuggest(raw, q));
    };
    script.onerror = () => finish(reject, new Error('行情搜索不可用'));
    document.head.appendChild(script);
  });
}
async function fetchTencentQuote(market) {
  if (!market || !market.code) throw new Error('未绑定行情代码');
  const res = await fetch('https://qt.gtimg.cn/q=' + encodeURIComponent(market.code) + '&_=' + Date.now(), {
    cache: 'no-store',
    mode: 'cors'
  });
  if (!res.ok) throw new Error('行情请求失败');
  let text = '';
  try {
    const buffer = await res.arrayBuffer();
    text = new TextDecoder('gbk').decode(buffer);
  } catch (e) {
    text = await res.text();
  }
  const m = text.match(/="([^"]*)"/);
  if (!m) throw new Error('未找到行情数据');
  const f = m[1].split('~');
  let price = 0, time = '', changePct = 0, prevClose = 0;
  if (market.code.indexOf('jj') === 0) {
    price = Number(f[5]);
    time = f[8] || '';
    changePct = Number(f[7]) || 0;
  } else {
    price = Number(f[3]);
    prevClose = Number(f[4]);
    time = f[30] || '';
    changePct = Number(f[32]) || 0;
  }
  if (!(price > 0)) throw new Error('行情价格无效');
  return { price, prevClose, changePct, time, name: f[1] || market.name, currency: market.currency };
}
function normalizeMarketTime(t) {
  const s = String(t || '').trim();
  if (/^\d{14}$/.test(s)) return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8) + ' ' + s.slice(8, 10) + ':' + s.slice(10, 12);
  return s;
}
function quoteDateFrom(time) {
  const s = normalizeMarketTime(time);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return todayKey();
  return m[1] > todayKey() ? todayKey() : m[1];
}
async function refreshQuoteForInstrument(id, opts) {
  const o = opts || {};
  const found = instrumentById(id);
  if (!found) return false;
  const market = found.market;
  if (!market || !market.code) { if (!o.silent) toast('该标的还没有绑定行情代码', 'error'); return false; }
  if (!o.silent) toast('正在同步行情…');
  try {
    const quote = await fetchTencentQuote(market);
    const account = accountById(found.accountId);
    const actual = account ? account.instruments.find(x => x.id === id) : null;
    if (!actual) return false;
    const date = quoteDateFrom(quote.time);
    upsertPricePoint(id, date, quote.price, 'market');
    actual.market = Object.assign({}, actual.market, {
      lastPrice: quote.price,
      lastUpdated: normalizeMarketTime(quote.time),
      lastQuoteDate: date,
      changePct: quote.changePct
    });
    saveState();
    if (!o.silent) {
      toast('行情已更新 ' + fmtPrice(quote.price, actual.currency), 'success');
      refreshPage();
    }
    return true;
  } catch (e) {
    console.warn('行情同步失败', e);
    if (!o.silent) toast('行情获取失败，请稍后再试', 'error');
    return false;
  }
}
async function autoRefreshMarketQuotes() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const last = Date.parse((state.meta && state.meta.marketSyncedAt) || '');
  if (Number.isFinite(last) && Date.now() - last < 30 * 60 * 1000) return;
  const list = [];
  accounts().forEach(a => (a.instruments || []).forEach(i => { if (i.market && i.market.code) list.push(i.id); }));
  if (!list.length) return;
  let changed = false;
  for (const id of list) {
    const ok = await refreshQuoteForInstrument(id, { silent: true });
    changed = changed || ok;
    await new Promise(resolve => setTimeout(resolve, 220));
  }
  state.meta = state.meta || {};
  state.meta.marketSyncedAt = nowISO();
  saveState();
  if (changed && !document.querySelector('.overlay')) refreshPage();
}
