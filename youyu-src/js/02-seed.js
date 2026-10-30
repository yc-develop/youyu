/* =========================================================
   02 · 演示数据 / 账本种子
   ========================================================= */
let state = null;
let demoMode = false;
let ui = {};
let chartRegistry = {};
let chartSeq = 0;
let renderSeq = 0;

const SEED_ACCOUNTS = [
  { id: 'alipay',    name: '支付宝',     type: 'payment', typeName: '支付账户', currency: 'CNY', color: '#1677ff', color2: '#3f93ff', icon: '支', note: '余额与余额宝' },
  { id: 'wechat',    name: '微信钱包',   type: 'payment', typeName: '支付账户', currency: 'CNY', color: '#27b768', color2: '#0f8c48', icon: '微', note: '零钱与零钱通' },
  { id: 'cash',      name: '现金',       type: 'cash',    typeName: '现金',     currency: 'CNY', color: '#c69236', color2: '#926321', icon: '现', note: '随身现金' },
  { id: 'boc',       name: '中国银行',   type: 'bank',    typeName: '银行账户', currency: 'CNY', color: '#c23b32', color2: '#8d251f', icon: '中', note: '活期储蓄' },
  { id: 'alipayfund', name: '支付宝基金', type: 'fund',   typeName: '基金账户', currency: 'CNY', color: '#ff6b35', color2: '#d84a23', icon: '基', note: '场外基金' },
  { id: 'deposit',   name: '银行定存',   type: 'deposit', typeName: '存款',     currency: 'CNY', color: '#6d7cff', color2: '#4453c7', icon: '定', note: '大额存单' },
  { id: 'longbridge', name: '长桥证券', type: 'broker',  typeName: '证券账户', currency: 'USD', color: '#ff7a00', color2: '#ca5600', icon: '长', note: '美股 · 美元' },
  { id: 'futu',      name: '富途牛牛',  type: 'broker',  typeName: '证券账户', currency: 'HKD', color: '#2b6bf3', color2: '#1745b6', icon: '富', note: '港股 · 港币' }
];

const SEED_INSTRUMENTS = {
  alipay: [
    { id: 'yuebao', name: '余额宝', symbol: 'YEB', cls: 'moneyFund', currency: 'CNY', color: '#1677ff', color2: '#3f93ff', note: '货币基金' }
  ],
  wechat: [
    { id: 'lqt', name: '零钱通', symbol: 'LQT', cls: 'moneyFund', currency: 'CNY', color: '#27b768', color2: '#0f8c48', note: '货币基金' }
  ],
  cash: [],
  boc: [],
  alipayfund: [
    { id: 'bondfund', name: '易方达稳健收益债券A', symbol: '110008', cls: 'bondFund', currency: 'CNY', color: '#5b8cff', color2: '#365fd6', note: '中低风险 · 债券型', market: { provider: 'tencent', code: 'jj110008', marketType: 'FUND', label: '基金', symbol: '110008', currency: 'CNY', cls: 'bondFund' } },
    { id: 'equityfund', name: '华夏沪深300ETF联接A', symbol: '000051', cls: 'equityFund', currency: 'CNY', color: '#ff9f45', color2: '#d97823', note: '宽基指数 · 股票型', market: { provider: 'tencent', code: 'jj000051', marketType: 'FUND', label: '基金', symbol: '000051', currency: 'CNY', cls: 'equityFund' } }
  ],
  deposit: [
    { id: 'cd', name: '三年期大额存单', symbol: 'CD', cls: 'deposit', currency: 'CNY', color: '#6d7cff', color2: '#4453c7', note: '年化 2.90% · 到期 2028' }
  ],
  longbridge: [
    { id: 'aapl', name: '苹果', symbol: 'AAPL', cls: 'stock', currency: 'USD', color: '#c9d1d9', color2: '#6e7681', note: 'Apple Inc.', market: { provider: 'tencent', code: 'usAAPL', marketType: 'US', label: '美股', symbol: 'AAPL', currency: 'USD', cls: 'stock' } },
    { id: 'tsla', name: '特斯拉', symbol: 'TSLA', cls: 'stock', currency: 'USD', color: '#ef4444', color2: '#991b1b', note: 'Tesla, Inc.', market: { provider: 'tencent', code: 'usTSLA', marketType: 'US', label: '美股', symbol: 'TSLA', currency: 'USD', cls: 'stock' } },
    { id: 'voo', name: '标普500 ETF', symbol: 'VOO', cls: 'etf', currency: 'USD', color: '#b18cff', color2: '#7448d6', note: 'Vanguard S&P 500', market: { provider: 'tencent', code: 'usVOO', marketType: 'US', label: '美股', symbol: 'VOO', currency: 'USD', cls: 'etf' } }
  ],
  futu: [
    { id: 'tencent', name: '腾讯控股', symbol: '0700.HK', cls: 'stock', currency: 'HKD', color: '#3b82f6', color2: '#1e40af', note: 'Tencent Holdings', market: { provider: 'tencent', code: 'hk00700', marketType: 'HK', label: '港股', symbol: '00700', currency: 'HKD', cls: 'stock' } },
    { id: 'xiaomi', name: '小米集团-W', symbol: '1810.HK', cls: 'stock', currency: 'HKD', color: '#f59e0b', color2: '#b45309', note: 'Xiaomi Corporation', market: { provider: 'tencent', code: 'hk01810', marketType: 'HK', label: '港股', symbol: '01810', currency: 'HKD', cls: 'stock' } }
  ]
};

