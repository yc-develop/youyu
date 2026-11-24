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
    '<button class="btn primary" data-action="open-rebalance-plan" data-scheme="' + esc(sid) + '">' + icon('sparkles') + '查看再平衡</button></div>' +
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
  if (!scheme) return;
  const tolerance = Number(state.settings.tolerance) || 0;
  const assets = groupBreakdown(scheme.id).total;
  const stats = {};
  scheme.groups.forEach(g => { stats[g.id] = groupExpectedStats(scheme.id, g.id); });
  const rateLabel = s => s.weighted == null ? '<span class="reb-unset">未设</span>' : s.weighted.toFixed(2) + '%';
  const rangeLine = s => {
    if (!s.parts.length) return '这个分组目前没有持仓';
    if (s.weighted == null) return '持仓都还没有填写「预期年化」';
    const rated = s.parts.filter(p => p.rate != null).length;
    const span = s.minRate === s.maxRate
      ? s.minRate.toFixed(2) + '%'
      : s.minRate.toFixed(2) + '% – ' + s.maxRate.toFixed(2) + '%';
    let out = '年化区间 ' + span + ' · 加权来自 ' + rated + ' 项';
    if (s.missingCount) out += ' · <b>' + s.missingCount + ' 项未设</b>（' + fmtMoney(s.missingValue, { compact: true }) + '）';
    return out;
  };
  const partsHTML = s => s.parts.length
    ? '<div class="reb-parts-head"><span>构成</span><span>金额</span><span>年化</span></div>' + s.parts.map(p =>
        '<div class="reb-parts-row"><span class="nm">' + esc(p.name) + '</span><span>' + fmtMoney(p.value, { compact: true }) + '</span>' +
        '<span class="' + (p.rate == null ? 'reb-unset' : '') + '">' + (p.rate == null ? '未设' : p.rate.toFixed(2) + '%') + '</span></div>').join('')
    : '<div class="reb-parts-row"><span class="nm">这个分组目前没有持仓</span><span></span><span></span></div>';
  const body = '<form id="target-form">' +
    '<div class="info-banner" style="margin-top:0">' + icon('target') + '<div>分组年化来自<b>当前持仓</b>加权。调整后收益 = 目标金额 × 该分组当前加权年化（假设桶内构成不变）。允许 ±' + tolerance.toFixed(1) + '% 的偏离。</div></div>' +
    '<div class="form-section">分组目标</div>' +
    '<div class="reb-target-head"><span>分组</span><span>目标 %</span><span>调整后收益/年</span></div>' +
    '<div class="reb-target-list">' +
      scheme.groups.map(g => {
        const s = stats[g.id];
        return '<div class="reb-target-row">' +
          '<div class="reb-target-name"><span class="dot" style="background:' + g.color + '"></span><span class="nm">' + esc(g.name) + '</span>' +
            '<button type="button" class="reb-expand" data-expand="' + esc(g.id) + '" aria-label="展开构成">' + icon('chevronDown') + '</button></div>' +
          '<div class="reb-target-pct"><input class="input reb-num" type="text" inputmode="decimal" name="target_' + esc(g.id) + '" id="target_' + esc(g.id) + '" value="' + rebalanceTargetFor(scheme, g) + '" placeholder="0" aria-label="目标占比"><span class="unit">%</span></div>' +
          '<div class="reb-target-amt reb-target-income" data-amount="' + esc(g.id) + '">—</div>' +
        '</div>' +
        '<div class="reb-target-meta" data-meta="' + esc(g.id) + '"></div>' +
        '<div class="reb-target-sub" data-sub="' + esc(g.id) + '">' + rangeLine(s) + '</div>' +
        '<div class="reb-target-parts" data-parts="' + esc(g.id) + '" hidden>' + partsHTML(s) + '</div>';
      }).join('') +
    '</div>' +
    '<div class="reb-target-sumline"><span>目标合计 <b id="target-total">' + schemeTargetTotal(scheme).toFixed(1) + '%</b></span><span>目标金额 <b id="goal-total">—</b></span></div>' +
    '<div class="reb-target-cmp">' +
      '<div class="cmp-head"><span></span><span>组合年化</span><span>年收益</span></div>' +
      '<div class="cmp-row"><span class="lbl">现在</span><b id="cmp-now-rate">—</b><b id="cmp-now-inc">—</b></div>' +
      '<div class="cmp-row"><span class="lbl">调整后</span><b id="cmp-adj-rate">—</b><b id="cmp-adj-inc">—</b></div>' +
      '<div class="cmp-row cmp-diff"><span class="lbl">变化</span><b id="cmp-diff-rate">—</b><b id="cmp-diff-inc">—</b></div>' +
    '</div>' +
    '<div class="cmp-warn" id="cmp-warn" hidden>目标合计不是 100%，年化可以比较，金额不可直接比较。</div>' +
    '<div class="reb-target-note" id="expected-note" hidden></div>' +
    '<div class="form-section">容忍带</div>' +
    '<div class="field" style="display:grid;grid-template-columns:1fr 98px;align-items:center;gap:10px"><div style="font-size:11px;color:var(--ink-2)">允许偏离目标</div><div class="amount-input"><input class="input" type="text" inputmode="decimal" name="tolerance" id="target-tolerance" value="' + tolerance + '"><span class="unit">%</span></div></div>' +
    '<div class="hint" style="font-size:8px;color:var(--faint);margin-top:7px;padding-left:2px">容忍带越窄，再平衡提示越频繁。</div>' +
  '</form>';
  const wrap = openSheet({
    title: '调整目标配置', sub: esc(scheme.name) + ' · 目标占比 · 预期年化', body,
    footer: '<button class="btn ghost" data-sheet-close>取消</button><button class="btn primary" data-target-save>保存目标</button>'
  });
  const form = wrap.querySelector('#target-form');
  const setText = (id, txt) => { const el = form.querySelector('#' + id); if (el) el.textContent = txt; };
  const pctText = v => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
  const updateTotals = () => {
    let totalPct = 0, curValue = 0, curIncome = 0, adjValue = 0, adjIncome = 0;
    let ratedGroups = 0, missingValue = 0, missingCount = 0;
    scheme.groups.forEach(g => {
      const ti = form.querySelector('#target_' + g.id);
      const t = clamp(parseNumber(ti ? ti.value : 0), 0, 100);
      totalPct += t;
      const s = stats[g.id];
      const hasRate = s.weighted != null;
      if (hasRate) ratedGroups += 1;
      missingValue += s.missingValue;
      missingCount += s.missingCount;
      const goal = assets * (t / 100);
      const amt = hasRate ? goal * (s.weighted / 100) : 0;
      adjValue += goal;
      adjIncome += amt;
      curValue += s.totalValue;
      curIncome += s.income;
      const cell = form.querySelector('[data-amount="' + g.id + '"]');
      if (cell) {
        const show = t > 0 && hasRate;
        cell.textContent = show ? fmtMoney(amt, { compact: true }) : '—';
        cell.classList.toggle('on', show);
      }
      const meta = form.querySelector('[data-meta="' + g.id + '"]');
      if (meta) {
        const nowPct = assets > 0 ? s.totalValue / assets * 100 : 0;
        const diff = amt - s.income;
        const diffTxt = (hasRate && Math.abs(diff) >= 1)
          ? ' · <b class="' + (diff > 0 ? 'gain' : 'loss') + '">' + (diff > 0 ? '+' : '−') + fmtMoney(Math.abs(diff), { compact: true }) + '</b>'
          : '';
        meta.innerHTML = '现在 ' + nowPct.toFixed(1) + '% → ' + pctText(t) + '%' +
          ' · 年化 ' + rateLabel(s) +
          ' · ' + fmtMoney(s.income, { compact: true }) + ' → ' + (hasRate ? fmtMoney(amt, { compact: true }) : '—') + diffTxt;
      }
    });
    const totalEl = form.querySelector('#target-total');
    if (totalEl) {
      totalEl.textContent = totalPct.toFixed(1) + '%';
      totalEl.style.color = Math.abs(totalPct - 100) < 0.01 ? 'var(--loss)' : 'var(--warning)';
    }
    setText('goal-total', adjValue > 0 ? fmtMoney(adjValue, { compact: true }) : '—');
    const ok = ratedGroups > 0 && curValue > 0;
    const nowRate = ok ? curIncome / curValue * 100 : null;
    const adjRate = ok && adjValue > 0 ? adjIncome / adjValue * 100 : null;
    setText('cmp-now-rate', nowRate == null ? '—' : nowRate.toFixed(2) + '%');
    setText('cmp-now-inc', ok ? fmtMoney(curIncome, { compact: true }) : '—');
    setText('cmp-adj-rate', adjRate == null ? '—' : adjRate.toFixed(2) + '%');
    setText('cmp-adj-inc', ok ? fmtMoney(adjIncome, { compact: true }) : '—');
    const drEl = form.querySelector('#cmp-diff-rate');
    const diEl = form.querySelector('#cmp-diff-inc');
    if (drEl && diEl) {
      if (nowRate == null || adjRate == null) {
        drEl.textContent = '—'; diEl.textContent = '—';
        drEl.style.color = ''; diEl.style.color = '';
      } else {
        const dr = adjRate - nowRate;
        const di = adjIncome - curIncome;
        drEl.textContent = (dr >= 0 ? '+' : '−') + Math.abs(dr).toFixed(2) + 'pp';
        diEl.textContent = (di >= 0 ? '+' : '−') + fmtMoney(Math.abs(di), { compact: true });
        const c = dr > 0.005 ? 'var(--gain)' : dr < -0.005 ? 'var(--loss)' : 'var(--faint)';
        drEl.style.color = c; diEl.style.color = c;
      }
    }
    const warnEl = form.querySelector('#cmp-warn');
    if (warnEl) warnEl.hidden = Math.abs(totalPct - 100) < 0.01;
    const noteEl = form.querySelector('#expected-note');
    if (noteEl) {
      if (missingCount > 0) {
        noteEl.hidden = false;
        noteEl.innerHTML = icon('alert') + '<span>' + missingCount + ' 项标的（合计 ' + fmtMoney(missingValue, { compact: true }) + '）还没有填写「预期年化」，这部分按 0 计入，两侧金额都偏低。</span>';
      } else if (ratedGroups === 0) {
        noteEl.hidden = false;
        noteEl.innerHTML = icon('alert') + '<span>还没有任何标的填写「预期年化」。到标的或账户的编辑页填上，这里才能算出收益。</span>';
      } else {
        noteEl.hidden = true;
        noteEl.innerHTML = '';
      }
    }
  };
  form.addEventListener('input', updateTotals);
  form.querySelectorAll('[data-expand]').forEach(btn => btn.addEventListener('click', () => {
    const gid = btn.getAttribute('data-expand');
    const parts = form.querySelector('[data-parts="' + gid + '"]');
    if (!parts) return;
    parts.hidden = !parts.hidden;
    btn.classList.toggle('open', !parts.hidden);
    btn.innerHTML = icon(parts.hidden ? 'chevronDown' : 'chevronUp');
  }));
  updateTotals();
  wrap.querySelector('[data-target-save]').addEventListener('click', () => {
    let total = 0;
    const values = {};
    scheme.groups.forEach(g => {
      const inp = form.querySelector('#target_' + g.id);
      const v = clamp(parseNumber(inp ? inp.value : 0), 0, 100);
      values[g.id] = v;
      total += v;
    });
    const tol = clamp(parseNumber(form.querySelector('#target-tolerance').value), 0.1, 30);
    if (scheme.builtin) {
      state.rebalance.targets[scheme.id] = Object.assign({}, state.rebalance.targets[scheme.id] || {}, values);
    } else {
      scheme.groups.forEach(g => { g.target = values[g.id]; });
    }
    state.settings.tolerance = tol;
    saveState();
    closeSheet(wrap);
    toast('目标配置已更新', 'success');
    refreshPage();
  });
}

