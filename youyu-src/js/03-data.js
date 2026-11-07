/* =========================================================
   03 · 账本计算 / 多币种 / 时间序列
   ========================================================= */
let dataRev = 0;
let dataCache = {};

const RECORD_META = {
  deposit:  { label: '存入',     icon: 'arrowDownLeft', tone: 'gain' },
  withdraw: { label: '取出',     icon: 'arrowUpRight',  tone: 'loss' },
  buy:      { label: '买入',     icon: 'arrowDownLeft', tone: 'accent' },
  sell:     { label: '卖出',     icon: 'arrowUpRight',  tone: 'loss' },
  dividend: { label: '分红',     icon: 'coins',         tone: 'gain' },
  interest: { label: '利息',     icon: 'percent',       tone: 'gain' },
  cashProfit: { label: '更新收益', icon: 'trendUp',      tone: 'gain' },
  fee:      { label: '费用',     icon: 'minus',         tone: 'loss' },
  price:    { label: '更新估值', icon: 'refresh',       tone: 'blue' },
  fx:       { label: '换汇',     icon: 'swap',          tone: 'blue' },
  flow:     { label: '资金流调整', icon: 'pen',          tone: 'blue' }
};

/* ---------- persistence ---------- */
function recordPricePoints(obj, instrumentId) {
  const map = new Map();
  (obj.records || []).forEach(r => {
    if (r.instrumentId !== instrumentId) return;
    if (r.type !== 'buy' && r.type !== 'sell' && r.type !== 'price') return;
    const price = Number(r.price) || 0;
    if (!(price > 0) || !r.date) return;
    map.set(r.date, price);
  });
  return Array.from(map.entries()).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0).map(([d, p]) => [d, p, 'record']);
}
function rebuildRecordPrices(obj, instrumentId) {
  const target = obj || state;
  if (!target || !target.prices) return;
  let found = null;
  (target.accounts || []).forEach(a => (a.instruments || []).forEach(i => { if (i.id === instrumentId) found = i; }));
  if (!found || found.market) return;
  target.prices[instrumentId] = recordPricePoints(target, instrumentId);
}
function rebuildAllRecordPrices() {
  if (!state) return;
  (state.accounts || []).forEach(a => (a.instruments || []).forEach(i => {
    if (!i.market) rebuildRecordPrices(state, i.id);
  }));
}
function normalizeState(obj) {
  if (!obj || !Array.isArray(obj.accounts) || !Array.isArray(obj.records)) return false;
  obj.settings = obj.settings || {};
  obj.settings.base = CURRENCY_META[obj.settings.base] ? obj.settings.base : 'CNY';
  // 阶段一：统一排除汇兑损益，汇率只用于金额折算。
  obj.settings.considerFx = false;
  obj.settings.tolerance = Number.isFinite(Number(obj.settings.tolerance)) ? Number(obj.settings.tolerance) : 3;
  obj.settings.hideAmounts = !!obj.settings.hideAmounts;
  obj.settings.theme = obj.settings.theme === 'light' ? 'light' : 'dark';
  obj.accountTypes = normalizeTypeList(obj.accountTypes, DEFAULT_ACCOUNT_TYPES, 'account');
  obj.instrumentTypes = normalizeTypeList(obj.instrumentTypes, DEFAULT_INSTRUMENT_TYPES, 'instrument');
  const validAccountTypes = new Set(obj.accountTypes.map(t => t.id));
  const validInstrumentTypes = new Set(obj.instrumentTypes.map(t => t.id));
  const seedAccountIds = new Set(SEED_ACCOUNTS.map(a => a.id));
  const seedInstrumentIds = new Set(Object.keys(SEED_INSTRUMENTS).reduce((all, k) => all.concat((SEED_INSTRUMENTS[k] || []).map(i => i.id)), []));
  const accountTypeById = id => obj.accountTypes.find(t => t.id === id);
  const instrumentTypeById = id => obj.instrumentTypes.find(t => t.id === id);
  obj.rates = obj.rates || {};
  Object.keys(CURRENCY_META).forEach(ccy => {
    if (!Number.isFinite(Number(obj.rates[ccy])) || Number(obj.rates[ccy]) <= 0) obj.rates[ccy] = CURRENCY_META[ccy].defaultRate;
  });
  obj.accounts.forEach(a => {
    a.id = a.id || uid('acc');
    a.instruments = Array.isArray(a.instruments) ? a.instruments : [];
    a.currency = CURRENCY_META[a.currency] ? a.currency : 'CNY';
    if (a.demo == null) a.demo = seedAccountIds.has(a.id);
    if (a.logo === undefined) a.logo = matchAccountBrand(a.name) || '';
    a.type = validAccountTypes.has(a.type) ? a.type : (validAccountTypes.has('payment') ? 'payment' : obj.accountTypes[0].id);
    a.typeName = accountTypeById(a.type) ? accountTypeById(a.type).name : a.type;
    a.color = a.color || '#ff9f45';
    a.color2 = a.color2 || a.color || '#d97823';
    a.icon = a.icon || (a.name || '?').slice(0, 1);
    a.instruments.forEach(i => {
      i.id = i.id || uid('inst');
      i.accountId = a.id;
      if (i.demo == null) i.demo = seedInstrumentIds.has(i.id);
      i.currency = CURRENCY_META[i.currency] ? i.currency : a.currency;
      i.cls = validInstrumentTypes.has(i.cls) ? i.cls : (validInstrumentTypes.has('other') ? 'other' : obj.instrumentTypes[0].id);
      const typeMeta = instrumentTypeById(i.cls);
      i.color = i.color || (typeMeta ? typeMeta.color : '#8e9aaf');
      i.color2 = i.color2 || i.color;
      if (!i.market && SEED_MARKET_MAP[i.id]) i.market = JSON.parse(JSON.stringify(SEED_MARKET_MAP[i.id]));
      if (i.market) delete i.market.historyLoading;
    });
  });
  obj.records.forEach(r => {
    r.id = r.id || uid('rec');
    r.date = r.date || todayKey();
    r.type = RECORD_META[r.type] ? r.type : 'deposit';
    r.amount = Number(r.amount) || 0;
    r.qty = Number(r.qty) || 0;
    r.price = Number(r.price) || 0;
    r.fee = Number(r.fee) || 0;
    r.fxRate = Number(r.fxRate) || 0;
  });
  // 账本调整替代旧版仅报表的 flowSnapshot；旧记录不兼容，直接移除。
  obj.records = obj.records.filter(r => r.type !== 'flow' || r.ledgerAdjust);
  obj.prices = obj.prices || {};
  (obj.accounts || []).forEach(a => (a.instruments || []).forEach(i => { if (!i.market) rebuildRecordPrices(obj, i.id); }));
  obj.fxHistory = obj.fxHistory || {};
  obj.rebalance = obj.rebalance && typeof obj.rebalance === 'object' ? obj.rebalance : {};
  obj.rebalance.schemes = obj.rebalance.schemes && typeof obj.rebalance.schemes === 'object' ? obj.rebalance.schemes : {};
  obj.rebalance.targets = obj.rebalance.targets && typeof obj.rebalance.targets === 'object' ? obj.rebalance.targets : {};
  if (!Array.isArray(obj.schemes) || !obj.schemes.length) obj.schemes = buildSeed().schemes;
  obj.schemes.forEach(s => {
    s.id = s.id || uid('sch');
    s.groups = Array.isArray(s.groups) ? s.groups : [];
    s.groups.forEach((g, gi) => {
      g.id = g.id || uid('grp');
      g.name = g.name || ('分组 ' + (gi + 1));
      g.color = g.color || GROUP_COLORS[gi % GROUP_COLORS.length];
      g.target = Number.isFinite(Number(g.target)) ? Number(g.target) : 0;
      g.includeAccounts = Array.isArray(g.includeAccounts) ? g.includeAccounts : [];
      g.includeCashAccounts = Array.isArray(g.includeCashAccounts) ? g.includeCashAccounts : [];
      g.includeClasses = Array.isArray(g.includeClasses) ? g.includeClasses : [];
      g.includeInstruments = Array.isArray(g.includeInstruments) ? g.includeInstruments : [];
    });
  });
  const allInstruments = [];
  obj.accounts.forEach(a => (a.instruments || []).forEach(i => allInstruments.push(i)));
  obj.schemes.forEach(s => {
    (s.groups || []).forEach(g => {
      if (Array.isArray(g.includeClasses) && g.includeClasses.length) {
        const ids = allInstruments.filter(i => g.includeClasses.indexOf(i.cls) >= 0).map(i => i.id);
        g.includeInstruments = uniq((g.includeInstruments || []).concat(ids));
        g.includeClasses = [];
      }
    });
  });
  obj.meta = obj.meta || {};
  return true;
}

