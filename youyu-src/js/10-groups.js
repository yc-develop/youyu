/* =========================================================
   10 · 分组方式 / 分组管理
   ========================================================= */
function renderGroupsPage(schemeId) {
  const scheme = schemeById(schemeId || (schemes()[0] && schemes()[0].id));
  if (!scheme) return backHead('分组管理') + '<div class="detail-body">' + emptyBlock('没有分组方式', '', '<a class="btn primary sm" href="#/settings">返回设置</a>', 'grid') + '</div>';
  if (isBuiltinScheme(scheme)) return renderBuiltinSchemePage(scheme);
  const gb = groupBreakdown(scheme.id);
  const current = new Map(gb.items.map(x => [x.id, x]));
  const totalTarget = schemeTargetTotal(scheme);
  const groupCards = scheme.groups.map((g, i) => {
    const info = current.get(g.id);
    return '<div class="group-card">' +
      '<div class="group-card-head"><span class="group-color" style="background:' + g.color + '"></span><div class="gc-main"><div class="gc-name">' + esc(g.name) + '<span class="gc-target">目标 ' + (Number(g.target) || 0).toFixed(1) + '%</span></div>' +
        '<div class="gc-sub">' + (info ? fmtMoney(info.value, { compact: true }) + ' · 实际 ' + (info.pct * 100).toFixed(1) + '%' : '暂无资产') + '</div></div>' +
        '<div class="gc-actions"><button class="icon-btn sm" data-action="move-group" data-id="' + esc(g.id) + '" data-dir="-1" ' + (i === 0 ? 'disabled' : '') + ' aria-label="上移">' + icon('chevronUp') + '</button>' +
        '<button class="icon-btn sm" data-action="move-group" data-id="' + esc(g.id) + '" data-dir="1" ' + (i === scheme.groups.length - 1 ? 'disabled' : '') + ' aria-label="下移">' + icon('chevronDown') + '</button>' +
        '<button class="icon-btn sm" data-action="open-group-editor" data-id="' + esc(g.id) + '" data-scheme="' + esc(scheme.id) + '" aria-label="编辑">' + icon('edit') + '</button></div></div>' +
      '<div class="gc-include">' + esc(groupIncludeSummary(g)) + '</div>' +
    '</div>';
  }).join('');

  return backHead('分组管理', '<button class="icon-btn sm accent" data-action="open-group-editor" data-scheme="' + esc(scheme.id) + '" aria-label="添加分组">' + icon('plus') + '</button>', '#/settings') +
  '<div class="detail-body">' +
    '<div class="group-scheme-card">' +
      '<div class="eyebrow">SCHEME</div><div class="group-scheme-name">' + esc(scheme.name) + '</div>' +
      '<div class="group-scheme-desc">' + esc(scheme.desc || '自定义资产分组方式') + '</div>' +
      '<div class="group-scheme-stats"><div><span>分组</span><b>' + scheme.groups.length + '</b></div><div><span>目标合计</span><b class="' + (Math.abs(totalTarget - 100) < 0.01 ? '' : 'gain') + '">' + totalTarget.toFixed(1) + '%</b></div><div><span>未分组</span><b class="' + (gb.ungrouped ? 'gain' : '') + '">' + (gb.ungrouped ? fmtMoney(gb.ungrouped.value, { compact: true }) : '无') + '</b></div></div>' +
      '<div class="group-scheme-actions"><button class="btn ghost sm" data-action="edit-scheme" data-scheme="' + esc(scheme.id) + '">' + icon('pen') + '编辑</button>' +
        '<button class="btn ghost sm danger" data-action="delete-scheme" data-scheme="' + esc(scheme.id) + '">' + icon('trash') + '删除</button></div>' +
    '</div>' +
    '<div class="info-banner">' + icon('info') + '<div>分组按从上到下的顺序匹配：同一资产只会计入第一个符合条件的分组。用右侧箭头调整优先级。</div></div>' +
    '<div class="section-head" style="margin-top:18px"><div><h2>分组成员</h2><div class="sub">账户与账户下的具体标的可以组合使用</div></div><span class="tiny">' + scheme.groups.length + ' 组</span></div>' +
    '<div class="group-list">' + (groupCards || '<div class="card">' + emptyBlock('还没有分组', '添加第一个分组，并设置目标占比。', '<button class="btn primary sm" data-action="open-group-editor" data-scheme="' + esc(scheme.id) + '">添加分组</button>', 'grid') + '</div>') + '</div>' +
    '<button class="btn wide ghost" style="margin-top:12px" data-action="open-group-editor" data-scheme="' + esc(scheme.id) + '">' + icon('plus') + '添加分组</button>' +
    '<div class="info-banner" style="margin-top:14px">' + icon('sliders') + '<div>多个分组方式互不影响。你可以为「账户归属」「风险属性」分别设置目标，再在不同页面切换查看。</div></div>' +
    '<div class="group-links"><a class="btn ghost sm" href="#/stats">查看统计</a><a class="btn ghost sm" href="#/rebalance">去再平衡</a></div>' +
    '<div style="height:8px"></div>' +
  '</div>';
}

