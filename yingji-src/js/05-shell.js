/* =========================================================
   05 · App Shell / 路由 / 通用组件 / 弹层
   ========================================================= */
const TABS = [
  { key: 'assets',    label: '资产', icon: 'wallet',   href: '#/assets' },
  { key: 'stats',     label: '统计', icon: 'chart',    href: '#/stats' },
  { key: 'calendar',  label: '日历', icon: 'calendar', href: '#/calendar' },
  { key: 'rebalance', label: '再平衡', icon: 'scale',    href: '#/rebalance' },
  { key: 'settings',  label: '我的', icon: 'user',     href: '#/settings' }
];
const PAGE_TITLES = { assets: '资产', stats: '统计', calendar: '收益日历', rebalance: '再平衡', settings: '我的' };

let lastRouteKey = '';
let overlayDepth = 0;

function parseRoute() {
  const raw = String(location.hash || '').replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return { name: 'assets' };
  if (parts[0] === 'account' && parts[1]) return { name: 'account', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'instrument' && parts[1]) return { name: 'instrument', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'groups' && parts[1]) return { name: 'groups', schemeId: decodeURIComponent(parts[1]) };
  if (TABS.some(t => t.key === parts[0])) return { name: parts[0] };
  return { name: 'assets' };
}
function routeKey(r) { return r.name + '|' + (r.id || r.schemeId || ''); }
function activeTabFor(route) {
  if (route.name === 'account' || route.name === 'instrument') return 'assets';
  if (route.name === 'groups') return 'settings';
  return route.name;
}
function navigate(hash, replace) {
  const target = hash.indexOf('#') === 0 ? hash : '#/' + hash.replace(/^\/+/, '');
  if (replace) history.replaceState(null, '', target);
  else if (location.hash !== target) location.hash = target;
  else renderPage({ scroll: false });
}
function goBack(fallback) {
  if (history.length > 1) history.back();
  else navigate(fallback || '#/assets');
}

function renderTabbar(active) {
  const el = $('#tabbar');
  if (!el) return;
  el.innerHTML = TABS.map(t => {
    const on = t.key === active;
    return '<a class="tab-item ' + (on ? 'active' : '') + '" href="' + t.href + '" aria-label="' + t.label + '"' + (on ? ' aria-current="page"' : '') + '>' +
      '<span class="tab-ico">' + icon(t.icon) + '</span><span>' + t.label + '</span></a>';
  }).join('');
}

function renderPage(opts) {
  const o = opts || {};
  const route = parseRoute();
  const isDetail = route.name === 'account' || route.name === 'instrument' || route.name === 'groups';
  const screen = $('#screen');
  const scrollY = window.scrollY;
  const prevKey = lastRouteKey;
  chartRegistry = {};
  let html = '';
  if (route.name === 'assets') html = renderAssetsPage();
  else if (route.name === 'stats') html = renderStatsPage();
  else if (route.name === 'calendar') html = renderCalendarPage();
  else if (route.name === 'rebalance') html = renderRebalancePage();
  else if (route.name === 'settings') html = renderSettingsPage();
  else if (route.name === 'account') html = renderAccountPage(route.id);
  else if (route.name === 'instrument') html = renderInstrumentPage(route.id);
  else if (route.name === 'groups') html = renderGroupsPage(route.schemeId);
  if (!html) html = renderNotFound();
  screen.className = 'screen' + (isDetail ? ' detail-screen' : '');
  screen.innerHTML = '<div class="page">' + html + '</div>';
  const tabbar = $('#tabbar');
  tabbar.style.display = isDetail ? 'none' : 'grid';
  renderTabbar(activeTabFor(route));
  bindCharts();
  if (typeof afterRenderPage === 'function') afterRenderPage(route);
  const newKey = routeKey(route);
  if (o.scroll === false) {
    // keep position
  } else if (newKey !== prevKey) {
    window.scrollTo(0, 0);
  } else if (o.keepScroll) {
    window.scrollTo(0, scrollY);
  } else {
    window.scrollTo(0, 0);
  }
  lastRouteKey = newKey;
  document.body.classList.toggle('is-detail', isDetail);
}
function refreshPage() {
  const y = window.scrollY;
  renderPage({ scroll: false });
  requestAnimationFrame(() => window.scrollTo(0, y));
}
function renderNotFound() {
  return backHead('未找到') + '<div class="detail-body"><div class="empty-state" style="padding-top:80px"><div class="ico">' + icon('search') + '</div><h3>没有找到这个页面</h3><p>它可能已经被删除。</p><a href="#/assets" class="btn primary sm" style="margin-top:16px">返回资产</a></div></div>';
}

