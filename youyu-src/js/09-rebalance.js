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
    '<div class="card-head" style="padding:0"><div><h2>当前 vs 目标</h2><div class="sub">' + esc(scheme ? scheme.name : '') + ' · 目标为 ' + baseCurrency() + ' 口径</div></div><span class="tiny">±' + tolerance.toFixed(1) + '% 容忍</span></div>' +
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
  const savedPlan = (state.rebalance.plans && state.rebalance.plans[scheme.id]) || {};
  const savedOps = savedPlan.ops || {};
  const savedFresh = Array.isArray(savedPlan.fresh) ? savedPlan.fresh : [];
  const groups = scheme.groups.map(g => {
    const comps = groupComponents(scheme.id, g.id);
    const rows = comps.map(c => {
      const inst = c.instrument || null;
      const key = inst ? inst.id : 'cash_' + (c.account ? c.account.id : 'x');
      return {
        key,
        name: c.name,
        isNew: false,
        current: Number(c.value) || 0,
        op: Number(savedOps[key]) || 0,
        rate: inst ? instrumentExpectedRate(inst) : accountExpectedRate(c.account)
      };
    });
    const fresh = savedFresh.filter(f => f && f.gid === g.id).map((f, i) => ({
      key: 'n' + i,
      name: f.name || '',
      isNew: true,
      current: 0,
      op: Number(f.amount) || 0,
      rate: f.rate == null ? null : Number(f.rate)
    }));
    return {
      gid: g.id, name: g.name, color: g.color,
      target: rebalanceTargetFor(scheme, g),
      rows,
      fresh
    };
  });

  const rateOf = row => row.rate;
  const adjOf = row => row.current + (Number(row.op) || 0);
  const allRows = () => groups.reduce((a, g) => a.concat(g.rows, g.fresh), []);
  const groupNow = g => sum(g.rows, r => r.current);
  const groupAdj = g => sum(g.rows.concat(g.fresh), r => adjOf(r));
  const totalNow = () => sum(groups, groupNow);
  const totalAdj = () => sum(groups, groupAdj);
  const incomeNow = () => sum(groups, g => sum(g.rows, r => (rateOf(r) == null ? 0 : r.current * rateOf(r) / 100)));
  const incomeAdj = () => sum(groups, g => sum(g.rows.concat(g.fresh), r => (rateOf(r) == null ? 0 : adjOf(r) * rateOf(r) / 100)));
  const unrated = () => {
    let n = 0, v = 0;
    allRows().forEach(r => { if (rateOf(r) == null && Math.abs(adjOf(r)) > 0.005) { n++; v += adjOf(r); } });
    return { n, v };
  };
  const pct = (a, b) => (b > 0 ? (a / b * 100) : 0);
  const money = v => {
    const neg = v < -0.005;
    const a = Math.abs(v);
    const body = a >= 10000 ? (a / 10000).toFixed(2) + '万' : String(Math.round(a));
    return (neg ? '−' : '') + '¥' + body;
  };
  const signMoney = v => (Math.abs(v) < 0.005 ? '—' : (v > 0 ? '+' : '−') + money(Math.abs(v)));

  const rowHTML = (g, r, idPrefix) => {
    const adj = adjOf(r);
    const rate = rateOf(r);
    return '<div class="plan-row" data-row="' + esc(idPrefix) + '">' +
      '<div class="plan-name" title="' + esc(r.name) + '">' + (r.isNew ? '<input class="input plan-text" data-f="name" data-g="' + esc(g.gid) + '" data-r="' + esc(idPrefix) + '" value="' + esc(r.name) + '" placeholder="标的名称">' : esc(r.name)) + '</div>' +
      '<div class="plan-num">' + (r.isNew ? '—' : money(r.current)) + '</div>' +
      '<div class="plan-num plan-op"><input class="input plan-amt" inputmode="decimal" data-f="op" data-g="' + esc(g.gid) + '" data-r="' + esc(idPrefix) + '" value="' + (r.op ? r.op : '') + '" placeholder="0"></div>' +
      '<div class="plan-num" data-cell="adj:' + esc(idPrefix) + '">' + money(adj) + '</div>' +
      '<div class="plan-num plan-rate"><input class="input plan-amt" inputmode="decimal" data-f="rate" data-g="' + esc(g.gid) + '" data-r="' + esc(idPrefix) + '" value="' + (rate == null ? '' : rate) + '" placeholder="—"><i>%</i></div>' +
      '<div class="plan-num" data-cell="inc:' + esc(idPrefix) + '">' + (rate == null ? '—' : money(adj * rate / 100)) + '</div>' +
    '</div>';
  };

  const groupsHTML = groups.map(g => {
    const now = groupNow(g);
    return '<div class="plan-block" data-group="' + esc(g.gid) + '">' +
      '<div class="plan-group">' +
        '<span class="dot" style="background:' + g.color + '"></span>' +
        '<span class="plan-gname">' + esc(g.name) + '</span>' +
        '<span class="plan-gstat">当前 <b>' + pct(now, totalNow()).toFixed(1) + '%</b></span>' +
        '<span class="plan-gstat">目标 <input class="input plan-amt plan-target" inputmode="decimal" data-f="target" data-g="' + esc(g.gid) + '" value="' + g.target + '"><i>%</i></span>' +
        '<span class="plan-gstat">调整后 <b data-cell="gpct:' + esc(g.gid) + '">' + pct(groupAdj(g), totalAdj() || 1).toFixed(1) + '%</b></span>' +
      '</div>' +
      '<div class="plan-table">' +
        '<div class="plan-head"><span>标的</span><span>当前</span><span>操作</span><span>调整后</span><span>预期年化</span><span>预期年收益</span></div>' +
        g.rows.map(r => rowHTML(g, r, g.gid + ':' + r.key)).join('') +
        '<div data-fresh="' + esc(g.gid) + '">' + g.fresh.map((r, i) => rowHTML(g, r, g.gid + ':new' + i)).join('') + '</div>' +
        '<button class="plan-add" data-f="add" data-g="' + esc(g.gid) + '">+ 新增标的</button>' +
      '</div>' +
    '</div>';
  }).join('');

  const body = '<form id="target-form">' +
    '<div class="plan-note">在「操作」列填金额（正数＝加仓／建仓，负数＝减仓），「调整后」与「预期年收益」实时算出。点「保存目标」会把这份方案一并存下，但不会改动账本持仓。</div>' +
    groupsHTML +
    '<div class="form-section">汇总</div>' +
    '<div class="plan-table plan-summary">' +
      '<div class="plan-head plan-head-sum"><span></span><span>调整前</span><span>变更</span><span>调整后</span></div>' +
      '<div class="plan-row"><div class="plan-name">总金额</div><div class="plan-num" data-cell="sum:now">' + money(totalNow()) + '</div><div class="plan-num" data-cell="sum:delta">—</div><div class="plan-num" data-cell="sum:adj">' + money(totalAdj()) + '</div></div>' +
      '<div class="plan-row"><div class="plan-name">预期年化</div><div class="plan-num" data-cell="sum:rnow">—</div><div class="plan-num">—</div><div class="plan-num" data-cell="sum:radj">—</div></div>' +
      '<div class="plan-row"><div class="plan-name">预期年收益</div><div class="plan-num" data-cell="sum:inow">—</div><div class="plan-num" data-cell="sum:idelta">—</div><div class="plan-num" data-cell="sum:iadj">—</div></div>' +
    '</div>' +
    '<div class="reb-target-note" id="plan-warn" hidden></div>' +
    '<div class="reb-target-sumline"><span>目标合计 <b id="target-total">' + schemeTargetTotal(scheme).toFixed(1) + '%</b></span></div>' +
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
    const parts = rid.split(':');
    if (/^new\d+$/.test(parts[1])) return g.fresh[Number(parts[1].slice(3))] || null;
    return g.rows.find(r => r.key === parts[1]) || null;
  };

  const refresh = () => {
    const tn = totalNow(), ta = totalAdj();
    const inow = incomeNow(), iadj = incomeAdj();
    groups.forEach(g => {
      g.rows.concat(g.fresh).forEach((r, i) => {
        const prefix = r.isNew ? (g.gid + ':new' + g.fresh.indexOf(r)) : (g.gid + ':' + r.key);
        const adjCell = form.querySelector('[data-cell="adj:' + prefix + '"]');
        if (adjCell) adjCell.textContent = money(adjOf(r));
        const incCell = form.querySelector('[data-cell="inc:' + prefix + '"]');
        if (incCell) incCell.textContent = rateOf(r) == null ? '—' : money(adjOf(r) * rateOf(r) / 100);
      });
      const gp = form.querySelector('[data-cell="gpct:' + g.gid + '"]');
      if (gp) gp.textContent = pct(groupAdj(g), ta || 1).toFixed(1) + '%';
    });
    const set = (k, v) => { const el = form.querySelector('[data-cell="' + k + '"]'); if (el) el.textContent = v; };
    set('sum:now', money(tn));
    set('sum:adj', money(ta));
    set('sum:delta', signMoney(ta - tn));
    set('sum:rnow', tn > 0 ? (inow / tn * 100).toFixed(2) + '%' : '—');
    set('sum:radj', ta > 0 ? (iadj / ta * 100).toFixed(2) + '%' : '—');
    set('sum:inow', money(inow));
    set('sum:iadj', money(iadj));
    set('sum:idelta', signMoney(iadj - inow));
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
        warn.innerHTML = icon('alert') + '<span>' + ur.n + ' 项标的（' + money(ur.v) + '）没填预期年化，年化与年收益按 0 计入，汇总会偏低。</span>';
      } else if (allRows().length === 0) {
        warn.hidden = false;
        warn.innerHTML = icon('alert') + '<span>这个分组还没有持仓。</span>';
      } else { warn.hidden = true; warn.innerHTML = ''; }
    }
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
    if (f === 'add') return;
    const r = findRow(gid, rid);
    if (!r) return;
    if (f === 'op') r.op = parseNumber(el.value);
    else if (f === 'rate') r.rate = el.value.trim() === '' ? null : parseNumber(el.value);
    else if (f === 'name') r.name = el.value;
    refresh();
  });

  form.addEventListener('click', ev => {
    const btn = ev.target.closest ? ev.target.closest('[data-f="add"]') : null;
    if (!btn) return;
    ev.preventDefault();
    const gid = btn.getAttribute('data-g');
    const g = groups.find(x => x.gid === gid);
    if (!g) return;
    g.fresh.push({ key: 'n' + g.fresh.length, name: '', isNew: true, current: 0, op: 0, rate: null });
    const holder = form.querySelector('[data-fresh="' + gid + '"]');
    if (holder) holder.innerHTML = g.fresh.map((r, i) => rowHTML(g, r, gid + ':new' + i)).join('');
    refresh();
  });

  refresh();

  wrap.querySelector('[data-target-save]').addEventListener('click', () => {
    const values = {};
    groups.forEach(g => { values[g.gid] = g.target; });
    const tol = clamp(parseNumber(form.querySelector('#target-tolerance').value), 0.1, 30);
    if (scheme.builtin) {
      state.rebalance.targets[scheme.id] = Object.assign({}, state.rebalance.targets[scheme.id] || {}, values);
    } else {
      scheme.groups.forEach(g => { g.target = values[g.gid]; });
    }
    // 写回标的的预期年化（这是账本数据，不是试算）
    groups.forEach(g => {
      g.rows.forEach(r => {
        if (r.isNew) return;
        if (r.key.indexOf('cash_') === 0) {
          const acc = accountById(r.key.slice(5));
          if (!acc) return;
          if (r.rate == null) delete acc.expectedRate; else acc.expectedRate = r.rate;
        } else {
          const inst = instrumentById(r.key);
          if (!inst) return;
          if (r.rate == null) delete inst.expectedRate; else inst.expectedRate = r.rate;
        }
      });
    });
    // 连带保存调仓方案（加减仓金额 + 计划新建的标的）
    const ops = {};
    const fresh = [];
    groups.forEach(g => {
      g.rows.forEach(r => {
        const v = Number(r.op) || 0;
        if (Math.abs(v) > 0.005) ops[r.key] = v;
      });
      g.fresh.forEach(r => {
        if (!String(r.name || '').trim() && Math.abs(Number(r.op) || 0) < 0.005) return;
        fresh.push({ gid: g.gid, name: r.name || '', amount: Number(r.op) || 0, rate: r.rate });
      });
    });
    state.rebalance.plans = state.rebalance.plans || {};
    state.rebalance.plans[scheme.id] = { ops, fresh };
    state.settings.tolerance = tol;
    saveState();
    closeSheet(wrap);
    toast('目标与调仓方案已保存', 'success');
    refreshPage();
  });
}

