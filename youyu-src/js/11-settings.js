/* =========================================================
   11 · 我的 / 设置 / 汇率 / 数据
   ========================================================= */
function renderSettingsPage() {
  const p = portfolioSummary();
  const base = baseCurrency();
  const foreign = Object.keys(CURRENCY_META).filter(c => c !== base);
  return pageTop({
    eyebrow: 'SETTINGS',
    title: '我的',
    sub: '本地优先，数据是你自己的。',
    actions: '<button class="icon-btn" data-action="toggle-hide" aria-label="隐藏金额">' + icon(state.settings.hideAmounts ? 'eyeOff' : 'eye') + '</button>'
  }) +
  '<section class="profile-card">' +
    '<div class="profile-top"><div class="profile-logo">余</div><div><div class="profile-name">有余 · 投资组合</div><div class="profile-sub">iPhone 上的私人资产账本 · 无需登录</div></div></div>' +
    '<div class="profile-stats"><div><div class="l">总资产</div><div class="v">' + fmtMoney(p.totalMarket, { compact: true }) + '</div></div><div><div class="l">累计收益</div><div class="v ' + pnlClass(p.profit) + '">' + pnlText(p.profit, { compact: true }) + '</div></div><div><div class="l">账户</div><div class="v">' + p.accounts.length + ' <span style="font-size:8px;color:var(--faint)">个</span></div></div></div>' +
  '</section>' +
  '<div class="install-card">' + icon('sparkles') + '<div><div class="t">把这个页面装进主屏幕</div><div class="s">在 Safari 中点「分享」→「添加到主屏幕」，即可像 App 一样全屏使用。数据保存在当前浏览器。</div></div></div>' +
  '<div class="settings-group"><div class="label">记账偏好</div><div class="settings-card">' +
    settingRowHTML('记账本币', base + ' · ' + baseMeta().name, 'wallet', 'open-base-currency', '所有统计统一折算为本币') +
    settingRowHTML('日间模式', state.settings.theme === 'light' ? '已开启' : '已关闭', state.settings.theme === 'light' ? 'sun' : 'moon', 'toggle-theme', '切换浅色界面，适合白天使用', '<span class="switch ' + (state.settings.theme === 'light' ? 'on' : '') + '"></span>') +
    settingRowHTML('隐藏金额', state.settings.hideAmounts ? '已隐藏' : '显示金额', state.settings.hideAmounts ? 'eyeOff' : 'eye', 'toggle-hide', '适合在公共场合查看', '<span class="switch ' + (state.settings.hideAmounts ? 'on' : '') + '"></span>') +
    settingRowHTML('再平衡容忍带', '±' + (Number(state.settings.tolerance) || 0).toFixed(1) + '%', 'scale', 'open-tolerance', '偏离目标多少时提示再平衡') +
  '</div></div>' +
  '<div class="settings-group"><div class="label">账户与标的</div><div class="settings-card">' +
    '<a class="setting-row" href="#/types"><span class="setting-icon blue">' + icon('grid') + '</span><span class="setting-main"><span class="t">类型管理</span><span class="s">编辑账户类型与标的类型，供添加资产和默认分组使用</span></span><span class="setting-value">' + accountTypes().length + ' / ' + instrumentTypes().length + ' 类' + icon('chevronRight') + '</span></a>' +
  '</div></div>' +
  '<div class="settings-group"><div class="label">默认分组 · 自动</div><div class="settings-card">' +
    builtinSchemes().map(s => '<a class="scheme-manage-row" href="#/groups/' + encodeURIComponent(s.id) + '">' +
      '<span class="dot" style="background:' + ((s.groups.find(g => !g.cashOnly) || s.groups[0] || {}).color || '#ff9f45') + '"></span>' +
      '<span class="sm-main"><span class="t">' + esc(s.name) + ' <span class="auto-tag">自动</span></span><span class="s">' + s.groups.length + ' 个分组 · 按' + (s.type === 'account' ? '账户' : s.type === 'instrument' ? '标的' : s.type === 'accountType' ? '账户类型' : '标的类型') + '实时生成</span></span>' +
      '<span class="chev">' + icon('chevronRight') + '</span></a>').join('') +
  '</div></div>' +
  '<div class="settings-group"><div class="label">自定义分组</div><div class="settings-card">' +
    customSchemes().map(s => '<a class="scheme-manage-row" href="#/groups/' + encodeURIComponent(s.id) + '">' +
      '<span class="dot" style="background:' + ((s.groups[0] && s.groups[0].color) || '#ff9f45') + '"></span>' +
      '<span class="sm-main"><span class="t">' + esc(s.name) + '</span><span class="s">' + s.groups.length + ' 个分组 · 目标 ' + schemeTargetTotal(s).toFixed(0) + '%</span></span>' +
      '<span class="chev">' + icon('chevronRight') + '</span></a>').join('') +
    '<button class="setting-row" data-action="new-scheme"><span class="setting-icon accent">' + icon('plus') + '</span><span class="setting-main"><span class="t">新建自定义分组</span><span class="s">用不同视角切分同一份资产</span></span><span class="setting-value">' + icon('chevronRight') + '</span></button>' +
  '</div></div>' +
  '<div class="settings-group"><div class="label">多币种汇率</div><div class="settings-card">' +
    '<button class="setting-row" data-action="open-rates"><span class="setting-icon blue">' + icon('swap') + '</span><span class="setting-main"><span class="t">汇率管理</span><span class="s">1 USD = ' + fmtPrice(rateCNY('USD') / rateCNY(base), base) + ' · 手动维护</span></span><span class="setting-value">管理' + icon('chevronRight') + '</span></button>' +
    foreign.slice(0, 3).map(c => '<div class="setting-row" style="padding-top:10px;padding-bottom:10px"><span class="setting-icon" style="background:rgba(255,255,255,.035)">' + icon('coins') + '</span><span class="setting-main"><span class="t">' + c + ' · ' + CURRENCY_META[c].name + '</span><span class="s">1 ' + c + ' = ' + fmtPrice(rateCNY(c) / rateCNY(base), base) + '</span></span></div>').join('') +
  '</div></div>' +
  '<div class="settings-group"><div class="label">数据</div><div class="settings-card">' +
    settingRowHTML('导出账本', 'JSON 备份', 'download', 'export-data', '保存账户、交易、价格与分组') +
    settingRowHTML('导入账本', '从备份恢复', 'upload', 'import-data', '导入会覆盖当前账本') +
    '<a class="setting-row" href="#/import"><span class="setting-icon blue">' + icon('search') + '</span><span class="setting-main"><span class="t">截图导入</span><span class="s">从截图提取的交易文字</span></span><span class="setting-value">' + icon('chevronRight') + '</span></a>' +
    (demoMode ? settingRowHTML('退出演示', '回到我的账本', 'logout', 'switch-user', '演示账本与真实账本完全分离') : settingRowHTML('体验示例数据', '完整演示', 'sparkles', 'switch-demo', '切换到独立演示账本，不影响真实数据')) +
    (demoMode ? settingRowHTML('重置示例数据', '重新同步', 'refresh', 'reset-demo', '仅重置演示账本，不影响真实数据') : '') +
    settingRowHTML('清空账本', '从零开始', 'trash', 'clear-data', '删除所有账户与记录', '', 'danger') +
    '<input type="file" id="import-file" accept=".json,application/json" style="display:none">' +
  '</div></div>' +
  '<div class="settings-group"><div class="label">关于</div><div class="settings-card">' +
    '<div class="setting-row"><span class="setting-icon accent">' + icon('shield') + '</span><span class="setting-main"><span class="t">本地存储</span><span class="s">所有数据保存在浏览器 localStorage，不上传服务器。清除浏览器数据会丢失账本，请定期导出备份。</span></span></div>' +
    '<div class="setting-row"><span class="setting-icon blue">' + icon('chart') + '</span><span class="setting-main"><span class="t">行情数据</span><span class="s">名称搜索来自新浪财经，最新报价来自腾讯行情；公开接口可能受网络影响，仅供估值参考。</span></span></div>' +
    '<div class="setting-row"><span class="setting-icon">' + icon('info') + '</span><span class="setting-main"><span class="t">有余 v5.6</span><span class="s">为 iPhone 打造 · 纯 HTML 单文件 · 本地存储</span></span></div>' +
  '</div></div>' +
  '<div class="version">' + esc(APP_NAME) + ' · 投资组合<br>不构成投资建议 · 数据仅供参考</div>' +
  '<div style="height:8px"></div>';
}
function settingRowHTML(title, value, ico, action, sub, right, tone) {
  return '<button class="setting-row" data-action="' + action + '"><span class="setting-icon ' + (tone || '') + '">' + icon(ico) + '</span><span class="setting-main"><span class="t">' + esc(title) + '</span><span class="s">' + esc(sub || '') + '</span></span>' +
    '<span class="setting-value">' + (right || '') + (right && String(right).indexOf('switch') >= 0 ? '' : (value ? esc(value) : '') + icon('chevronRight')) + '</span></button>';
}