function renderBuiltinSchemePage(scheme) {
  const gb = groupBreakdown(scheme.id);
  const cards = gb.items.filter(x => x.value > 0.5).map(it => '<div class="group-card" style="padding-bottom:12px">' +
    '<div class="group-card-head"><span class="group-color" style="background:' + it.color + '"></span><div class="gc-main"><div class="gc-name">' + esc(it.name) + '<span class="gc-target">自动</span></div>' +
    '<div class="gc-sub">' + fmtMoney(it.value) + ' · 占比 ' + (it.pct * 100).toFixed(1) + '%</div></div></div></div>').join('');
  return backHead(scheme.name, '', '#/settings') +
  '<div class="detail-body">' +
    '<div class="group-scheme-card"><div class="eyebrow">DEFAULT GROUPING</div><div class="group-scheme-name">' + esc(scheme.name) + '</div>' +
    '<div class="group-scheme-desc">' + esc(scheme.desc) + ' · 系统按当前持仓自动生成，不需要维护成员。</div>' +
    '<div class="group-scheme-stats"><div><span>分组</span><b>' + gb.items.length + '</b></div><div><span>目标合计</span><b>自动</b></div><div><span>未分组</span><b>' + (gb.ungrouped ? fmtMoney(gb.ungrouped.value) : '无') + '</b></div></div></div>' +
    '<div class="info-banner">' + icon('sparkles') + '<div>这是内置的只读分组。你仍然可以在统计页和日历页切换使用；如需自定义目标，请使用“自定义分组”。</div></div>' +
    '<div class="section-head" style="margin-top:18px"><div><h2>当前分组</h2><div class="sub">按当前市值</div></div><span class="tiny">' + gb.items.length + ' 组</span></div>' +
    '<div class="group-list">' + (cards || '<div class="card">' + emptyBlock('暂无资产', '添加账户或标的后，这里会自动出现分组。', '', 'grid') + '</div>') + '</div>' +
    '<div class="group-links"><a class="btn ghost sm" href="#/stats">查看统计</a><a class="btn ghost sm" href="#/settings">管理自定义分组</a></div>' +
  '</div>';
}

