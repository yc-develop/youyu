/* =========================================================
   12c · 账户类型 / 标的类型管理
   ========================================================= */
function typeUsageCount(kind, id) {
  if (kind === 'account') return accounts().filter(a => a.type === id).length;
  return accounts().reduce((n, a) => n + (a.instruments || []).filter(i => i.cls === id).length, 0);
}
function typeRowsHTML(kind, list) {
  return list.map(t => {
    const count = typeUsageCount(kind, t.id);
    const unit = kind === 'account' ? ' 个账户' : ' 个标的';
    return '<button class="type-row" data-action="open-type-editor" data-kind="' + kind + '" data-id="' + esc(t.id) + '">' +
      '<span class="type-swatch" style="background:' + t.color + '"></span>' +
      '<span class="type-main"><span class="t">' + esc(t.name) + (t.builtin ? '<span class="type-tag">内置</span>' : '') + '</span>' +
      '<span class="s">' + esc(kind === 'instrument' ? (t.short || t.name) + ' · ' : '') + count + unit + '</span></span>' +
      '<span class="type-chev">' + icon('chevronRight') + '</span></button>';
  }).join('') || '<div class="tiny" style="padding:16px">暂无类型</div>';
}
function renderTypesPage() {
  return backHead('类型管理', '', '#/settings') +
  '<div class="detail-body">' +
    '<div class="section-head" style="margin-top:2px"><div><h2>账户类型</h2><div class="sub">用于账户添加、筛选和「账户类型分组」</div></div><span class="tiny">' + accountTypes().length + ' 类</span></div>' +
    '<div class="type-list">' + typeRowsHTML('account', accountTypes()) + '</div>' +
    '<button class="btn wide ghost type-add" data-action="open-type-editor" data-kind="account">' + icon('plus') + '添加账户类型</button>' +
    '<div class="section-head" style="margin-top:22px"><div><h2>标的类型</h2><div class="sub">用于标的归类、默认分组和统计口径</div></div><span class="tiny">' + instrumentTypes().length + ' 类</span></div>' +
    '<div class="type-list">' + typeRowsHTML('instrument', instrumentTypes()) + '</div>' +
    '<button class="btn wide ghost type-add" data-action="open-type-editor" data-kind="instrument">' + icon('plus') + '添加标的类型</button>' +
    '<div class="info-banner" style="margin-top:16px">' + icon('info') + '<div>改名或改色会同步到已有账户/标的与默认分组。内置类型不可删除；自定义类型在未被使用时可以删除。</div></div>' +
    '<div style="height:10px"></div>' +
  '</div>';
}
function openTypeEditor(kind, typeId) {
  const isAccount = kind === 'account';
  const list = isAccount ? accountTypes() : instrumentTypes();
  const editing = typeId ? list.find(t => t.id === typeId) : null;
  const colors = ['#ff9f45', '#5b8cff', '#b18cff', '#43d6b0', '#f2c45c', '#ff7aa2', '#7c9cff', '#ff5d6c', '#8e9aaf', '#f7931a'];
  const currentColor = editing ? editing.color : colors[list.length % colors.length];
  const body = '<form id="type-form" data-kind="' + kind + '" data-id="' + esc(editing ? editing.id : '') + '">' +
    '<div class="form-grid">' +
      fieldHTML({ id: 'type-name', label: isAccount ? '账户类型名称' : '标的类型名称', value: editing ? editing.name : '', placeholder: isAccount ? '例如：券商账户' : '例如：REITs', full: true }) +
      (!isAccount ? fieldHTML({ id: 'type-short', label: '简称（可选）', value: editing ? (editing.short || '') : '', placeholder: '例如：REITs' }) : '') +
    '</div>' +
    '<div class="field" style="margin-top:12px"><label>类型颜色</label><div class="color-row">' +
      colors.map(c => '<button type="button" class="color-dot ' + (c === currentColor ? 'active' : '') + '" style="background:' + c + '" data-color="' + c + '" aria-label="选择颜色"></button>').join('') +
    '</div><input type="hidden" name="type-color" id="type-color" value="' + currentColor + '"></div>' +
    (isAccount ? '<div class="info-banner" style="margin-top:14px">' + icon('info') + '<div>账户类型只影响分类与默认分组，不影响账户币种、余额或交易记录。</div></div>' : '<div class="info-banner" style="margin-top:14px">' + icon('info') + '<div>标的类型是统计分类；修改名称不会改变标的的代码、价格或持仓。</div></div>') +
    (editing && !editing.builtin ? '<button type="button" class="btn danger wide" style="margin-top:14px" data-type-delete>' + icon('trash') + '删除这个类型</button>' : '') +
  '</form>';
  const wrap = openSheet({
    title: editing ? '编辑类型' : '添加类型', sub: isAccount ? '账户类型' : '标的类型',
    body, footer: '<button class="btn ghost" data-sheet-close>取消</button><button class="btn primary" data-type-save>' + (editing ? '保存' : '添加') + '</button>'
  });
  const form = wrap.querySelector('#type-form');
  form.querySelectorAll('.color-dot').forEach(btn => btn.addEventListener('click', () => {
    form.querySelectorAll('.color-dot').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    form.querySelector('#type-color').value = btn.getAttribute('data-color');
  }));
  wrap.querySelector('[data-type-save]').addEventListener('click', () => {
    const name = cleanText(form.querySelector('#type-name').value, 20);
    if (!name) { toast('请填写类型名称', 'error'); return; }
    if (list.some(t => t.id !== (editing && editing.id) && t.name === name)) { toast('已存在同名类型', 'error'); return; }
    const color = form.querySelector('#type-color').value || currentColor;
    const shortInput = form.querySelector('#type-short');
    if (editing) {
      editing.name = name;
      editing.color = color;
      if (!isAccount) editing.short = cleanText(shortInput ? shortInput.value : '', 8) || name.slice(0, 2);
      if (isAccount) state.accounts.filter(a => a.type === editing.id).forEach(a => { a.typeName = name; });
    } else {
      const id = uid(isAccount ? 'acc_type' : 'inst_type');
      list.push(isAccount
        ? { id, name, color, builtin: false }
        : { id, name, short: cleanText(shortInput ? shortInput.value : '', 8) || name.slice(0, 2), color, group: 'other', builtin: false });
    }
    saveState();
    closeSheet(wrap);
    toast(editing ? '类型已更新' : '类型已添加', 'success');
    refreshPage();
  });
  const delBtn = wrap.querySelector('[data-type-delete]');
  if (delBtn) delBtn.addEventListener('click', () => {
    const usage = typeUsageCount(kind, editing.id);
    if (usage > 0) { toast((isAccount ? '还有 ' + usage + ' 个账户使用此类型' : '还有 ' + usage + ' 个标的属于此类型'), 'error'); return; }
    confirmDialog({
      title: '删除「' + editing.name + '」？',
      message: '未被使用的自定义类型可以直接删除，已有记录不会受影响。',
      confirmText: '删除', danger: true,
      onConfirm: () => {
        const target = isAccount ? state.accountTypes : state.instrumentTypes;
        const idx = target.findIndex(t => t.id === editing.id);
        if (idx >= 0) target.splice(idx, 1);
        saveState();
        closeAllSheets();
        toast('类型已删除', 'success');
        refreshPage();
      }
    });
  });
}
