/* =========================================================
   12b · 行情匹配 / 搜索 / 报价同步
   数据源：新浪财经搜索（JSONP）+ 腾讯行情（CORS）
   ========================================================= */
const MARKET_SEARCH_TYPES = '11,21,22,23,31,41,81,201,202,203';
const SGE_AU9999 = { provider: 'eastmoney', code: '118.au9999', marketType: 'SGE', label: '上金所', symbol: 'AU9999', name: '黄金9999', currency: 'CNY', cls: 'gold' };
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
  if (/au9999|黄金9999|沪金|上金所/i.test(q)) return Promise.resolve([Object.assign({}, SGE_AU9999)]);
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
async function fetchEastmoneySgeQuote(market) {
  const res = await fetch('https://push2.eastmoney.com/api/qt/stock/get?secid=' + encodeURIComponent(market.code) + '&fields=f43,f57,f58,f60,f86,f170&_=' + Date.now(), { cache: 'no-store', mode: 'cors' });
  if (!res.ok) throw new Error('上金所行情请求失败');
  const json = await res.json();
  const d = json && json.data;
  if (!d || !(Number(d.f43) > 0)) throw new Error('上金所行情为空');
  const price = Number(d.f43) / 100;
  const prevClose = Number(d.f60) / 100;
  const changePct = Number(d.f170) / 100;
  const ts = Number(d.f86);
  let time = '';
  if (ts > 0) {
    const dt = new Date(ts * 1000);
    time = dateKey(dt) + ' ' + pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()) + ':' + pad2(dt.getSeconds());
  }
  return { price, prevClose, changePct, time, name: d.f58 || market.name, currency: market.currency || 'CNY' };
}
async function fetchEastmoneySgeHistory(market) {
  const res = await fetch('https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=' + encodeURIComponent(market.code) + '&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58&klt=101&fqt=0&beg=0&end=20500101&lmt=2500&_=' + Date.now(), { cache: 'no-store', mode: 'cors' });
  if (!res.ok) throw new Error('上金所历史行情请求失败');
  const json = await res.json();
  const rows = json && json.data && json.data.klines;
  if (!Array.isArray(rows) || !rows.length) throw new Error('上金所历史行情为空');
  return rows.map(row => {
    const f = String(row).split(',');
    return [f[0], Number(f[2])];
  }).filter(x => x[0] && x[1] > 0);
}
async function fetchTencentQuote(market) {
  if (!market || !market.code) throw new Error('未绑定行情代码');
  if (market.provider === 'eastmoney' || market.marketType === 'SGE') return fetchEastmoneySgeQuote(market);
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
      if (!actual.market.historyLoaded) setTimeout(() => ensureInstrumentHistory(id), 120);
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

/* ---------- historical price series ---------- */
let historySeq = 0;
const historyLoadingIds = new Set();
async function fetchTencentHistory(market) {
  const url = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=' + encodeURIComponent(market.code + ',day,,,2000,qfq');
  const res = await fetch(url, { cache: 'no-store', mode: 'cors' });
  if (!res.ok) throw new Error('历史行情请求失败');
  const json = await res.json();
  const node = json && json.data && json.data[market.code];
  const rows = (node && (node.qfqday || node.day)) || [];
  return rows.map(row => [row[0], Number(row[2])]).filter(x => x[0] && x[1] > 0);
}
function fetchSinaUSHistory(market) {
  return new Promise((resolve, reject) => {
    const seq = ++historySeq;
    const cb = '__marketHistory_' + seq;
    const symbol = String(market.symbol || market.code.replace(/^us/i, '')).toLowerCase();
    const script = document.createElement('script');
    script.charset = 'gbk';
    script.src = 'https://stock.finance.sina.com.cn/usstock/api/jsonp.php/var%20' + cb + '=/US_MinKService.getDailyK?symbol=' + encodeURIComponent(symbol) + '&scale=240&datalen=2500';
    let settled = false;
    const cleanup = () => { try { script.remove(); } catch (e) {} try { delete window[cb]; } catch (e) {} };
    const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(timer); cleanup(); fn(value); };
    const timer = setTimeout(() => finish(reject, new Error('美股历史行情超时')), 15000);
    script.onload = () => {
      const rows = window[cb];
      if (!Array.isArray(rows)) { finish(reject, new Error('美股历史行情为空')); return; }
      finish(resolve, rows.map(r => [r.d, Number(r.c)]).filter(x => x[0] && x[1] > 0));
    };
    script.onerror = () => finish(reject, new Error('美股历史行情不可用'));
    document.head.appendChild(script);
  });
}
function fetchFundHistory(market) {
  return new Promise((resolve, reject) => {
    const seq = ++historySeq;
    const digits = String(market.code || '').replace(/^jj/i, '');
    if (!/^\d{6}$/.test(digits)) { reject(new Error('基金代码无效')); return; }
    const script = document.createElement('script');
    script.charset = 'utf-8';
    script.src = 'https://fund.eastmoney.com/pingzhongdata/' + digits + '.js?v=' + Date.now();
    let settled = false;
    const cleanup = () => { try { script.remove(); } catch (e) {} };
    const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(timer); cleanup(); fn(value); };
    const timer = setTimeout(() => finish(reject, new Error('基金历史净值超时')), 20000);
    script.onload = () => {
      const rows = window.Data_netWorthTrend;
      if (!Array.isArray(rows)) { finish(reject, new Error('基金历史净值为空')); return; }
      finish(resolve, rows.map(r => [new Date(r.x).toISOString().slice(0, 10), Number(r.y)]).filter(x => x[0] && x[1] > 0));
      try { delete window.Data_netWorthTrend; } catch (e) {}
    };
    script.onerror = () => finish(reject, new Error('基金历史净值不可用'));
    document.head.appendChild(script);
  });
}
function fetchSinaCNHistory(market) {
  return new Promise((resolve, reject) => {
    const seq = ++historySeq;
    const cb = '__cnHistory_' + seq;
    const symbol = String(market.code || '');
    if (!/^(sh|sz)/.test(symbol)) { reject(new Error('A股代码无效')); return; }
    const script = document.createElement('script');
    script.charset = 'gbk';
    script.src = 'https://quotes.sina.cn/cn/api/jsonp_v2.php/var%20' + cb + '=/CN_MarketDataService.getKLineData?symbol=' + encodeURIComponent(symbol) + '&scale=240&ma=no&datalen=1023';
    let settled = false;
    const cleanup = () => { try { script.remove(); } catch (e) {} try { delete window[cb]; } catch (e) {} };
    const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(timer); cleanup(); fn(value); };
    const timer = setTimeout(() => finish(reject, new Error('A股历史行情超时')), 15000);
    script.onload = () => {
      const rows = window[cb];
      if (!Array.isArray(rows)) { finish(reject, new Error('A股历史行情为空')); return; }
      finish(resolve, rows.map(r => [r.day, Number(r.close)]).filter(x => x[0] && x[1] > 0));
    };
    script.onerror = () => finish(reject, new Error('A股历史行情不可用'));
    document.head.appendChild(script);
  });
}
async function ensureInstrumentHistory(id, opts) {
  const o = opts || {};
  const found = instrumentById(id);
  if (!found || !found.market || !found.market.code) return false;
  const actual = (accountById(found.accountId) || { instruments: [] }).instruments.find(x => x.id === id);
  if (actual && actual.market && actual.market.marketType === 'SGE' && actual.market.historyVersion !== 2) {
    actual.market.historyLoaded = false;
    state.prices[id] = (state.prices[id] || []).filter(p => p[2] !== 'market');
  }
  if (!actual || actual.market.historyLoaded || historyLoadingIds.has(id)) return !!(actual && actual.market.historyLoaded);
  historyLoadingIds.add(id);
  try {
    let rows = [];
    const code = actual.market.code;
    if (actual.market.provider === 'eastmoney' || actual.market.marketType === 'SGE') rows = await fetchEastmoneySgeHistory(actual.market);
    else if (code.indexOf('jj') === 0) rows = await fetchFundHistory(actual.market);
    else if (code.indexOf('us') === 0) rows = await fetchSinaUSHistory(actual.market);
    else if (/^(sh|sz)/.test(code)) {
      try { rows = await fetchSinaCNHistory(actual.market); } catch (e) { rows = await fetchTencentHistory(actual.market); }
    } else rows = await fetchTencentHistory(actual.market);
    rows = rows.filter(x => x[0] <= todayKey()).slice(-2000);
    if (!rows.length) throw new Error('没有历史行情');
    rows.forEach(([date, price]) => upsertPricePoint(id, date, price, 'market'));
    actual.market = Object.assign({}, actual.market, {
      historyLoaded: true,
      historyVersion: actual.market.marketType === 'SGE' ? 2 : actual.market.historyVersion,
      historySyncedAt: nowISO(),
      historyCount: rows.length
    });
    historyLoadingIds.delete(id);
    saveState();
    if (!o.noRefresh && parseRoute().name === 'instrument' && parseRoute().id === id && !document.querySelector('.overlay')) refreshPage();
    return true;
  } catch (e) {
    historyLoadingIds.delete(id);
    console.warn('历史行情获取失败', id, e);
    return false;
  }
}

