/* =========================================================
   08 · 收益日历（日 / 周 / 月 / 年）
   ========================================================= */
function calendarSchemeId() {
  if (!ui.calendarSchemeId || !schemes().some(s => s.id === ui.calendarSchemeId)) ui.calendarSchemeId = '__auto_account';
  return ui.calendarSchemeId;
}
function calendarGroupId(schemeId) {
  const sid = schemeId || calendarSchemeId();
  if (!ui.calendarGroupId) ui.calendarGroupId = 'all';
  if (ui.calendarGroupId === 'all' || ui.calendarGroupId === '__ungrouped') return ui.calendarGroupId;
  return groupById(sid, ui.calendarGroupId) ? ui.calendarGroupId : 'all';
}
function calendarSeries(schemeId, groupId) {
  const daily = buildDailyAnalytics();
  if (!groupId || groupId === 'all') return { name: '全部资产', color: '#ff9f45', values: daily.total.values, pnls: daily.total.pnls, dates: daily.dates };
  const gs = groupDailySeries(schemeId);
  const g = gs.groups.find(x => x.id === groupId);
  if (!g) return { name: '全部资产', color: '#ff9f45', values: daily.total.values, pnls: daily.total.pnls, dates: daily.dates };
  return { name: g.name, color: g.color, values: g.values, pnls: g.pnls, dates: daily.dates };
}
function calendarDatePnl(series, date) {
  const daily = buildDailyAnalytics();
  const idx = daily.indexMap.get(date);
  if (idx == null) return { pnl: 0, ret: 0 };
  const p = series.pnls[idx] || 0;
  const prev = idx > 0 ? series.values[idx - 1] : 0;
  return { pnl: p, ret: prev > 0 ? p / prev : 0 };
}

