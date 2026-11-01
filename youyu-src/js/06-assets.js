/* =========================================================
   06 · 资产首页 / 账户详情 / 标的详情
   ========================================================= */
function renderAssetsPage() {
  const p = portfolioSummary();
  const daily = buildDailyAnalytics();
  const n = daily.n;
  const sparkVals = daily.total.values.slice(Math.max(0, n - 31));
  const pnlCls = pnlClass(p.unrealized);
  const eyeIcon = state.settings.hideAmounts ? 'eyeOff' : 'eye';
  const heroMoney = moneyParts(p.totalMarket);
  const groups = [
    { key: 'pay', title: '现金与支付', types: ['payment', 'cash'] },
    { key: 'bank', title: '银行与存款', types: ['bank', 'deposit'] },
    { key: 'fund', title: '基金账户', types: ['fund'] },
    { key: 'broker', title: '证券账户', types: ['broker'] }
  ];
  const coveredTypes = new Set(groups.reduce((all, g) => all.concat(g.types), []));
  accountTypes().forEach(t => {
    if (!coveredTypes.has(t.id)) groups.push({ key: 'type_' + t.id, title: t.name, types: [t.id] });
  });
  const knownTypes = new Set(accountTypes().map(t => t.id));
  const unknown = p.accounts.filter(m => !knownTypes.has(m.account.type));
  if (unknown.length) groups.push({ key: 'other', title: '其他账户', types: [] });
  let accountList = '';
  groups.forEach(g => {
    const ms = g.key === 'other' ? p.accounts.filter(m => !knownTypes.has(m.account.type)) : p.accounts.filter(m => g.types.indexOf(m.account.type) >= 0);
    if (!ms.length) return;
    const total = sum(ms, m => m.marketBase);
    accountList += '<div class="list-card">' +
      '<div class="account-group-label"><span>' + g.title + '</span><span>' + fmtMoney(total, { compact: true }) + ' · ' + ms.length + ' 个</span></div>' +
      ms.map(accountRowHTML).join('') + '</div>';
  });
  if (!accountList) {
    accountList = '<div class="list-card">' + emptyBlock('还没有账户', '先添加支付宝、银行卡或证券账户，开始记录你的资产。', '<button class="btn primary sm" data-action="open-add-account">' + icon('plus') + '添加账户</button>', 'wallet') + '</div>';
  }
  return pageTop({
    eyebrow: 'PORTFOLIO OVERVIEW',
    title: '资产',
    sub: '把每一笔钱，放在看得见的地方。',
    actions: '<button class="icon-btn" data-action="toggle-hide" aria-label="隐藏金额">' + icon(eyeIcon) + '</button>' +
      '<button class="icon-btn accent" data-action="open-add-account" aria-label="添加账户">' + icon('plus') + '</button>'
  }) +
  '<section class="hero">' +
    (sparkVals.length > 2 ? '<div class="spark-layer">' + sparklineHTML(sparkVals, { color: p.profit >= 0 ? '#ff9f45' : '#43d6b0' }) + '</div>' : '') +
    '<div class="hero-top"><div class="hero-label">总资产 <span class="tag">含持仓收益</span></div>' +
      '<span style="font-size:8.5px;color:rgba(255,255,255,.32);letter-spacing:.03em">更新至 ' + shortDate(todayKey()) + '</span></div>' +
    '<div class="hero-amount"><span class="cur">' + heroMoney.sym + '</span><span>' + heroMoney.main + '</span>' + (heroMoney.dec ? '<span class="dec">.' + heroMoney.dec + '</span>' : '') + '</div>' +
    '<div class="hero-pnl-list">' +
      '<div class="hero-pnl-line"><span class="k">持仓收益</span><span class="v ' + pnlClass(p.unrealized) + '">' + pnlText(p.unrealized) + '</span></div>' +
      '<div class="hero-pnl-line"><span class="k">累计收益</span><span class="v ' + pnlClass(p.profit) + '">' + pnlText(p.profit) + '</span><span class="pct ' + pnlClass(p.profit) + '">' + (p.returnPct == null ? '—' : fmtPct(p.returnPct, 2)) + '</span></div>' +
    '</div>' +
    '<div class="hero-stats">' +
      '<div class="hero-stat"><div class="lab">投入本金</div><div class="val">' + fmtMoney(p.netDeposits, { compact: true }) + '</div></div>' +
      '<div class="hero-stat"><div class="lab">可用现金</div><div class="val">' + fmtMoney(p.cash, { compact: true }) + '</div></div>' +
      '<div class="hero-stat"><div class="lab">持仓市值</div><div class="val">' + fmtMoney(p.holdings, { compact: true }) + '</div></div>' +
    '</div>' +
    '<div class="hero-note">' + icon('swap') + '<span>按固定汇率折算，不计入收益</span><span class="faint">' + baseCurrency() + '</span></div>' +
  '</section>' +
  '<div class="quick-grid">' +
    '<button class="quick-item" data-action="open-record-picker">' + icon('plus') + '记一笔</button>' +
    '<button class="quick-item blue" data-action="go" data-href="#/calendar">' + icon('calendar') + '收益日历</button>' +
    '<button class="quick-item violet" data-action="go" data-href="#/rebalance">' + icon('scale') + '再平衡</button>' +
  '</div>' +
  '<div class="asset-toolbar"><div class="left"><span class="dot"></span>共 ' + p.accounts.length + ' 个账户 · ' + p.positions + ' 个持仓</div>' +
    '<div class="right"><span class="faint tiny">' + (demoMode ? (state.meta && state.meta.demoHydrated ? '示例数据' : '示例同步中') : '本地账本') + '</span></div></div>' +
  '<section class="section" style="margin-top:10px"><div class="section-head"><div><h2>资产账户</h2><div class="sub">账户资产按固定汇率折算为 ' + baseCurrency() + '</div></div><button class="text-btn" data-action="open-add-account">' + icon('plus') + '新增</button></div>' +
    '<div class="stack-8">' + accountList + '</div></section>' +
  '<div class="version">数据仅保存在本机浏览器 · 建议定期导出备份<br>' + esc(APP_NAME) + ' · ' + (state.meta && state.meta.name ? state.meta.name : '我的投资组合') + '</div>';
}

