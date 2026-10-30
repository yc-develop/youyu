/* =========================================================
   13 · 全局交互 / 动作路由
   ========================================================= */
function defaultUi() {
  const custom = schemesForRebalance();
  const firstCustom = custom[0] ? custom[0].id : '';
  const secondCustom = custom[1] ? custom[1].id : firstCustom;
  return {
    accountPeriod: 90,
    accountChartMode: 'value',
    instrumentPeriod: 365,
    instrumentChartMode: 'price',
    trendPeriod: 365,
    flowAccountPeriod: {},
    flowInstrumentPeriod: {},
    statsSchemeId: '__auto_account',
    rebalanceSchemeId: secondCustom,
    calendarSchemeId: '__auto_account',
    calendarGroupId: 'all',
    calendarMode: 'day',
    calendarMetric: 'amount',
    calendarMonth: startOfMonth(todayKey()),
    calendarYear: parseDay(todayKey()).getFullYear(),
    sankeyMode: 'account'
  };
}

function handleAction(action, el) {
  const d = el.dataset || {};
  switch (action) {
    case 'back': goBack(d.fallback || '#/assets'); return;
    case 'go': closeAllSheets(); navigate(d.href || '#/assets'); return;
    case 'noop': return;
    case 'toggle-hide':
      state.settings.hideAmounts = !state.settings.hideAmounts;
      saveState(); refreshPage(); return;
    case 'toggle-fx':
      state.settings.considerFx = !state.settings.considerFx;
      saveState();
      toast(state.settings.considerFx ? '已计入汇率影响' : '已按本币价格统计', 'success');
      refreshPage(); return;

    case 'open-add-account':
      closeAllSheets(); setTimeout(() => openAccountForm(), 50); return;
    case 'open-add-instrument':
      closeAllSheets(); setTimeout(() => openInstrumentForm(d.account), 50); return;
    case 'open-record-picker':
      closeAllSheets(); setTimeout(openRecordPicker, 50); return;
    case 'add-record-account':
      closeAllSheets(); setTimeout(() => openRecordChooser(d.account), 50); return;
    case 'add-record-instrument': {
      const im = instrumentById(d.instrument);
      if (!im) return;
      closeAllSheets(); setTimeout(() => openRecordChooser(im.account.id, im.id), 50); return;
    }
    case 'open-price-update': {
      const im = instrumentById(d.instrument);
      if (!im) return;
      closeAllSheets(); setTimeout(() => openRecordForm(im.account.id, 'price', im.id), 50); return;
    }
    case 'open-account-menu':
      closeAllSheets(); setTimeout(() => openAccountMenu(d.id), 50); return;
    case 'open-instrument-menu':
      closeAllSheets(); setTimeout(() => openInstrumentMenu(d.id), 50); return;
    case 'refresh-quote':
      closeAllSheets(); setTimeout(() => refreshQuoteForInstrument(d.id), 50); return;
    case 'match-market': {
      const im = instrumentById(d.id);
      if (!im) return;
      closeAllSheets(); setTimeout(() => openInstrumentForm(im.account.id, im.id), 50); return;
    }
    case 'edit-account':
      closeAllSheets(); setTimeout(() => openAccountForm(d.id), 50); return;
    case 'edit-instrument': {
      const im = instrumentById(d.id);
      if (!im) return;
      closeAllSheets(); setTimeout(() => openInstrumentForm(im.account.id, im.id), 50); return;
    }
    case 'open-records':
      closeAllSheets(); setTimeout(() => openRecordsSheet(d.scope, d.id), 50); return;
    case 'delete-account':
      setTimeout(() => deleteAccountById(d.id), 50); return;
    case 'delete-instrument':
      setTimeout(() => deleteInstrumentById(d.id), 50); return;
    case 'edit-record': {
      const rec = state.records.find(r => r.id === d.id);
      if (!rec) return;
      if (rec.type === 'flow') {
        closeAllSheets();
        const scope = rec.instrumentId ? 'instrument' : 'account';
        const targetId = rec.instrumentId || rec.accountId;
        setTimeout(() => openFlowFieldEditor(scope, targetId, rec.periodKey, rec.flowField), 50);
        return;
      }
      closeAllSheets();
      setTimeout(() => openRecordForm(rec.accountId, rec.type, rec.instrumentId, rec.id), 50);
      return;
    }
    case 'delete-record': {
      const rec = state.records.find(r => r.id === d.id);
      if (!rec) return;
      setTimeout(() => confirmDialog({
        title: '删除这条记录？', message: dateRangeLabel(rec.date, rec.date) + ' · ' + recordTitle(rec) + '。删除后相关统计会重新计算。', confirmText: '删除', danger: true,
        onConfirm: () => { deleteRecord(rec.id); closeAllSheets(); toast('记录已删除'); refreshPage(); }
      }), 80);
      return;
    }

    case 'set-account-period': ui.accountPeriod = Number(d.value); refreshPage(); return;
    case 'set-account-chart-mode': ui.accountChartMode = d.value; refreshPage(); return;
    case 'set-instrument-period': ui.instrumentPeriod = Number(d.value); refreshPage(); return;
    case 'set-instrument-chart-mode': ui.instrumentChartMode = d.value; refreshPage(); return;
    case 'set-trend-period': ui.trendPeriod = Number(d.value); refreshPage(); return;
    case 'set-flow-period': {
      const map = d.scope === 'account' ? (ui.flowAccountPeriod || (ui.flowAccountPeriod = {})) : (ui.flowInstrumentPeriod || (ui.flowInstrumentPeriod = {}));
      map[d.id] = d.period;
      refreshPage(); return;
    }
    case 'edit-flow-field': openFlowFieldEditor(d.scope, d.id, d.period, d.field); return;
    case 'reset-flow': resetFlowAdjustments(d.scope, d.id, d.period); return;
    case 'select-stats-scheme': ui.statsSchemeId = d.id; ui.sankeyMode = ui.sankeyMode || 'account'; refreshPage(); return;
    case 'set-sankey-mode': ui.sankeyMode = d.value; refreshPage(); return;
    case 'select-rebalance-scheme': ui.rebalanceSchemeId = d.id; refreshPage(); return;
    case 'select-calendar-scheme': ui.calendarSchemeId = d.id; ui.calendarGroupId = 'all'; refreshPage(); return;
    case 'select-calendar-group': ui.calendarGroupId = d.id; refreshPage(); return;
    case 'set-calendar-mode':
      ui.calendarMode = d.value;
      if (d.value === 'month') ui.calendarYear = parseDay(ui.calendarMonth).getFullYear();
      if (d.value === 'year') ui.calendarYear = parseDay(todayKey()).getFullYear();
      refreshPage(); return;
    case 'set-calendar-metric': ui.calendarMetric = d.value; refreshPage(); return;
    case 'cal-prev': shiftCalendar(-1); return;
    case 'cal-next': shiftCalendar(1); return;
    case 'calendar-today':
      ui.calendarMonth = startOfMonth(todayKey());
      ui.calendarYear = parseDay(todayKey()).getFullYear();
      refreshPage(); return;
    case 'open-calendar-day': openCalendarDaySheet(d.date); return;
    case 'open-calendar-week':
      ui.calendarMonth = startOfMonth(d.start);
      ui.calendarMode = 'day';
      refreshPage(); return;
    case 'open-calendar-month':
      ui.calendarMonth = d.month;
      ui.calendarMode = 'day';
      refreshPage(); return;
    case 'open-calendar-year':
      ui.calendarYear = Number(d.year);
      ui.calendarMode = 'month';
      refreshPage(); return;

    case 'new-scheme': closeAllSheets(); setTimeout(openNewSchemeSheet, 50); return;
    case 'edit-scheme': closeAllSheets(); setTimeout(() => openEditSchemeSheet(d.scheme), 50); return;
    case 'delete-scheme': closeAllSheets(); setTimeout(() => deleteSchemeById(d.scheme), 50); return;
    case 'open-group-editor': closeAllSheets(); setTimeout(() => openGroupEditor(d.scheme, d.id || null), 50); return;
    case 'open-type-editor': closeAllSheets(); setTimeout(() => openTypeEditor(d.kind, d.id || ''), 50); return;
    case 'move-group': moveGroup(d.id, Number(d.dir)); return;
    case 'open-group-detail': openGroupDetailSheet(d.id); return;
    case 'open-target-editor': closeAllSheets(); setTimeout(() => openTargetEditor(d.scheme), 60); return;
    case 'open-rebalance-plan': openRebalancePlanSheet(d.scheme); return;

    case 'open-base-currency': openBaseCurrencySheet(); return;
    case 'open-rates': openRatesSheet(); return;
    case 'open-tolerance': openToleranceSheet(); return;
    case 'export-data': downloadBackup(); return;
    case 'import-data': triggerImport(); return;
    case 'reset-demo': closeAllSheets(); setTimeout(resetDemo, 50); return;
    case 'clear-data': closeAllSheets(); setTimeout(clearAllData, 50); return;
    default: return;
  }
}