function renderCalendarPage() {
  const sid = calendarSchemeId();
  const scheme = schemeById(sid);
  const gid = calendarGroupId(sid);
  const daily = buildDailyAnalytics();
  const mode = ui.calendarMode || 'day';
  const metric = ui.calendarMetric || 'amount';
  const series = calendarSeries(sid, gid);
  if (!ui.calendarMonth) ui.calendarMonth = startOfMonth(todayKey());
  const month = ui.calendarMonth;
  const year = Number(ui.calendarYear) || parseDay(month).getFullYear();
  ui.calendarYear = year;
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const groups = scheme ? scheme.groups : [];
  const groupChips = '<div class="chip-row" style="margin-bottom:12px"><button class="chip ' + (gid === 'all' ? 'active' : '') + '" data-action="select-calendar-group" data-id="all">全部资产</button>' +
    groups.map(g => '<button class="chip ' + (gid === g.id ? 'active' : '') + '" data-action="select-calendar-group" data-id="' + esc(g.id) + '"><span class="dot" style="background:' + g.color + '"></span>' + esc(g.name) + '</button>').join('') +
    '</div>';

  let periodStart, periodEnd, summaryLabel;
  if (mode === 'day' || mode === 'week') {
    periodStart = monthStart; periodEnd = monthEnd < todayKey() ? monthEnd : todayKey(); summaryLabel = '当月收益';
  } else if (mode === 'month') {
    periodStart = year + '-01-01'; periodEnd = year + '-12-31' < todayKey() ? year + '-12-31' : todayKey(); summaryLabel = '本年收益';
  } else {
    periodStart = daily.dates[0]; periodEnd = todayKey(); summaryLabel = '记账以来';
  }
  let summary = periodStats(series, periodStart, periodEnd);
  if (periodStart > todayKey()) summary = periodStats(series, todayKey(), todayKey());
  const totalPnl = summary.pnl;
  const summaryMain = metric === 'percent' ? fmtPct(summary.returnPct, 2) : (totalPnl > 0 ? '+' : totalPnl < 0 ? '-' : '') + fmtMoney(Math.abs(totalPnl));
  const best = summary.best || { pnl: 0, date: periodStart };

  const header = pageTop({
    eyebrow: 'GAIN CALENDAR',
    title: '收益日历',
    sub: '每天的涨跌，都是长期的一部分。',
    actions: '<button class="icon-btn" data-action="calendar-today" aria-label="回到本月">' + icon('target') + '</button>'
  });

  const controls = schemeChipsHTML(sid, 'select-calendar-scheme') + groupChips +
    '<div class="cal-toolbar"><div class="segmented">' +
      [['day', '日'], ['week', '周'], ['month', '月'], ['year', '年']].map(([k, l]) => '<button class="seg ' + (mode === k ? 'active' : '') + '" data-action="set-calendar-mode" data-value="' + k + '">' + l + '</button>').join('') +
    '</div><div class="segmented mini-toggle">' +
      [['amount', '金额'], ['percent', '收益率']].map(([k, l]) => '<button class="seg ' + (metric === k ? 'active' : '') + '" data-action="set-calendar-metric" data-value="' + k + '">' + l + '</button>').join('') +
    '</div></div>';

  const summaryHTML = '<section class="cal-summary">' +
    '<div class="l">' + summaryLabel + ' <span class="faint">· ' + esc(series.name) + '</span></div>' +
    '<div class="v ' + pnlClass(totalPnl) + '">' + summaryMain + '</div>' +
    '<div class="sub"><b class="' + pnlClass(summary.returnPct) + '">' + fmtPct(summary.returnPct, 2) + '</b><span>区间收益率</span><span class="faint">' + (summary.positiveDays || 0) + ' 天盈利 / ' + (summary.negativeDays || 0) + ' 天亏损</span></div>' +
    '<div class="cal-mini-stats"><div><div class="l">最佳单日</div><div class="n gain">' + (best.pnl >= 0 ? '+' : '') + fmtMoney(best.pnl, { compact: true }) + '</div></div>' +
      '<div><div class="l">日均收益</div><div class="n ' + pnlClass(totalPnl) + '">' + fmtMoney(summary.days ? totalPnl / summary.days : 0, { compact: true }) + '</div></div>' +
      '<div><div class="l">胜率</div><div class="n">' + ((summary.positiveDays + summary.negativeDays) > 0 ? Math.round(summary.positiveDays / (summary.positiveDays + summary.negativeDays) * 100) : 0) + '%</div></div></div>' +
  '</section>';

  let bodyHTML = '';
  if (mode === 'day') bodyHTML = dayCalendarHTML(series, month, metric);
  else if (mode === 'week') bodyHTML = weekCalendarHTML(series, month);
  else if (mode === 'month') bodyHTML = monthCalendarHTML(series, year);
  else bodyHTML = yearCalendarHTML(series) + yearInsightHTML(series, year);

  const navTitle = mode === 'day' || mode === 'week' ? monthCN(month) : mode === 'month' ? year + '年' : '年度收益';
  const currentYear = parseDay(todayKey()).getFullYear();
  const atLatest = (mode === 'day' || mode === 'week') ? startOfMonth(month) >= startOfMonth(todayKey()) : mode === 'month' ? year >= currentYear : true;
  const nav = mode === 'year' ? '' : '<div class="cal-head"><div class="title">' + navTitle + '</div><div class="nav">' +
    '<button class="icon-btn" data-action="cal-prev" aria-label="上一页">' + icon('chevronLeft') + '</button>' +
    '<button class="icon-btn" data-action="cal-next" aria-label="下一页"' + (atLatest ? ' disabled' : '') + '>' + icon('chevronRight') + '</button></div></div>';

  return header + controls + summaryHTML + nav + bodyHTML +
    '<div class="cal-legend"><span>' + (mode === 'day' || mode === 'week' ? '当月每日盈亏' : mode === 'month' ? '本年每月盈亏' : '年度收益') + '</span><div class="scale"><span class="loss">亏</span><i class="l3"></i><i class="l2"></i><i class="l1"></i><i></i><i class="g1"></i><i class="g2"></i><i class="g3"></i><span class="gain">盈</span></div></div>' +
    '<div style="height:10px"></div>' +
    portfolioTrendCard(portfolioSummary(), { series, title: gid === 'all' ? '组合走势' : series.name + '走势', scopeName: series.name }) +
    '<div style="height:10px"></div>';
}