/* ---------- account detail ---------- */
function renderAccountPage(accountId) {
  const am = computeAccountMetrics(accountId);
  if (!am) return backHead('账户') + '<div class="detail-body">' + emptyBlock('账户不存在', '它可能已经被删除。', '<a class="btn primary sm" href="#/assets">返回资产</a>', 'alert') + '</div>';
  const a = am.account;
  const daily = buildDailyAnalytics();
  const by = daily.byAccount.get(accountId);
  const todayPnl = by ? (by.nativePnls ? by.nativePnls[by.nativePnls.length - 1] : by.pnls[by.pnls.length - 1]) : 0;
  const money = moneyParts(am.marketNative, a.currency);
  const composition = accountComposition(am);
  const records = recordsForAccount(accountId).slice().reverse();
  const flowPeriod = flowPeriodKey('account', accountId);
  return backHead(a.name, '<button class="icon-btn sm" data-action="open-account-menu" data-id="' + esc(a.id) + '" aria-label="更多">' + icon('more') + '</button>', '#/assets') +
  '<div class="detail-body">' +
    '<section class="detail-hero with-color" style="--accent-color:' + a.color + '">' +
      '<div class="detail-head">' + accountIconHTML(a) +
        '<div class="dh-main"><div class="dh-name">' + esc(a.name) + '</div><div class="dh-sub"><span>' + esc(accountTypeName(a.type)) + '</span><span class="dot"></span><span>' + a.currency + '</span><span class="dot"></span><span>' + am.positions + ' 个持仓</span></div></div>' +
        '<span class="ccy" style="font-size:9px;border:1px solid var(--line);border-radius:5px;padding:3px 5px;color:var(--faint)">' + (a.note ? esc(a.note) : '账户') + '</span></div>' +
      '<div class="detail-total"><span class="cur">' + money.sym + '</span><span>' + money.main + '</span>' + (money.dec ? '<span class="cur" style="font-size:15px">.' + money.dec + '</span>' : '') + '</div>' +
      '<div class="detail-pnl"><b class="' + pnlClass(am.profitNative) + '">' + (am.profitNative >= 0 ? '+' : '') + fmtMoney(am.profitNative, { currency: a.currency }) + '</b><span class="' + pnlClass(am.profitNative) + '">' + (am.returnPctNative == null ? '—' : fmtPct(am.returnPctNative, 2)) + '</span><span class="muted">累计收益</span>' +
        '<span class="' + pnlClass(todayPnl) + '" style="margin-left:auto;font-size:9.5px">今日 ' + pnlText(todayPnl, { currency: a.currency }) + '</span></div>' +
      '<div class="detail-stats account-detail-stats">' +
        '<div><div class="l">可用现金</div><div class="v">' + fmtMoney(am.cashNative, { currency: a.currency }) + '</div></div>' +
        '<div><div class="l">持仓市值</div><div class="v">' + fmtMoney(am.holdingsNative, { currency: a.currency }) + '</div></div>' +
        '<div><div class="l">持仓收益</div><div class="v ' + pnlClass(am.unrealizedNative) + '">' + pnlText(am.unrealizedNative, { currency: a.currency }) + '</div></div>' +
        '<div><div class="l">累计已实现</div><div class="v ' + pnlClass(am.realizedNativeAccount) + '">' + pnlText(am.realizedNativeAccount, { currency: a.currency }) + '</div></div>' +
      '</div>' +
    '</section>' +
    (a.currency !== baseCurrency() ? '<div class="info-banner" style="margin-top:12px;margin-bottom:0">' + icon('swap') + '<div>账户统计以 <b>' + a.currency + '</b> 计价，不折算为 ' + baseCurrency() + '；组合总览仍按 ' + baseCurrency() + ' 汇总。参考汇率 1 ' + a.currency + ' = ' + fmtPrice(fxToBase(a.currency), baseCurrency()) + '。</div></div>' : '') +
    accountChartCard(am) +
    '<div class="detail-section"><div class="section-head"><div><h2>资产构成</h2><div class="sub">现金与持仓 · 按当前市值</div></div><span class="tiny">' + a.currency + '</span></div>' +
      '<div class="card pad" style="padding-top:12px;padding-bottom:14px"><div class="donut-layout">' + donutBoxHTML(composition.items, { size: 132, stroke: 15, centerValue: fmtMoney(am.marketNative, { compact: true, currency: a.currency }), centerLabel: '账户资产' }) +
      '<div class="donut-legend">' + donutLegendHTML(composition.items, { compact: true }) + '</div></div></div></div>' +
    '<div class="detail-section" style="margin-top:14px">' + flowDiagramHTML(accountFlow(accountId, flowPeriod), { scope: 'account', id: accountId, periodKey: flowPeriod, periods: flowPeriods('account', accountId), editable: true, currency: a.currency }) + '</div>' +
    '<div class="detail-section"><div class="section-head"><div><h2>持仓</h2><div class="sub">按市值排序 · 点击查看标的</div></div><button class="text-btn" data-action="open-add-instrument" data-account="' + esc(a.id) + '">' + icon('plus') + '添加</button></div>' +
      (am.instruments.filter(x => x.qty > 0.000001).length ? '<div class="list-card">' + am.instruments.filter(x => x.qty > 0.000001).sort((x, y) => y.marketBase - x.marketBase).map(im => holdingRowHTML(im, { currency: a.currency })).join('') + '</div>' :
        '<div class="list-card">' + emptyBlock('这个账户还没有标的', '添加基金、股票或存单，记录买入与估值。', '<button class="btn primary sm" data-action="open-add-instrument" data-account="' + esc(a.id) + '">添加标的</button>', 'fund') + '</div>') +
    '</div>' +
    '<div class="detail-section"><div class="section-head"><div><h2>更新记录</h2><div class="sub">买入、卖出、换汇与估值更新</div></div><button class="text-btn" data-action="open-records" data-scope="account" data-id="' + esc(a.id) + '">全部 ' + records.length + '</button></div>' +
      recordsCardHTML(records, { limit: 6, moreAction: 'open-records', moreScope: 'account', id: a.id }) + '</div>' +
    '<div style="height:12px"></div>' +
  '</div>' +
  '<div class="actionbar"><button class="btn primary" data-action="add-record-account" data-account="' + esc(a.id) + '">' + icon('plus') + '记一笔</button>' +
    '<button class="btn ghost" data-action="open-add-instrument" data-account="' + esc(a.id) + '">' + icon('fund') + '添加标的</button></div>';
}

