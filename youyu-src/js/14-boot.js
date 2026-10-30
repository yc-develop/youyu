/* =========================================================
   14 · 启动
   ========================================================= */
let afterRenderHooks = [];

function afterRenderPage(route) {
  // 为页面上的隐藏文件输入等预留钩子
  afterRenderHooks.forEach(fn => { try { fn(route); } catch (e) { console.error(e); } });
  // 表单里的回车不提交页面
  const screen = $('#screen');
  if (screen) {
    screen.querySelectorAll('form').forEach(form => {
      form.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target && e.target.tagName !== 'TEXTAREA') e.preventDefault();
      });
    });
  }
}

function boot() {
  try {
    loadState();
  } catch (e) {
    console.error(e);
    state = buildSeed();
    normalizeState(state);
  }
  ui = defaultUi();
  bindGlobalEvents();
  if (!location.hash || location.hash === '#') {
    history.replaceState(null, '', '#/assets');
  } else if (!/^#\//.test(location.hash)) {
    history.replaceState(null, '', '#/assets');
  }
  const route = parseRoute();
  if (!TABS.some(t => t.key === route.name) && ['account', 'instrument', 'groups', 'types'].indexOf(route.name) < 0) {
    history.replaceState(null, '', '#/assets');
  }
  renderPage({ scroll: true });
  setTimeout(() => { autoRefreshMarketQuotes().catch(e => console.warn('自动行情失败', e)); }, 900);
  // 开放给调试与自动化测试
  window.__YINGJI__ = {
    get state() { return state; },
    get ui() { return ui; },
    renderPage, refreshPage, saveState, buildDailyAnalytics, portfolioSummary,
    groupBreakdown, computeAccountMetrics, computeInstrumentMetrics
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