/* ---------- group editor ---------- */
function openGroupEditor(schemeId, groupId) {
  const scheme = schemeById(schemeId);
  if (!scheme || isBuiltinScheme(scheme)) { if (scheme && isBuiltinScheme(scheme)) toast('默认分组不可编辑', 'error'); return; }
  const editing = groupId ? scheme.groups.find(g => g.id === groupId) : null;
  const g = editing || {
    id: '', name: '', color: GROUP_COLORS[scheme.groups.length % GROUP_COLORS.length],
    target: 0, includeAccounts: [], includeClasses: [], includeInstruments: []
  };
  const tree = accounts().map(a => {
    const accountChecked = (g.includeAccounts || []).indexOf(a.id) >= 0;
    const children = a.instruments.map(inst => {
      const checked = accountChecked || (g.includeInstruments || []).indexOf(inst.id) >= 0;
      return '<label class="check-row tree-inst"><input type="checkbox" name="instruments" value="' + esc(inst.id) + '" data-account="' + esc(a.id) + '"' + (checked ? ' checked' : '') + (accountChecked ? ' disabled' : '') + '><span class="checkbox ' + (checked ? 'checked' : '') + '">' + icon('check') + '</span>' +
        '<span class="check-name">' + esc(inst.name) + '<span class="check-sub">' + esc(inst.symbol) + ' · ' + esc(instrumentTypeName(inst.cls)) + '</span></span></label>';
    }).join('');
    return '<div class="tree-account">' +
      '<label class="check-row tree-account-row"><input type="checkbox" name="accounts" value="' + esc(a.id) + '"' + (accountChecked ? ' checked' : '') + '><span class="checkbox ' + (accountChecked ? 'checked' : '') + '">' + icon('check') + '</span>' +
        '<span class="check-name">' + esc(a.name) + '<span class="check-sub">' + esc(accountTypeName(a.type)) + ' · ' + a.currency + ' · ' + (a.instruments.length ? a.instruments.length + ' 个标的' : '现金') + '</span></span></label>' +
      (a.instruments.length ? '<div class="tree-children">' + children + '</div>' : '<div class="tree-empty">账户现金</div>') +
    '</div>';
  }).join('');

  const colors = ['#ff9f45', '#5b8cff', '#b18cff', '#43d6b0', '#f2c45c', '#ff7aa2', '#7c9cff', '#ff5d6c', '#8e9aaf', '#f7931a'];
  const body = '<form id="group-form" data-scheme="' + esc(scheme.id) + '" data-group="' + esc(editing ? editing.id : '') + '">' +
    '<div class="form-grid">' +
      fieldHTML({ id: 'group-name', label: '分组名称', value: g.name, placeholder: '例如：稳健投资', full: true }) +
      fieldHTML({ id: 'group-target', label: '目标占比', value: Number(g.target) || 0, unit: '%', inputmode: 'decimal' }) +
      '<div class="field"><label>分组颜色</label><div class="color-row">' + colors.map(c => '<button type="button" class="color-dot ' + (c === g.color ? 'active' : '') + '" style="background:' + c + '" data-color="' + c + '" aria-label="选择颜色"></button>').join('') + '</div><input type="hidden" name="group-color" id="group-color" value="' + g.color + '"></div>' +
    '</div>' +
    '<div class="form-section">选择账户与标的</div>' +
    '<div class="form-hint">勾选账户会包含该账户现金和全部标的；若只选部分标的，先取消勾选账户，再展开勾选。实际归属仍按分组列表顺序决定。</div>' +
    '<div class="check-list account-tree">' + (tree || '<div class="tiny">还没有账户</div>') + '</div>' +
    '<div class="info-banner" style="margin-top:14px">' + icon('info') + '<div>保存后，符合本组条件的资产会从其他分组中移出；实际归属按分组列表顺序决定。</div></div>' +
    (editing ? '<button type="button" class="btn danger wide" style="margin-top:14px" data-group-delete>' + icon('trash') + '删除这个分组</button>' : '') +
  '</form>';
  const wrap = openSheet({
    title: editing ? '编辑分组' : '添加分组', sub: scheme.name,
    body, footer: '<button class="btn ghost" data-sheet-close>取消</button><button class="btn primary" data-group-save>' + (editing ? '保存' : '添加') + '</button>'
  });
  const form = wrap.querySelector('#group-form');
  form.querySelectorAll('.color-dot').forEach(btn => btn.addEventListener('click', () => {
    form.querySelectorAll('.color-dot').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    form.querySelector('#group-color').value = btn.getAttribute('data-color');
  }));
  form.querySelectorAll('.check-row input[type="checkbox"]').forEach(inp => {
    inp.addEventListener('change', () => {
      const box = inp.parentNode.querySelector('.checkbox');
      if (box) box.classList.toggle('checked', inp.checked);
    });
  });
  const treeEl = form.querySelector('.account-tree');
  if (treeEl) {
    treeEl.querySelectorAll('.tree-account').forEach(box => {
      const main = box.querySelector('.tree-account-row input[type="checkbox"]');
      const children = Array.from(box.querySelectorAll('.tree-inst input[type="checkbox"]'));
      const sync = (initial) => {
        children.forEach(inp => {
          inp.disabled = main.checked;
          if (main.checked) inp.checked = true;
          else if (!initial) inp.checked = false;
          const cb = inp.parentNode.querySelector('.checkbox');
          if (cb) cb.classList.toggle('checked', inp.checked);
        });
      };
      main.addEventListener('change', () => sync(false));
      sync(true);
    });
    treeEl.querySelectorAll('.tree-inst input[type="checkbox"]').forEach(inp => {
      inp.addEventListener('change', () => {
        const cb = inp.parentNode.querySelector('.checkbox');
        if (cb) cb.classList.toggle('checked', inp.checked);
      });
    });
  }
  const delBtn = wrap.querySelector('[data-group-delete]');
  if (delBtn) delBtn.addEventListener('click', () => {
    setTimeout(() => {
      confirmDialog({
        title: '删除「' + editing.name + '」？',
        message: '这个分组会从分组方式中移除，账户和交易记录不受影响。',
        confirmText: '删除', danger: true,
        onConfirm: () => {
          scheme.groups = scheme.groups.filter(x => x.id !== editing.id);
          if (ui.statsSchemeId === scheme.id) { /* 保留当前方式 */ }
          if (ui.rebalanceSchemeId === scheme.id) { /* 保留 */ }
          if (ui.calendarGroupId === editing.id) ui.calendarGroupId = 'all';
          saveState(); closeAllSheets(); toast('分组已删除');
          refreshPage();
        }
      });
    }, 60);
  });
  wrap.querySelector('[data-group-save]').addEventListener('click', () => {
    const name = cleanText(form.querySelector('#group-name').value, 24);
    if (!name) { toast('请填写分组名称', 'error'); return; }
    const target = clamp(parseNumber(form.querySelector('#group-target').value), 0, 100);
    const color = form.querySelector('#group-color').value || '#ff9f45';
    const includeAccounts = Array.from(form.querySelectorAll('input[name="accounts"]:checked')).map(x => x.value);
    const includeInstruments = Array.from(form.querySelectorAll('input[name="instruments"]:checked')).map(x => x.value);
    if (editing) {
      editing.name = name; editing.target = target; editing.color = color;
      editing.includeAccounts = includeAccounts; editing.includeInstruments = includeInstruments; editing.includeClasses = [];
    } else {
      scheme.groups.push({ id: uid('grp'), name, target, color, includeAccounts, includeClasses: [], includeInstruments });
    }
    saveState();
    closeSheet(wrap);
    toast(editing ? '分组已更新' : '分组已添加', 'success');
    if (parseRoute().name === 'groups') refreshPage();
    else renderPage({ scroll: false });
  });
}
function checkRowHTML(name, value, label, sub, checked, isBoolean) {
  return '<label class="check-row"><input type="checkbox" name="' + name + '" value="' + esc(value) + '"' + (checked ? ' checked' : '') + '><span class="checkbox ' + (checked ? 'checked' : '') + '">' + icon('check') + '</span>' +
    '<span class="check-name">' + esc(label) + (sub ? '<span class="check-sub">' + esc(sub) + '</span>' : '') + '</span></label>';
}