function dayCalendarHTML(series, month, metric) {
  const daily = buildDailyAnalytics();
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const firstDay = parseDay(first).getDay();
  const total = daysInMonth(month);
  const recDates = new Set(state.records.map(r => r.date));
  let maxAbs = 1;
  for (let i = 1; i <= total; i++) {
    const d = first.slice(0, 8) + String(i).padStart(2, '0');
    const p = calendarDatePnl(series, d).pnl;
    if (Math.abs(p) > maxAbs) maxAbs = Math.abs(p);
  }
  let cells = '';
  for (let i = 0; i < firstDay; i++) cells += '<div class="cal-cell blank"></div>';
  for (let i = 1; i <= total; i++) {
    const d = first.slice(0, 8) + String(i).padStart(2, '0');
    const future = d > todayKey();
    const { pnl, ret } = calendarDatePnl(series, d);
    const tier = Math.min(4, Math.ceil(Math.abs(pnl) / maxAbs * 4));
    const cls = future ? 'future' : pnl > 0.0001 ? 'gain-bg t' + tier : pnl < -0.0001 ? 'loss-bg t' + tier : '';
    const today = d === todayKey() ? ' today' : '';
    let amount = '';
    if (!future) {
      if (metric === 'percent') amount = Math.abs(ret) > 0.000001 ? fmtPct(ret, Math.abs(ret) < 0.001 ? 3 : 2) : '';
      else amount = Math.abs(pnl) > 0.005 ? moneyShort(pnl) : '';
    }
    const pctSmall = metric === 'amount' && !future && Math.abs(ret) > 0.0001 ? '<div class="cal-pct">' + fmtPct(ret, 1) + '</div>' : '';
    cells += '<button class="cal-cell ' + cls + today + '" data-action="open-calendar-day" data-date="' + d + '"' + (future ? ' disabled' : '') + '>' +
      '<span class="cal-day"><span>' + i + '</span>' + (recDates.has(d) ? '<span class="rec-dot"></span>' : '') + '</span>' +
      '<span><span class="cal-amt ' + (pnl > 0 ? 'gain' : pnl < 0 ? 'loss' : '') + '">' + esc(amount) + '</span>' + pctSmall + '</span></button>';
  }
  const trailing = (7 - ((firstDay + total) % 7)) % 7;
  for (let i = 0; i < trailing; i++) cells += '<div class="cal-cell blank"></div>';
  return '<div class="weekdays">' + ['日', '一', '二', '三', '四', '五', '六'].map(x => '<span>' + x + '</span>').join('') + '</div>' +
    '<div class="cal-grid">' + cells + '</div>';
}

function weekCalendarHTML(series, month) {
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const startSunday = weekStart(first);
  const daily = buildDailyAnalytics();
  const rows = [];
  for (let w = 0; w < 6; w++) {
    const rawWs = addDays(startSunday, w * 7);
    const rawWe = addDays(rawWs, 6);
    if (rawWs > last) break;
    if (rawWe < first) continue;
    const ws = rawWs < first ? first : rawWs;
    const we = rawWe > last ? last : rawWe;
    const end = we > todayKey() ? todayKey() : we;
    if (ws > todayKey()) continue;
    const ps = periodStats(series, ws, end);
    rows.push({ ws, we, ps, idx: w + 1 });
  }
  const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.ps.pnl)));
  return '<div class="week-list">' + (rows.length ? rows.map(r => {
    const pct = r.ps.returnPct;
    const w = Math.max(2, Math.abs(r.ps.pnl) / maxAbs * 100);
    return '<button class="week-row" data-action="open-calendar-week" data-start="' + r.ws + '">' +
      '<span class="wk"><b>W' + r.idx + '</b><span>' + dateRangeLabel(r.ws, r.we) + '</span></span>' +
      '<span class="wk-main"><span class="r">' + r.ps.positiveDays + ' 天盈利 · ' + r.ps.negativeDays + ' 天亏损</span><span class="week-bar"><i style="width:' + w.toFixed(1) + '%;background:' + (r.ps.pnl >= 0 ? 'var(--gain)' : 'var(--loss)') + '"></i></span></span>' +
      '<span class="wk-val ' + pnlClass(r.ps.pnl) + '">' + (r.ps.pnl >= 0 ? '+' : '') + fmtMoney(r.ps.pnl, { compact: true }) + '<span>' + fmtPct(pct, 2) + '</span></span></button>';
  }).join('') : '<div class="cal-empty">这个月还没有收益记录</div>') + '</div>';
}

