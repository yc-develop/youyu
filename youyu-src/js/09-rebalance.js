/* 调仓试算与操作清单统一用千分位、原币符号 */
const PLAN_CUR_SYM = { CNY: '¥', USD: '$', HKD: 'HK$', JPY: 'JP¥', EUR: '€', GBP: '£', USDT: '$' };
function planMoney(v, ccy) {
  const neg = v < -0.005;
  const a = Math.abs(v);
  return (neg ? '−' : '') + (PLAN_CUR_SYM[ccy || 'CNY'] || '') + Math.round(a).toLocaleString('en-US');
}

/* =========================================================
   09 · 再平衡 / 目标配置
   ========================================================= */
function rebalanceSchemeId() {
  const enabled = schemesForRebalance();
  const found = enabled.find(s => s.id === ui.rebalanceSchemeId);
  if (!found) ui.rebalanceSchemeId = (enabled[1] || enabled[0]) ? (enabled[1] || enabled[0]).id : '';
  return ui.rebalanceSchemeId;
}
function seedRebalanceTargets(scheme) {
  if (!scheme || !scheme.builtin) return;
  if (!state.rebalance.targets) state.rebalance.targets = {};
  const existing = state.rebalance.targets[scheme.id] || {};
  if (Object.keys(existing).some(id => Number(existing[id]) > 0)) return;
  const gb = groupBreakdown(scheme.id);
  const targets = {};
  gb.items.forEach(it => { if (it.id !== '__ungrouped') targets[it.id] = round(it.pct * 100, 1); });
  state.rebalance.targets[scheme.id] = targets;
}
function toggleRebalanceScheme(schemeId) {
  const scheme = schemeById(schemeId);
  if (!scheme) return;
  const next = !rebalanceEnabled(scheme);
  setRebalanceEnabled(scheme.id, next);
  if (next && scheme.builtin) seedRebalanceTargets(scheme);
  if (!next && ui.rebalanceSchemeId === scheme.id) ui.rebalanceSchemeId = '';
  saveState();
  toast(next ? (scheme.builtin ? '已开启再平衡，并按当前权重初始化目标' : '已开启再平衡') : '已关闭再平衡', 'success');
  refreshPage();
}

function renderRebalancePage() {
  const sid = rebalanceSchemeId();
  const scheme = sid ? schemeById(sid) : null;
  if (!scheme) {
    return pageTop({ eyebrow: 'REBALANCE', title: '再平衡', sub: '让配置回到你设定的目标区间。' }) +
      '<div class="detail-body">' + emptyBlock('还没有启用再平衡的分组方式', '到分组管理中打开「参与再平衡」开关，即可按该分组设置目标。', '<a class="btn primary sm" href="#/settings">去设置</a>', 'scale') + '</div>';
  }
  const gb = groupBreakdown(sid);
  const items = gb.items.filter(x => x.id !== '__ungrouped');
  const ungrouped = gb.ungrouped;
  const offenders = items.filter(x => x.status === 'high' || x.status === 'low');
  const currentItems = gb.items.filter(x => x.value > 0).map(x => ({ name: x.name, value: x.value, color: x.color }));
  const targetItems = items.filter(x => (x.normalizedTarget || 0) > 0.01).map(x => ({ name: x.name, value: x.normalizedTarget, color: x.color }));
  const tolerance = Number(state.settings.tolerance) || 0;
  const donutCurrent = donutBoxHTML(currentItems, { size: 126, stroke: 14, centerValue: fmtMoney(gb.total, { compact: true }), centerLabel: '当前' });
  const donutTarget = donutBoxHTML(targetItems, { size: 126, stroke: 14, centerValue: fmtPct(schemeTargetTotal(scheme) / 100, 0, false), centerLabel: '目标' });
  return pageTop({
    eyebrow: 'REBALANCE',
    title: '再平衡',
    sub: '让配置回到你设定的目标区间。',
    actions: '<button class="icon-btn" data-action="open-target-editor" data-scheme="' + esc(sid) + '" aria-label="调整目标">' + icon('sliders') + '</button>' +
      '<a class="icon-btn" href="#/groups/' + encodeURIComponent(sid) + '" aria-label="管理分组">' + icon('grid') + '</a>'
  }) +
  schemeChipsHTML(sid, 'select-rebalance-scheme', schemesForRebalance()) +
  '<section class="card" style="padding:16px 14px 14px;margin-top:2px">' +
    '<div class="card-head" style="padding:0"><div><h2>当前 vs 目标</h2><div class="sub">' + esc(scheme ? scheme.name : '') + (scheme && !scheme.builtin ? ' · ' + esc(activeSchemePlan(scheme).name) : '') + ' · 目标为 ' + baseCurrency() + ' 口径</div></div><span class="tiny">±' + tolerance.toFixed(1) + '% 容忍</span></div>' +
    '<div class="donut-pair" style="margin-top:16px">' +
      '<div class="donut-mini-wrap">' + donutCurrent + '<div class="cap"><b>当前配置</b>' + fmtMoney(gb.total, { compact: true }) + '</div></div>' +
      '<div class="donut-mini-wrap">' + donutTarget + '<div class="cap"><b>目标配置</b>' + (schemeTargetTotal(scheme) || 0).toFixed(0) + '%</div></div>' +
    '</div>' +
    '<div class="reb-summary"><div class="l">' + icon(offenders.length ? 'alert' : 'check') + (offenders.length ? offenders.length + ' 个分组偏离目标范围' : '当前配置在目标范围内') + '</div><div class="r">' + (offenders.length ? '有可优化空间' : '保持即可') + '</div></div>' +
    (Math.abs(schemeTargetTotal(scheme) - 100) > 0.01 ? '<div class="info-banner warn" style="margin-top:10px">' + icon('alert') + '<div>目标比例合计为 <b>' + schemeTargetTotal(scheme).toFixed(1) + '%</b>，当前页按归一化比例计算。</div></div>' : '') +
    (ungrouped && ungrouped.value > 0 ? '<div class="info-banner warn" style="margin-top:10px">' + icon('alert') + '<div>' + fmtMoney(ungrouped.value, { compact: true }) + ' 资产未分组，无法参与再平衡。' +
      '<button class="text-btn" style="font-size:9px;margin-left:4px" data-action="go" data-href="#/groups/' + encodeURIComponent(sid) + '">去分组 ' + icon('chevronRight') + '</button></div></div>' : '') +
  '</section>' +
  '<section class="card pad" style="margin-top:14px">' +
    '<div class="card-head" style="padding:0"><div><h2>偏离与目标区间</h2><div class="sub">竖线为目标，底色区域为 ±' + tolerance.toFixed(1) + '% 容忍带 · 点击分组查看构成</div></div></div>' +
    '<div class="reb-list">' + rebalanceRows(items, tolerance, sid) + '</div>' +
  '</section>' +
  '<div class="reb-actions"><button class="btn ghost" data-action="open-target-editor" data-scheme="' + esc(sid) + '">' + icon('sliders') + '调整目标</button>' +
    '<button class="btn primary" data-action="open-rebalance-plan" data-scheme="' + esc(sid) + '">' + icon('list') + '操作清单</button></div>' +
  '<div style="height:12px"></div>';
}