/* ---------- scheme editor ---------- */
function openNewSchemeSheet() {
  const body = '<form id="scheme-form"><div class="form-grid">' + fieldHTML({ id: 'scheme-name', label: '分组方式名称', placeholder: '例如：投资期限', full: true }) +
    fieldHTML({ id: 'scheme-desc', label: '说明（可选）', placeholder: '这个分组方式用来回答什么问题？', full: true }) + '</div>' +
    '<div class="info-banner" style="margin-top:14px">' + icon('sparkles') + '<div>新建后会默认创建一个「新分组」，你可以继续添加并设置目标占比。</div></div></form>';
  const wrap = openSheet({
    title: '新建分组方式', body,
    footer: '<button class="btn ghost" data-sheet-close>取消</button><button class="btn primary" data-scheme-save>创建</button>'
  });
  wrap.querySelector('[data-scheme-save]').addEventListener('click', () => {
    const name = cleanText(wrap.querySelector('#scheme-name').value, 20);
    if (!name) { toast('请填写名称', 'error'); return; }
    const desc = cleanText(wrap.querySelector('#scheme-desc').value, 50);
    const id = uid('scheme');
    const scheme = { id, name, desc, groups: [{ id: uid('grp'), name: '新分组', target: 100, color: GROUP_COLORS[0], includeAccounts: [], includeClasses: [], includeInstruments: [] }] };
    state.schemes.push(scheme);
    saveState();
    closeSheet(wrap);
    ui.statsSchemeId = id; ui.rebalanceSchemeId = id; ui.calendarSchemeId = id;
    navigate('#/groups/' + encodeURIComponent(id));
  });
}
function openEditSchemeSheet(schemeId) {
  const scheme = schemeById(schemeId);
  if (!scheme || isBuiltinScheme(scheme)) return;
  const body = '<form id="scheme-edit-form"><div class="form-grid">' + fieldHTML({ id: 'scheme-name-edit', label: '名称', value: scheme.name, full: true }) +
    fieldHTML({ id: 'scheme-desc-edit', label: '说明', value: scheme.desc || '', full: true }) + '</div></form>';
  const wrap = openSheet({
    title: '编辑分组方式', body,
    footer: '<button class="btn ghost" data-sheet-close>取消</button><button class="btn primary" data-scheme-edit-save>保存</button>'
  });
  wrap.querySelector('[data-scheme-edit-save]').addEventListener('click', () => {
    scheme.name = cleanText(wrap.querySelector('#scheme-name-edit').value, 20) || scheme.name;
    scheme.desc = cleanText(wrap.querySelector('#scheme-desc-edit').value, 50);
    saveState(); closeSheet(wrap); refreshPage(); toast('已更新', 'success');
  });
}