function openBaseCurrencySheet() {
  const body = '<div class="check-list">' + Object.keys(CURRENCY_META).map(c => '<label class="check-row"><input type="radio" name="base-ccy" value="' + c + '"' + (c === baseCurrency() ? ' checked' : '') + '><span class="checkbox ' + (c === baseCurrency() ? 'checked' : '') + '">' + icon('check') + '</span>' +
    '<span class="check-name">' + c + ' · ' + CURRENCY_META[c].name + '<span class="check-sub">1 ' + c + ' = ' + fmtPrice(rateCNY(c) / rateCNY('CNY'), 'CNY') + '（人民币）</span></span></label>').join('') + '</div>' +
    '<div class="info-banner">' + icon('info') + '<div>切换本币只改变展示与统计口径，不会修改交易记录。汇率以人民币为锚保存。</div></div>';
  const wrap = openSheet({
    title: '记账本币', sub: '所有资产与收益统一折算为这个币种', body,
    footer: '<button class="btn ghost" data-sheet-close>取消</button><button class="btn primary" data-base-save>应用</button>'
  });
  wrap.querySelectorAll('input[name="base-ccy"]').forEach(inp => inp.addEventListener('change', () => {
    wrap.querySelectorAll('.checkbox').forEach(x => x.classList.remove('checked'));
    const box = inp.parentNode.querySelector('.checkbox');
    if (box) box.classList.add('checked');
  }));
  wrap.querySelector('[data-base-save]').addEventListener('click', () => {
    const checked = wrap.querySelector('input[name="base-ccy"]:checked');
    if (!checked) return;
    state.settings.base = checked.value;
    saveState();
    closeSheet(wrap);
    toast('本币已切换为 ' + checked.value, 'success');
    refreshPage();
  });
}