function shiftCalendar(dir) {
  const mode = ui.calendarMode || 'day';
  const currentYear = parseDay(todayKey()).getFullYear();
  if (mode === 'day' || mode === 'week') {
    const next = addMonths(ui.calendarMonth, dir);
    if (startOfMonth(next) > startOfMonth(todayKey())) return;
    ui.calendarMonth = next;
    ui.calendarYear = parseDay(ui.calendarMonth).getFullYear();
  } else if (mode === 'month') {
    const nextYear = (Number(ui.calendarYear) || currentYear) + dir;
    if (nextYear > currentYear) return;
    ui.calendarYear = nextYear;
    ui.calendarMonth = ui.calendarYear + '-01-01';
  }
  refreshPage();
}

function moveGroup(groupId, dir) {
  const route = parseRoute();
  const schemeId = route.name === 'groups' ? route.schemeId : rebalanceSchemeId();
  const scheme = schemeById(schemeId);
  if (!scheme) return;
  const idx = scheme.groups.findIndex(g => g.id === groupId);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= scheme.groups.length) return;
  const tmp = scheme.groups[idx];
  scheme.groups[idx] = scheme.groups[target];
  scheme.groups[target] = tmp;
  saveState(); refreshPage();
}

function deleteSchemeById(schemeId) {
  if (customSchemes().length <= 1) { toast('至少保留一个自定义分组方式', 'error'); return; }
  const scheme = schemeById(schemeId);
  if (!scheme || isBuiltinScheme(scheme)) return;
  confirmDialog({
    title: '删除「' + scheme.name + '」？', message: '这个分组方式及其所有目标设置会被删除，账户和交易记录不受影响。', confirmText: '删除', danger: true,
    onConfirm: () => {
      state.schemes = state.schemes.filter(s => s.id !== schemeId);
      const first = state.schemes[0] ? state.schemes[0].id : '__auto_account';
      if (ui.statsSchemeId === schemeId) ui.statsSchemeId = first;
      if (ui.rebalanceSchemeId === schemeId) ui.rebalanceSchemeId = first;
      if (ui.calendarSchemeId === schemeId) ui.calendarSchemeId = first;
      saveState(); closeAllSheets(); toast('分组方式已删除');
      navigate('#/settings', true); renderPage();
    }
  });
}

/* ---------- global bindings ---------- */
function bindGlobalEvents() {
  document.addEventListener('click', e => {
    const closeBtn = e.target.closest('[data-sheet-close]');
    if (closeBtn) { e.preventDefault(); closeTopSheet(); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    if (!action) return;
    // 允许普通链接继续导航
    if (el.tagName === 'A' && el.getAttribute('href') && action !== 'go') return;
    e.preventDefault();
    e.stopPropagation();
    handleAction(action, el);
  }, false);

  document.addEventListener('change', e => {
    if (e.target && e.target.id === 'import-file') {
      const f = e.target.files && e.target.files[0];
      handleImportFile(f);
      e.target.value = '';
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTopSheet();
  });

  window.addEventListener('hashchange', () => {
    closeAllSheets();
    renderPage();
    window.scrollTo(0, 0);
  });
}

window.addEventListener('error', function (e) {
  console.error('有余运行错误', e.error || e.message);
});