function accountComposition(am) {
  const fx = fxToBase(am.account.currency) || 1;
  const list = [{ name: '现金', value: Math.max(0, am.cashNative), color: '#8e9aaf' }];
  am.instruments.filter(x => x.qty > 0.000001).forEach(im => {
    list.push({ name: im.inst.name, value: im.marketBase, color: im.inst.color || im.inst.color2 || '#ff9f45' });
  });
  list.sort((a, b) => b.value - a.value);
  if (list.length > 6) {
    const rest = list.slice(5);
    list.splice(5, list.length, { name: '其他 ' + rest.length + ' 项', value: sum(rest, x => x.value), color: '#6b7280' });
  }
  return { items: list };
}

function accountChartCard(am) {
  const a = am.account;
  const period = Number(ui.accountPeriod == null ? 90 : ui.accountPeriod);
  const mode = ui.accountChartMode || 'value';
  const series = accountSeries(a.id);
  const n = series ? series.values.length : 0;
  const labels = { 30: '近1月', 90: '近3月', 365: '近1年', 0: '全部' };
  let chartHTML = '', metricsHTML = '', rangeText = '';
  if (series && n > 2) {
    const start = period ? Math.max(1, n - period) : 1;
    const ps = periodStats(series, dailyStartDateForIndex(series, start), todayKey());
    const tw = twrStats(series, period || n - 1);
    let points;
    if (mode === 'return') points = tw.points.map(p => ({ date: p.date, value: p.value }));
    else points = series.dates.slice(start).map((d, i) => ({ date: d, value: series.values[start + i] }));
    const color = mode === 'return' ? (tw.totalReturn >= 0 ? '#ff5d6c' : '#35d39a') : '#ff9f45';
    chartHTML = lineChartHTML({
      points, mode: mode === 'return' ? 'percent' : 'money', currency: a.currency, color, height: 174,
      baseline: mode === 'return', aria: '账户资产曲线'
    });
    rangeText = points.length ? dateRangeLabel(points[0].date, points[points.length - 1].date) : '';
    const psPnl = ps.pnl;
    metricsHTML = '<div class="metrics">' +
      '<div class="metric"><div class="lab">区间收益</div><div class="val ' + pnlClass(psPnl) + '">' + pnlText(psPnl, { compact: true, currency: a.currency }) + '</div><div class="sub">金额</div></div>' +
      '<div class="metric"><div class="lab">区间收益率</div><div class="val ' + pnlClass(ps.returnPct) + '">' + fmtPct(ps.returnPct, 2) + '</div><div class="sub">时间加权</div></div>' +
      '<div class="metric"><div class="lab">最大回撤</div><div class="val loss">' + fmtPct(tw.maxDrawdown, 2) + '</div><div class="sub">回撤</div></div>' +
      '<div class="metric"><div class="lab">年化收益</div><div class="val ' + pnlClass(tw.annualized) + '">' + fmtPct(tw.annualized, 1) + '</div><div class="sub">参考</div></div>' +
    '</div>';
  } else {
    chartHTML = chartEmptyHTML('还没有足够的历史数据', 174);
  }
  return '<div class="detail-chart-card">' +
    '<div class="chart-head"><div><h2>收益曲线</h2><div class="sub">' + (rangeText || '记账以来') + ' · ' + a.currency + ' 计价' + (a.currency === baseCurrency() ? '' : ' · 不折算') + '</div></div>' +
      '<div class="segmented small chart-toggle"><button class="seg ' + (mode === 'value' ? 'active' : '') + '" data-action="set-account-chart-mode" data-value="value">资产</button><button class="seg ' + (mode === 'return' ? 'active' : '') + '" data-action="set-account-chart-mode" data-value="return">收益率</button></div></div>' +
    chartHTML + metricsHTML +
    '<div class="period-row"><div class="segmented small">' + [30, 90, 365, 0].map(d => '<button class="seg ' + (period === d ? 'active' : '') + '" data-action="set-account-period" data-value="' + d + '">' + labels[d] + '</button>').join('') + '</div>' +
      '<span class="tiny">' + (n > 2 ? '更新至 ' + shortDate(todayKey()) : '') + '</span></div>' +
  '</div>';
}
function dailyStartDateForIndex(series, startIdx) {
  const daily = buildDailyAnalytics();
  return series.dates && series.dates[startIdx] ? series.dates[startIdx] : daily.dates[Math.max(0, startIdx)];
}