function readStoredState(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === SCHEMA && normalizeState(parsed)) return parsed;
  } catch (e) {}
  return null;
}
function loadState() {
  const userState = readStoredState(STORE_KEY);
  if (userState && !userState.isDemo) {
    state = userState;
    demoMode = false;
    ensureRates();
    return state;
  }
  // 旧版本把演示数据存在用户键中；迁移到独立的演示账本，不污染真实账本。
  if (userState && userState.isDemo) {
    state = userState;
    demoMode = true;
    try { localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(state)); localStorage.removeItem(STORE_KEY); } catch (e) {}
    ensureRates();
    return state;
  }
  const demoState = readStoredState(DEMO_STORE_KEY);
  if (demoState) {
    state = demoState;
    demoMode = true;
    ensureRates();
    return state;
  }
  state = buildSeed();
  normalizeState(state);
  demoMode = true;
  saveState(true);
  return state;
}

function saveState(silent) {
  try {
    state.meta = state.meta || {};
    state.meta.lastUpdated = nowISO();
    localStorage.setItem(demoMode ? DEMO_STORE_KEY : STORE_KEY, JSON.stringify(state));
  } catch (e) {
    if (!silent) console.warn('保存失败', e);
  }
  invalidate();
}
function invalidate() {
  dataRev++;
  dataCache = {};
}
function ensureRates() {
  if (!state.rates) state.rates = {};
  Object.keys(CURRENCY_META).forEach(c => {
    if (!Number.isFinite(Number(state.rates[c])) || Number(state.rates[c]) <= 0) state.rates[c] = CURRENCY_META[c].defaultRate;
  });
}

/* ---------- lookup ---------- */
function accounts() { return state.accounts || []; }
function accountById(id) { return accounts().find(a => a.id === id); }
function customSchemes() { return state.schemes || []; }
function builtinSchemes() {
  const acctGroups = accounts().map((a, i) => ({
    id: '__auto_acc_' + a.id,
    name: a.name,
    color: autoGroupColor(i),
    target: 0,
    auto: true,
    includeAccounts: [a.id],
    includeCashAccounts: [],
    includeClasses: [],
    includeInstruments: []
  }));
  const instGroups = [];
  let instColorIndex = 0;
  accounts().forEach(a => {
    instGroups.push({
      id: '__auto_cash_' + a.id,
      name: a.name + ' · 可用现金',
      color: autoGroupColor(instColorIndex++),
      target: 0,
      auto: true,
      cashOnly: true,
      includeAccounts: [a.id],
      includeCashAccounts: [],
      includeClasses: [],
      includeInstruments: []
    });
    (a.instruments || []).forEach(inst => {
      instGroups.push({
        id: '__auto_inst_' + inst.id,
        name: inst.name,
        color: autoGroupColor(instColorIndex++),
        target: 0,
        auto: true,
        includeAccounts: [],
        includeCashAccounts: [],
        includeClasses: [],
        includeInstruments: [inst.id]
      });
    });
  });
  const acctTypeGroups = [];
  accountTypes().forEach((t, i) => {
    const list = accounts().filter(a => a.type === t.id);
    if (!list.length) return;
    acctTypeGroups.push({
      id: '__auto_accttype_' + t.id,
      name: t.name,
      color: t.color || autoGroupColor(i),
      target: 0, auto: true,
      includeAccounts: list.map(a => a.id),
      includeCashAccounts: [], includeClasses: [], includeInstruments: []
    });
  });
  const instTypeGroups = [{
    id: '__auto_insttype_cash',
    name: instrumentTypeName('cash'),
    color: instrumentTypeColor('cash'),
    target: 0, auto: true, cashOnly: true,
    includeAccounts: accounts().map(a => a.id),
    includeCashAccounts: [], includeClasses: [], includeInstruments: []
  }];
  const usedTypes = new Set();
  accounts().forEach(a => (a.instruments || []).forEach(i => usedTypes.add(i.cls)));
  instrumentTypes().filter(t => t.id !== 'cash').forEach((t, i) => {
    if (!usedTypes.has(t.id)) return;
    instTypeGroups.push({
      id: '__auto_insttype_' + t.id,
      name: t.name,
      color: t.color || autoGroupColor(i),
      target: 0, auto: true, typeFilter: t.id,
      includeAccounts: [], includeCashAccounts: [], includeClasses: [], includeInstruments: []
    });
  });
  return [
    { id: '__auto_account', name: '账户分组', desc: '按资金所在账户自动分组', builtin: true, type: 'account', groups: acctGroups },
    { id: '__auto_instrument', name: '标的分组', desc: '按具体持仓自动分组', builtin: true, type: 'instrument', groups: instGroups },
    { id: '__auto_account_type', name: '账户类型分组', desc: '按账户类型自动分组', builtin: true, type: 'accountType', groups: acctTypeGroups },
    { id: '__auto_instrument_type', name: '标的类型分组', desc: '按标的类型自动分组', builtin: true, type: 'instrumentType', groups: instTypeGroups }
  ];
}
function schemes() { return builtinSchemes().concat(state.schemes || []); }
function isBuiltinScheme(scheme) { return !!(scheme && scheme.builtin); }
function rebalanceConfig(schemeId) {
  if (!state.rebalance) state.rebalance = { schemes: {}, targets: {} };
  if (!state.rebalance.schemes) state.rebalance.schemes = {};
  if (!state.rebalance.targets) state.rebalance.targets = {};
  return state.rebalance.schemes[schemeId] || {};
}
function rebalanceEnabled(scheme) {
  if (!scheme) return false;
  const cfg = rebalanceConfig(scheme.id);
  if (typeof cfg.enabled === 'boolean') return cfg.enabled;
  return !scheme.builtin;
}
function setRebalanceEnabled(schemeId, enabled) {
  if (!state.rebalance) state.rebalance = { schemes: {}, targets: {} };
  if (!state.rebalance.schemes) state.rebalance.schemes = {};
  state.rebalance.schemes[schemeId] = Object.assign({}, rebalanceConfig(schemeId), { enabled: !!enabled });
}
function rebalanceTargetFor(scheme, group) {
  if (!scheme || !group) return 0;
  if (!scheme.builtin) return Number(group.target) || 0;
  const targets = (state.rebalance && state.rebalance.targets && state.rebalance.targets[scheme.id]) || {};
  return Number(targets[group.id]) || 0;
}
function groupTargetValue(scheme, group) { return rebalanceTargetFor(scheme, group); }
function schemesForRebalance() {
  return schemes().filter(s => rebalanceEnabled(s));
}
function schemeById(id) { return schemes().find(s => s.id === id) || schemes()[0]; }
function groupById(schemeId, groupId) {
  const s = schemeById(schemeId);
  return s ? s.groups.find(g => g.id === groupId) : null;
}
function allInstruments() {
  const out = [];
  accounts().forEach(a => (a.instruments || []).forEach(i => out.push(Object.assign({}, i, { accountId: a.id, account: a }))));
  return out;
}
function normalizeFundQty(qty) {
  return Number(qty) || 0;
}
function instrumentById(id) {
  for (const a of accounts()) {
    const i = (a.instruments || []).find(x => x.id === id);
    if (i) return Object.assign({}, i, { accountId: a.id, account: a });
  }
  return null;
}
function instrumentsOf(account) { return (account && account.instruments) || []; }
function recordsSorted() {
  return (state.records || []).slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ac = String(a.createdAt || '');
    const bc = String(b.createdAt || '');
    if (ac !== bc) return ac < bc ? -1 : 1;
    return String(a.id).localeCompare(String(b.id));
  });
}
function recordsForAccount(accountId) {
  return recordsSorted().filter(r => r.accountId === accountId);
}
function recordsForInstrument(instrumentId) {
  return recordsSorted().filter(r => r.instrumentId === instrumentId);
}
function priceList(id) { return state.prices[id] || []; }
function valuationPriceList(id) {
  const list = priceList(id);
  const inst = instrumentById(id);
  if (inst && inst.market && inst.market.historyLoaded) {
    const market = list.filter(p => p[2] === 'market');
    if (market.length > 2) return market;
  }
  return list;
}
function priceMap(id) {
  if (!dataCache.priceMaps) dataCache.priceMaps = {};
  if (dataCache.priceMaps[id]) return dataCache.priceMaps[id];
  const map = new Map();
  valuationPriceList(id).forEach(([d, p]) => map.set(d, p));
  dataCache.priceMaps[id] = map;
  return map;
}
function priceAt(id, date) {
  const list = valuationPriceList(id);
  if (!list.length) return 0;
  const map = priceMap(id);
  let d = date || todayKey();
  for (let i = 0; i < 8; i++) {
    if (map.has(d)) return map.get(d);
    if (d < list[0][0]) return list[0][1];
    if (d > list[list.length - 1][0]) return list[list.length - 1][1];
    d = addDays(d, -1);
  }
  let lo = 0, hi = list.length - 1, ans = list[0][1];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid][0] <= date) { ans = list[mid][1]; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans;
}
function priceNow(id) { return priceAt(id, todayKey()); }
function previousPrice(id, date) { const d = date || todayKey(); return priceAt(id, addDays(d, -1)); }
function priceOnDateOffset(id, offset) { return priceAt(id, addDays(todayKey(), offset)); }
function fxMap(ccy) {
  if (!dataCache.fxMaps) dataCache.fxMaps = {};
  if (dataCache.fxMaps[ccy]) return dataCache.fxMaps[ccy];
  const map = new Map();
  (state.fxHistory[ccy] || []).forEach(([d, v]) => map.set(d, v));
  dataCache.fxMaps[ccy] = map;
  return map;
}
function fxAt(ccy, date) {
  if (!ccy || ccy === 'CNY') return 1;
  const rate = Number(state.rates[ccy]);
  const current = Number.isFinite(rate) && rate > 0 ? rate : currencyMeta(ccy).defaultRate;
  if (!date) return current;
  const today = todayKey();
  if (date >= today) return current;
  const list = state.fxHistory[ccy] || [];
  if (!list.length) return current;
  if (date <= list[0][0]) return list[0][1];
  if (date >= list[list.length - 1][0]) return list[list.length - 1][1];
  let lo = 0, hi = list.length - 1, ans = current;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid][0] <= date) { ans = list[mid][1]; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans;
}
function fxToBaseAt(ccy, date) {
  const base = baseCurrency();
  return fxAt(ccy, date) / (base === 'CNY' ? 1 : fxAt(base, date));
}
function recordFx(rec, ccy) {
  if (Number(rec.fxRate) > 0) return Number(rec.fxRate);
  return fxAt(ccy || 'CNY', rec.date);
}
function recordBase(rec, ccy) {
  return (Number(rec.amount) || 0) * fxToBase(ccy || 'CNY');
}
function accountCurrency(account) { return account ? account.currency : 'CNY'; }
function instrumentCurrency(inst) { return inst ? inst.currency : accountCurrency(inst && inst.account); }