function rebalanceRows(items, tolerance, schemeId) {
  if (!items.length) return '<div class="tiny" style="padding:20px;text-align:center">还没有分组目标</div>';
  return items.map(it => {
    const current = clamp(it.pct * 100, 0, 100);
    const target = clamp(it.normalizedTarget, 0, 100);
    const left = clamp(target - tolerance, 0, 100);
    const width = clamp(tolerance * 2, 0, 100);
    const statusCls = it.status === 'high' ? 'high' : it.status === 'low' ? 'low' : 'ok';
    const statusText = groupStatusText(it.status);
    const diff = it.drift;
    return '<button class="reb-row" data-action="open-group-detail" data-id="' + esc(it.id) + '" data-scheme="' + esc(schemeId || '') + '">' +
      '<div class="reb-top"><span class="dot" style="background:' + it.color + '"></span><span class="name">' + esc(it.name) + '</span>' +
        '<span class="st ' + statusCls + '">' + statusText + '</span></div>' +
      '<div class="reb-track"><span class="reb-zone" style="left:' + left.toFixed(1) + '%;width:' + width.toFixed(1) + '%"></span>' +
        '<span class="reb-fill" style="width:' + current.toFixed(1) + '%;background:' + it.color + '"></span>' +
        '<span class="reb-target" style="left:calc(' + target.toFixed(1) + '% - 1px)"></span></div>' +
      '<div class="reb-meta"><span>目标 <b>' + target.toFixed(1) + '%</b> · 当前 <b>' + current.toFixed(1) + '%</b> · ' + (it.status === 'high' ? '超出' : it.status === 'low' ? '低于' : '接近') + ' <b class="diff ' + statusCls + '">' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%</b></span>' +
        '<span>' + (it.status === 'ok' ? '在目标区间内' : Math.abs(it.delta) < 0.005 ? '无需操作' : (it.delta > 0 ? '需买入 ' : '需卖出 ') + fmtMoney(Math.abs(it.delta), { compact: true })) + '</span></div>' +
    '</button>';
  }).join('');
}