const SEED_MARKET_MAP = (() => {
  const map = {};
  Object.keys(SEED_INSTRUMENTS).forEach(acc => (SEED_INSTRUMENTS[acc] || []).forEach(inst => {
    if (inst.market) map[inst.id] = inst.market;
  }));
  return map;
})();

const SEED_SPECS = {
  alipay: {
    targetCash: 8200,
    flows: [{ offset: -150, type: 'deposit', amount: 5000, note: '工资转入' }],
    buys: [{ inst: 'yuebao', offset: -330, qty: 45970, note: '余额转入' }],
    sells: [],
    incomes: []
  },
  wechat: {
    targetCash: 2800,
    flows: [],
    buys: [{ inst: 'lqt', offset: -300, qty: 12560, note: '零钱转入' }],
    sells: [],
    incomes: []
  },
  cash: {
    targetCash: 6500,
    flows: [{ offset: -30, type: 'deposit', amount: 2000, note: '备用金补充' }],
    buys: [], sells: [], incomes: []
  },
  boc: {
    targetCash: 180000,
    flows: [
      { offset: -200, type: 'deposit', amount: 10000, note: '奖金入账' },
      { offset: -55, type: 'withdraw', amount: 15000, note: '家庭支出' }
    ],
    buys: [], sells: [],
    incomes: [{ offset: -35, type: 'interest', amount: 1852.4, note: '活期结息' }]
  },
  alipayfund: {
    targetCash: 3800,
    flows: [],
    buys: [
      { inst: 'bondfund', offset: -360, qty: 42000, note: '首次建仓' },
      { inst: 'bondfund', offset: -190, qty: 26965, note: '定投加仓' },
      { inst: 'equityfund', offset: -300, qty: 24000, note: '指数定投' },
      { inst: 'equityfund', offset: -140, qty: 10804, note: '逢低加仓' }
    ],
    sells: [],
    incomes: [{ offset: -20, inst: 'bondfund', type: 'dividend', amount: 612.8, note: '债券基金分红' }]
  },
  deposit: {
    targetCash: 1200,
    flows: [],
    buys: [{ inst: 'cd', offset: -468, qty: 1, note: '大额存单存入' }],
    sells: [], incomes: []
  },
  longbridge: {
    targetCash: 8500,
    flows: [{ offset: -100, type: 'deposit', amount: 3000, note: '换汇转入' }],
    buys: [
      { inst: 'aapl', offset: -340, qty: 30, note: '分批建仓' },
      { inst: 'aapl', offset: -160, qty: 12, note: '加仓' },
      { inst: 'tsla', offset: -300, qty: 16, note: '首次建仓' },
      { inst: 'tsla', offset: -120, qty: 8, note: '回调加仓' },
      { inst: 'voo', offset: -260, qty: 26, note: '长期配置' },
      { inst: 'voo', offset: -80, qty: 4, note: '定投' }
    ],
    sells: [
      { inst: 'aapl', offset: -50, qty: 4, note: '部分止盈' },
      { inst: 'tsla', offset: -30, qty: 2, note: '减仓' }
    ],
    incomes: [{ offset: -25, inst: 'aapl', type: 'dividend', amount: 28.4, note: 'AAPL 股息' }],
    extras: [{ offset: -95, type: 'fx', fromCcy: 'CNY', toCcy: 'USD', fromAmount: 10000, toAmount: 1402.5, fxRate: 7.13, note: '换汇 CNY → USD' }]
  },
  futu: {
    targetCash: 22000,
    flows: [],
    buys: [
      { inst: 'tencent', offset: -350, qty: 260, note: '核心持仓' },
      { inst: 'tencent', offset: -170, qty: 80, note: '加仓' },
      { inst: 'xiaomi', offset: -220, qty: 1200, note: '首次建仓' },
      { inst: 'xiaomi', offset: -100, qty: 600, note: '加仓' }
    ],
    sells: [
      { inst: 'tencent', offset: -70, qty: 40, note: '部分止盈' },
      { inst: 'xiaomi', offset: -20, qty: 200, note: '调仓' }
    ],
    incomes: [{ offset: -90, inst: 'tencent', type: 'dividend', amount: 1600, note: '腾讯股息' }]
  }
};