/* ---------- record cash effects ---------- */
function crossRate(fromCcy, toCcy, date) {
  if (fromCcy === toCcy) return 1;
  const from = fxAt(fromCcy, date);
  const to = fxAt(toCcy, date);
  return to ? from / to : 1;
}
function recordCashDelta(rec, account) {
  if (!rec || !account) return 0;
  const inst = rec.instrumentId ? instrumentById(rec.instrumentId) : null;
  const fromCcy = inst ? inst.currency : account.currency;
  const toCcy = account.currency;
  const rate = rec.type === 'buy' || rec.type === 'sell' || rec.type === 'fee'
    ? crossRate(fromCcy, toCcy, rec.date)
    : 1;
  switch (rec.type) {
    case 'deposit': return Number(rec.amount) || 0;
    case 'withdraw': return -(Number(rec.amount) || 0);
    case 'buy': return -((Number(rec.amount) || 0) + (Number(rec.fee) || 0)) * rate;
    case 'sell': return ((Number(rec.amount) || 0) - (Number(rec.fee) || 0)) * rate;
    case 'dividend': return (Number(rec.amount) || 0) * (inst ? crossRate(inst.currency, account.currency, rec.date) : 1);
    case 'interest': return Number(rec.amount) || 0;
    case 'cashProfit': return Number(rec.amount) || 0;
    case 'fee': return -(Number(rec.amount) || 0);
    case 'flow': return rec.ledgerAdjust ? (Number(rec.cashNative) || 0) : 0;
    default: return 0;
  }
}
function accountCashNative(account) {
  let cash = 0;
  recordsForAccount(account.id).forEach(r => { cash += recordCashDelta(r, account); });
  return cash;
}
function accountCashBefore(accountId, date, excludeId) {
  const account = accountById(accountId);
  if (!account) return 0;
  let cash = 0;
  recordsForAccount(accountId).forEach(r => {
    if (r.id === excludeId || (date && r.date > date)) return;
    cash += recordCashDelta(r, account);
  });
  return round(cash, 2);
}

/* ---------- instrument metrics ---------- */
function computeInstrumentMetrics(instId) {
  if (!dataCache.metrics) dataCache.metrics = {};
  if (dataCache.metrics[instId]) return dataCache.metrics[instId];
  const found = instrumentById(instId);
  if (!found) return null;
  const inst = found;
  const recs = recordsForInstrument(instId).filter(r => r.type === 'buy' || r.type === 'sell' || r.type === 'dividend');
  let qty = 0, costNative = 0, costCNY = 0, realizedNative = 0, dividendsNative = 0;
  let totalBuyNative = 0, totalBuyCNY = 0, totalSellNative = 0, totalFeesNative = 0;
  let cashDividendNative = 0, shareDividendQty = 0, buyCount = 0, sellCount = 0;
  let firstDate = null, lastTradeDate = null;
  recs.forEach(rec => {
    const rate = recordFx(rec, inst.currency);
    const amount = Number(rec.amount) || (Number(rec.qty) * Number(rec.price)) || 0;
    const fee = Number(rec.fee) || 0;
    if (rec.type === 'buy') {
      const value = amount + fee;
      qty += Number(rec.qty) || 0;
      costNative += value;
      costCNY += value * rate;
      totalBuyNative += value;
      totalBuyCNY += value * rate;
      totalFeesNative += fee;
      buyCount += 1;
      if (!firstDate || rec.date < firstDate) firstDate = rec.date;
      if (!lastTradeDate || rec.date > lastTradeDate) lastTradeDate = rec.date;
    } else if (rec.type === 'sell') {
      const sellQty = Math.min(Number(rec.qty) || 0, qty);
      const avgCost = qty > 0 ? costNative / qty : 0;
      const avgRate = costNative > 0 ? costCNY / costNative : rate;
      const soldCost = avgCost * sellQty;
      realizedNative += (Number(rec.price) || 0) * sellQty - soldCost - fee;
      qty -= sellQty;
      costNative = Math.max(0, costNative - soldCost);
      costCNY = Math.max(0, costCNY - soldCost * avgRate);
      totalSellNative += amount - fee;
      totalFeesNative += fee;
      sellCount += 1;
      if (!lastTradeDate || rec.date > lastTradeDate) lastTradeDate = rec.date;
    } else if (rec.type === 'dividend') {
      dividendsNative += amount;
      cashDividendNative += amount;
      shareDividendQty += Number(rec.qty) || 0;
      qty += Number(rec.qty) || 0;
      if (!lastTradeDate || rec.date > lastTradeDate) lastTradeDate = rec.date;
    }
  });
  const price = priceNow(instId);
  const prev = previousPrice(instId);
  const curFx = fxToBase(inst.currency);
  const avgFx = costNative > 0 && costCNY > 0 ? (costCNY / rateCNY(baseCurrency())) / costNative : curFx;
  const marketNative = qty * price;
  const marketBase = marketNative * curFx;
  const costBaseNow = costNative * curFx;
  const costBaseHist = costNative * avgFx;
  const pricePnlBase = (marketNative - costNative) * curFx;
  const fxPnlBase = costNative * (curFx - avgFx);
  const realizedBase = realizedNative * curFx;
  const dividendBase = dividendsNative * curFx;
  const baseProfit = realizedBase + pricePnlBase + dividendBase;
  const fullProfit = baseProfit + fxPnlBase;
  const consider = state.settings.considerFx;
  const displayProfit = consider ? fullProfit : baseProfit;
  const totalInvestedBase = totalBuyCNY / rateCNY(baseCurrency());
  const returnPct = totalInvestedBase > 0 ? displayProfit / totalInvestedBase : 0;
  const instFx = fxToBase(inst.currency);
  const profitNativeInst = instFx > 0 ? displayProfit / instFx : displayProfit;
  const returnPctNative = totalBuyNative > 0 ? profitNativeInst / totalBuyNative : 0;
  const unrealizedNativeInst = instFx > 0 ? (pricePnlBase + (consider ? fxPnlBase : 0)) / instFx : pricePnlBase;
  const totalPnlNative = realizedNative + (marketNative - costNative) + dividendsNative;
  const netInvestedNative = totalBuyNative - totalSellNative - cashDividendNative;
  const dilutedCost = qty > 0 ? netInvestedNative / qty : 0;
  const holdingDays = firstDate ? Math.max(0, daysBetween(firstDate)) : 0;
  const annualizedNative = holdingDays > 0 && returnPctNative > -1
    ? Math.pow(1 + returnPctNative, 365 / holdingDays) - 1
    : null;
  const floatingReturnPct = costNative > 0 ? unrealizedNativeInst / costNative : null;
  const soldCostNative = Math.max(0, totalBuyNative - costNative);
  const realizedReturnPct = soldCostNative > 0 ? realizedNative / soldCostNative : null;
  const prevFxBase = fxToBaseAt(inst.currency, addDays(todayKey(), -1));
  const dayPnl = consider ? qty * (price * curFx - prev * prevFxBase) : (price - prev) * qty * curFx;
  const dayPnlNative = instFx > 0 ? dayPnl / instFx : dayPnl;
  const dayPct = prev ? (price - prev) / prev : 0;
  const out = {
    inst, account: found.account, accountId: found.accountId,
    qty, price, prevPrice: prev, avgCost: qty > 0 ? costNative / qty : 0,
    costNative, costBase: costBaseNow, costBaseHist, marketNative, marketBase,
    marketValue: marketBase, value: marketBase,
    realizedNative, realized: realizedBase, realizedBase,
    dividendsNative, dividendBase, incomeBase: dividendBase,
    pricePnl: pricePnlBase, fxPnl: fxPnlBase,
    baseProfit, fullProfit, profit: displayProfit, displayProfit,
    unrealized: pricePnlBase + (consider ? fxPnlBase : 0),
    totalPnlNative, returnPct, profitNativeInst, returnPctNative, unrealizedNativeInst, dayPnlNative, instFx,
    totalBuyNative, totalBuyBase: totalInvestedBase, totalSellNative,
    totalFeesNative, cashDividendNative, shareDividendQty, buyCount, sellCount,
    netInvestedNative, dilutedCost, annualizedNative, floatingReturnPct, realizedReturnPct, soldCostNative,
    dayPnl, dayPct,
    firstDate, lastTradeDate,
    holdingDays,
    curFx, avgFx
  };
  dataCache.metrics[instId] = out;
  return out;
}