function monthCalendarHTML(series, year) {
  let cells = '';
  for (let m = 0; m < 12; m++) {
    const ms = year + '-' + String(m + 1).padStart(2, '0') + '-01';
    if (ms > todayKey()) {
      cells += '<div class="month-cell" style="opacity:.35"><div class="m">' + (m + 1) + '月</div><div class="v faint">—</div><div class="p">未来</div></div>';
      continue;
    }
    const ps = periodStats(series, ms, endOfMonth(ms) < todayKey() ? endOfMonth(ms) : todayKey());
    const active = ms.slice(0, 7) === todayKey().slice(0, 7) ? ' active' : '';
    const tint = ps.pnl > 0 ? 'background:rgba(255,93,108,.055)' : ps.pnl < 0 ? 'background:rgba(53,211,154,.05)' : '';
    cells += '<button class="month-cell' + active + '" style="' + tint + '" data-action="open-calendar-month" data-month="' + ms + '">' +
      '<div><div class="m">' + (m + 1) + '月</div><div class="v ' + pnlClass(ps.pnl) + '">' + (ps.pnl >= 0 ? '+' : '') + fmtMoney(ps.pnl, { compact: true }) + '</div></div>' +
      '<div class="p">' + fmtPct(ps.returnPct, 2) + '</div></button>';
  }
  return '<div class="month-grid">' + cells + '</div>';
}

function yearCalendarHTML(series) {
  const daily = buildDailyAnalytics();
  const firstYear = parseDay(daily.dates[0]).getFullYear();
  const nowYear = parseDay(todayKey()).getFullYear();
  const startYear = Math.max(firstYear, nowYear - 5);
  const rows = [];
  for (let y = nowYear; y >= startYear; y--) {
    const start = y + '-01-01', end = y + '-12-31' > todayKey() ? todayKey() : y + '-12-31';
    const ps = periodStats(series, start, end);
    rows.push({ y, ps });
  }
  const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.ps.pnl)));
  return '<div class="year-list">' + rows.map(r => {
    const w = Math.max(2, Math.abs(r.ps.pnl) / maxAbs * 100);
    return '<button class="year-row" data-action="open-calendar-year" data-year="' + r.y + '">' +
      '<span class="y">' + r.y + '</span><span class="bar"><i style="width:' + w.toFixed(1) + '%;background:' + (r.ps.pnl >= 0 ? 'var(--gain)' : 'var(--loss)') + '"></i></span>' +
      '<span class="v ' + pnlClass(r.ps.pnl) + '">' + (r.ps.pnl >= 0 ? '+' : '') + fmtMoney(r.ps.pnl, { compact: true }) + '<span>' + fmtPct(r.ps.returnPct, 2) + '</span></span></button>';
  }).join('') + '</div>';
}

function yearInsightHTML(series, year) {
  const months = [];
  for (let m = 0; m < 12; m++) {
    const ms = year + '-' + String(m + 1).padStart(2, '0') + '-01';
    if (ms > todayKey()) { months.push({ m: m + 1, pnl: null, ret: 0 }); continue; }
    const ps = periodStats(series, ms, endOfMonth(ms) < todayKey() ? endOfMonth(ms) : todayKey());
    months.push({ m: m + 1, pnl: ps.pnl, ret: ps.returnPct });
  }
  const known = months.filter(x => x.pnl != null);
  const maxAbs = Math.max(1, ...known.map(x => Math.abs(x.pnl)));
  const best = known.slice().sort((a, b) => b.pnl - a.pnl)[0];
  const worst = known.slice().sort((a, b) => a.pnl - b.pnl)[0];
  const win = known.filter(x => x.pnl > 0).length;
  const bars = months.map(x => {
    if (x.pnl == null) return '<div class="yb-col"><div class="yb-track"><i style="height:2px;bottom:50%;background:rgba(255,255,255,.06)"></i></div><span>' + x.m + '</span></div>';
    const h = Math.max(2, Math.abs(x.pnl) / maxAbs * 42);
    return '<div class="yb-col"><div class="yb-track"><i class="' + (x.pnl >= 0 ? 'up' : 'down') + '" style="height:' + h.toFixed(1) + 'px;' + (x.pnl >= 0 ? 'bottom:50%' : 'top:50%') + '"></i></div><span>' + x.m + '</span></div>';
  }).join('');
  return '<section class="card pad" style="margin-top:14px">' +
    '<div class="card-head" style="padding:0"><div><h2>年度分布</h2><div class="sub">' + year + ' 年 · 每月盈亏</div></div><span class="tiny">' + esc(series.name) + '</span></div>' +
    '<div class="year-bars">' + bars + '</div>' +
    '<div class="cal-mini-stats" style="margin-top:10px"><div><div class="l">最佳月份</div><div class="n gain">' + (best ? best.m + '月 · ' + (best.pnl >= 0 ? '+' : '') + fmtMoney(best.pnl, { compact: true }) : '—') + '</div></div>' +
    '<div><div class="l">最差月份</div><div class="n ' + (worst && worst.pnl < 0 ? 'loss' : '') + '">' + (worst ? worst.m + '月 · ' + fmtMoney(worst.pnl, { compact: true }) : '—') + '</div></div>' +
    '<div><div class="l">盈利月份</div><div class="n">' + win + ' / ' + known.length + '</div></div></div>' +
  '</section>';
}

