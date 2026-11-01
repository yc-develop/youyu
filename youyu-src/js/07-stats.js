/* =========================================================
   07 · 统计 / 资产构成 / 桑基图 / 组合走势
   ========================================================= */
function statsSchemeId() {
  if (!ui.statsSchemeId || !schemes().some(s => s.id === ui.statsSchemeId)) ui.statsSchemeId = '__auto_account';
  return ui.statsSchemeId;
}

function renderStatsPage() {
  const sid = statsSchemeId();
  const scheme = schemeById(sid);
  const gb = groupBreakdown(sid);
  const p = portfolioSummary();
  const items = visualGroupItems(gb.items.filter(x => x.value > 0), 8);
  const groupReturns = groupPeriodSummary(sid, 365);
  const retMap = new Map(groupReturns.map(x => [x.group.id, x]));
  const sankeyMode = ui.sankeyMode || 'account';
  const builtin = !!scheme.builtin;
  const manageSid = sid;
  return pageTop({
    eyebrow: 'ALLOCATION & FLOW',
    title: '统计',
    sub: '从整体到细项，看清资产的结构。',
    actions: '<button class="icon-btn" data-action="toggle-hide" aria-label="隐藏金额">' + icon(state.settings.hideAmounts ? 'eyeOff' : 'eye') + '</button>' +
      (manageSid ? '<a class="icon-btn" href="#/groups/' + encodeURIComponent(manageSid) + '" aria-label="管理分组">' + icon('grid') + '</a>' : '')
  }) +
  schemeChipsHTML(sid, 'select-stats-scheme') +
  '<div class="stat-hero"><div><div class="eyebrow">组合总资产</div><div class="big">' + fmtMoney(p.totalMarket) + '</div><div class="cap">含持仓收益 · ' + p.accounts.length + ' 个账户 · ' + p.positions + ' 个持仓</div></div>' +
    '<div class="right">累计收益<b class="' + pnlClass(p.profit) + '">' + pnlText(p.profit) + '</b><span class="' + pnlClass(p.returnPct) + '">' + (p.returnPct == null ? '—' : fmtPct(p.returnPct, 2)) + '</span></div></div>' +
  '<section class="card pad" style="margin-top:12px">' +
    '<div class="card-head" style="padding:0"><div><h2>资产构成</h2><div class="sub">' + esc(scheme ? scheme.name : '') + ' · 按当前市值</div></div><span class="tiny">' + esc(baseCurrency()) + '</span></div>' +
    '<div class="donut-layout stats-donut-layout" style="margin-top:16px">' + donutBoxHTML(items, { size: 150, stroke: 16, centerValue: fmtMoney(gb.total, { compact: true }), centerLabel: '总资产' }) +
      '<div class="donut-legend">' + donutLegendHTML(items, { compact: !!scheme.builtin }) + '</div></div>' +
    (gb.ungrouped && gb.ungrouped.value > 0 ? '<div class="info-banner warn" style="margin-top:14px">' + icon('alert') + '<div>有 ' + fmtMoney(gb.ungrouped.value, { compact: true }) + ' 资产尚未归入分组。前往分组管理把账户或标的加入分组。</div></div>' : '') +
    '<div class="divider-line"></div>' +
    '<div class="row-between"><span class="tiny">' + (builtin ? '默认自动分组 · 按当前持仓实时计算' : '目标配置：' + (gb.items.filter(x => x.id !== '__ungrouped').map(x => x.normalizedTarget.toFixed(0) + '%').join(' / ') || '未设置')) + '</span>' +
      (builtin ? '<button class="text-btn" data-action="go" data-href="#/settings">管理分组 ' + icon('chevronRight') + '</button>' : '<button class="text-btn" data-action="go" data-href="#/rebalance">查看再平衡 ' + icon('chevronRight') + '</button>') + '</div>' +
  '</section>' +
  '<section class="card" style="margin-top:14px;padding:18px 18px 13px">' +
    '<div class="card-head" style="padding:0"><div><h2>资金流向</h2><div class="sub">总资产 → 分组 → ' + (sankeyMode === 'instrument' ? '底层标的' : '账户') + '</div></div>' +
      '<div class="segmented small chart-toggle" style="width:112px"><button class="seg ' + (sankeyMode === 'account' ? 'active' : '') + '" data-action="set-sankey-mode" data-value="account">账户</button><button class="seg ' + (sankeyMode === 'instrument' ? 'active' : '') + '" data-action="set-sankey-mode" data-value="instrument">标的</button></div></div>' +
    sankeyHTML(sid, sankeyMode) +
    '<div class="sankey-hint">' + icon('swap') + '色带代表分组资金 · 按当前市值</div>' +
  '</section>' +
  '<section class="detail-section" style="margin:18px 0 0"><div class="section-head"><div><h2>分组明细</h2><div class="sub">实际占比与近一年表现</div></div><span class="tiny">点击查看构成</span></div>' +
    '<div class="card pad" style="padding-top:4px;padding-bottom:6px">' + statsGroupRows(gb, retMap, scheme) + '</div></section>' +
  '<div style="height:8px"></div>';
}