function instrumentListMetrics(account) {
  return instrumentsOf(account).map(i => computeInstrumentMetrics(i.id)).filter(Boolean);
}

function instrumentProfitSeries(im, periodOverride) {
  const inst = im.inst;
  const period = periodOverride == null
    ? Number(ui && ui.instrumentPeriod == null ? 365 : ui.instrumentPeriod)
    : Number(periodOverride) || 0;
  const list = priceSeriesRange(inst.id, period || 0);
  if (!list.length) return [];
  const recs = recordsForInstrument(inst.id)
    .filter(r => r.type === 'buy' || r.type === 'sell' || r.type === 'dividend')
    .slice()
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  let ri = 0, qty = 0, costNative = 0, realizedNative = 0, dividendsNative = 0;
  const applyTo = date => {
    while (ri < recs.length && recs[ri].date <= date) {
      const rec = recs[ri++];
      const amount = Number(rec.amount) || (Number(rec.qty) * Number(rec.price)) || 0;
      const fee = Number(rec.fee) || 0;
      if (rec.type === 'buy') {
        qty += Number(rec.qty) || 0;
        costNative += amount + fee;
      } else if (rec.type === 'sell') {
        const sellQty = Math.min(Number(rec.qty) || 0, qty);
        const avgCost = qty > 0 ? costNative / qty : 0;
        const soldCost = avgCost * sellQty;
        realizedNative += (Number(rec.price) || 0) * sellQty - soldCost - fee;
        qty -= sellQty;
        costNative = Math.max(0, costNative - soldCost);
      } else if (rec.type === 'dividend') {
        dividendsNative += amount;
        qty += Number(rec.qty) || 0;
      }
    }
  };
  const out = [];
  list.forEach(([date, price]) => {
    applyTo(date);
    const marketNative = qty * Number(price);
    out.push({ date, value: realizedNative + (marketNative - costNative) + dividendsNative });
  });
  if (inst.market && out.length && out[out.length - 1].date < todayKey() && (!period || todayKey() >= addDays(todayKey(), -period))) {
    applyTo(todayKey());
    const marketNative = qty * priceNow(inst.id);
    out.push({ date: todayKey(), value: realizedNative + (marketNative - costNative) + dividendsNative });
  }
  if (out.length) out[out.length - 1].value = im.profitNativeInst;
  return out;
}


/* ---------- cash income ---------- */
function accountIncome(account) {
  let income = 0, fees = 0;
  recordsForAccount(account.id).forEach(r => {
    const inst = r.instrumentId ? instrumentById(r.instrumentId) : null;
    const ccy = inst ? inst.currency : account.currency;
    const rate = fxToBase(ccy);
    if (r.type === 'dividend' || r.type === 'interest' || r.type === 'cashProfit') income += (Number(r.amount) || 0) * rate;
    if (r.type === 'fee') fees += (Number(r.amount) || 0) * rate;
  });
  return { income, fees };
}

function accountNetDeposits(account) {
  let net = 0, deposits = 0, withdrawals = 0;
  recordsForAccount(account.id).forEach(r => {
    if (r.type === 'deposit' || r.type === 'withdraw') {
      const v = recordBase(r, account.currency);
      if (r.type === 'deposit') { deposits += v; net += v; }
      else { withdrawals += v; net -= v; }
      return;
    }
    if (r.type !== 'flow' || !r.ledgerAdjust) return;
    if (r.flowField === 'in' || r.flowField === 'out') {
      const d = (Number(r.flowDeltaNative) || 0) * fxToBase(account.currency);
      if (r.flowField === 'in') { deposits += d; net += d; }
      else { withdrawals += d; net -= d; }
    } else if (r.flowField === 'opening') {
      net += (Number(r.netDeltaNative) || 0) * fxToBase(account.currency);
    }
  });
  return { net, deposits, withdrawals };
}

function accountNetDepositsNative(account) {
  let net = 0, deposits = 0, withdrawals = 0;
  recordsForAccount(account.id).forEach(r => {
    if (r.type === 'deposit' || r.type === 'withdraw') {
      const v = Number(r.amount) || 0;
      if (r.type === 'deposit') { deposits += v; net += v; }
      else { withdrawals += v; net -= v; }
      return;
    }
    if (r.type !== 'flow' || !r.ledgerAdjust) return;
    if (r.flowField === 'in' || r.flowField === 'out') {
      const d = Number(r.flowDeltaNative) || 0;
      if (r.flowField === 'in') { deposits += d; net += d; }
      else { withdrawals += d; net -= d; }
    } else if (r.flowField === 'opening') {
      net += Number(r.netDeltaNative) || 0;
    }
  });
  return { net, deposits, withdrawals };
}

/* ---------- account metrics ---------- */
function computeAccountMetrics(accountId) {
  if (!dataCache.accounts) dataCache.accounts = {};
  if (dataCache.accounts[accountId]) return dataCache.accounts[accountId];
  const account = accountById(accountId);
  if (!account) return null;
  const cashNative = accountCashNative(account);
  const cashBase = cashNative * fxToBase(account.currency);
  const insts = instrumentListMetrics(account);
  const holdingsBase = sum(insts, x => x.marketBase);
  const marketBase = cashBase + holdingsBase;
  const deposits = accountNetDeposits(account);
  const income = accountIncome(account);
  const realizedBase = sum(insts, x => x.realizedBase) + income.income - income.fees;
  const floatBase = sum(insts, x => x.pricePnl);
  const dividendBase = sum(insts, x => x.dividendBase);
  const fullProfit = marketBase - deposits.net;
  const baseProfit = realizedBase + floatBase;
  const fxPnl = fullProfit - baseProfit;
  const consider = state.settings.considerFx;
  const profit = consider ? fullProfit : baseProfit;
  const unrealized = profit - realizedBase;
  const accountFx = fxToBase(account.currency);
  const marketNative = accountFx > 0 ? marketBase / accountFx : marketBase;
  const holdingsNative = accountFx > 0 ? holdingsBase / accountFx : holdingsBase;
  const depositsNative = accountNetDepositsNative(account);
  const profitNative = accountFx > 0 ? profit / accountFx : profit;
  const realizedNativeAccount = accountFx > 0 ? realizedBase / accountFx : realizedBase;
  const unrealizedNative = profitNative - realizedNativeAccount;
  const costNative = sum(insts, x => x.costNative);
  const netInvestedNative = sum(insts.filter(x => x.qty > 0.000001), x => x.netInvestedNative);
  const costBasis = costNative * accountFx;
  const incomeNative = accountFx > 0 ? income.income / accountFx : income.income;
  const otherFeesNative = accountFx > 0 ? income.fees / accountFx : income.fees;
  const tradeFeesNative = sum(insts, x => x.totalFeesNative);
  const totalFeesNative = tradeFeesNative + otherFeesNative;
  const tradingRealizedNative = realizedNativeAccount - incomeNative + otherFeesNative;
  const holdingsReturnPct = costNative > 0 ? unrealizedNative / costNative : null;
  const cashRatio = marketNative > 0 ? cashNative / marketNative : 0;
  const holdingsRatio = marketNative > 0 ? holdingsNative / marketNative : 0;
  const firstRecord = recordsForAccount(accountId)[0];
  const recordDays = firstRecord && firstRecord.date ? Math.max(0, daysBetween(firstRecord.date)) : 0;
  const out = {
    account, accountId,
    cashNative, cashBase, holdingsBase, holdingsNative, marketNative, marketBase, value: marketBase,
    netDeposits: deposits.net, deposits: deposits.deposits, withdrawals: deposits.withdrawals,
    netDepositsNative: depositsNative.net, depositsNative: depositsNative.deposits, withdrawalsNative: depositsNative.withdrawals,
    profitNative, returnPctNative: depositsNative.net > 0 ? profitNative / depositsNative.net : null,
    realizedNativeAccount, unrealizedNative,
    realizedBase, realized: realizedBase,
    floatBase, floatPnl: floatBase,
    fxPnl, profit, unrealized, unrealizedPnl: unrealized,
    profitPct: deposits.net > 0 ? profit / deposits.net : null,
    fullProfit, baseProfit,
    incomeBase: income.income, feesBase: income.fees,
    incomeNative, otherFeesNative, tradeFeesNative, totalFeesNative,
    tradingRealizedNative, costNative, netInvestedNative, costBasis, cashRatio, holdingsRatio, holdingsReturnPct, recordDays,
    fxPnlNative: accountFx > 0 ? fxPnl / accountFx : fxPnl,
    instruments: insts,
    positions: insts.filter(x => x.qty > 0.0000001).length,
    recordCount: recordsForAccount(accountId).length,
    firstDate: (recordsForAccount(accountId)[0] || {}).date || null
  };
  dataCache.accounts[accountId] = out;
  return out;
}