const SEED_PRICES = {
  yuebao:    { current: 1.0268, startFactor: 0.987, vol: 0.00016, drift: 0.00004, kind: 'money' },
  lqt:       { current: 1.0187, startFactor: 0.982, vol: 0.00014, drift: 0.00004, kind: 'money' },
  bondfund:  { current: 1.2470, startFactor: 0.938, vol: 0.0012, drift: 0.00012, kind: 'fund' },
  equityfund:{ current: 2.0400, startFactor: 0.825, vol: 0.012, drift: 0.0005, kind: 'fund' },
  cd:        { current: 258400, startFactor: 250000 / 258400, vol: 0, drift: 0, kind: 'deposit' },
  aapl:      { current: 238.42, startFactor: 0.635, vol: 0.017, drift: 0.0007, kind: 'stock' },
  tsla:      { current: 262.35, startFactor: 0.88, vol: 0.027, drift: 0.00025, kind: 'stock' },
  voo:       { current: 588.20, startFactor: 0.76, vol: 0.0085, drift: 0.00055, kind: 'stock' },
  tencent:   { current: 612.00, startFactor: 0.70, vol: 0.016, drift: 0.00055, kind: 'stock' },
  xiaomi:    { current: 46.80, startFactor: 0.50, vol: 0.025, drift: 0.0008, kind: 'stock' }
};

const SEED_RATES = { CNY: 1, USD: 7.12, HKD: 0.912, JPY: 0.0475, EUR: 7.76, GBP: 9.08, USDT: 7.11 };

function seedDate(offset) { return addDays(todayKey(), offset); }

function makePriceSeries(spec, days) {
  const n = days || 501;
  const rng = makeRng((spec.current * 1000 + spec.vol * 100000 + spec.startFactor * 10000) | 0);
  let values = [1];
  if (spec.kind === 'deposit') {
    const start = spec.current * spec.startFactor;
    for (let i = 1; i < n; i++) values.push(start + (spec.current - start) * (i / (n - 1)));
  } else {
    for (let i = 1; i < n; i++) {
      const shock = gaussian(rng);
      let r = spec.drift + spec.vol * shock;
      if (r < -0.09) r = -0.09;
      if (r > 0.09) r = 0.09;
      values.push(values[i - 1] * (1 + r));
    }
    const scale = spec.current / values[n - 1];
    values = values.map(v => v * scale);
  }
  const start = seedDate(-(n - 1));
  const out = [];
  for (let i = 0; i < n; i++) {
    const key = addDays(start, i);
    const wd = parseDay(key).getDay();
    let v = values[i];
    if (spec.kind === 'stock' && (wd === 0 || wd === 6) && i > 0 && i < n - 1) v = out[i - 1][1];
    if (i === n - 1) v = spec.current;
    const rounded = v < 10 ? round(v, 4) : v < 1000 ? round(v, 2) : Math.round(v);
    out.push([key, rounded]);
  }
  return out;
}

function makeFxSeries(ccy, current, days) {
  const n = days || 501;
  const rng = makeRng((current * 100000 + ccy.charCodeAt(0) * 31) | 0);
  let vals = [current];
  const vol = ccy === 'JPY' ? 0.0025 : ccy === 'USDT' ? 0.0004 : 0.0018;
  for (let i = 1; i < n; i++) {
    const back = current / vals[0];
    const meanPull = (1 - back) * 0.0008;
    const r = meanPull + vol * gaussian(rng);
    vals.push(vals[i - 1] / (1 + r));
  }
  const start = seedDate(-(n - 1));
  const chronological = vals.slice().reverse();
  return chronological.map((v, i) => [addDays(start, i), round(v, ccy === 'JPY' ? 5 : 4)]);
}