/* ---------- shared headers ---------- */
function pageTop(opts) {
  const o = opts || {};
  return '<header class="topbar"><div class="head-left"><div class="eyebrow">' + esc(o.eyebrow || 'PORTFOLIO') + '</div>' +
    '<h1 class="page-title">' + esc(o.title || '') + '</h1>' +
    (o.sub ? '<p class="page-sub">' + o.sub + '</p>' : '') + '</div>' +
    (o.actions ? '<div class="head-actions">' + o.actions + '</div>' : '') + '</header>';
}
function backHead(title, right, backHref) {
  return '<header class="back-head">' +
    '<div class="side"><button class="icon-btn sm" data-action="back" data-fallback="' + esc(backHref || '#/assets') + '" aria-label="返回">' + icon('chevronLeft') + '</button></div>' +
    '<div class="title">' + esc(title || '') + '</div>' +
    '<div class="side right">' + (right || '<span style="width:32px"></span>') + '</div></header>';
}
function iconBtn(action, ico, label, cls, attrs) {
  return '<button class="icon-btn ' + (cls || '') + '" data-action="' + action + '" aria-label="' + esc(label || '') + '" ' + (attrs || '') + '>' + icon(ico) + '</button>';
}

/* ---------- icons for entities ---------- */
function accountIconHTML(account, extraCls) {
  const c1 = account.color || '#ff9f45';
  const c2 = account.color2 || c1;
  return '<span class="acct-icon ' + (extraCls || '') + '" style="background:linear-gradient(145deg,' + c1 + ',' + c2 + ')"><span>' + esc(account.icon || (account.name || '?').slice(0, 1)) + '</span></span>';
}
function instrumentIconHTML(inst, extraCls) {
  const c1 = inst.color || '#ff9f45';
  const c2 = inst.color2 || c1;
  const initials = (inst.symbol || inst.name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || (inst.name || '?').slice(0, 1);
  return '<span class="h-icon img ' + (extraCls || '') + '" style="--hc1:' + c1 + ';--hc2:' + c2 + '">' + esc(initials) + '</span>';
}
function qtyUnit(cls) {
  if (cls === 'stock' || cls === 'etf') return '股';
  if (cls === 'deposit') return '笔';
  if (cls === 'bond') return '张';
  return '份';
}

/* ---------- shared rows ---------- */
function accountRowHTML(m) {
  const a = m.account;
  return '<a class="account-row" href="#/account/' + encodeURIComponent(a.id) + '">' +
    accountIconHTML(a) +
    '<div class="acct-main"><div class="acct-name">' + esc(a.name) + ' <span class="ccy">' + a.currency + '</span></div>' +
      '<div class="acct-meta"><span>已实现 <b class="' + pnlClass(m.realizedBase) + '">' + pnlText(m.realizedBase, { compact: true }) + '</b></span>' +
      '<span class="sep"></span><span>浮盈 <b class="' + pnlClass(m.unrealized) + '">' + pnlText(m.unrealized, { compact: true }) + '</b></span></div>' +
    '</div>' +
    '<div class="acct-value"><div class="v">' + fmtMoney(m.marketBase, { compact: true }) + '</div>' +
      '<div class="p ' + pnlClass(m.profitPct) + '">' + (m.profitPct == null ? '—' : fmtPct(m.profitPct, 1)) + '</div>' +
    '</div>' +
    '<span class="acct-chevron">' + icon('chevronRight') + '</span></a>';
}
function holdingRowHTML(im) {
  return '<a class="holding-row" href="#/instrument/' + encodeURIComponent(im.inst.id) + '">' +
    instrumentIconHTML(im.inst) +
    '<div class="h-main"><div class="h-name">' + esc(im.inst.name) + '</div>' +
      '<div class="h-sub">' + esc(im.inst.symbol) + ' · ' + fmtQty(im.qty) + qtyUnit(im.inst.cls) + ' · 均价 ' + fmtPrice(im.avgCost, im.inst.currency) + '</div></div>' +
    '<div class="h-value"><div class="v">' + fmtMoney(im.marketBase, { compact: true }) + '</div>' +
      '<div class="p ' + pnlClass(im.unrealized) + '">' + pnlText(im.unrealized, { compact: true }) + '</div></div>' +
    '<span class="h-chevron">' + icon('chevronRight') + '</span></a>';
}
function recordRowHTML(rec, opts) {
  const o = opts || {};
  const meta = RECORD_META[rec.type] || RECORD_META.deposit;
  const tone = recordTone(rec);
  return '<div class="record-row" data-record="' + esc(rec.id) + '">' +
    '<span class="rec-icon ' + tone + '">' + icon(meta.icon) + '</span>' +
    '<div class="rec-main"><div class="rec-title">' + esc(recordTitle(rec)) + (rec.note && rec.type !== 'price' ? '' : '') + '</div>' +
      '<div class="rec-sub">' + recordSubHTML(rec) + '</div></div>' +
    '<div class="rec-val">' + recordAmountHTML(rec) +
      (rec.type === 'buy' || rec.type === 'sell' ? '<span class="small">' + esc(meta.label) + '</span>' : '') +
    '</div>' +
    ((o.editable || o.deletable) ? '<div class="rec-actions">' +
      (o.editable ? '<button class="rec-edit" data-action="edit-record" data-id="' + esc(rec.id) + '" aria-label="编辑记录">' + icon('pen') + '</button>' : '') +
      (o.deletable ? '<button class="rec-del" data-action="delete-record" data-id="' + esc(rec.id) + '" aria-label="删除记录">' + icon('trash') + '</button>' : '') +
    '</div>' : '') +
  '</div>';
}
function recordsCardHTML(records, opts) {
  const o = opts || {};
  if (!records.length) return '<div class="empty-state" style="padding:26px 16px"><p>还没有记录</p></div>';
  const list = o.limit ? records.slice(0, o.limit) : records;
  return '<div class="list-card">' + list.map(r => recordRowHTML(r, o)).join('') +
    (o.limit && records.length > o.limit ? '<div class="records-more"><button class="text-btn" data-action="' + (o.moreAction || 'noop') + '" data-id="' + esc(o.id || '') + '">查看全部 ' + records.length + ' 条 ' + icon('chevronRight') + '</button></div>' : '') +
    '</div>';
}
function emptyBlock(title, text, actionHtml, ico) {
  return '<div class="empty-state"><div class="ico">' + icon(ico || 'sparkles') + '</div><h3>' + esc(title || '暂无数据') + '</h3>' +
    (text ? '<p>' + text + '</p>' : '') + (actionHtml || '') + '</div>';
}

/* ---------- amount formatting ---------- */
function moneyParts(v) {
  if (state && state.settings && state.settings.hideAmounts) return { sym: baseMeta().symbol, main: '••••••', dec: '' };
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  const fixed = abs.toFixed(2);
  const parts = fixed.split('.');
  const main = Number(parts[0]).toLocaleString('zh-CN');
  return { sym: (n < 0 ? '-' : '') + baseMeta().symbol, main, dec: parts[1] };
}
function fmtBase(v, opts) { return fmtMoney(v, Object.assign({ currency: baseCurrency() }, opts || {})); }
function signedPct(v, digits) { return fmtPct(v, digits == null ? 2 : digits, true); }

function tinyMoney(v) { return fmtMoney(v, { compact: true, decimals: 2 }); }

/* ---------- tabs / chips ---------- */
function schemeChipsHTML(activeId, actionName, list) {
  const source = Array.isArray(list) ? list : schemes();
  return '<div class="scheme-strip">' + source.map(s => '<button class="chip ' + (s.id === activeId ? 'active' : '') + '" data-action="' + (actionName || 'select-scheme') + '" data-id="' + esc(s.id) + '">' + esc(s.name) + '</button>').join('') +
    '<button class="chip add" data-action="new-scheme" aria-label="新建分组方式">' + icon('plus') + '方式</button></div>';
}

/* ---------- sheet / dialog ---------- */
function lockBodyScroll() {
  if (overlayDepth === 1) document.body.style.overflow = 'hidden';
}
function unlockBodyScroll() {
  if (overlayDepth === 0) document.body.style.overflow = '';
}
function openSheet(opts) {
  const o = opts || {};
  const root = $('#overlay-root');
  const wrap = document.createElement('div');
  wrap.className = 'overlay' + (o.center ? ' center' : '');
  const sheetId = o.id || uid('sheet');
  wrap.innerHTML =
    '<section class="sheet ' + (o.className || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title || '') + '">' +
      (o.center ? '' : '<div class="sheet-grab"></div>') +
      '<header class="sheet-head"><div class="st"><h2>' + esc(o.title || '') + '</h2>' + (o.sub ? '<div class="sub">' + o.sub + '</div>' : '') + '</div>' +
      '<button class="sheet-close" data-sheet-close aria-label="关闭">' + icon('x') + '</button></header>' +
      '<div class="sheet-body ' + (o.bodyClass || '') + '">' + (o.body || '') + '</div>' +
      (o.footer ? '<footer class="sheet-foot">' + o.footer + '</footer>' : '') +
    '</section>';
  root.appendChild(wrap);
  overlayDepth++;
  document.body.classList.add('has-overlay');
  lockBodyScroll();
  const close = () => closeSheet(wrap);
  wrap.addEventListener('click', e => {
    if (e.target === wrap && o.dismissible !== false) close();
  });
  wrap.querySelectorAll('form').forEach(form => {
    form.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target && e.target.tagName !== 'TEXTAREA') e.preventDefault();
    });
  });
  if (o.onMount) o.onMount(wrap, sheetId);
  requestAnimationFrame(() => {
    wrap.classList.add('open');
    if (o.onOpen) o.onOpen(wrap, sheetId);
  });
  return wrap;
}
function closeSheet(wrap) {
  if (!wrap || !wrap.parentNode) return;
  wrap.classList.remove('open');
  overlayDepth = Math.max(0, overlayDepth - 1);
  if (overlayDepth === 0) document.body.classList.remove('has-overlay');
  unlockBodyScroll();
  setTimeout(() => { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 300);
}
function closeTopSheet() {
  const all = $$('#overlay-root .overlay');
  if (all.length) closeSheet(all[all.length - 1]);
}
function closeAllSheets() {
  $$('#overlay-root .overlay').forEach(w => { w.classList.remove('open'); if (w.parentNode) w.parentNode.removeChild(w); });
  overlayDepth = 0;
  document.body.classList.remove('has-overlay');
  unlockBodyScroll();
}
function confirmDialog(opts) {
  const o = opts || {};
  const wrap = openSheet({
    center: true,
    title: o.title || '确认操作',
    body: '<div class="modal-text" style="margin-top:0">' + (o.message || '') + '</div>',
    footer: '<button class="btn ghost" data-confirm-cancel>取消</button><button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-confirm-ok>' + esc(o.confirmText || '确认') + '</button>'
  });
  wrap.querySelector('[data-confirm-cancel]').addEventListener('click', () => closeSheet(wrap));
  wrap.querySelector('[data-confirm-ok]').addEventListener('click', () => {
    closeSheet(wrap);
    if (o.onConfirm) setTimeout(o.onConfirm, 50);
  });
  return wrap;
}
function toast(text, type) {
  const root = $('#toast-root');
  root.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = text;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    el.style.transition = 'opacity .2s,transform .2s';
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
  }, 2400);
}