function allAccountMetrics() { return accounts().map(a => computeAccountMetrics(a.id)).filter(Boolean); }
function portfolioSummary() {
  if (dataCache.portfolio) return dataCache.portfolio;
  const list = allAccountMetrics();
  const totalMarket = sum(list, x => x.marketBase);
  const cash = sum(list, x => x.cashBase);
  const holdings = sum(list, x => x.holdingsBase);
  const netDeposits = sum(list, x => x.netDeposits);
  const realized = sum(list, x => x.realizedBase);
  const floatPnl = sum(list, x => x.floatBase);
  const fxPnl = sum(list, x => x.fxPnl);
  const profit = sum(list, x => x.profit);
  const out = {
    accounts: list,
    totalMarket, total: totalMarket, cash, holdings,
    netDeposits, realized, floatPnl, fxPnl, profit,
    unrealized: profit - realized,
    returnPct: netDeposits > 0 ? profit / netDeposits : null,
    positions: sum(list, x => x.positions)
  };
  dataCache.portfolio = out;
  return out;
}

/* ---------- schemes / membership ---------- */
function groupMatches(group, account, inst) {
  if (!group) return false;
  if (group.typeFilter) return !!inst && inst.cls === group.typeFilter;
  if (inst) {
    if (group.cashOnly) return false;
    if ((group.includeInstruments || []).indexOf(inst.id) >= 0) return true;
    if ((group.includeAccounts || []).indexOf(account.id) >= 0) return true;
    return false;
  }
  if (group.cashOnly) return (group.includeAccounts || []).indexOf(account.id) >= 0;
  if ((group.includeAccounts || []).indexOf(account.id) >= 0) return true;
  if ((group.includeCashAccounts || []).indexOf(account.id) >= 0) return true;
  return false;
}
function resolveGroupId(scheme, account, inst) {
  if (!scheme) return null;
  for (const g of scheme.groups) {
    if (groupMatches(g, account, inst)) return g.id;
  }
  return null;
}
function groupTarget(g) { return Number(g.target) || 0; }
function schemeTargetTotal(scheme) { return sum(scheme ? scheme.groups : [], g => rebalanceTargetFor(scheme, g)); }
function normalizeTargets(scheme) {
  const total = schemeTargetTotal(scheme);
  return (scheme ? scheme.groups : []).map(g => ({
    group: g,
    raw: rebalanceTargetFor(scheme, g),
    normalized: total > 0 ? rebalanceTargetFor(scheme, g) / total : 0
  }));
}


/* ---------- daily analytics ---------- */
function dailyStartDate() {
  let earliest = addDays(todayKey(), -520);
  (state.records || []).forEach(r => { if (r.date < earliest) earliest = r.date; });
  return addDays(earliest, -1);
}

function buildDailyAnalytics() {
  const consider = state.settings.considerFx;
  const base = baseCurrency();
  const key = 'daily|' + dataRev + '|' + consider + '|' + base;
  if (dataCache.daily && dataCache.dailyKey === key) return dataCache.daily;
  const start = dailyStartDate();
  const days = Math.max(2, daysBetween(start, todayKey()) + 1);
  const dates = [];
  for (let i = 0; i < days; i++) dates.push(addDays(start, i));
  const N = dates.length;
  const indexMap = new Map();
  dates.forEach((d, i) => indexMap.set(d, i));
  const baseRate = rateCNY(base);

  const recordsByDate = {};
  recordsSorted().forEach(r => {
    if (!indexMap.has(r.date)) return;
    if (!recordsByDate[r.date]) recordsByDate[r.date] = [];
    recordsByDate[r.date].push(r);
  });

  const components = [];
  const byAccount = new Map();
  const byInstrument = new Map();
  const totalValues = new Array(N).fill(0);
  const totalPnls = new Array(N).fill(0);

  accounts().forEach(account => {
    const accRecs = recordsForAccount(account.id);
    const cashValues = new Array(N).fill(0);
    const cashPnls = new Array(N).fill(0);
    const cashNativeValues = new Array(N).fill(0);
    const cashNativePnls = new Array(N).fill(0);
    const cashFxSeries = new Array(N).fill(0);
    let cash = 0;
    for (let i = 0; i < N; i++) {
      const d = dates[i];
      const prevD = addDays(d, -1);
      const cashStart = cash;
      let income = 0, fees = 0, valuation = 0;
      let nativeIncome = 0, nativeFees = 0, nativeValuation = 0;
      (recordsByDate[d] || []).forEach(r => {
        if (r.accountId !== account.id) return;
        cash += recordCashDelta(r, account);
        const inst = r.instrumentId ? instrumentById(r.instrumentId) : null;
        const ccy = inst ? inst.currency : account.currency;
        const toAcc = inst ? crossRate(inst.currency, account.currency, d) : 1;
        if (r.type === 'dividend' || r.type === 'interest' || r.type === 'cashProfit') { income += (Number(r.amount) || 0) * toAcc; nativeIncome += (Number(r.amount) || 0) * toAcc; }
        if (r.type === 'fee') { fees += (Number(r.amount) || 0); nativeFees += Number(r.amount) || 0; }
        if (r.type === 'buy' || r.type === 'sell') { fees += (Number(r.fee) || 0) * toAcc; nativeFees += (Number(r.fee) || 0) * toAcc; }
        if (r.type === 'flow' && r.ledgerAdjust && (r.flowField === 'ending' || r.flowField === 'profit')) {
          valuation += (Number(r.cashNative) || 0) * fxToBaseAt(account.currency, d);
          nativeValuation += Number(r.cashNative) || 0;
        }
      });
      const baseNow = fxToBase(account.currency);
      const cashFx = 0;
      cashValues[i] = cash * baseNow;
      cashPnls[i] = (income - fees) * baseNow + valuation;
      cashNativeValues[i] = cash;
      cashNativePnls[i] = nativeIncome - nativeFees + nativeValuation;
      cashFxSeries[i] = cashFx;
    }
    const cashComp = {
      accountId: account.id, instrumentId: null, kind: 'cash', account,
      values: cashValues, pnls: cashPnls, nativeValues: cashNativeValues, nativePnls: cashNativePnls, cashFx: cashFxSeries
    };
    components.push(cashComp);

    const instComps = [];
    instrumentsOf(account).forEach(inst => {
      const buySellRecs = accRecs.filter(r => r.instrumentId === inst.id && (r.type === 'buy' || r.type === 'sell' || (r.type === 'dividend' && (Number(r.qty) || 0) > 0)));
      const events = {};
      buySellRecs.forEach(r => {
        if (!events[r.date]) events[r.date] = [];
        events[r.date].push(r);
      });
      let qty = 0;
      const vals = new Array(N).fill(0);
      const pnls = new Array(N).fill(0);
      const nativeVals = new Array(N).fill(0);
      const nativePnls = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        const d = dates[i];
        const prevD = addDays(d, -1);
        const qtyStart = qty;
        (events[d] || []).forEach(r => {
          if (r.type === 'buy') qty += Number(r.qty) || 0;
          else if (r.type === 'sell') qty = Math.max(0, qty - (Number(r.qty) || 0));
          else if (r.type === 'dividend') qty += Number(r.qty) || 0;
        });
        const p = priceAt(inst.id, d);
        const pp = priceAt(inst.id, prevD);
        const fx = fxToBase(inst.currency);
        const pfx = fx;
        const pnl = qtyStart * (p - pp) * fx;
        const cross = crossRate(inst.currency, account.currency, d);
        const crossPrev = crossRate(inst.currency, account.currency, prevD);
        vals[i] = qty * p * fx;
        pnls[i] = pnl;
        nativeVals[i] = qty * p * cross;
        nativePnls[i] = consider ? qtyStart * (p * cross - pp * crossPrev) : qtyStart * (p - pp) * cross;
      }
      const comp = {
        accountId: account.id, instrumentId: inst.id, kind: 'instrument', inst, account,
        values: vals, pnls, nativeValues: nativeVals, nativePnls: nativePnls
      };
      components.push(comp);
      instComps.push(comp);
      byInstrument.set(inst.id, { inst, account, values: vals, pnls: pnls, nativeValues: nativeVals, nativePnls: nativePnls, dates });
    });

    const accVals = new Array(N).fill(0);
    const accPnls = new Array(N).fill(0);
    const nativeValues = new Array(N).fill(0);
    const nativePnls = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      let v = cashValues[i], p = cashPnls[i];
      instComps.forEach(c => { v += c.values[i]; p += c.pnls[i]; });
      accVals[i] = v;
      accPnls[i] = p;
      totalValues[i] += v;
      totalPnls[i] += p;
      nativeValues[i] = cashNativeValues[i];
      nativePnls[i] = cashNativePnls[i];
      instComps.forEach(c => {
        nativeValues[i] += c.nativeValues[i];
        nativePnls[i] += c.nativePnls[i];
      });
    }
    byAccount.set(account.id, { account, values: accVals, pnls: accPnls, nativeValues, nativePnls, cashValues, cashPnls, instruments: instComps, dates });
  });

  const daily = {
    dates, indexMap, n: N, components, byAccount, byInstrument,
    total: { values: totalValues, pnls: totalPnls, dates },
    consider, base
  };
  dataCache.daily = daily;
  dataCache.dailyKey = key;
  return daily;
}

