/* =========================================================
   04 · SVG 图表（折线 / 环形 / 桑基 / 资金流）
   ========================================================= */
function chartId() { return 'c' + (++chartSeq); }

function chartEmptyHTML(text, height) {
  return '<div class="empty-state" style="min-height:' + (height || 150) + 'px;padding:24px 12px"><div class="ico">' + icon('chart') + '</div><p>' + esc(text || '暂无足够数据') + '</p></div>';
}

function chartAxisText(v, mode, ccy) {
  if (mode === 'percent') return (v * 100).toFixed(Math.abs(v) < 0.01 ? 2 : 1) + '%';
  if (state && state.settings && state.settings.hideAmounts) return '••';
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '亿';
  if (abs >= 1000000) return (n / 10000).toFixed(0) + '万';
  if (abs >= 100000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
  if (abs >= 10000) return (n / 10000).toFixed(2).replace(/\.?0+$/, '') + '万';
  if (abs >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return abs < 10 ? n.toFixed(2) : Math.round(n).toString();
}

function lineChartHTML(opts) {
  const o = opts || {};
  const id = o.id || chartId();
  const points = (o.points || []).filter(p => p && Number.isFinite(Number(p.value)));
  const height = o.height || 188;
  const W = 360, H = height;
  const pad = { l: o.showY === false ? 8 : 38, r: 8, t: 13, b: 24 };
  if (points.length < 2) return chartEmptyHTML(o.emptyText || '暂无足够数据', height + 24);
  const vals = points.map(p => Number(p.value));
  let min = Math.min(...vals), max = Math.max(...vals);
  if (o.baseline || (min < 0 && max > 0)) { min = Math.min(min, 0); max = Math.max(max, 0); }
  if (min === max) { const padV = Math.abs(min) * 0.02 || 1; min -= padV; max += padV; }
  const span = max - min;
  min -= span * 0.09;
  max += span * 0.09;
  if (o.baseline) { min = Math.min(min, 0); max = Math.max(max, 0); }
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const x = i => pad.l + (points.length === 1 ? 0 : i / (points.length - 1)) * plotW;
  const y = v => pad.t + (1 - (v - min) / (max - min || 1)) * plotH;
  const color = o.color || '#ff9f45';
  const gid = 'grad_' + id;
  const zeroY = y(0);
  let d = '';
  points.forEach((p, i) => { d += (i === 0 ? 'M' : 'L') + x(i).toFixed(2) + ',' + y(Number(p.value)).toFixed(2); });
  let areaD = d;
  if (o.baseline || (min < 0 && max > 0)) areaD += 'L' + x(points.length - 1).toFixed(2) + ',' + zeroY.toFixed(2) + 'L' + x(0).toFixed(2) + ',' + zeroY.toFixed(2) + 'Z';
  else areaD += 'L' + x(points.length - 1).toFixed(2) + ',' + (H - pad.b) + 'L' + x(0).toFixed(2) + ',' + (H - pad.b) + 'Z';
  let grid = '', labels = '';
  const ticks = 3;
  for (let i = 0; i < ticks; i++) {
    const v = min + (max - min) * (i / (ticks - 1));
    const yy = y(v);
    if (o.showY !== false) {
      grid += '<line class="grid-line" x1="' + pad.l + '" y1="' + yy.toFixed(2) + '" x2="' + (W - pad.r) + '" y2="' + yy.toFixed(2) + '"/>';
      labels += '<text class="axis-label" x="' + (pad.l - 6) + '" y="' + (yy + 3).toFixed(2) + '" text-anchor="end">' + esc(chartAxisText(v, o.mode, o.currency)) + '</text>';
    }
  }
  if (min < 0 && max > 0) {
    grid += '<line x1="' + pad.l + '" y1="' + zeroY.toFixed(2) + '" x2="' + (W - pad.r) + '" y2="' + zeroY.toFixed(2) + '" stroke="rgba(255,255,255,.17)" stroke-width=".7" stroke-dasharray="3 4"/>';
  }
  const labelIdx = points.length <= 4 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 3), Math.floor((points.length - 1) * 2 / 3), points.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  labelIdx.forEach(i => {
    const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
    labels += '<text class="axis-label" x="' + x(i).toFixed(2) + '" y="' + (H - 6) + '" text-anchor="' + anchor + '">' + esc(shortDate(points[i].date)) + '</text>';
  });
  const markerSvg = (() => {
    const seen = new Set();
    return (o.markers || []).map(m => {
      if (!m || (m.type !== 'buy' && m.type !== 'sell')) return '';
      if (m.date < points[0].date || m.date > points[points.length - 1].date) return '';
      const key = m.date + '|' + m.type;
      if (seen.has(key)) return '';
      seen.add(key);
      let idx = points.findIndex(p => p.date >= m.date);
      if (idx < 0) idx = points.length - 1;
      const isBuy = m.type === 'buy';
      const cx = x(idx);
      const cy = clamp(y(Number(points[idx].value)) + (isBuy ? -11 : 11), pad.t + 8, H - pad.b - 8);
      return '<g class="trade-marker" pointer-events="none">' +
        '<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="6.5" fill="' + (isBuy ? '#5b8cff' : '#2bb673') + '" stroke="#16181d" stroke-width="1.2"/>' +
        '<text x="' + cx.toFixed(2) + '" y="' + (cy + 2.7).toFixed(2) + '" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">' + (isBuy ? 'B' : 'S') + '</text>' +
      '</g>';
    }).join('');
  })();
  const last = points[points.length - 1];
  const lastX = x(points.length - 1), lastY = y(Number(last.value));
  const tipFmt = value => {
    if (o.mode === 'percent') return fmtPct(value, 2, true);
    if (o.mode === 'price') return fmtPrice(value, o.currency);
    return fmtMoney(value, { currency: o.currency, decimals: Math.abs(value) >= 1000 ? 0 : 2 });
  };
  chartRegistry[id] = {
    id, points, W, H, pad, plotW, plotH, min, max,
    dateOf: p => p.date,
    fmt: tipFmt,
    mode: o.mode
  };
  const svg = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(o.aria || '资产趋势图') + '">' +
    '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".27"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
    grid +
    '<path class="area" d="' + areaD + '" fill="url(#' + gid + ')"/>' +
    '<path class="line" d="' + d + '" stroke="' + color + '"/>' +
    markerSvg +
    '<line class="crosshair" data-hover="line" x1="0" y1="' + pad.t + '" x2="0" y2="' + (H - pad.b) + '" opacity="0"/>' +
    '<circle class="last-dot" cx="' + lastX.toFixed(2) + '" cy="' + lastY.toFixed(2) + '" r="3.1" fill="' + color + '"/>' +
    '<circle class="hover-dot" data-hover="dot" cx="0" cy="0" r="3.8" fill="' + color + '" opacity="0"/>' +
    labels +
    '</svg>';
  return '<div class="chart-block" data-chart="' + id + '">' + svg + '<div class="chart-tip" data-tip="' + id + '"><div class="d"></div><div class="v"></div><div class="p"></div></div></div>';
}

function sparklineHTML(values, opts) {
  const o = opts || {};
  const vals = (values || []).filter(v => Number.isFinite(Number(v)));
  if (vals.length < 2) return '';
  const W = 360, H = o.height || 78;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = i => 0 + i / (vals.length - 1) * W;
  const y = v => 5 + (1 - (v - min) / span) * (H - 12);
  let d = '';
  vals.forEach((v, i) => { d += (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ',' + y(v).toFixed(1); });
  const gid = 'spark_' + (++chartSeq);
  const color = o.color || '#ff9f45';
  const area = d + 'L' + W + ',' + H + 'L0,' + H + 'Z';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".34"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + area + '" fill="url(#' + gid + ')"/><path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
}

/* ---------- donut ---------- */
function donutBoxHTML(items, opts) {
  const o = opts || {};
  const size = o.size || 154, stroke = o.stroke || 17;
  const total = sum(items, x => Math.max(0, Number(x.value) || 0));
  const r = (size - stroke) / 2;
  let circles = '';
  if (total > 0) {
    let offset = 0;
    items.forEach((it, i) => {
      const v = Math.max(0, Number(it.value) || 0);
      if (v <= 0) return;
      const pct = v / total * 100;
      const len = Math.max(0.15, pct - 0.55);
      const color = it.color || PALETTE[i % PALETTE.length];
      circles += '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" pathLength="100" stroke-dasharray="' + len.toFixed(3) + ' ' + (100 - len).toFixed(3) + '" stroke-dashoffset="' + (-offset).toFixed(3) + '" stroke-linecap="round"><title>' + esc((it.name || '') + ' · ' + fmtMoney(v) + ' · ' + fmtPct(pct / 100, 1)) + '</title></circle>';
      offset += pct;
    });
  } else {
    circles = '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.075)" stroke-width="' + stroke + '"/>';
  }
  return '<div class="donut-box" style="width:' + size + 'px;height:' + size + 'px;flex-basis:' + size + 'px">' +
    '<svg viewBox="0 0 ' + size + ' ' + size + '" aria-label="资产占比图">' + circles + '</svg>' +
    '<div class="donut-center"><strong>' + esc(o.centerValue || '') + '</strong><span>' + esc(o.centerLabel || '') + '</span></div></div>';
}

function donutLegendHTML(items, opts) {
  const o = opts || {};
  const total = sum(items, x => Math.max(0, Number(x.value) || 0));
  const max = o.max || 8;
  const list = items.slice(0, max);
  if (!list.length) return '<div class="tiny" style="padding:8px 0">暂无数据</div>';
  return list.map((it, i) => {
    const pct = total > 0 ? Math.max(0, Number(it.value) || 0) / total : 0;
    if (o.compact) return '<div class="legend-row"><span class="dot" style="background:' + (it.color || PALETTE[i % PALETTE.length]) + '"></span><span class="name">' + esc(it.name) + '</span><span class="pct">' + (pct * 100).toFixed(1) + '%</span></div>';
    return '<div class="legend-row"><span class="dot" style="background:' + (it.color || PALETTE[i % PALETTE.length]) + '"></span><span class="name">' + esc(it.name) + '</span><span class="amt">' + fmtMoney(it.value, { compact: true }) + '</span><span class="pct">' + (pct * 100).toFixed(1) + '%</span></div>';
  }).join('');
}

/* ---------- flow diagram ---------- */
function flowDiagramHTML(flow, opts) {
  const o = opts || {};
  const f = flow || {};
  const money = v => fmtMoney(v, { currency: o.currency || f.currency || baseCurrency() });
  const pnl = Number(f.profit) || 0;
  const pnlCls = pnl > 0 ? 'gain' : pnl < 0 ? 'loss' : '';
  const pnlSign = pnl > 0 ? '+' : pnl < 0 ? '-' : '';
  const scope = o.scope || '';
  const id = o.id || '';
  const periodKey = o.periodKey || 'all';
  const periods = o.periods || ['all'];
  const periodLabel = f.periodLabel || flowPeriodLabel(periodKey);
  const editable = !!o.editable && scope && id;
  const isInstrument = !!o.isInstrument;
  const allTime = periodKey === 'all';
  const flowLabels = isInstrument ? {
    in: allTime ? '累计买入金额' : '本期买入金额',
    out: allTime ? '累计卖出净额' : '本期卖出净额',
    net: allTime ? '累计净买入' : '本期净买入',
    profit: allTime ? '累计收益' : '本期收益',
    opening: '期初总价值', ending: '期末总价值'
  } : {
    in: allTime ? '累计转入' : '本期转入',
    out: allTime ? '累计转出' : '本期转出',
    net: '净投入本金',
    profit: allTime ? '含汇兑累计收益' : '含汇兑本期收益',
    opening: '期初资产', ending: '期末资产'
  };
  const showDividend = isInstrument && Number(f.dividend) > 0;
  const flowFormula = '期初' + (isInstrument ? '总价值' : '资产') + ' + ' + flowLabels.net + ' + ' + flowLabels.profit + ' = 期末' + (isInstrument ? '总价值 · 期末总价值 = 持仓市值 + 已收分红' : '资产');
  const node = (field, cls, label, valueHtml, extra) => {
    const attr = editable ? ' data-action="edit-flow-field" data-scope="' + esc(scope) + '" data-id="' + esc(id) + '" data-period="' + esc(periodKey) + '" data-field="' + esc(field) + '"' : '';
    const pen = editable ? '<span class="flow-edit">' + icon('pen') + '</span>' : '';
    return '<button type="button" class="flow-node ' + cls + (editable ? ' editable' : '') + '"' + attr + '>' + pen + '<span class="l">' + label + '</span><span class="v">' + valueHtml + '</span>' + (extra || '') + '</button>';
  };
  const periodChips = periods.length > 1 ? '<div class="chip-row flow-period-row">' +
    periods.map(p => '<button class="chip ' + (p === periodKey ? 'active' : '') + '" data-action="set-flow-period" data-scope="' + esc(scope) + '" data-id="' + esc(id) + '" data-period="' + esc(p) + '">' + flowPeriodLabel(p) + '</button>').join('') +
    '</div>' : '';
  return '<div class="flow-card card">' +
    '<div class="card-head" style="padding:0"><div><h2>资金流 ' + (f.adjusted ? '<span class="flow-adjusted">已调整</span>' : '') + '</h2><div class="sub">' + esc(periodLabel) + ' · ' + flowFormula + '</div></div>' +
      (f.adjusted ? '<button class="text-btn" style="font-size:9px" data-action="reset-flow" data-scope="' + esc(scope) + '" data-id="' + esc(id) + '" data-period="' + esc(periodKey) + '">撤销调整</button>' : (editable ? '<span class="pill-btn" style="height:26px;font-size:9px;padding:0 9px">' + icon('info') + '点击可校正</span>' : '')) + '</div>' +
    periodChips +
    '<div class="flow-diagram">' +
      '<svg class="flow-svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
        '<path d="M25 20 L25 27 Q25 32 31 32 L44 32 Q50 32 50 38" fill="none" stroke="rgba(255,255,255,.13)" stroke-width=".7" vector-effect="non-scaling-stroke"/>' +
        '<path d="M75 20 L75 27 Q75 32 69 32 L56 32 Q50 32 50 38" fill="none" stroke="rgba(255,255,255,.13)" stroke-width=".7" vector-effect="non-scaling-stroke"/>' +
        '<path d="M16 56 L16 64 Q16 69 23 69 L44 69 Q50 69 50 74" fill="none" stroke="rgba(255,255,255,.12)" stroke-width=".7" vector-effect="non-scaling-stroke"/>' +
        '<path d="M50 56 L50 74" fill="none" stroke="rgba(255,255,255,.12)" stroke-width=".7" vector-effect="non-scaling-stroke"/>' +
        '<path d="M84 56 L84 64 Q84 69 77 69 L56 69 Q50 69 50 74" fill="none" stroke="rgba(255,255,255,.12)" stroke-width=".7" vector-effect="non-scaling-stroke"/>' +
        '<circle cx="50" cy="38" r=".8" fill="rgba(255,255,255,.35)"/><circle cx="50" cy="74" r=".8" fill="rgba(255,255,255,.35)"/>' +
      '</svg>' +
      node('in', 'flow-top', flowLabels.in, ((f.in || 0) > 0 ? '+' : '') + money(f.in || 0)) +
      node('out', 'flow-top right', flowLabels.out, ((f.out || 0) > 0 ? '−' : '') + money(f.out || 0)) +
      node('opening', 'flow-mid a', flowLabels.opening, money(f.beginning || 0)) +
      '<div class="flow-node flow-mid b accent"><span class="l">' + flowLabels.net + '</span><span class="v">' + ((f.net || 0) > 0 ? '+' : (f.net || 0) < 0 ? '−' : '') + money(Math.abs(f.net || 0)) + '</span></div>' +
      node('profit', 'flow-mid c ' + pnlCls, flowLabels.profit, pnlSign + money(Math.abs(pnl)), showDividend ? '<span class="flow-node-sub">含分红 ' + money(f.dividend) + '</span>' : '') +
      node('ending', 'flow-end total', flowLabels.ending, money(f.ending || 0)) +
    '</div>' +
    '<div class="flow-legend"><span class="dot"></span>' + flowLabels.net + ' + ' + flowLabels.profit + ' = 期末 − 期初' + (showDividend ? ' · 分红已计入' + flowLabels.profit : '') + (editable ? ' · 点击金额可校正' : '') + '</div>' +
    (f.adjusted ? '<div class="flow-adjusted-note">本周期已写入账本调整，资产统计已同步；可在更新记录中删除调整或撤销本周期调整。</div>' : '') +
  '</div>';
}

/* ---------- sankey ---------- */
function shortLabel(text, max) {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function sankeyHTML(schemeId, mode) {
  const gb = groupBreakdown(schemeId);
  const daily = buildDailyAnalytics();
  const last = daily.n - 1;
  const scheme = gb.scheme;
  if (!scheme || gb.total <= 0) return chartEmptyHTML('还没有可用于桑基图的资产', 260);
  let visibleGroups = gb.items.filter(g => g.value > 0 && g.id !== '__ungrouped');
  if (gb.ungrouped && gb.ungrouped.value > 0) visibleGroups.push(gb.ungrouped);
  if (!visibleGroups.length) return chartEmptyHTML('还没有可用于桑基图的资产', 260);
  const total = sum(visibleGroups, g => g.value);
  let restGroupIds = new Set();
  if (visibleGroups.length > 6) {
    const sorted = visibleGroups.slice().sort((a, b) => b.value - a.value);
    const rest = sorted.slice(5);
    rest.forEach(g => restGroupIds.add(g.id));
    visibleGroups = sorted.slice(0, 5).concat([{
      id: '__sankey_other', name: '其他 ' + rest.length + ' 组', color: '#6b7280',
      value: sum(rest, x => x.value), pct: sum(rest, x => x.pct), target: 0,
      normalizedTarget: 0, status: 'auto', synthetic: true
    }]);
  }

  // group -> leaves
  const groupData = [];
  visibleGroups.forEach(g => {
    const leafMap = new Map();
    daily.components.forEach(comp => {
      const account = comp.account;
      const inst = comp.inst || null;
      const compGroup = resolveGroupId(scheme, account, inst) || '__ungrouped';
      const match = g.id === '__sankey_other' ? restGroupIds.has(compGroup) : compGroup === g.id;
      if (!match) return;
      const value = comp.values[last] || 0;
      let key, label, sub;
      if (mode === 'instrument' && inst) {
        key = 'inst:' + inst.id;
        label = inst.name;
        sub = account.name;
      } else if (mode === 'instrument') {
        key = 'cash:' + account.id;
        label = account.name + ' 可用现金';
        sub = account.currency;
      } else {
        key = 'acc:' + account.id;
        label = account.name;
        sub = account.currency + ' · ' + (inst ? inst.name : '可用现金');
      }
      if (!leafMap.has(key)) leafMap.set(key, { key, label, sub, value: 0, groupId: g.id, color: g.color });
      leafMap.get(key).value += value;
    });
    let leaves = Array.from(leafMap.values()).filter(l => l.value > 0).sort((a, b) => b.value - a.value);
    if (leaves.length > 6) {
      const rest = leaves.slice(5);
      leaves = leaves.slice(0, 5).concat([{ key: 'other:' + g.id, label: '其他 ' + rest.length + ' 项', sub: '', value: sum(rest, x => x.value), groupId: g.id, color: g.color }]);
    }
    groupData.push({ group: g, leaves });
  });
  for (let i = groupData.length - 1; i >= 0; i--) {
    if (!groupData[i].leaves.length) groupData.splice(i, 1);
  }
  // 分组按实际正净值叶子重算，避免负现金被单独丢弃后产生虚高
  groupData.forEach(gd => { gd.group.value = sum(gd.leaves, l => l.value); });
  const layoutTotal = sum(groupData, gd => gd.group.value);
  const hasNegative = Math.abs(layoutTotal - total) > 0.5;

  // unique leaves across groups
  const leafTotals = new Map();
  groupData.forEach(gd => gd.leaves.forEach(l => {
    if (!leafTotals.has(l.key)) leafTotals.set(l.key, { key: l.key, label: l.label, sub: l.sub, value: 0, color: l.color });
    leafTotals.get(l.key).value += l.value;
  }));
  const leaves = Array.from(leafTotals.values()).sort((a, b) => b.value - a.value);

  const nG = groupData.length, nL = leaves.length;
  const minHeight = Math.max(
    58 + 22 + nG * 12 + Math.max(0, nG - 1) * 12 + 8,
    58 + 22 + nL * 11 + Math.max(0, nL - 1) * 6 + 8
  );
  const H = clamp(Math.max(340 + Math.max(0, nG - 2) * 10 + Math.max(0, nL - 6) * 8, minHeight), 340, 760);
  const W = 360;
  const top = 58, bottom = 22;
  const x0 = 8, x1 = 116, x2 = 232;
  const nodeW = 9;
  const avail = H - top - bottom;
  const gapG = nG > 1 ? 12 : 0;
  const gapL = nL > 1 ? 6 : 0;
  const minGroupH = 12, minLeafH = 11;
  const groupScale = Math.max(0, (avail - gapG * (nG - 1) - minGroupH * nG) / Math.max(1, layoutTotal));
  const leafScale = Math.max(0, (avail - gapL * (nL - 1) - minLeafH * nL) / Math.max(1, layoutTotal));

  // group y — reserve a minimum node height, then distribute the rest by value
  let gy = top;
  groupData.forEach(gd => {
    gd.h = minGroupH + gd.group.value * groupScale;
    gd.y = gy;
    gy += gd.h + gapG;
  });
  const groupsBottom = gy - gapG;
  // leaf y — same sizing rule, so the right column cannot overflow vertically
  let ly = top;
  leaves.forEach(l => {
    l.h = minLeafH + l.value * leafScale;
    l.y = ly;
    ly += l.h + gapL;
  });
  const leavesBottom = ly - gapL;
  const groupTop = groupData.length ? groupData[0].y : top;
  const totalNodeY = groupTop;
  const totalNodeH = Math.max(0, groupsBottom - groupTop);

  // allocate incoming slices on leaves
  const incomingByLeaf = new Map();
  groupData.forEach(gd => {
    let sourceY = gd.y;
    gd.leaves.forEach(l => {
      const srcH = gd.group.value > 0 ? gd.h * (l.value / gd.group.value) : 0;
      const link = { group: gd, leafKey: l.key, value: l.value, sy: sourceY, sh: srcH };
      sourceY += srcH;
      if (!incomingByLeaf.has(l.key)) incomingByLeaf.set(l.key, []);
      incomingByLeaf.get(l.key).push(link);
    });
  });
  leaves.forEach(l => {
    const links = incomingByLeaf.get(l.key) || [];
    links.sort((a, b) => a.group.y - b.group.y);
    let ty = l.y;
    links.forEach(link => {
      const th = l.value > 0 ? l.h * (link.value / l.value) : 0;
      link.ty = ty; link.th = th;
      ty += th;
    });
  });

  function linkPath(sx, sy, sh, tx, ty, th) {
    const c1 = sx + 46, c2 = tx - 46;
    return 'M' + sx + ',' + sy.toFixed(2) +
      ' C' + c1 + ',' + sy.toFixed(2) + ' ' + c2 + ',' + ty.toFixed(2) + ' ' + tx + ',' + ty.toFixed(2) +
      ' L' + tx + ',' + (ty + th).toFixed(2) +
      ' C' + c2 + ',' + (ty + th).toFixed(2) + ' ' + c1 + ',' + (sy + sh).toFixed(2) + ' ' + sx + ',' + (sy + sh).toFixed(2) + 'Z';
  }

  let linksSvg = '', nodesSvg = '', labelsSvg = '';
  // total -> group links
  let totalSourceY = totalNodeY;
  groupData.forEach((gd, gi) => {
    linksSvg += '<path class="sankey-link" d="' + linkPath(x0 + nodeW, totalSourceY, gd.h, x1, gd.y, gd.h) + '" fill="' + gd.group.color + '" opacity=".16"/>';
    totalSourceY += gd.h + (gi < groupData.length - 1 ? gapG : 0);
  });
  // group -> leaf links
  groupData.forEach(gd => {
    gd.leaves.forEach(l => {
      const link = (incomingByLeaf.get(l.key) || []).find(x => x.group === gd);
      if (!link) return;
      linksSvg += '<path class="sankey-link" d="' + linkPath(x1 + nodeW, link.sy, link.sh, x2, link.ty, link.th) + '" fill="' + gd.group.color + '" opacity=".19"/>';
    });
  });
  // nodes & labels
  nodesSvg += '<rect x="' + x0 + '" y="' + totalNodeY.toFixed(2) + '" width="' + nodeW + '" height="' + totalNodeH.toFixed(2) + '" rx="4" fill="url(#sankeyTotal)"/>';
  labelsSvg += '<text class="sankey-head" x="' + x0 + '" y="15">组合总资产</text>' +
    '<text class="sankey-total" x="' + x0 + '" y="34">' + esc(fmtMoney(layoutTotal, { compact: true, decimals: 2 })) + '</text>' +
    '<text class="sankey-head" x="' + x1 + '" y="15">分组</text>' +
    '<text class="sankey-head" x="' + x2 + '" y="15">' + (mode === 'instrument' ? '底层标的' : '账户') + '</text>';
  groupData.forEach(gd => {
    nodesSvg += '<rect x="' + x1 + '" y="' + gd.y.toFixed(2) + '" width="' + nodeW + '" height="' + gd.h.toFixed(2) + '" rx="4" fill="' + gd.group.color + '"/>';
    const cy = gd.y + gd.h / 2;
    labelsSvg += '<text class="sankey-label" x="' + (x1 - 8) + '" y="' + (cy + (gd.h >= 24 ? -2 : 3)).toFixed(2) + '" text-anchor="end">' + esc(shortLabel(gd.group.name, 7)) + '</text>' +
      (gd.h >= 24 ? '<text class="sankey-sub" x="' + (x1 - 8) + '" y="' + (cy + 9).toFixed(2) + '" text-anchor="end">' + esc(fmtMoney(gd.group.value, { compact: true })) + '</text>' : '');
  });
  leaves.forEach(l => {
    nodesSvg += '<rect x="' + x2 + '" y="' + l.y.toFixed(2) + '" width="8" height="' + l.h.toFixed(2) + '" rx="3" fill="' + l.color + '"/>';
    const cy = l.y + l.h / 2;
    const line = shortLabel(l.label, 6) + ' · ' + fmtMoney(l.value, { compact: true });
    labelsSvg += '<text class="sankey-label" x="' + (x2 + 15) + '" y="' + (cy + 2.8).toFixed(2) + '">' + esc(line) + '</text>';
  });

  return '<div class="sankey-shell"><svg class="sankey-svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="资产流向桑基图" style="height:auto;display:block">' +
    '<defs><linearGradient id="sankeyTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9f45"/><stop offset=".55" stop-color="#5b8cff"/><stop offset="1" stop-color="#b18cff"/></linearGradient></defs>' +
    linksSvg + nodesSvg + labelsSvg + '</svg>' + (hasNegative ? '<div class="sankey-hint">' + icon('info') + '<span>负值已从流向中剔除，仅展示正净值资产</span></div>' : '') + '</div>';
}

/* ---------- chart interactions ---------- */
function bindCharts() {
  $$('[data-chart]').forEach(wrap => {
    if (wrap.dataset.bound) return;
    wrap.dataset.bound = '1';
    const id = wrap.getAttribute('data-chart');
    const meta = chartRegistry[id];
    if (!meta) return;
    const svg = $('svg', wrap);
    const tip = $('[data-tip]', wrap);
    const line = $('[data-hover="line"]', svg);
    const dot = $('[data-hover="dot"]', svg);
    const show = (clientX) => {
      const rect = wrap.getBoundingClientRect();
      const frac = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      const index = Math.round(frac * (meta.points.length - 1));
      const p = meta.points[index];
      if (!p) return;
      const xv = meta.pad.l + frac * meta.plotW;
      const yv = meta.pad.t + (1 - (Number(p.value) - meta.min) / (meta.max - meta.min || 1)) * meta.plotH;
      if (line) { line.setAttribute('x1', xv); line.setAttribute('x2', xv); line.setAttribute('opacity', '1'); }
      if (dot) { dot.setAttribute('cx', xv); dot.setAttribute('cy', yv); dot.setAttribute('opacity', '1'); }
      if (tip) {
        const dateEl = $('.d', tip), valueEl = $('.v', tip), pctEl = $('.p', tip);
        dateEl.textContent = p.date || '';
        valueEl.textContent = meta.fmt(p.value);
        pctEl.textContent = meta.mode === 'percent' ? '' : '';
        const left = (xv / meta.W) * rect.width;
        const top = (yv / meta.H) * rect.height;
        tip.style.left = clamp(left, 44, rect.width - 44) + 'px';
        tip.style.top = Math.max(32, top) + 'px';
        tip.classList.add('show');
      }
    };
    const hide = () => {
      if (line) line.setAttribute('opacity', '0');
      if (dot) dot.setAttribute('opacity', '0');
      if (tip) tip.classList.remove('show');
    };
    wrap.addEventListener('pointermove', e => show(e.clientX));
    wrap.addEventListener('pointerdown', e => { show(e.clientX); });
    wrap.addEventListener('pointerenter', e => show(e.clientX));
    wrap.addEventListener('pointerleave', hide);
    wrap.addEventListener('pointercancel', hide);
  });
}