/* ---------- rebalance plan ---------- */
function buildRebalancePlan(sid) {
  const gb = groupBreakdown(sid);
  const scheme = gb.scheme;
  const rows = [];
  let buy = 0, sell = 0;
  gb.items.forEach(it => {
    if (it.id === '__ungrouped') return;
    if (it.status !== 'high' && it.status !== 'low') return;
    const delta = it.targetValue - it.value;
    if (Math.abs(delta) < 1) return;
    const side = delta > 0 ? 'buy' : 'sell';
    if (side === 'buy') buy += delta; else sell += Math.abs(delta);
    const comps = groupComponents(sid, it.id).filter(c => c.type === 'instrument' && c.instrument);
    const totalComp = sum(comps, c => c.value) || 1;
    const ops = comps.slice(0, 4).map(c => {
      const amountBase = Math.abs(delta) * (c.value / totalComp);
      const im = computeInstrumentMetrics(c.instrument.id);
      const nativeAmount = amountBase / (im.curFx || 1);
      const approxQty = im.price > 0 ? nativeAmount / im.price : 0;
      return { name: c.instrument.name, amount: amountBase, nativeAmount, currency: c.instrument.currency, qty: approxQty };
    });
    if (!ops.length) {
      rows.push({ side, name: it.name, color: it.color, delta: Math.abs(delta), ops: [], note: side === 'buy' ? '该分组暂无标的，可配置货币基金或现金' : '该分组暂无标的，可减少现金留存' });
    } else {
      rows.push({ side, name: it.name, color: it.color, delta: Math.abs(delta), ops });
    }
  });
  return { gb, scheme, rows, buy, sell };
}