/* ---------- group time series ---------- */
function groupDailySeries(schemeId) {
  const daily = buildDailyAnalytics();
  const key = 'groups|' + dataRev + '|' + schemeId + '|' + state.settings.considerFx + '|' + baseCurrency();
  if (dataCache.groupKey === key && dataCache.groups) return dataCache.groups;
  const scheme = schemeById(schemeId) || schemes()[0];
  if (!scheme) return { scheme: null, groups: [], ungrouped: null, total: daily.total, dates: daily.dates };
  const N = daily.n;
  const map = new Map();
  scheme.groups.forEach(g => {
    map.set(g.id, {
      id: g.id, name: g.name, color: g.color, target: groupTargetValue(scheme, g), group: g,
      values: new Array(N).fill(0), pnls: new Array(N).fill(0)
    });
  });
  let un = null;
  daily.components.forEach(comp => {
    const account = comp.account;
    const inst = comp.inst || null;
    const gid = resolveGroupId(scheme, account, inst);
    let target;
    if (gid && map.has(gid)) target = map.get(gid);
    else {
      if (!un) un = { id: '__ungrouped', name: '未分组', color: '#6b7280', target: 0, values: new Array(N).fill(0), pnls: new Array(N).fill(0) };
      target = un;
    }
    for (let i = 0; i < N; i++) {
      target.values[i] += comp.values[i];
      target.pnls[i] += comp.pnls[i];
    }
  });
  const groups = Array.from(map.values());
  if (un) groups.push(un);
  const out = { scheme, groups, ungrouped: un, total: daily.total, dates: daily.dates, n: N };
  dataCache.groups = out;
  dataCache.groupKey = key;
  return out;
}

/* ---------- period stats ---------- */
function sliceSeries(series, startDate, endDate) {
  const daily = buildDailyAnalytics();
  const dates = series.dates || daily.dates;
  const vals = series.values;
  const pnls = series.pnls;
  let startIdx = 0, endIdx = dates.length - 1;
  if (startDate) {
    startIdx = dates.findIndex(d => d >= startDate);
    if (startIdx < 0) startIdx = dates.length - 1;
  }
  if (endDate) {
    for (let i = dates.length - 1; i >= 0; i--) { if (dates[i] <= endDate) { endIdx = i; break; } }
  }
  if (endIdx < startIdx) endIdx = startIdx;
  const outDates = dates.slice(startIdx, endIdx + 1);
  const outVals = vals.slice(startIdx, endIdx + 1);
  const outPnls = pnls.slice(startIdx, endIdx + 1);
  return { dates: outDates, values: outVals, pnls: outPnls, startIdx, endIdx, allDates: dates };
}

function periodStats(series, startDate, endDate) {
  const s = sliceSeries(series, startDate, endDate);
  const all = series.values;
  const startIdx = s.startIdx;
  const prevVal = startIdx > 0 ? all[startIdx - 1] : 0;
  const firstVal = s.values[0] || 0;
  const endVal = s.values[s.values.length - 1] || 0;
  const pnl = sum(s.pnls);
  const baseVal = prevVal > 0 ? prevVal : firstVal;
  const returnPct = baseVal > 0 ? pnl / baseVal : (endVal - pnl > 0 ? pnl / (endVal - pnl) : 0);
  let pos = 0, neg = 0, best = null, worst = null;
  s.pnls.forEach((p, i) => {
    if (p > 0.0001) pos++;
    if (p < -0.0001) neg++;
    if (!best || p > best.pnl) best = { pnl: p, date: s.dates[i] };
    if (!worst || p < worst.pnl) worst = { pnl: p, date: s.dates[i] };
  });
  return {
    startDate: s.dates[0], endDate: s.dates[s.dates.length - 1],
    pnl, returnPct, startValue: baseVal, endValue: endVal,
    positiveDays: pos, negativeDays: neg, best, worst,
    days: s.dates.length, series: s
  };
}

function twrStats(series, days) {
  const daily = buildDailyAnalytics();
  const n = series.values.length;
  const lookback = days ? Math.min(days, n - 1) : n - 1;
  let start = Math.max(1, n - 1 - lookback);
  let cum = 1;
  let peak = 1;
  let maxDd = 0;
  let pos = 0;
  const points = [];
  for (let i = start; i < n; i++) {
    const prev = series.values[i - 1];
    const r = prev > 0 ? (series.pnls[i] || 0) / prev : 0;
    cum *= (1 + r);
    if (r > 0.000001) pos++;
    if (cum > peak) peak = cum;
    const dd = peak > 0 ? cum / peak - 1 : 0;
    if (dd < maxDd) maxDd = dd;
    points.push({ date: daily.dates[i], value: cum - 1, daily: r });
  }
  const totalReturn = cum - 1;
  const d = Math.max(1, n - 1 - start);
  const annualized = Math.pow(Math.max(0.0001, 1 + totalReturn), 365 / d) - 1;
  return { points, totalReturn, annualized, maxDrawdown: maxDd, positiveRate: points.length ? pos / points.length : 0, days: d };
}

function accountSeries(accountId, days) {
  const daily = buildDailyAnalytics();
  const a = daily.byAccount.get(accountId);
  if (!a) return null;
  return Object.assign({}, a, {
    baseValues: a.values,
    basePnls: a.pnls,
    values: a.nativeValues || a.values,
    pnls: a.nativePnls || a.pnls
  });
}

/* ---------- current group breakdown ---------- */
function groupBreakdown(schemeId) {
  const daily = buildDailyAnalytics();
  const gs = groupDailySeries(schemeId);
  const last = daily.n - 1;
  const total = Math.max(0, sum(gs.groups, g => g.values[last]));
  const targetTotal = schemeTargetTotal(gs.scheme);
  const norm = targetTotal > 0 ? targetTotal : 100;
  const items = gs.groups.map(g => {
    const value = Math.max(0, g.values[last] || 0);
    const pct = total > 0 ? value / total : 0;
    const targetRaw = g.id === '__ungrouped' ? 0 : rebalanceTargetFor(gs.scheme, g);
    const normalizedTarget = g.id === '__ungrouped' ? 0 : (targetRaw / norm) * 100;
    const targetValue = total * normalizedTarget / 100;
    const delta = targetValue - value;
    const drift = pct * 100 - normalizedTarget;
    return {
      id: g.id, name: g.name, color: g.color, group: g.group || g, target: targetRaw,
      normalizedTarget, targetValue, value, pct, delta, drift,
      values: g.values, pnls: g.pnls
    };
  });
  const consider = state.settings.considerFx;
  const tolerance = Number(state.settings.tolerance) || 0;
  items.forEach(it => {
    if (it.id === '__ungrouped') { it.status = 'unassigned'; return; }
    if (gs.scheme && gs.scheme.builtin && !rebalanceEnabled(gs.scheme)) { it.status = 'auto'; return; }
    it.status = it.drift > tolerance ? 'high' : it.drift < -tolerance ? 'low' : 'ok';
  });
  return { scheme: gs.scheme, items, total, tolerance, targetTotal, dates: daily.dates, ungrouped: items.find(x => x.id === '__ungrouped') || null };
}

function groupPeriodSummary(schemeId, days) {
  const gs = groupDailySeries(schemeId);
  const n = gs.n;
  const lookback = days || 365;
  const startIdx = Math.max(1, n - 1 - lookback);
  return gs.groups.map(g => {
    const pnl = sum(g.pnls.slice(startIdx, n));
    const startVal = g.values[startIdx - 1] || 0;
    return { group: g, pnl, returnPct: startVal > 0 ? pnl / startVal : 0 };
  });
}

/* ---------- flow / waterfall ---------- */
const FLOW_FIELD_META = {
  opening: { label: '期初资产', title: '期初资产调整' },
  ending:  { label: '期末资产', title: '期末资产调整' },
  profit:  { label: '本期收益', title: '本期收益调整' },
  in:      { label: '本期投入', title: '本期投入调整' },
  out:     { label: '本期转出', title: '本期转出调整' }
};