function openRatesSheet() {
  const base = baseCurrency();
  const list = Object.keys(CURRENCY_META).filter(c => c !== base);
  const body = '<form id="rates-form"><div class="info-banner" style="margin-top:0">' + icon('info') + '<div>汇率用于把不同币种的资产折算成 <b>' + base + '</b>。修改后立即影响总资产、收益与再平衡。</div></div>' +
    '<div class="form-section">当前汇率</div>' +
    '<div style="display:flex;flex-direction:column;gap:10px">' +
      list.map(c => '<div class="field" style="display:grid;grid-template-columns:1fr 150px;align-items:center;gap:10px">' +
        '<div><div style="font-size:11px;color:var(--ink-2);font-weight:550">1 ' + c + ' =</div><div class="hint" style="padding:0;margin-top:2px">' + CURRENCY_META[c].name + '</div></div>' +
        '<div class="amount-input"><input class="input rate-input" type="text" inputmode="decimal" name="rate_' + c + '" data-ccy="' + c + '" value="' + round(rateCNY(c) / rateCNY(base), 4) + '"><span class="unit">' + base + '</span></div>' +
      '</div>').join('') +
    '</div>' +
    '<div class="form-section">基准说明</div><div class="tiny">1 ' + base + ' = 1 ' + base + '。若你从银行换汇，可直接填写成交价。</div></form>';
  const wrap = openSheet({
    title: '汇率管理', sub: '手动维护 · 当前本币 ' + base,
    body, footer: '<button class="btn ghost" data-sheet-close>取消</button><button class="btn primary" data-rates-save>保存汇率</button>'
  });
  wrap.querySelector('[data-rates-save]').addEventListener('click', () => {
    const baseRate = rateCNY(base);
    wrap.querySelectorAll('.rate-input').forEach(inp => {
      const c = inp.getAttribute('data-ccy');
      const v = parseNumber(inp.value);
      if (v > 0) state.rates[c] = round(v * baseRate, 6);
    });
    ensureRates();
    saveState();
    closeSheet(wrap);
    toast('汇率已更新', 'success');
    refreshPage();
  });
}