function seriesPriceAt(series, key) {
  let last = null;
  for (let i = 0; i < series.length; i++) {
    if (series[i][0] <= key) last = series[i][1];
    else break;
  }
  return last == null ? (series[0] ? series[0][1] : 0) : last;
}
function seriesFxAt(series, key) {
  if (!series) return 1;
  let last = null;
  for (let i = 0; i < series.length; i++) {
    if (series[i][0] <= key) last = series[i][1];
    else break;
  }
  return last == null ? (series[0] ? series[0][1] : 1) : last;
}

function buildSeed() {
  const accounts = SEED_ACCOUNTS.map(a => Object.assign({}, a, {
    id: a.id,
    demo: true,
    instruments: (SEED_INSTRUMENTS[a.id] || []).map(x => Object.assign({}, x, { id: x.id, accountId: a.id, demo: true }))
  }));
  const seriesPrices = {};
  Object.keys(SEED_INSTRUMENTS).forEach(accId => {
    (SEED_INSTRUMENTS[accId] || []).forEach(inst => {
      seriesPrices[inst.id] = makePriceSeries(SEED_PRICES[inst.id], 501);
    });
  });
  const fxHistory = {};
  Object.keys(SEED_RATES).forEach(ccy => {
    if (ccy === 'CNY') return;
    fxHistory[ccy] = makeFxSeries(ccy, SEED_RATES[ccy], 501);
  });
  const records = [];
  const addRecord = r => {
    records.push(Object.assign({
      id: uid('rec'),
      date: todayKey(),
      type: 'deposit',
      accountId: '',
      instrumentId: null,
      amount: 0,
      qty: 0,
      price: 0,
      fee: 0,
      fxRate: 1,
      note: '',
      createdAt: nowISO()
    }, r));
  };
  const instById = {};
  accounts.forEach(a => a.instruments.forEach(i => { instById[i.id] = { inst: i, account: a }; }));

  accounts.forEach(account => {
    const spec = SEED_SPECS[account.id] || { targetCash: 0, flows: [], buys: [], sells: [], incomes: [] };
    let buyCost = 0, sellProceeds = 0, income = 0, otherDeposits = 0, withdrawals = 0;

    (spec.flows || []).forEach(f => {
      if (f.type === 'deposit') otherDeposits += f.amount;
      if (f.type === 'withdraw') withdrawals += f.amount;
    });
    (spec.incomes || []).forEach(inc => { income += inc.amount; });

    (spec.buys || []).forEach(b => {
      const rec = instById[b.inst];
      if (!rec) return;
      const d = seedDate(b.offset);
      const price = seriesPriceAt(seriesPrices[b.inst], d);
      const amount = round(b.qty * price, 2);
      const fee = rec.inst.cls === 'stock' || rec.inst.cls === 'etf' ? Math.max(1, round(amount * 0.0004, 2)) : 0;
      buyCost += amount + fee;
      addRecord({
        date: d, type: 'buy', accountId: account.id, instrumentId: b.inst,
        amount, qty: b.qty, price, fee,
        fxRate: account.currency === 'CNY' ? 1 : seriesFxAt(fxHistory[account.currency], d),
        note: b.note || '买入'
      });
    });

    (spec.sells || []).forEach(s => {
      const rec = instById[s.inst];
      if (!rec) return;
      const d = seedDate(s.offset);
      const price = seriesPriceAt(seriesPrices[s.inst], d);
      const amount = round(s.qty * price, 2);
      const fee = rec.inst.cls === 'stock' || rec.inst.cls === 'etf' ? Math.max(1, round(amount * 0.0004, 2)) : 0;
      sellProceeds += amount - fee;
      addRecord({
        date: d, type: 'sell', accountId: account.id, instrumentId: s.inst,
        amount, qty: s.qty, price, fee,
        fxRate: account.currency === 'CNY' ? 1 : seriesFxAt(fxHistory[account.currency], d),
        note: s.note || '卖出'
      });
    });

    (spec.flows || []).forEach(f => {
      addRecord({
        date: seedDate(f.offset), type: f.type, accountId: account.id,
        amount: f.amount, note: f.note || '',
        fxRate: account.currency === 'CNY' ? 1 : seriesFxAt(fxHistory[account.currency], seedDate(f.offset))
      });
    });

    (spec.incomes || []).forEach(inc => {
      addRecord({
        date: seedDate(inc.offset), type: inc.type, accountId: account.id,
        instrumentId: inc.inst || null, amount: inc.amount, note: inc.note || '收益',
        fxRate: account.currency === 'CNY' ? 1 : seriesFxAt(fxHistory[account.currency], seedDate(inc.offset))
      });
    });

    const initial = round(spec.targetCash - otherDeposits + withdrawals + buyCost - sellProceeds - income, 2);
    addRecord({
      date: seedDate(-496), type: 'deposit', accountId: account.id,
      amount: Math.max(initial, 0), note: '初始资金',
      fxRate: account.currency === 'CNY' ? 1 : seriesFxAt(fxHistory[account.currency], seedDate(-496))
    });

    (spec.extras || []).forEach(x => {
      addRecord(Object.assign({}, x, {
        date: seedDate(x.offset), accountId: account.id,
        amount: 0,
        fxRate: x.fxRate || (account.currency === 'CNY' ? 1 : seriesFxAt(fxHistory[account.currency], seedDate(x.offset)))
      }));
    });
  });

  // 月末估值记录（用于详情页时间线）
  accounts.forEach(account => {
    account.instruments.forEach(inst => {
      const cls = inst.cls;
      const isDeposit = cls === 'deposit';
      const isMoney = cls === 'moneyFund';
      const updateOffsets = isDeposit || isMoney ? [-120, -90, -60, -30] : [-150, -90, -45, -15];
      updateOffsets.forEach(off => {
        const d = seedDate(off);
        addRecord({
          date: d, type: 'price', accountId: account.id, instrumentId: inst.id,
          price: seriesPriceAt(seriesPrices[inst.id], d),
          note: isDeposit ? '利息结转' : isMoney ? '收益结转' : '估值更新',
          fxRate: account.currency === 'CNY' ? 1 : seriesFxAt(fxHistory[account.currency], d)
        });
      });
    });
  });

  records.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const pri = { deposit: 0, buy: 1, sell: 2, dividend: 3, interest: 3, fee: 4, fx: 5, price: 6, withdraw: 7 };
    return (pri[a.type] || 9) - (pri[b.type] || 9);
  });

  const schemes = [
    {
      id: 'scheme_account', name: '账户归属', desc: '按资金所在账户划分',
      groups: [
        { id: 'g_domestic', name: '境内账户', color: '#ff9f45', target: 60, includeAccounts: ['alipay', 'wechat', 'cash', 'boc', 'alipayfund', 'deposit'], includeClasses: [], includeInstruments: [] },
        { id: 'g_global', name: '境外账户', color: '#5b8cff', target: 40, includeAccounts: ['longbridge', 'futu'], includeClasses: [], includeInstruments: [] }
      ]
    },
    {
      id: 'scheme_risk', name: '风险属性', desc: '按资金的风险用途划分',
      groups: [
        { id: 'g_liquid', name: '活钱', color: '#43d6b0', target: 10, includeAccounts: ['alipay', 'wechat', 'cash'], includeClasses: ['moneyFund'], includeInstruments: [] },
        { id: 'g_steady', name: '稳健投资', color: '#5b8cff', target: 38, includeAccounts: ['boc', 'deposit'], includeClasses: ['bondFund', 'bond', 'deposit'], includeInstruments: [] },
        { id: 'g_risk', name: '风险投资', color: '#ff5d6c', target: 52, includeAccounts: ['alipayfund', 'longbridge', 'futu'], includeClasses: ['stock', 'etf', 'equityFund'], includeInstruments: [] }
      ]
    }
  ];

  const storedPrices = {};
  const addPricePoint = (id, date, price) => {
    if (!id || !(Number(price) > 0)) return;
    if (!storedPrices[id]) storedPrices[id] = [];
    const idx = storedPrices[id].findIndex(([d]) => d === date);
    if (idx >= 0) storedPrices[id][idx][1] = Number(price);
    else storedPrices[id].push([date, Number(price), 'record']);
  };
  records.forEach(r => {
    if (!r.instrumentId) return;
    if (r.type === 'buy' || r.type === 'sell' || r.type === 'price') addPricePoint(r.instrumentId, r.date, r.price);
  });
  Object.keys(storedPrices).forEach(id => storedPrices[id].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return {
    version: SCHEMA,
    createdAt: nowISO(),
    isDemo: true,
    settings: {
      base: 'CNY',
      considerFx: true,
      tolerance: 3,
      hideAmounts: false,
      showWeekends: true
    },
    rates: Object.assign({}, SEED_RATES),
    accountTypes: defaultAccountTypes(),
    instrumentTypes: defaultInstrumentTypes(),
    accounts,
    records,
    prices: storedPrices,
    fxHistory,
    schemes,
    rebalance: { schemes: {}, targets: {} },
    meta: { name: '我的投资组合', lastUpdated: nowISO() }
  };
}