function flowPeriodLabel(periodKey) {
  return periodKey === 'all' ? '记账以来' : periodKey + '年';
}
function flowPeriodBounds(periodKey) {
  if (!periodKey || periodKey === 'all') return { start: null, end: todayKey(), label: '记账以来' };
  const year = String(periodKey).slice(0, 4);
  let end = year + '-12-31';
  if (end > todayKey()) end = todayKey();
  return { start: year + '-01-01', end: end, label: year + '年' };
}
function flowPeriods(scope, id) {
  const values = new Set(['all']);
  const recs = scope === 'account' ? recordsForAccount(id) : recordsForInstrument(id);
  recs.forEach(r => { if (r.date) values.add(String(r.date).slice(0, 4)); });
  (state.records || []).forEach(r => {
    if (r.type !== 'flow' || r.periodKey === 'all') return;
    if (scope === 'account' ? (r.accountId === id && !r.instrumentId) : r.instrumentId === id) values.add(String(r.periodKey));
  });
  if (recs.length) values.add(todayKey().slice(0, 4));
  return Array.from(values).sort((a, b) => a === 'all' ? -1 : b === 'all' ? 1 : Number(b) - Number(a));
}
function flowPeriodKey(scope, id) {
  const map = scope === 'account' ? (ui.flowAccountPeriod || {}) : (ui.flowInstrumentPeriod || {});
  const key = map[id];
  return flowPeriods(scope, id).indexOf(key) >= 0 ? key : 'all';
}
function flowValueAt(series, date) {
  if (!series) return 0;
  const daily = buildDailyAnalytics();
  let idx = daily.indexMap.get(date);
  if (idx == null) {
    for (let i = daily.dates.length - 1; i >= 0; i--) {
      if (daily.dates[i] <= date) { idx = i; break; }
    }
  }
  return idx == null ? 0 : (series.values[idx] || 0);
}
function flowRecordBase(rec, ccy, mode) {
  const amount = Number(rec.amount) || 0;
  const fee = Number(rec.fee) || 0;
  const rate = recordFx(rec, ccy) / rateCNY(baseCurrency());
  if (mode === 'buy') return (amount + fee) * rate;
  if (mode === 'sell') return (amount - fee) * rate;
  if (mode === 'income') return amount * rate;
  return amount * rate;
}
function flowInPeriod(rec, bounds) {
  if (!rec || !rec.date) return false;
  if (bounds.start && rec.date < bounds.start) return false;
  if (bounds.end && rec.date > bounds.end) return false;
  return true;
}
function accountFlow(accountId, periodKey) {
  const account = accountById(accountId);
  if (!account) return null;
  const key = periodKey || 'all';
  const bounds = flowPeriodBounds(key);
  const daily = buildDailyAnalytics();
  const rawSeries = daily.byAccount.get(accountId);
  const series = rawSeries ? Object.assign({}, rawSeries, {
    values: rawSeries.nativeValues || rawSeries.values,
    pnls: rawSeries.nativePnls || rawSeries.pnls
  }) : null;
  const recs = recordsForAccount(accountId);
  let beginning = bounds.start ? flowValueAt(series, addDays(bounds.start, -1)) : 0;
  if (bounds.start) {
    recs.filter(r => r.type === 'flow' && r.ledgerAdjust && r.flowField === 'opening' && r.date === bounds.start)
      .forEach(r => { beginning += (Number(r.netDeltaNative) || 0); });
  }
  const ending = flowValueAt(series, bounds.end);
  let inAmt = 0, outAmt = 0;
  recs.forEach(r => {
    if (!flowInPeriod(r, bounds)) return;
    if (r.type === 'deposit') inAmt += Number(r.amount) || 0;
    else if (r.type === 'withdraw') outAmt += Number(r.amount) || 0;
    else if (r.type === 'flow' && r.ledgerAdjust) {
      if (r.flowField === 'in') inAmt += Number(r.flowDeltaNative) || 0;
      else if (r.flowField === 'out') outAmt += Number(r.flowDeltaNative) || 0;
      else if (r.flowField === 'opening' && !bounds.start) inAmt += Number(r.netDeltaNative) || 0;
    }
  });
  const net = inAmt - outAmt;
  const profit = ending - beginning - net;
  return {
    scope: 'account', periodKey: key, periodLabel: bounds.label, currency: account.currency,
    beginning, in: inAmt, out: outAmt, net, profit, ending,
    label: bounds.label,
    adjusted: recs.some(r => r.type === 'flow' && r.ledgerAdjust && (key === 'all' || r.periodKey === key))
  };
}
function instrumentFlow(instrumentId, periodKey) {
  const im = computeInstrumentMetrics(instrumentId);
  if (!im) return null;
  const inst = im.inst;
  const key = periodKey || 'all';
  const bounds = flowPeriodBounds(key);
  const daily = buildDailyAnalytics();
  const raw = daily.byInstrument.get(instrumentId);
  const series = raw ? Object.assign({}, raw, {
    values: raw.nativeValues || raw.values,
    pnls: raw.nativePnls || raw.pnls
  }) : null;
  const beginning = bounds.start ? flowValueAt(series, addDays(bounds.start, -1)) : 0;
  const ending = flowValueAt(series, bounds.end);
  let inAmt = 0, outAmt = 0, divAmt = 0, divBefore = 0;
  recordsForInstrument(instrumentId).forEach(r => {
    const amount = Number(r.amount) || 0;
    if (r.type === 'dividend' && bounds.start && r.date < bounds.start) {
      divBefore += amount;
      return;
    }
    if (!flowInPeriod(r, bounds)) return;
    const fee = Number(r.fee) || 0;
    if (r.type === 'buy') inAmt += amount + fee;
    else if (r.type === 'sell') outAmt += amount - fee;
    else if (r.type === 'dividend') divAmt += amount;
  });
  // 分红计入累计收益，不作为资金流出；期末总价值 = 持仓市值 + 已收分红
  const beginningTotal = beginning + divBefore;
  const endingTotal = ending + divBefore + divAmt;
  const net = inAmt - outAmt;
  const profit = endingTotal - beginningTotal - net;
  return {
    scope: 'instrument', periodKey: key, periodLabel: bounds.label, currency: inst.currency,
    beginning: beginningTotal, ending: endingTotal,
    marketBeginning: beginning, marketEnding: ending, dividendBefore: divBefore,
    in: inAmt, out: outAmt, dividend: divAmt, net, profit,
    label: bounds.label
  };
}

/* ---------- current snapshot for a group ---------- */
function groupComponents(schemeId, groupId) {
  const scheme = schemeById(schemeId);
  if (!scheme) return [];
  const out = [];
  accounts().forEach(account => {
    const cashGroup = resolveGroupId(scheme, account, null);
    if (cashGroup === groupId) {
      const am = computeAccountMetrics(account.id);
      out.push({ type: 'cash', account, name: account.name + ' · 可用现金', value: am.cashBase });
    }
    instrumentsOf(account).forEach(inst => {
      const gid = resolveGroupId(scheme, account, inst);
      if (gid === groupId) {
        const im = computeInstrumentMetrics(inst.id);
        if (im.qty > 0.000001) out.push({ type: 'instrument', account, instrument: inst, name: inst.name, value: im.marketBase });
      }
    });
  });
  return out.sort((a, b) => b.value - a.value);
}

/* ---------- price range ---------- */
function priceSeriesRange(instrumentId, days) {
  const inst = instrumentById(instrumentId);
  let list = priceList(instrumentId);
  if (!list.length) return [];
  // 行情标的优先使用真实行情序列；交易/演示记录只用于无行情标的。
  if (inst && inst.market && inst.market.historyLoaded) {
    const marketPoints = list.filter(p => p[2] === 'market');
    if (marketPoints.length > 2) list = marketPoints;
  }
  const end = todayKey();
  const start = days ? addDays(end, -days) : list[0][0];
  return list.filter(([d]) => d >= start && d <= end);
}