/* ---------- instrument detail ---------- */
function renderInstrumentPage(instrumentId) {
  const im = computeInstrumentMetrics(instrumentId);
  if (!im) return backHead('标的') + '<div class="detail-body">' + emptyBlock('标的不存在', '它可能已经被删除。', '<a class="btn primary sm" href="#/assets">返回资产</a>', 'alert') + '</div>';
  const inst = im.inst;
  const a = im.account;
  const money = moneyParts(im.marketNative, inst.currency);
  const records = recordsForInstrument(instrumentId).slice().reverse();
  const isForeign = inst.currency !== baseCurrency();
  const flowPeriod = flowPeriodKey('instrument', instrumentId);
  return backHead(inst.name, '<button class="icon-btn sm" data-action="open-instrument-menu" data-id="' + esc(inst.id) + '" aria-label="更多">' + icon('more') + '</button>', '#/account/' + encodeURIComponent(a.id)) +
  '<div class="detail-body">' +
    '<section class="detail-hero with-color" style="--accent-color:' + inst.color + '">' +
      '<div class="detail-head">' + instrumentIconHTML(inst) +
        '<div class="dh-main"><div class="dh-name">' + esc(inst.name) + '</div><div class="dh-sub"><span class="instrument-symbol">' + esc(inst.symbol) + '</span><span class="dot"></span><span>' + esc(assetClassName(inst.cls)) + '</span><span class="dot"></span><span>' + esc(a.name) + '</span>' + (inst.market ? '<span class="market-connected">' + (inst.demo ? '示例' : '行情') + '</span>' : '') + '</div></div>' +
        '<span class="ccy" style="font-size:9px;border:1px solid var(--line);border-radius:5px;padding:3px 5px;color:var(--faint)">' + inst.currency + '</span></div>' +
      '<div class="detail-total"><span class="cur">' + money.sym + '</span><span>' + money.main + '</span>' + (money.dec ? '<span class="cur" style="font-size:15px">.' + money.dec + '</span>' : '') + '</div>' +
      '<div class="detail-pnl"><b class="' + pnlClass(im.profitNativeInst) + '">' + (im.profitNativeInst >= 0 ? '+' : '') + fmtMoney(im.profitNativeInst, { currency: inst.currency }) + '</b><span class="' + pnlClass(im.returnPctNative) + '">' + fmtPct(im.returnPctNative, 2) + '</span><span class="muted">累计收益</span>' +
        '<span class="' + pnlClass(im.dayPnlNative) + '" style="margin-left:auto;font-size:9.5px">今日 ' + pnlText(im.dayPnlNative, { currency: inst.currency }) + ' · ' + fmtPct(im.dayPct, 2) + '</span></div>' +
      '<div class="detail-stats">' +
        '<div><div class="l">最新价</div><div class="v">' + fmtPrice(im.price, inst.currency) + '</div></div>' +
        '<div><div class="l">持仓数量</div><div class="v">' + fmtQty(im.qty) + '<small>' + qtyUnit(inst.cls) + '</small></div></div>' +
        '<div><div class="l">持仓成本</div><div class="v">' + fmtMoney(im.costNative, { compact: true, currency: inst.currency }) + '</div></div>' +
      '</div>' +
    '</section>' +
    instrumentChartCard(im) +
    '<div class="detail-section"><div class="section-head"><div><h2>持仓概览</h2><div class="sub">当前持仓与收益拆解</div></div><span class="tiny">' + inst.currency + '</span></div>' +
      '<div class="list-card card-pad-sm" style="padding:4px 14px">' +
        positionRow('持仓市值', fmtMoney(im.marketNative, { currency: inst.currency }), '账户币种计价') +
        positionRow('平均成本', fmtPrice(im.avgCost, inst.currency) + ' × ' + fmtQty(im.qty) + qtyUnit(inst.cls), '成本金额 ' + fmtMoney(im.costNative, { currency: inst.currency })) +
        positionRow('浮动盈亏', '<span class="' + pnlClass(im.unrealizedNativeInst) + '">' + pnlText(im.unrealizedNativeInst, { currency: inst.currency }) + '</span>', '价格变化') +
        positionRow('累计已实现', '<span class="' + pnlClass(im.realized) + '">' + pnlText(im.realized, { currency: inst.currency }) + '</span>', '已卖出部分') +
        (im.dividendNative > 0 ? positionRow('累计分红', '<span class="gain">' + pnlText(im.dividendNative, { currency: inst.currency }) + '</span>', '已计入收益') : '') +
        positionRow('持有天数', im.firstDate ? im.holdingDays + ' 天' : '—', im.firstDate ? '首次买入 ' + im.firstDate : '暂无交易') +
        (inst.market ? positionRow('行情来源', esc('腾讯行情 · ' + (inst.market.label || '') + ' ' + (inst.market.symbol || '')), inst.market.lastUpdated ? '最近同步 ' + inst.market.lastUpdated : '尚未同步，可点击刷新行情') : '') +
      '</div></div>' +
    '<div class="detail-section" style="margin-top:14px">' + flowDiagramHTML(instrumentFlow(instrumentId, flowPeriod), { isInstrument: true, scope: 'instrument', id: instrumentId, periodKey: flowPeriod, periods: flowPeriods('instrument', instrumentId), editable: false, currency: inst.currency }) + '</div>' +
    (isForeign ? '<div class="info-banner">' + icon('swap') + '<div>以 ' + inst.currency + ' 计价，按当前汇率 <b>1 ' + inst.currency + ' = ' + fmtPrice(fxToBase(inst.currency), baseCurrency()) + '</b> 折算。汇兑损益 <b class="' + pnlClass(im.fxPnl) + '">' + pnlText(im.fxPnl) + '</b> ' + (state.settings.considerFx ? '已计入' : '未计入') + '累计收益。</div></div>' : '') +
    '<div class="detail-section"><div class="section-head"><div><h2>更新记录</h2><div class="sub">买入、卖出、分红与估值更新</div></div><button class="text-btn" data-action="open-records" data-scope="instrument" data-id="' + esc(inst.id) + '">全部 ' + records.length + '</button></div>' +
      recordsCardHTML(records, { limit: 7, moreAction: 'open-records', moreScope: 'instrument', id: inst.id }) + '</div>' +
    '<div style="height:12px"></div>' +
  '</div>' +
  '<div class="actionbar"><button class="btn primary" data-action="add-record-instrument" data-instrument="' + esc(inst.id) + '">' + icon('plus') + '记一笔</button>' +
    (inst.market ? '<button class="btn ghost" data-action="refresh-quote" data-id="' + esc(inst.id) + '">' + icon('refresh') + '刷新行情</button>' : '<button class="btn ghost" data-action="open-price-update" data-instrument="' + esc(inst.id) + '">' + icon('refresh') + '更新价格</button>') + '</div>';
}