/* ---------- rebalance plan ---------- */
function openRebalancePlanSheet(sid) {
  const scheme = schemeById(sid || rebalanceSchemeId());
  if (!scheme) { toast('还没有开启再平衡的分组', 'error'); return; }
  const plan = (state.rebalance.plans && state.rebalance.plans[scheme.id]) || {};
  const ops = plan.ops || {};
  const fresh = Array.isArray(plan.fresh) ? plan.fresh : [];
  const items = [];
  scheme.groups.forEach(g => {
    groupComponents(scheme.id, g.id).forEach(c => {
      const inst = c.instrument || null;
      const key = inst ? inst.id : 'cash_' + (c.account ? c.account.id : 'x');
      const amt = Number(ops[key]) || 0;
      if (Math.abs(amt) < 0.005) return;
      items.push({ gid: g.id, name: c.name, amount: amt, current: Number(c.value) || 0, isNew: false });
    });
  });
  fresh.forEach(f => {
    if (!f || !scheme.groups.some(x => x.id === f.gid)) return;
    const amt = Number(f.amount) || 0;
    if (Math.abs(amt) < 0.005 && !String(f.name || '').trim()) return;
    items.push({ gid: f.gid, name: String(f.name || '').trim() || '未命名标的', amount: amt, current: 0, isNew: true });
  });

  const buy = sum(items.filter(x => x.amount > 0), x => x.amount);
  const sell = sum(items.filter(x => x.amount < 0), x => -x.amount);
  const newRows = items.filter(x => x.isNew && x.amount > 0);
  const newSum = sum(newRows, x => x.amount);

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
            '<div class="s">' + label + (x.isNew ? ' · 当前没有持仓' : ' · 当前 ' + fmtMoney(x.current, { compact: true })) + '</div></div>' +
          '<div class="reb-plan-val ' + (side === 'sell' ? 'loss' : 'gain') + '">' + (side === 'sell' ? '−' : '+') + fmtMoney(Math.abs(x.amount), { compact: true }) + '</div></div>';
      }).join('');
  }).join('');

  const hero = '<div class="stat-hero" style="margin-bottom:0"><div><div class="eyebrow">操作清单</div>' +
    '<div class="big" style="font-size:25px">' + fmtMoney(buy) + '</div>' +
    '<div class="cap">加仓与新建合计' + (sell > 0.005 ? ' · 减仓 ' + fmtMoney(sell) : '') + '</div></div>' +
    '<div class="right"><b>' + items.length + ' 笔</b><span>' + (newSum > 0.005 ? '其中新建 ' + fmtMoney(newSum, { compact: true }) : '按你的计划') + '</span></div></div>';

  const body = items.length
    ? hero + blocks + '<div class="info-banner" style="margin-top:14px">' + icon('info') + '<div>这份清单来自「调整目标」里填的操作金额，不会自动交易，也没有改动账本持仓。真买完之后记得回来把这行操作清零。</div></div>'
    : hero + '<div class="empty-state" style="padding:30px 10px"><div class="ico">' + icon('sliders') + '</div><h3>还没有操作</h3><p>打开下方「调整目标」，在「操作」列填金额，或点「+ 新增标的」规划建仓。</p></div>';

  openSheet({
    title: '操作清单', sub: esc(scheme.name) + ' · 来自调整目标里的计划',
    body, footer: '<button class="btn ghost" data-sheet-close>关闭</button><button class="btn primary" data-action="open-target-editor" data-scheme="' + esc(scheme.id) + '">调整目标</button>'
  });
}