/* ---------- record helpers ---------- */
function recordAccount(rec) { return accountById(rec.accountId); }
function recordInstrument(rec) { return rec.instrumentId ? instrumentById(rec.instrumentId) : null; }
function recordCurrency(rec) {
  if (rec.type === 'flow') {
    const acc = accountById(rec.accountId);
    return acc ? acc.currency : baseCurrency();
  }
  const inst = recordInstrument(rec);
  if (inst) return inst.currency;
  const acc = recordAccount(rec);
  return acc ? acc.currency : baseCurrency();
}
function recordTitle(rec) {
  const inst = recordInstrument(rec);
  const acc = recordAccount(rec);
  const meta = RECORD_META[rec.type] || RECORD_META.deposit;
  if (rec.type === 'fx') {
    return '换汇 ' + (rec.fromCcy || '') + ' → ' + (rec.toCcy || '');
  }
  if (rec.type === 'flow') {
    const fm = FLOW_FIELD_META[rec.flowField] || FLOW_FIELD_META.opening;
    return (inst ? inst.name : acc ? acc.name : '') + ' · ' + fm.title + ' · ' + flowPeriodLabel(rec.periodKey);
  }
  if (rec.type === 'price') return inst ? inst.name + ' · 估值更新' : '估值更新';
  if (rec.type === 'buy' || rec.type === 'sell' || rec.type === 'dividend') {
    return (inst ? inst.name : acc ? acc.name : '') + ' · ' + meta.label;
  }
  return (acc ? acc.name : '') + ' · ' + meta.label;
}
function recordAmountHTML(rec) {
  const meta = RECORD_META[rec.type] || RECORD_META.deposit;
  const inst = recordInstrument(rec);
  const ccy = recordCurrency(rec);
  if (rec.type === 'price') return '<span class="mono">' + fmtPrice(rec.price, ccy) + '</span>';
  if (rec.type === 'flow') {
    const acc = accountById(rec.accountId);
    const ccy = acc ? acc.currency : baseCurrency();
    const v = Number(rec.flowValueNative) || 0;
    const sign = rec.flowField === 'out' ? '−' : rec.flowField === 'in' ? '+' : rec.flowField === 'profit' ? (v > 0 ? '+' : v < 0 ? '-' : '') : '';
    const cls = rec.flowField === 'out' ? 'loss' : (rec.flowField === 'in' || (rec.flowField === 'profit' && v > 0)) ? 'gain' : (rec.flowField === 'profit' && v < 0 ? 'loss' : '');
    const body = (rec.flowField === 'opening' || rec.flowField === 'ending') ? fmtMoney(v, { currency: ccy }) : sign + fmtMoney(Math.abs(v), { currency: ccy });
    return '<span class="' + cls + '">' + body + '</span>';
  }
  if (rec.type === 'fx') return '<span class="mono">' + fmtMoney(rec.fromAmount || 0, { currency: rec.fromCcy }) + ' → ' + fmtMoney(rec.toAmount || 0, { currency: rec.toCcy }) + '</span>';
  if (rec.type === 'dividend' && (Number(rec.qty) || 0) > 0 && !(Number(rec.amount) > 0)) {
    const unit = inst ? qtyUnit(inst.cls) : '份';
    return '<span class="gain">' + fmtQty(rec.qty) + unit + '</span>';
  }
  if (rec.type === 'cashProfit') {
    const v = Number(rec.amount) || 0;
    return '<span class="' + (v >= 0 ? 'gain' : 'loss') + '">' + (v >= 0 ? '+' : '-') + fmtMoney(Math.abs(v), { currency: ccy }) + '</span>';
  }
  const positive = rec.type === 'deposit' || rec.type === 'sell' || rec.type === 'dividend' || rec.type === 'interest';
  const cls = positive ? 'gain' : (rec.type === 'withdraw' || rec.type === 'buy' || rec.type === 'fee' ? 'loss' : '');
  const sign = positive ? '+' : '-';
  return '<span class="' + cls + '">' + sign + fmtMoney(rec.amount, { currency: ccy }) + '</span>';
}
function recordSubHTML(rec) {
  const parts = [rec.date];
  if (rec.type === 'buy' || rec.type === 'sell' || rec.type === 'dividend') {
    if (rec.type === 'dividend' && !(Number(rec.amount) > 0) && Number(rec.qty) > 0) parts.push('赠送份额 ' + fmtQty(rec.qty));
    else if (rec.type !== 'dividend') parts.push('数量 ' + fmtQty(rec.qty));
    if (rec.price) parts.push('单价 ' + fmtPrice(rec.price, recordCurrency(rec)));
    if (rec.fee) parts.push('费用 ' + fmtMoney(rec.fee, { currency: recordCurrency(rec) }));
  } else if (rec.type === 'price') {
    // 价格已在上方金额位置展示，避免重复
  } else if (rec.type === 'flow') {
    parts.push(flowPeriodLabel(rec.periodKey));
    parts.push('账本调整');
  }
  if (rec.note && !(rec.type === 'price' && /估值更新|价格更新/.test(rec.note)) && rec.type !== 'flow') parts.push(rec.note);
  return parts.map(esc).join(' · ');
}
function recordTone(rec) {
  if (rec.type === 'cashProfit') return (Number(rec.amount) || 0) >= 0 ? 'gain' : 'loss';
  if (rec.type === 'deposit' || rec.type === 'sell' || rec.type === 'dividend' || rec.type === 'interest') return 'gain';
  if (rec.type === 'withdraw' || rec.type === 'buy' || rec.type === 'fee') return 'loss';
  if (rec.type === 'price' || rec.type === 'flow') return 'blue';
  return 'accent';
}

/* ---------- mutation helpers ---------- */
function upsertPricePoint(instrumentId, date, price, source) {
  if (!state.prices[instrumentId]) state.prices[instrumentId] = [];
  const list = state.prices[instrumentId];
  const idx = list.findIndex(([d]) => d === date);
  if (idx >= 0) { list[idx][1] = price; list[idx][2] = source || list[idx][2] || 'record'; }
  else {
    list.push([date, price, source || 'record']);
    list.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  }
}
function addRecord(rec) {
  state.records.push(Object.assign({
    id: uid('rec'), date: todayKey(), type: 'deposit', accountId: '', instrumentId: null,
    amount: 0, qty: 0, price: 0, fee: 0, fxRate: 0, note: '', createdAt: nowISO()
  }, rec));
  rebuildAllRecordPrices();
  saveState();
}
function removePricePoint(instrumentId, date, price) {
  const list = state.prices[instrumentId];
  if (!list) return;
  const idx = list.findIndex(([d, p]) => d === date && Math.abs(Number(p) - Number(price)) < 1e-9);
  if (idx >= 0) list.splice(idx, 1);
}
function deleteRecord(recId) {
  const rec = state.records.find(r => r.id === recId);
  if (!rec) return;
  if (rec.type === 'price' && rec.pricePoint) removePricePoint(rec.instrumentId, rec.date, rec.price);
  state.records = state.records.filter(r => r.id !== recId);
  rebuildAllRecordPrices();
  saveState();
}
function rateForRecord(ccy, date) {
  return fxAt(ccy, date);
}

/* ---------- import / export ---------- */
function stripNetworkHistory(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj.prices && typeof obj.prices === 'object') {
    Object.keys(obj.prices).forEach(id => {
      const rows = Array.isArray(obj.prices[id]) ? obj.prices[id] : [];
      const kept = rows.filter(row => !Array.isArray(row) || row[2] !== 'market');
      if (kept.length) obj.prices[id] = kept;
      else delete obj.prices[id];
    });
  }
  (obj.accounts || []).forEach(account => {
    (account.instruments || []).forEach(inst => {
      if (!inst.market || typeof inst.market !== 'object') return;
      delete inst.market.historyLoaded;
      delete inst.market.historyCount;
      delete inst.market.historySyncedAt;
      delete inst.market.historyVersion;
    });
  });
  if (obj.meta && typeof obj.meta === 'object') delete obj.meta.marketSyncedAt;
  return obj;
}
function exportData() {
  // 备份只保留手工价格和交易记录生成的价格，不导出网络历史行情
  const copy = JSON.parse(JSON.stringify(state));
  stripNetworkHistory(copy);
  return JSON.stringify(copy, null, 2);
}
function importData(text) {
  const obj = JSON.parse(text);
  if (!normalizeState(obj)) throw new Error('数据格式不正确');
  if (obj.version !== SCHEMA) obj.version = SCHEMA;
  // 兼容旧备份：即使文件里带了网络历史行情，也不导入
  stripNetworkHistory(obj);
  state = obj;
  // 导入普通备份时必须退出演示模式，否则会写进演示账本
  demoMode = !!obj.isDemo;
  state.isDemo = demoMode;
  saveState();
  return true;
}

/* ---------- names ---------- */
function normalizeTypeList(list, defaults, kind) {
  const source = Array.isArray(list) && list.length ? list : [];
  const out = [];
  const seen = new Set();
  source.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const id = String(raw.id || '').trim() || uid(kind + '_type');
    if (seen.has(id)) return;
    const fallback = defaults.find(d => d.id === id);
    const name = String(raw.name || '').trim() || (fallback && fallback.name) || '未命名类型';
    const color = /^#[0-9a-f]{6}$/i.test(String(raw.color || '')) ? raw.color : ((fallback && fallback.color) || autoGroupColor(index));
    const item = {
      id, name, color,
      builtin: raw.builtin == null ? !!(fallback && fallback.builtin) : !!raw.builtin
    };
    if (kind === 'instrument') {
      item.short = String(raw.short || '').trim() || (fallback && fallback.short) || name.slice(0, 2);
      item.group = String(raw.group || '').trim() || (fallback && fallback.group) || 'other';
    }
    out.push(item);
    seen.add(id);
  });
  defaults.forEach(d => {
    if (!seen.has(d.id)) { out.push(Object.assign({}, d)); seen.add(d.id); }
  });
  return out;
}
function accountTypes() {
  return Array.isArray(state.accountTypes) && state.accountTypes.length ? state.accountTypes : defaultAccountTypes();
}
function instrumentTypes() {
  return Array.isArray(state.instrumentTypes) && state.instrumentTypes.length ? state.instrumentTypes : defaultInstrumentTypes();
}
function accountTypeMeta(type) {
  return accountTypes().find(t => t.id === type) || { id: type, name: type || '账户', color: '#8e9aaf' };
}
function accountTypeName(type) { return accountTypeMeta(type).name; }
function accountTypeLabel(type) { return accountTypeName(type); }
function instrumentTypeMeta(cls) {
  return instrumentTypes().find(t => t.id === cls) || { id: cls || 'other', name: cls || '其他', short: '其他', color: '#9ca3af', group: 'other' };
}
function instrumentTypeName(cls) { return instrumentTypeMeta(cls).name; }
function instrumentTypeColor(cls) { return instrumentTypeMeta(cls).color; }
function accountTypeOptions() { return accountTypes().map(t => ({ value: t.id, label: t.name })); }
function instrumentTypeOptions() {
  return instrumentTypes().filter(t => t.id !== 'cash').map(t => ({ value: t.id, label: t.name }));
}
function assetClassName(cls) { return instrumentTypeName(cls); }
function scopeName(scope, schemeId) {
  if (scope === 'all' || !scope) return '全部资产';
  const g = groupById(schemeId, scope);
  return g ? g.name : '全部资产';
}