function openRebalancePlanSheet(sid) {
  const plan = buildRebalancePlan(sid || rebalanceSchemeId());
  if (!plan.scheme) { toast('请先开启再平衡', 'error'); return; }
  const rows = plan.rows;
  const body = '<div class="stat-hero" style="margin-bottom:0"><div><div class="eyebrow">建议调仓金额</div><div class="big" style="font-size:25px">' + fmtMoney(plan.buy) + '</div><div class="cap">买入总额 · 卖出 ' + fmtMoney(plan.sell) + '</div></div>' +
    '<div class="right">需要调整<b>' + rows.length + ' 组</b><span>目标区间</span></div></div>' +
    (rows.length ? rows.map(r => '<div class="reb-plan-row"><span class="reb-plan-icon ' + r.side + '">' + icon(r.side === 'buy' ? 'arrowDownLeft' : 'arrowUpRight') + '</span>' +
      '<div class="reb-plan-main"><div class="t">' + esc(r.name) + ' · ' + (r.side === 'buy' ? '加仓' : '减仓') + '</div>' +
        '<div class="s">' + (r.note || '按组内当前持仓比例分配') + '</div>' +
        (r.ops && r.ops.length ? '<div class="ops">' + r.ops.map(o => '<span class="op">' + (r.side === 'buy' ? '买入 ' : '卖出 ') + esc(o.name) + ' <b>' + fmtMoney(o.amount, { compact: true }) + '</b></span>').join('') + '</div>' : '') +
      '</div><div class="reb-plan-val ' + (r.side === 'buy' ? 'gain' : 'loss') + '">' + (r.side === 'buy' ? '+' : '−') + fmtMoney(r.delta, { compact: true }) + '</div></div>').join('') :
      '<div class="empty-state" style="padding:34px 10px"><div class="ico">' + icon('check') + '</div><h3>配置很健康</h3><p>所有分组都在目标容忍带内，暂时不需要再平衡。</p></div>') +
    (rows.length ? '<div class="info-banner" style="margin-top:12px">' + icon('info') + '<div>这只是按当前目标计算的建议，系统不会自动交易。实际买卖请结合税费、汇率和你的判断。</div></div>' : '');
  openSheet({
    title: '再平衡建议', sub: plan.scheme.name + ' · 按当前市值',
    body, footer: '<button class="btn ghost" data-sheet-close>关闭</button><button class="btn primary" data-action="open-target-editor" data-scheme="' + esc(plan.scheme.id) + '">调整目标</button>'
  });
}