function openToleranceSheet() {
  const body = '<form id="tolerance-form"><div class="info-banner" style="margin-top:0">' + icon('scale') + '<div>再平衡时，分组的实际占比偏离目标超过这个范围，会被标记为「超配」或「低配」。</div></div>' +
    '<div class="form-section">容忍带</div>' +
    '<div class="field" style="display:grid;grid-template-columns:1fr 110px;align-items:center;gap:10px"><span style="font-size:11px;color:var(--ink-2)">允许偏离目标</span><div class="amount-input"><input class="input" type="text" inputmode="decimal" id="tolerance-input" value="' + (Number(state.settings.tolerance) || 0) + '"><span class="unit">%</span></div></div>' +
    '<div class="hint" style="margin-top:8px">常用值 3%–5%。越低越敏感。</div></form>';
  const wrap = openSheet({
    title: '再平衡容忍带', body,
    footer: '<button class="btn ghost" data-sheet-close>取消</button><button class="btn primary" data-tolerance-save>保存</button>'
  });
  wrap.querySelector('[data-tolerance-save]').addEventListener('click', () => {
    state.settings.tolerance = clamp(parseNumber(wrap.querySelector('#tolerance-input').value), 0.1, 30);
    saveState(); closeSheet(wrap); refreshPage(); toast('容忍带已更新', 'success');
  });
}

/* ---------- data actions ---------- */
function downloadBackup() {
  const text = exportData();
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'youyu-backup-' + todayKey() + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
  toast('备份文件已生成', 'success');
}
function triggerImport() {
  const input = $('#import-file');
  if (input) input.click();
}
function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      confirmDialog({
        title: '导入账本？',
        message: '导入会覆盖当前所有账户、记录和设置。建议先导出备份。',
        confirmText: '确认导入',
        onConfirm: () => {
          try {
            importData(String(reader.result || ''));
            closeAllSheets();
            toast('账本导入成功', 'success');
            navigate('#/assets', true);
            renderPage();
          } catch (e) {
            toast('导入失败：' + e.message, 'error');
          }
        }
      });
    } catch (e) { toast('文件读取失败', 'error'); }
  };
  reader.readAsText(file);
}
function makeEmptyState() {
  const s = buildSeed();
  s.isDemo = false;
  s.accounts = [];
  s.records = [];
  s.prices = {};
  s.fxHistory = {};
  s.meta.name = '我的投资组合';
  s.schemes = [{
    id: 'scheme_account', name: '账户归属', desc: '按资金所在账户划分',
    groups: [
      { id: 'g_domestic', name: '境内账户', color: '#ff9f45', target: 60, includeAccounts: [], includeClasses: [], includeInstruments: [] },
      { id: 'g_global', name: '境外账户', color: '#5b8cff', target: 40, includeAccounts: [], includeClasses: [], includeInstruments: [] }
    ]
  }];
  return s;
}
function switchDataMode(toDemo) {
  saveState(true);
  if (toDemo) {
    const saved = readStoredState(DEMO_STORE_KEY);
    state = saved || buildSeed();
    demoMode = true;
  } else {
    const saved = readStoredState(STORE_KEY);
    state = saved || makeEmptyState();
    demoMode = false;
  }
  normalizeState(state);
  ensureRates();
  saveState(true);
  ui = defaultUi();
  closeAllSheets();
  navigate('#/assets', true);
  renderPage({ scroll: true });
  toast(toDemo ? '已切换到演示账本' : '已切换到我的账本', 'success');
  if (toDemo) setTimeout(() => { hydrateDemoLedger().catch(e => console.warn('演示数据同步失败', e)); }, 500);
}
function resetDemo() {
  if (!demoMode) { switchDataMode(true); return; }
  state = buildSeed();
  normalizeState(state);
  demoMode = true;
  ensureRates();
  saveState(true);
  ui = defaultUi();
  closeAllSheets();
  toast('示例数据已重置', 'success');
  navigate('#/assets', true);
  renderPage({ scroll: true });
  setTimeout(() => { hydrateDemoLedger().catch(e => console.warn('演示数据同步失败', e)); }, 500);
}

function clearAllData() {
  confirmDialog({
    title: demoMode ? '重置示例账本？' : '清空整个账本？', message: demoMode ? '示例账本会恢复为初始演示组合，真实账本不受影响。' : '所有账户、交易、价格与分组设置都会被删除，且无法恢复。', confirmText: demoMode ? '确认重置' : '确认清空', danger: true,
    onConfirm: () => {
      if (demoMode) { resetDemo(); return; }
      state = makeEmptyState();
      normalizeState(state);
      saveState();
      ui = defaultUi();
      closeAllSheets();
      toast('账本已清空', 'success');
      navigate('#/assets', true);
      renderPage();
    }
  });
}