function positionRow(label, value, sub) {
  return '<div class="position-row"><div class="l">' + esc(label) + (sub ? '<div style="font-size:8px;color:var(--faint);margin-top:2px">' + esc(sub) + '</div>' : '') + '</div><div class="v">' + value + '</div></div>';
}

function instrumentChartCard(im) {
  const inst = im.inst;
  const period = Number(ui.instrumentPeriod == null ? 365 : ui.instrumentPeriod);
  const mode = ui.instrumentChartMode === 'profit' ? 'profit' : 'price';
  const labels = { 30: '近1月', 90: '近3月', 365: '近1年', 0: '全部' };
  const list = priceSeriesRange(inst.id, period || 0);
  let chartHTML = '', metricsHTML = '', rangeText = '', lastDate = '';
  if (mode === 'profit') {
    const series = instrumentProfitSeries(im);
    if (series.length > 1) {
      let peak = -Infinity, maxDd = 0;
      series.forEach(p => { if (p.value > peak) peak = p.value; if (Number.isFinite(peak)) maxDd = Math.min(maxDd, p.value - peak); });
      const finalProfit = im.profitNativeInst;
      const color = finalProfit >= 0 ? '#ff5d6c' : '#35d39a';
      chartHTML = lineChartHTML({
        points: series, mode: 'amount', currency: inst.currency,
        color, height: 174, baseline: true, aria: '标的累计收益曲线'
      });
      rangeText = dateRangeLabel(series[0].date, series[series.length - 1].date);
      lastDate = series[series.length - 1].date;
      metricsHTML = '<div class="metrics">' +
        '<div class="metric"><div class="lab">累计收益</div><div class="val ' + pnlClass(finalProfit) + '">' + fmtMoney(finalProfit, { currency: inst.currency }) + '</div><div class="sub">' + inst.currency + '</div></div>' +
        '<div class="metric"><div class="lab">最大回撤</div><div class="val loss">' + fmtMoney(maxDd, { currency: inst.currency }) + '</div><div class="sub">金额</div></div>' +
        '<div class="metric"><div class="lab">持仓收益</div><div class="val ' + pnlClass(im.unrealizedNativeInst) + '">' + fmtMoney(im.unrealizedNativeInst, { currency: inst.currency }) + '</div><div class="sub">未实现</div></div>' +
        '<div class="metric"><div class="lab">累计已实现</div><div class="val ' + pnlClass(im.realized) + '">' + fmtMoney(im.realized, { currency: inst.currency }) + '</div><div class="sub">已落袋</div></div>' +
      '</div>';
    } else {
      chartHTML = chartEmptyHTML('还没有足够的累计收益数据', 174);
    }
  } else if (list.length > 2) {
    const startPrice = list[0][1] || 1;
    const endPrice = list[list.length - 1][1];
    let peak = -Infinity, maxDd = 0;
    list.forEach(([d, p]) => { if (p > peak) peak = p; if (peak > 0) maxDd = Math.min(maxDd, p / peak - 1); });
    const ret = startPrice > 0 ? endPrice / startPrice - 1 : 0;
    const days = Math.max(1, daysBetween(list[0][0], list[list.length - 1][0]));
    const annualized = Math.pow(Math.max(0.0001, endPrice / startPrice), 365 / days) - 1;
    const points = list.map(([d, p]) => ({ date: d, value: p }));
    chartHTML = lineChartHTML({
      points, mode: 'price', currency: inst.currency,
      color: inst.color || '#ff9f45',
      height: 174, baseline: false, aria: '标的价格曲线'
    });
    rangeText = dateRangeLabel(list[0][0], list[list.length - 1][0]);
    lastDate = list[list.length - 1][0];
    metricsHTML = '<div class="metrics">' +
      '<div class="metric"><div class="lab">区间涨跌</div><div class="val ' + pnlClass(ret) + '">' + fmtPct(ret, 2) + '</div><div class="sub">价格</div></div>' +
      '<div class="metric"><div class="lab">最大回撤</div><div class="val loss">' + fmtPct(maxDd, 2) + '</div><div class="sub">区间</div></div>' +
      '<div class="metric"><div class="lab">年化涨跌</div><div class="val ' + pnlClass(annualized) + '">' + fmtPct(annualized, 1) + '</div><div class="sub">参考</div></div>' +
      '<div class="metric"><div class="lab">最新价</div><div class="val">' + fmtPrice(endPrice, inst.currency) + '</div><div class="sub">' + inst.currency + '</div></div>' +
    '</div>';
  } else {
    chartHTML = chartEmptyHTML(inst.market ? '正在获取历史行情…' : '还没有足够的价格历史', 174);
  }
  const ccyLabel = mode === 'profit' ? inst.currency + ' 累计收益' : inst.currency + ' 原币计价';
  const sourceLabel = inst.market ? '行情自动同步' : '按记录生成';
  return '<div class="detail-chart-card">' +
    '<div class="chart-head"><div><h2>' + (mode === 'profit' ? '累计收益' : '价格走势') + '</h2><div class="sub">' + (rangeText || '暂无数据') + ' · ' + ccyLabel + ' · ' + sourceLabel + '</div></div>' +
      '<div class="segmented small chart-toggle"><button class="seg ' + (mode === 'price' ? 'active' : '') + '" data-action="set-instrument-chart-mode" data-value="price">价格</button><button class="seg ' + (mode === 'profit' ? 'active' : '') + '" data-action="set-instrument-chart-mode" data-value="profit">累计收益</button></div></div>' +
    chartHTML + metricsHTML +
    '<div class="period-row"><div class="segmented small">' + [30, 90, 365, 0].map(d => '<button class="seg ' + (period === d ? 'active' : '') + '" data-action="set-instrument-period" data-value="' + d + '">' + labels[d] + '</button>').join('') + '</div>' +
      '<span class="tiny">' + (lastDate ? shortDate(lastDate) : '') + '</span></div>' +
  '</div>';
}