/* ---------- calendar day sheet ---------- */
function openCalendarDaySheet(date) {
  const sid = calendarSchemeId();
  const gid = calendarGroupId(sid);
  const scheme = schemeById(sid);
  const series = calendarSeries(sid, gid);
  const daily = buildDailyAnalytics();
  const idx = daily.indexMap.get(date);
  const pnl = idx != null ? series.pnls[idx] : 0;
  const prev = idx != null && idx > 0 ? series.values[idx - 1] : 0;
  const ret = prev > 0 ? pnl / prev : 0;
  const gs = groupDailySeries(sid);
  const groupRows = gs.groups.map(g => {
    const p = idx != null ? g.pnls[idx] : 0;
    return { name: g.name, color: g.color, p };
  }).filter(r => Math.abs(r.p) > 0.005)
    .sort((a, b) => Math.abs(b.p) - Math.abs(a.p))
    .slice(0, 5)
    .sort((a, b) => b.p - a.p);
  let dayRecords = recordsSorted().filter(r => r.date === date).reverse();
  if (gid !== 'all') {
    const sch = schemeById(sid);
    dayRecords = dayRecords.filter(r => {
      const account = accountById(r.accountId);
      if (!account) return false;
      const inst = r.instrumentId ? instrumentById(r.instrumentId) : null;
      return resolveGroupId(sch, account, inst) === gid;
    });
  }
  const maxAbs = Math.max(1, ...groupRows.map(r => Math.abs(r.p)));
  const body = '<div class="stat-hero" style="margin-bottom:0"><div><div class="eyebrow">' + esc(date) + ' · ' + weekdayCN(date) + '</div><div class="big ' + pnlClass(pnl) + '" style="font-size:27px">' + (pnl >= 0 ? '+' : '') + fmtMoney(pnl) + '</div><div class="cap">' + esc(series.name) + ' · ' + fmtPct(ret, 2) + ' 当日收益</div></div>' +
    '<div class="right">记录<b>' + dayRecords.length + ' 笔</b><span>当日</span></div></div>' +
    '<div class="bar-list" style="margin-top:18px">' + groupRows.map(r => '<div class="bar-row"><div class="bar-top"><span class="dot" style="background:' + r.color + '"></span><span class="name">' + esc(r.name) + '</span><span class="pct ' + pnlClass(r.p) + '">' + (r.p >= 0 ? '+' : '') + fmtMoney(r.p, { compact: true }) + '</span></div><div class="bar-track"><div class="bar-fill" style="width:' + (Math.abs(r.p) / maxAbs * 100).toFixed(1) + '%;background:' + r.color + '"></div></div></div>').join('') + '</div>' +
    '<div class="divider-line"></div>' +
    (dayRecords.length ? '<div class="list-card" style="background:transparent;border:0">' + dayRecords.map(r => recordRowHTML(r)).join('') + '</div>' : '<div class="tiny" style="padding:14px 0;text-align:center">当天没有买卖或资金记录</div>');
  openSheet({ title: '单日收益', sub: esc(date) + ' · ' + esc(scopeName(gid, sid)), body, footer: '<button class="btn ghost" data-sheet-close>关闭</button>' });
}