function openTargetEditor(sid) {
  const scheme = schemeById(sid || rebalanceSchemeId());
  if (!scheme || !rebalanceEnabled(scheme)) { toast('请先在分组管理中开启再平衡', 'error'); return; }
  const tolerance = Number(state.settings.tolerance) || 0;
  const plans = ensureSchemePlans(scheme);
  let activePlanId = scheme.activePlan;
  const money = planMoney;
  const planOf = () => activeSchemePlan(scheme);

  const groups = scheme.groups.map(g => {
    const rows = groupComponents(scheme.id, g.id).map(c => {
      const inst = c.instrument || null;
      const key = inst ? inst.id : 'cash_' + (c.account ? c.account.id : 'x');
      const ccy = c.currency || baseCurrency();
      const fx = fxToBase(ccy) || 1;
      const curNative = round(Number(c.native) || 0, 2);
      return {
        key, name: c.name, isNew: false, currency: ccy, fx,
        curNative,
        adjNative: curNative,
        rate: inst ? instrumentExpectedRate(inst) : accountExpectedRate(c.account)
      };
    });
    return { gid: g.id, name: g.name, color: g.color, target: rebalanceTargetFor(scheme, g), rows, fresh: [], open: false };
  });
  /* 把某个方案的调仓明细套到行上：调整后 = 当前 + 计划增量 */
  const applyPlanOps = () => {
    const p = planOf();
    const ops = (p && p.ops) || {};
    groups.forEach(g => {
      g.rows.forEach(r => {
        r.adjNative = round(r.curNative + (Number(ops[r.key]) || 0) / r.fx, 2);
      });
      g.fresh = (((p && p.fresh) || []).filter(f => f.gid === g.gid)).map((f, i) => ({
        key: 'n' + i,
        name: f.name || '',
        isNew: true,
        currency: baseCurrency(),
        fx: 1,
        curNative: 0,
        adjNative: Number(f.amount) || 0,
        rate: f.rate == null ? null : Number(f.rate)
      }));
    });
  };
  applyPlanOps();

  const rateOf = r => r.rate;
  const curBase = r => r.curNative * r.fx;
  const adjBase = r => r.adjNative * r.fx;
  const opBase = r => (r.adjNative - r.curNative) * r.fx;
  const rowsOf = g => g.rows.concat(g.fresh);
  const groupNow = g => sum(g.rows, curBase);
  const groupAdj = g => sum(rowsOf(g), adjBase);
  const totalNow = () => sum(groups, groupNow);
  const totalAdj = () => sum(groups, groupAdj);
  const incomeNow = () => sum(groups, g => sum(g.rows, r => (rateOf(r) == null ? 0 : curBase(r) * rateOf(r) / 100)));
  const incomeAdj = () => sum(groups, g => sum(rowsOf(g), r => (rateOf(r) == null ? 0 : adjBase(r) * rateOf(r) / 100)));
  const unrated = () => {
    let n = 0, v = 0;
    groups.forEach(g => rowsOf(g).forEach(r => {
      if (rateOf(r) == null && Math.abs(adjBase(r)) > 0.005) { n++; v += adjBase(r); }
    }));
    return { n, v };
  };
  const pct = (a, b) => (b > 0 ? (a / b * 100) : 0);
  const signMoney = v => (Math.abs(v) < 0.005 ? '—' : (v > 0 ? '+' : '−') + money(Math.abs(v), 'CNY'));

  /* 当前编辑中的配比会算出的年化（只改各桶比例，桶内构成不变） */
  const liveEffect = () => {
    const tt = sum(groups, g => g.target);
    if (!(tt > 0)) return null;
    const base = totalNow();
    let annual = 0;
    groups.forEach(g => {
      const st = groupExpectedStats(scheme.id, g.gid);
      if (st.weighted == null) return;
      annual += (g.target / tt) * st.weighted;
    });
    return { annual, income: base * annual / 100 };
  };
  const tabsHTML = () => plans.map(p => {
    let annual = null;
    if (p.id === activePlanId) { const le = liveEffect(); annual = le ? le.annual : null; }
    else { const eff = schemePlanEffect(scheme.id, p); annual = eff && eff.annual != null ? eff.annual : null; }
    return '<button type="button" class="plan-tab' + (p.id === activePlanId ? ' on' : '') + '" data-f="plan" data-plan="' + esc(p.id) + '">' +
      '<b>' + esc(p.name) + '</b><i>' + (annual == null ? '—' : annual.toFixed(2) + '%') + '</i></button>';
  }).join('') + '<button type="button" class="plan-tab plan-tab-add" data-f="plan-add" aria-label="新建方案">' + icon('plus') + '</button>';
  const syncPlanUI = () => {
    const le = liveEffect();
    const eff = form.querySelector('#plan-eff');
    if (eff) eff.textContent = le ? '按这个配比 ≈ 年化 ' + le.annual.toFixed(2) + '%，年收益 ' + money(le.income, 'CNY') : '';
    const active = form.querySelector('[data-f="plan"][data-plan="' + activePlanId + '"] i');
    if (active) active.textContent = le ? le.annual.toFixed(2) + '%' : '—';
  };

  const rowHTML = (g, r, rid) => {
    const diff = r.adjNative - r.curNative;
    const cls = diff > 0.005 ? 'up' : diff < -0.005 ? 'down' : '';
    return '<div class="plan-row" data-row="' + esc(rid) + '">' +
      '<div class="plan-name" title="' + esc(r.name) + '">' + (r.isNew
        ? '<input class="input plan-text" data-f="name" data-g="' + esc(g.gid) + '" data-r="' + esc(rid) + '" value="' + esc(r.name) + '" placeholder="标的名称">'
        : esc(r.name)) + '</div>' +
      '<div class="plan-num">' + (r.isNew ? '—' : money(r.curNative, r.currency)) + '</div>' +
      '<div class="plan-num plan-adj ' + cls + '"><input class="input plan-amt" inputmode="decimal" data-f="adj" data-g="' + esc(g.gid) + '" data-r="' + esc(rid) + '" value="' + (Math.abs(r.adjNative - r.curNative) < 0.005 && !r.isNew ? '' : round(r.adjNative, 2)) + '" placeholder="' + (r.isNew ? '0' : '不变') + '"></div>' +
      '<div class="plan-num plan-rate"><input class="input plan-amt" inputmode="decimal" data-f="rate" data-g="' + esc(g.gid) + '" data-r="' + esc(rid) + '" value="' + (rateOf(r) == null ? '' : rateOf(r)) + '" placeholder="—"><i>%</i></div>' +
      '<div class="plan-num ' + cls + '" data-cell="inc:' + esc(rid) + '">' + (rateOf(r) == null ? '—' : money(r.adjNative * rateOf(r) / 100, r.currency)) + '</div>' +
    '</div>';
  };

  const groupsHTML = groups.map(g => {
    return '<div class="plan-block' + (g.open ? '' : ' collapsed') + '" data-group="' + esc(g.gid) + '">' +
      '<div class="plan-group" data-f="fold" data-g="' + esc(g.gid) + '">' +
        '<span class="plan-fold">' + icon('chevronDown') + '</span>' +
        '<span class="dot" style="background:' + g.color + '"></span>' +
        '<span class="plan-gname">' + esc(g.name) + '</span>' +
        '<span class="plan-gstat">当前 <b>' + pct(groupNow(g), totalNow()).toFixed(1) + '%</b></span>' +
        '<span class="plan-gstat">目标 <input class="input plan-amt plan-target" inputmode="decimal" data-f="target" data-g="' + esc(g.gid) + '" value="' + g.target + '"><i>%</i></span>' +
        '<span class="plan-gstat">调整后 <b data-cell="gpct:' + esc(g.gid) + '">' + pct(groupAdj(g), totalAdj() || 1).toFixed(1) + '%</b></span>' +
      '</div>' +
      '<div class="plan-table">' +
        '<div class="plan-head"><span>标的</span><span>当前</span><span>调整后</span><span>预期年化</span><span>预期年收益</span></div>' +
        g.rows.map(r => rowHTML(g, r, g.gid + ':' + r.key)).join('') +
        '<div data-fresh="' + esc(g.gid) + '">' + g.fresh.map((r, i) => rowHTML(g, r, g.gid + ':new' + i)).join('') + '</div>' +
        '<button class="plan-add" data-f="add" data-g="' + esc(g.gid) + '">+ 新增标的</button>' +
      '</div>' +
    '</div>';
  }).join('');

  const body = '<form id="target-form">' +
    '<div class="plan-note">直接改「调整后」那一列：比当前大就是加仓，比当前小就是减仓，新标的把「调整后」填上就是建仓。点分组名可以折叠。外币标的按原币显示。</div>' +
    '<div class="plan-tabs" id="plan-tabs">' + tabsHTML() + '</div>' +
    '<div class="plan-eff-row"><span id="plan-eff"></span><button type="button" class="text-btn" data-f="plan-menu">管理方案</button></div>' +
    '<div class="reb-target-sumline" style="margin-top:0;padding-top:0;border-top:0;margin-bottom:14px"><span>目标合计 <b id="target-total">' + schemeTargetTotal(scheme).toFixed(1) + '%</b></span></div>' +
    groupsHTML +
    '<div class="form-section">汇总</div>' +
    '<div class="plan-table plan-summary">' +
      '<div class="plan-head plan-head-sum"><span></span><span>调整前</span><span>变更</span><span>调整后</span></div>' +
      '<div class="plan-row"><div class="plan-name">总金额</div><div class="plan-num" data-cell="sum:now">—</div><div class="plan-num" data-cell="sum:delta">—</div><div class="plan-num" data-cell="sum:adj">—</div></div>' +
      '<div class="plan-row"><div class="plan-name">预期年化</div><div class="plan-num" data-cell="sum:rnow">—</div><div class="plan-num">—</div><div class="plan-num" data-cell="sum:radj">—</div></div>' +
      '<div class="plan-row"><div class="plan-name">预期年收益</div><div class="plan-num" data-cell="sum:inow">—</div><div class="plan-num" data-cell="sum:idelta">—</div><div class="plan-num" data-cell="sum:iadj">—</div></div>' +
    '</div>' +
    '<div class="reb-target-note" id="plan-warn" hidden></div>' +
    '<div class="form-section">容忍带</div>' +
    '<div class="field" style="display:grid;grid-template-columns:1fr 98px;align-items:center;gap:10px"><div style="font-size:11px;color:var(--ink-2)">允许偏离目标</div><div class="amount-input"><input class="input" type="text" inputmode="decimal" name="tolerance" id="target-tolerance" value="' + tolerance + '"><span class="unit">%</span></div></div>' +
  '</form>';

  const wrap = openSheet({
    title: '调整目标配置', sub: esc(scheme.name) + ' · 目标占比与调仓试算',
    body, footer: '<button class="btn ghost" data-sheet-close>取消</button><button class="btn primary" data-target-save>保存目标</button>'
  });
  const form = wrap.querySelector('#target-form');

  const findRow = (gid, rid) => {
    const g = groups.find(x => x.gid === gid);
    if (!g) return null;
    const key = rid.slice(gid.length + 1);
    if (/^new\d+$/.test(key)) return g.fresh[Number(key.slice(3))] || null;
    return g.rows.find(r => r.key === key) || null;
  };
  const rowCurrency = (gid, rid) => {
    const r = findRow(gid, rid);
    return r ? r.currency : 'CNY';
  };

  const refresh = () => {
    const tn = totalNow(), ta = totalAdj();
    const inow = incomeNow(), iadj = incomeAdj();
    groups.forEach(g => {
      rowsOf(g).forEach(r => {
        const rid = r.isNew ? (g.gid + ':new' + g.fresh.indexOf(r)) : (g.gid + ':' + r.key);
        const incCell = form.querySelector('[data-cell="inc:' + rid + '"]');
        if (incCell) incCell.textContent = rateOf(r) == null ? '—' : money(r.adjNative * rateOf(r) / 100, r.currency);
        const rowEl = form.querySelector('[data-row="' + rid + '"]');
        if (rowEl) {
          const diff = r.adjNative - r.curNative;
          const cls = diff > 0.005 ? 'up' : diff < -0.005 ? 'down' : '';
          const adjWrap = rowEl.querySelector('.plan-adj');
          if (adjWrap) adjWrap.className = 'plan-num plan-adj ' + cls;
          if (incCell) incCell.className = 'plan-num ' + cls;
        }
      });
      const gp = form.querySelector('[data-cell="gpct:' + g.gid + '"]');
      if (gp) gp.textContent = pct(groupAdj(g), ta || 1).toFixed(1) + '%';
    });
    const set = (k, v) => { const el = form.querySelector('[data-cell="' + k + '"]'); if (el) el.textContent = v; };
    const mark = (k, v) => {
      const el = form.querySelector('[data-cell="' + k + '"]');
      if (!el) return;
      el.classList.remove('up', 'down');
      if (Math.abs(v) > 0.005) el.classList.add(v > 0 ? 'up' : 'down');
    };
    const dAmt = ta - tn;
    const rNow = tn > 0 ? inow / tn * 100 : null;
    const rAdj = ta > 0 ? iadj / ta * 100 : null;
    const dRate = (rNow == null || rAdj == null) ? 0 : rAdj - rNow;
    const dInc = iadj - inow;
    set('sum:now', money(tn, 'CNY'));
    set('sum:adj', money(ta, 'CNY'));
    set('sum:delta', signMoney(dAmt));
    set('sum:rnow', rNow == null ? '—' : rNow.toFixed(2) + '%');
    set('sum:radj', rAdj == null ? '—' : rAdj.toFixed(2) + '%');
    set('sum:inow', money(inow, 'CNY'));
    set('sum:iadj', money(iadj, 'CNY'));
    set('sum:idelta', signMoney(dInc));
    mark('sum:delta', dAmt);
    mark('sum:adj', dAmt);
    mark('sum:radj', dRate);
    mark('sum:idelta', dInc);
    mark('sum:iadj', dInc);
    let totalPct = 0;
    groups.forEach(g => {
      const inp = form.querySelector('[data-f="target"][data-g="' + g.gid + '"]');
      totalPct += clamp(parseNumber(inp ? inp.value : 0), 0, 100);
    });
    const tt = form.querySelector('#target-total');
    if (tt) { tt.textContent = totalPct.toFixed(1) + '%'; tt.style.color = Math.abs(totalPct - 100) < 0.01 ? 'var(--ink-2)' : 'var(--warning)'; }
    const warn = form.querySelector('#plan-warn');
    const ur = unrated();
    if (warn) {
      if (ur.n > 0) {
        warn.hidden = false;
        warn.innerHTML = icon('alert') + '<span>' + ur.n + ' 项标的（' + money(ur.v, 'CNY') + '）没填预期年化，年化与年收益按 0 计入，汇总会偏低。</span>';
      } else { warn.hidden = true; warn.innerHTML = ''; }
    }
    syncPlanUI();
  };

  const applyTargetsToDOM = () => {
    groups.forEach(g => {
      const inp = form.querySelector('[data-f="target"][data-g="' + g.gid + '"]');
      if (inp) inp.value = g.target;
    });
  };
  const syncRowsToDOM = () => {
    groups.forEach(g => {
      g.rows.forEach(r => {
        const rid = g.gid + ':' + r.key;
        const el = form.querySelector('[data-f="adj"][data-r="' + rid + '"]');
        if (el) el.value = (Math.abs(r.adjNative - r.curNative) < 0.005 && !r.isNew ? '' : round(r.adjNative, 2));
      });
      const holder = form.querySelector('[data-fresh="' + g.gid + '"]');
      if (holder) holder.innerHTML = g.fresh.map((r, i) => rowHTML(g, r, g.gid + ':new' + i)).join('');
    });
  };
  const switchPlan = planId => {
    if (!planId || planId === activePlanId) return;
    if (!setActiveSchemePlan(scheme, planId)) return;
    activePlanId = scheme.activePlan;
    const plan = activeSchemePlan(scheme);
    groups.forEach(g => { g.target = planTargetFor(plan, g.gid); });
    applyPlanOps();
    applyTargetsToDOM();
    syncRowsToDOM();
    const holder = form.querySelector('#plan-tabs');
    if (holder) holder.innerHTML = tabsHTML();
    refresh();
  };
  const addPlan = () => {
    const cur = activeSchemePlan(scheme);
    const id = uid('plan');
    plans.push({
      id, name: '方案 ' + (plans.length + 1),
      targets: Object.assign({}, cur.targets),
      ops: Object.assign({}, cur.ops || {}),
      fresh: (cur.fresh || []).map(f => Object.assign({}, f))
    });
    scheme.activePlan = id;
    activePlanId = id;
    const holder = form.querySelector('#plan-tabs');
    if (holder) holder.innerHTML = tabsHTML();
    refresh();
    toast('已复制「' + cur.name + '」为新方案', 'success');
  };
  const openPlanManager = () => {
    const rowsHTML = () => plans.map(p => {
      const on = p.id === activePlanId;
      return '<div class="plan-mg-row">' +
        '<input class="input plan-mg-name" data-pf="name" data-plan="' + esc(p.id) + '" value="' + esc(p.name) + '" maxlength="20" placeholder="方案名">' +
        '<span class="tiny" style="min-width:38px;text-align:right">' + (on ? '使用中' : '') + '</span>' +
        '<button type="button" class="icon-btn danger" data-pf="del" data-plan="' + esc(p.id) + '"' + (plans.length < 2 ? ' disabled' : '') + ' aria-label="删除">' + icon('trash') + '</button>' +
      '</div>';
    }).join('');
    const w = openSheet({
      title: '管理方案', sub: '改名直接编辑 · 删除后不可恢复',
      body: '<div class="plan-mg" id="plan-mg">' + rowsHTML() + '</div>',
      footer: '<button class="btn ghost" data-sheet-close>关闭</button>'
    });
    w.addEventListener('input', ev => {
      const el = ev.target;
      if (!el || el.getAttribute('data-pf') !== 'name') return;
      const p = plans.find(x => x.id === el.getAttribute('data-plan'));
      if (p) p.name = String(el.value || '').slice(0, 20);
    });
    w.addEventListener('click', ev => {
      const btn = ev.target.closest ? ev.target.closest('[data-pf="del"]') : null;
      if (!btn) return;
      const id = btn.getAttribute('data-plan');
      if (plans.length < 2) return;
      const p = plans.find(x => x.id === id);
      confirmDialog({
        title: '删除方案', message: '删除「' + esc(p ? p.name : '') + '」？只删这一套目标，不动账本。',
        confirmText: '删除', danger: true,
        onConfirm: () => {
          plans.splice(plans.findIndex(x => x.id === id), 1);
          if (activePlanId === id) {
            activePlanId = plans[0].id;
            scheme.activePlan = activePlanId;
            const plan = activeSchemePlan(scheme);
            groups.forEach(g => { g.target = planTargetFor(plan, g.gid); });
            applyTargetsToDOM();
          }
          const mg = w.querySelector('#plan-mg');
          if (mg) mg.innerHTML = rowsHTML();
          const holder = form.querySelector('#plan-tabs');
          if (holder) holder.innerHTML = tabsHTML();
          refresh();
          toast('已删除方案', 'success');
        }
      });
    });
    w.addEventListener('click', ev => {
      const done = ev.target.closest ? ev.target.closest('[data-sheet-close]') : null;
      if (!done) return;
      if (scheme.activePlan !== activePlanId) switchPlan(scheme.activePlan);
      else {
        const holder = form.querySelector('#plan-tabs');
        if (holder) holder.innerHTML = tabsHTML();
        refresh();
      }
    });
  };

  form.addEventListener('input', ev => {
    const el = ev.target;
    const f = el.getAttribute && el.getAttribute('data-f');
    if (!f) return;
    const gid = el.getAttribute('data-g');
    const rid = el.getAttribute('data-r');
    const g = groups.find(x => x.gid === gid);
    if (!g) return;
    if (f === 'target') { g.target = clamp(parseNumber(el.value), 0, 100); refresh(); return; }
    const r = findRow(gid, rid);
    if (!r) return;
    if (f === 'adj') {
      const v = String(el.value).trim();
      r.adjNative = v === '' ? r.curNative : parseNumber(v);
    } else if (f === 'rate') {
      r.rate = String(el.value).trim() === '' ? null : parseNumber(el.value);
    } else if (f === 'name') {
      r.name = el.value;
    }
    refresh();
  });

  form.addEventListener('click', ev => {
    const el = ev.target.closest ? ev.target.closest('[data-f]') : null;
    if (!el) return;
    const f = el.getAttribute('data-f');
    if (f === 'plan') { ev.preventDefault(); switchPlan(el.getAttribute('data-plan')); return; }
    if (f === 'plan-add') { ev.preventDefault(); addPlan(); return; }
    if (f === 'plan-menu') { ev.preventDefault(); openPlanManager(); return; }
    const gid = el.getAttribute('data-g');
    const g = groups.find(x => x.gid === gid);
    if (!g) return;
    if (f === 'fold') {
      g.open = !g.open;
      const block = form.querySelector('[data-group="' + gid + '"]');
      if (block) block.classList.toggle('collapsed', !g.open);
      return;
    }
    if (f === 'add') {
      ev.preventDefault();
      g.fresh.push({ key: 'n' + g.fresh.length, name: '', isNew: true, currency: baseCurrency(), fx: 1, curNative: 0, adjNative: 0, rate: null });
      const holder = form.querySelector('[data-fresh="' + gid + '"]');
      if (holder) holder.innerHTML = g.fresh.map((r, i) => rowHTML(g, r, gid + ':new' + i)).join('');
      refresh();
    }
  });

  refresh();

  wrap.querySelector('[data-target-save]').addEventListener('click', () => {
    const values = {};
    groups.forEach(g => { values[g.gid] = g.target; });
    const tol = clamp(parseNumber(form.querySelector('#target-tolerance').value), 0.1, 30);
    if (scheme.builtin) {
      state.rebalance.targets[scheme.id] = Object.assign({}, state.rebalance.targets[scheme.id] || {}, values);
    } else {
      const plan = activeSchemePlan(scheme);
      plan.targets = {};
      scheme.groups.forEach(g => { plan.targets[g.id] = clamp(Number(values[g.id]) || 0, 0, 100); });
      syncSchemeGroupTargets(scheme);
    }
    const ops = {};
    const fresh = [];
    groups.forEach(g => {
      g.rows.forEach(r => {
        const v = Math.round(opBase(r) * 100) / 100;
        if (Math.abs(v) > 0.005) ops[r.key] = v;
        if (r.key.indexOf('cash_') === 0) {
          const acc = accountById(r.key.slice(5));
          if (acc) { if (r.rate == null) delete acc.expectedRate; else acc.expectedRate = r.rate; }
        } else {
          const inst = liveInstrumentById(r.key);
          if (inst) { if (r.rate == null) delete inst.expectedRate; else inst.expectedRate = r.rate; }
        }
      });
      g.fresh.forEach(r => {
        if (!String(r.name || '').trim() && Math.abs(r.adjNative) < 0.005) return;
        fresh.push({ gid: g.gid, name: r.name || '', amount: r.adjNative, rate: r.rate });
      });
    });
    const plan = activeSchemePlan(scheme);
    plan.ops = ops;
    plan.fresh = fresh;
    // 旧字段保持同步，操作清单等入口还能读到
    state.rebalance.plans = state.rebalance.plans || {};
    state.rebalance.plans[scheme.id] = { ops, fresh };
    state.settings.tolerance = tol;
    saveState();
    closeSheet(wrap);
    toast('目标与调仓方案已保存', 'success');
    refreshPage();
  });
}