function visualGroupItems(items, max) {
  const list = (items || []).slice().sort((a, b) => (b.value || 0) - (a.value || 0));
  const limit = max || 8;
  if (list.length <= limit) return list.map(x => ({ name: x.name, value: x.value, color: x.color }));
  const head = list.slice(0, limit - 1).map(x => ({ name: x.name, value: x.value, color: x.color }));
  const rest = list.slice(limit - 1);
  head.push({ name: '其他 ' + rest.length + ' 项', value: sum(rest, x => x.value), color: '#6b7280' });
  return head;
}

function statsGroupRows(gb, retMap, scheme) {
  const auto = !!(scheme && scheme.builtin);
  const rows = auto ? gb.items.filter(x => x.value > 0) : gb.items;
  return rows.map(it => {
    const ret = retMap.get(it.id);
    return '<button class="stats-row" data-action="open-group-detail" data-id="' + esc(it.id) + '">' +
      '<span class="dot" style="background:' + it.color + '"></span>' +
      '<span class="main"><span class="t">' + esc(it.name) + (!auto && it.status === 'high' ? ' <span style="font-size:8px;color:var(--gain)">超配</span>' : !auto && it.status === 'low' ? ' <span style="font-size:8px;color:var(--blue)">低配</span>' : '') + '</span>' +
        '<span class="s">' + fmtMoney(it.value, { compact: true }) + (auto ? ' · 自动分组' : ' · 目标 ' + (it.id === '__ungrouped' ? '—' : it.normalizedTarget.toFixed(1) + '%')) + '</span></span>' +
      '<span class="val"><b>' + (gb.total > 0 ? (it.pct * 100).toFixed(1) + '%' : '—') + '</b>' +
        '<span class="' + (ret ? pnlClass(ret.returnPct) : 'faint') + '">' + (ret ? fmtPct(ret.returnPct, 1) : '—') + ' · 近一年</span></span>' +
      '<span class="chev">' + icon('chevronRight') + '</span></button>';
  }).join('') || '<div class="tiny" style="padding:20px;text-align:center">暂无分组数据</div>';
}

function portfolioTrendCard(p, opts) {
  const o = opts || {};
  const days = Number(ui.trendPeriod == null ? 365 : ui.trendPeriod);
  const metric = o.metric || ui.trendMetric || 'amount';
  const daily = buildDailyAnalytics();
  const series = o.series || daily.total;
  const tw = twrStats(series, days || daily.n - 1);
  const pnl = sum(series.pnls.slice(Math.max(1, daily.n - 1 - (days || daily.n - 1))));
  const title = o.title || '组合走势';
  const scope = o.scopeName || '全部资产';
  const labels = { 30: '1月', 90: '3月', 365: '1年', 0: '全部' };
  const lookback = days || daily.n - 1;
  const start = Math.max(1, daily.n - 1 - lookback);
  let points = [];
  if (metric === 'amount') {
    let cumulative = 0;
    points.push({ date: daily.dates[Math.max(0, start - 1)], value: 0 });
    for (let i = start; i < daily.n; i++) {
      cumulative += series.pnls[i] || 0;
      points.push({ date: daily.dates[i], value: cumulative });
    }
  } else {
    points = tw.points.map(x => ({ date: x.date, value: x.value }));
  }
  let chart = '';
  if (points.length > 1) {
    chart = lineChartHTML({
      points,
      mode: metric === 'amount' ? 'amount' : 'percent',
      currency: baseCurrency(),
      color: (metric === 'amount' ? pnl : tw.totalReturn) >= 0 ? '#ff5d6c' : '#35d39a',
      height: 156, baseline: true,
      aria: scope + (metric === 'amount' ? '收益金额走势' : '收益率走势')
    });
  } else chart = chartEmptyHTML('还没有足够的历史数据', 156);
  const pill = metric === 'amount' ? pnlText(pnl, { compact: true }) : fmtPct(tw.totalReturn, 2);
  const sub = metric === 'amount' ? '累计收益金额' : '时间加权收益率';
  return '<section class="detail-chart-card" style="margin:14px 0 0;border-radius:20px">' +
    '<div class="chart-head"><div><h2>' + esc(title) + '</h2><div class="sub">' + sub + ' · ' + esc(scope) + ' · ' + (state.settings.considerFx ? '含汇率影响' : '不含汇率影响') + '</div></div>' +
      '<span class="pill-btn" style="height:26px;font-size:9px;padding:0 9px">' + icon('trendUp') + pill + '</span></div>' +
    chart +
    '<div class="trend-metric-row"><div class="segmented small" style="width:112px"><button class="seg ' + (metric === 'amount' ? 'active' : '') + '" data-action="set-trend-metric" data-value="amount">金额</button><button class="seg ' + (metric === 'percent' ? 'active' : '') + '" data-action="set-trend-metric" data-value="percent">收益率</button></div>' +
      '<span class="tiny">更新至 ' + shortDate(todayKey()) + '</span></div>' +
    '<div class="metrics">' +
      '<div class="metric"><div class="lab">区间收益</div><div class="val ' + pnlClass(pnl) + '">' + pnlText(pnl, { compact: true }) + '</div><div class="sub">金额</div></div>' +
      '<div class="metric"><div class="lab">最大回撤</div><div class="val loss">' + fmtPct(tw.maxDrawdown, 2) + '</div><div class="sub">回撤</div></div>' +
      '<div class="metric"><div class="lab">年化收益</div><div class="val ' + pnlClass(tw.annualized) + '">' + fmtPct(tw.annualized, 2) + '</div><div class="sub">参考</div></div>' +
      '<div class="metric"><div class="lab">正收益天</div><div class="val">' + (tw.positiveRate * 100).toFixed(0) + '%</div><div class="sub">胜率</div></div>' +
    '</div>' +
    '<div class="period-row"><div class="segmented small">' + [30, 90, 365, 0].map(d => '<button class="seg ' + (days === d ? 'active' : '') + '" data-action="set-trend-period" data-value="' + d + '">' + labels[d] + '</button>').join('') + '</div>' +
      '<span class="tiny">' + (metric === 'amount' ? '累计盈亏' : '时间加权') + '</span></div>' +
  '</section>';
}