async function hydrateDemoLedger() {
  if (!demoMode || !state || !state.meta || state.meta.demoHydrated) return;
  const targetState = state;
  const list = [];
  accounts().forEach(a => (a.instruments || []).forEach(i => { if (i.market && i.market.code) list.push(i.id); }));
  if (!list.length) { state.meta.demoHydrated = true; saveState(true); return; }
  let all = true;
  for (const id of list) {
    if (state !== targetState || !demoMode) return;
    const ok = await ensureInstrumentHistory(id, { noRefresh: true });
    all = all && ok;
    await new Promise(resolve => setTimeout(resolve, 180));
  }
  if (state !== targetState || !demoMode) return;
  const closeAt = (id, date) => {
    const pts = (state.prices[id] || []).filter(p => p[2] === 'market' && p[0] <= date);
    return pts.length ? Number(pts[pts.length - 1][1]) : null;
  };
  const demoAccountIds = new Set(Object.keys(SEED_SPECS));
  state.records.forEach(rec => {
    if (!demoAccountIds.has(rec.accountId)) return;
    if (!rec.instrumentId || (rec.type !== 'buy' && rec.type !== 'sell' && rec.type !== 'price')) return;
    const inst = instrumentById(rec.instrumentId);
    if (!inst || !inst.market) return;
    const price = closeAt(rec.instrumentId, rec.date);
    if (!(price > 0)) return;
    if (rec.type === 'price') { rec.price = price; return; }
    rec.price = price;
    rec.amount = round((Number(rec.qty) || 0) * price, 2);
    rec.fee = inst.cls === 'stock' || inst.cls === 'etf' ? Math.max(1, round(rec.amount * 0.0004, 2)) : 0;
  });
  accounts().forEach(account => {
    const recs = state.records.filter(r => r.accountId === account.id);
    const spec = SEED_SPECS[account.id];
    if (!spec) return;
    let buyCost = 0, sellProceeds = 0, income = 0, otherDep = 0, withdrawals = 0;
    recs.forEach(r => {
      if (r.type === 'buy') buyCost += (Number(r.amount) || 0) + (Number(r.fee) || 0);
      else if (r.type === 'sell') sellProceeds += (Number(r.amount) || 0) - (Number(r.fee) || 0);
      else if (r.type === 'dividend' || r.type === 'interest') income += Number(r.amount) || 0;
      else if (r.type === 'withdraw') withdrawals += Number(r.amount) || 0;
      else if (r.type === 'deposit' && r.note !== '初始资金') otherDep += Number(r.amount) || 0;
    });
    const initial = round((Number(spec.targetCash) || 0) - otherDep + withdrawals + buyCost - sellProceeds - income, 2);
    const initialRec = recs.find(r => r.type === 'deposit' && r.note === '初始资金') || recs.find(r => r.type === 'deposit' && r.date === seedDate(-496));
    if (initialRec) initialRec.amount = Math.max(0, initial);
  });
  state.meta.demoHydrated = true;
  state.meta.demoHydratedAt = nowISO();
  saveState(true);
  if (!document.querySelector('.overlay') && demoMode) refreshPage();
}

async function ensureAccountHistories(accountId) {
  const account = accountById(accountId);
  if (!account) return;
  const pending = (account.instruments || []).filter(i => i.market && i.market.code && !i.market.historyLoaded).map(i => i.id);
  if (!pending.length) return;
  for (const id of pending) {
    const route = parseRoute();
    if (route.name !== 'account' || route.id !== accountId) return;
    await ensureInstrumentHistory(id, { noRefresh: true });
  }
  const route = parseRoute();
  if (route.name === 'account' && route.id === accountId && !document.querySelector('.overlay')) refreshPage();
}