function openRebalancePlanSheet(sid) {
  const scheme = schemeById(sid || rebalanceSchemeId());
  if (!scheme) { toast('还没有开启再平衡的分组', 'error'); return; }
  const ap = scheme.builtin ? ((state.rebalance.plans && state.rebalance.plans[scheme.id]) || {}) : activeSchemePlan(scheme);
  const ops = (ap && ap.ops) || {};
  const fresh = (ap && Array.isArray(ap.fresh)) ? ap.fresh : [];
  const items = [];
  scheme.groups.forEach(g => {
    groupComponents(scheme.id, g.id).forEach(c => {
      const inst = c.instrument || null;
      const key = inst ? inst.id : 'cash_' + (c.account ? c.account.id : 'x');
      const amt = Number(ops[key]) || 0;
      if (Math.abs(amt) < 0.005) return;
      const ccy = c.currency || baseCurrency();
      const fx = fxToBase(ccy) || 1;
      items.push({
        gid: g.id, name: c.name, isNew: false, ccy, fx,
        amount: amt / fx,
        current: Number(c.native) || 0
      });
    });
  });
  fresh.forEach(f => {
    if (!f || !scheme.groups.some(x => x.id === f.gid)) return;
    const amt = Number(f.amount) || 0;
    if (Math.abs(amt) < 0.005 && !String(f.name || '').trim()) return;
    items.push({ gid: f.gid, name: String(f.name || '').trim() || '未命名标的', isNew: true, ccy: baseCurrency(), fx: 1, amount: amt, current: 0 });
  });

  const baseAmt = x => x.amount * x.fx;
  const buy = sum(items.filter(x => x.amount > 0), baseAmt);
  const sell = sum(items.filter(x => x.amount < 0), x => -baseAmt(x));
  const newRows = items.filter(x => x.isNew && x.amount > 0);
  const newSum = sum(newRows, baseAmt);

  const blocks = scheme.groups.map(g => {
    const list = items.filter(x => x.gid === g.id);
    if (!list.length) return '';
    return '<div class="plan-group" style="margin-top:14px"><span class="dot" style="background:' + g.color + '"></span><span class="plan-gname">' + esc(g.name) + '</span></div>' +
      list.map(x => {
        const side = x.amount >= 0 ? (x.isNew ? 'new' : 'buy') : 'sell';
        const label = side === 'sell' ? '减仓' : side === 'new' ? '新建' : '加仓';
        return '<div class="reb-plan-row"><span class="reb-plan-icon ' + (side === 'sell' ? 'sell' : 'buy') + '">' +
          icon(side === 'sell' ? 'arrowUpRight' : 'arrowDownLeft') + '</span>' +
          '<div class="reb-plan-main"><div class="t">' + esc(x.name) + '</div>' +
            '<div class="s">' + label + (x.isNew ? ' · 当前没有持仓' : ' · 当前 ' + planMoney(x.current, x.ccy)) + '</div></div>' +
          '<div class="reb-plan-val ' + (side === 'sell' ? 'loss' : 'gain') + '">' + (side === 'sell' ? '−' : '+') + planMoney(Math.abs(x.amount), x.ccy) + '</div></div>';
      }).join('');
  }).join('');

  const hero = '<div class="stat-hero" style="margin-bottom:0"><div><div class="eyebrow">操作清单</div>' +
    '<div class="big" style="font-size:25px">' + planMoney(buy, 'CNY') + '</div>' +
    '<div class="cap">加仓与新建合计' + (sell > 0.005 ? ' · 减仓 ' + planMoney(sell, 'CNY') : '') + '</div></div>' +
    '<div class="right"><b>' + items.length + ' 笔</b><span>' + (newSum > 0.005 ? '其中新建 ' + planMoney(newSum, 'CNY') : '按你的计划') + '</span></div></div>';

  const body = items.length
    ? hero + blocks + '<div class="info-banner" style="margin-top:14px">' + icon('info') + '<div>这份清单来自「调整目标」里填的操作金额，不会自动交易，也没有改动账本持仓。真买完之后记得回来把这行操作清零。</div></div>'
    : hero + '<div class="empty-state" style="padding:30px 10px"><div class="ico">' + icon('sliders') + '</div><h3>还没有操作</h3><p>打开下方「调整目标」，在「操作」列填金额，或点「+ 新增标的」规划建仓。</p></div>';

  openSheet({
    title: '操作清单', sub: esc(scheme.name) + ' · 来自调整目标里的计划',
    body, footer: '<button class="btn ghost" data-sheet-close>关闭</button><button class="btn primary" data-action="open-target-editor" data-scheme="' + esc(scheme.id) + '">调整目标</button>'
  });
}