/* ---------- form helpers ---------- */
function fieldHTML(opts) {
  const o = opts || {};
  const full = o.full ? ' full' : '';
  let control = '';
  if (o.type === 'select') {
    control = '<select class="select" id="' + o.id + '" name="' + (o.name || o.id) + '"' + (o.attrs || '') + '>' +
      (o.options || []).map(opt => '<option value="' + esc(opt.value) + '"' + (String(opt.value) === String(o.value) ? ' selected' : '') + '>' + esc(opt.label) + '</option>').join('') + '</select>';
  } else if (o.type === 'textarea') {
    control = '<textarea class="textarea" id="' + o.id + '" name="' + (o.name || o.id) + '" placeholder="' + esc(o.placeholder || '') + '"' + (o.attrs || '') + '>' + esc(o.value || '') + '</textarea>';
  } else {
    const inputType = o.type || 'text';
    const inputMode = o.inputmode || (inputType === 'number' ? 'decimal' : '');
    control = '<input class="input" type="' + inputType + '" id="' + o.id + '" name="' + (o.name || o.id) + '" value="' + esc(o.value == null ? '' : o.value) + '" placeholder="' + esc(o.placeholder || '') + '"' +
      (inputMode ? ' inputmode="' + inputMode + '"' : '') +
      (o.step ? ' step="' + o.step + '"' : '') +
      (o.min != null ? ' min="' + o.min + '"' : '') +
      (o.attrs || '') + ' autocomplete="off" spellcheck="false">';
  }
  return '<div class="field' + full + '"><label for="' + o.id + '">' + esc(o.label || '') + '</label>' +
    (o.unit ? '<div class="amount-input">' + control + '<span class="unit">' + esc(o.unit) + '</span></div>' : control) +
    (o.hint ? '<div class="hint">' + o.hint + '</div>' : '') + '</div>';
}
function segmentedFieldHTML(opts) {
  const o = opts || {};
  return '<div class="field' + (o.full ? ' full' : '') + '"><label>' + esc(o.label || '') + '</label>' +
    '<div class="segmented field-seg" data-segmented="' + o.name + '">' +
      (o.options || []).map(op => '<button type="button" class="seg ' + (String(op.value) === String(o.value) ? 'active' : '') + '" data-seg-value="' + esc(op.value) + '">' + esc(op.label) + '</button>').join('') +
      '<input type="hidden" name="' + o.name + '" id="' + (o.id || o.name) + '" value="' + esc(o.value || '') + '">' +
    '</div></div>';
}
function currencyOptions(selected) {
  return Object.keys(CURRENCY_META).map(c => ({ value: c, label: c + ' · ' + CURRENCY_META[c].name })).map(o => ({ value: o.value, label: o.label }));
}

/* ---------- shared data snippets ---------- */
function schemeTargetWarning(scheme) {
  const t = schemeTargetTotal(scheme);
  if (Math.abs(t - 100) < 0.01) return '';
  return '<div class="info-banner warn">' + icon('alert') + '<div>当前目标合计为 <b>' + t.toFixed(1) + '%</b>，饼图与再平衡计算会按比例归一化。建议调整到 100%。</div></div>';
}
function groupStatusText(status) {
  return { high: '超出', low: '低于', ok: '正常', unassigned: '未分组' }[status] || '正常';
}
function tabularNFT(v, ccy) {
  return '<span class="num">' + fmtMoney(v, { currency: ccy }) + '</span>';
}