function openGroupDetailSheet(groupId, schemeId) {
  const sid = schemeId || statsSchemeId();
  const scheme = schemeById(sid);
  const g = groupById(sid, groupId);
  if (!g) return;
  const gb = groupBreakdown(sid);
  const item = gb.items.find(x => x.id === groupId);
  const comps = groupComponents(sid, groupId);
  const total = item ? item.value : sum(comps, c => c.value);
  const builtin = !!scheme.builtin;
  const ret = groupPeriodSummary(sid, 365).find(x => x.group.id === groupId);
  const list = comps.length ? comps.map(c => {
    const pct = total > 0 ? c.value / total : 0;
    return '<div class="bar-row"><div class="bar-top"><span class="dot" style="background:' + (c.instrument ? c.instrument.color : (c.account.color || '#8e9aaf')) + '"></span>' +
      '<span class="name">' + esc(c.name) + '</span><span class="pct">' + (pct * 100).toFixed(1) + '%</span></div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + (pct * 100).toFixed(1) + '%;background:' + (c.instrument ? c.instrument.color : (c.account.color || '#8e9aaf')) + '"></div></div>' +
      '<div class="amt">' + fmtMoney(c.value) + (c.account ? ' · ' + esc(c.account.name) : '') + '</div></div>';
  }).join('') : '<div class="tiny" style="padding:16px 0">这个分组还没有资产</div>';
  const body = '<div class="stat-hero" style="margin-bottom:0"><div><div class="eyebrow">' + esc(scheme.name) + ' · 分组构成</div><div class="big" style="font-size:25px">' + fmtMoney(total) + '</div><div class="cap">占组合 ' + (gb.total > 0 ? (total / gb.total * 100).toFixed(1) : '0') + '% · 目标 ' + (Number(g.target) || 0).toFixed(0) + '%</div></div>' +
    '<div class="right">近一年<b class="' + (ret ? pnlClass(ret.returnPct) : '') + '">' + (ret ? fmtPct(ret.returnPct, 2) : '—') + '</b><span>收益率</span></div></div>' +
    '<div class="info-banner" style="margin-top:14px">' + icon('info') + '<div>' + esc(groupIncludeSummary(g)) + '</div></div>' +
    '<div class="bar-list" style="margin-top:16px">' + list + '</div>' +
    '<div style="height:8px"></div>';
  openSheet({ title: g.name, sub: '分组构成与表现', body, footer: builtin ? '<button class="btn ghost" data-sheet-close>关闭</button>' : '<button class="btn ghost" data-action="open-group-editor" data-id="' + esc(g.id) + '" data-scheme="' + esc(sid) + '">编辑分组</button><button class="btn primary" data-action="open-target-editor" data-scheme="' + esc(sid) + '">调整目标</button>' });
}
