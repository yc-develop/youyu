/* =========================================================
   12d · 截图 OCR 文本导入
   ========================================================= */
let importDrafts = [];
let importAccountId = '';
let importInstrumentId = '';

function importAccount() {
  return accountById(importAccountId) || accounts()[0] || null;
}
function importInstrumentOptions(account) {
  return (account ? (account.instruments || []) : []).map(i => '<option value="' + esc(i.id) + '">' + esc(i.name) + ' · ' + esc(i.symbol || '') + '</option>').join('');
}
function detectImportTarget(text, selectedAccount) {
  const raw = String(text || '').toLowerCase();
  const all = accounts();
  let best = null;
  all.forEach(a => (a.instruments || []).forEach(i => {
    [i.name, i.symbol].filter(Boolean).forEach(k => {
      const key = String(k).toLowerCase();
      if (key.length < 2 || raw.indexOf(key) < 0) return;
      const score = key.length + (selectedAccount && selectedAccount.id === a.id ? 100 : 0);
      if (!best || score > best.score) best = { account: a, instrument: i, score };
    });
  }));
  if (best) return { account: best.account, instrument: best.instrument };
  let account = selectedAccount || all[0] || null;
  const acctMatch = all.slice().sort((a, b) => String(b.name).length - String(a.name).length).find(a => raw.indexOf(String(a.name).toLowerCase()) >= 0);
  if (acctMatch) account = acctMatch;
  const insts = (account && account.instruments) || [];
  return { account, instrument: insts.length === 1 ? insts[0] : null };
}
function renderImportPage() {
  const list = accounts();
  if (!list.length) return backHead('截图导入', '', '#/settings') + '<div class="detail-body">' + emptyBlock('还没有账户', '先添加账户，再导入交易记录。', '<a class="btn primary sm" href="#/assets">去添加账户</a>', 'wallet') + '</div>';
  if (!importAccountId || !accountById(importAccountId)) importAccountId = list[0].id;
  const account = importAccount();
  if (!importInstrumentId || !(account.instruments || []).some(i => i.id === importInstrumentId)) importInstrumentId = (account.instruments[0] || {}).id || '';
  return backHead('截图导入', '', '#/settings') +
    '<div class="detail-body">' +
      '<div class="import-help">' + icon('search') + '<div><b>从截图导入</b><p>用 iPhone 相册或分享菜单提取文字，复制后回到这里读取。没有自动上传，截图不会离开手机。</p></div></div>' +
      '<div class="form-grid" style="margin-top:14px">' +
        fieldHTML({ id: 'import-account', label: '导入到账户', type: 'select', value: importAccountId, options: list.map(a => ({ value: a.id, label: a.name + ' · ' + a.currency })) }) +
        fieldHTML({ id: 'import-instrument', label: '标的（自动识别）', type: 'select', value: importInstrumentId, options: (account.instruments || []).map(i => ({ value: i.id, label: i.name + ' · ' + (i.symbol || '') })), hint: '优先从文字中识别名称/代码；识别不到时使用当前选择' }) +
      '</div>' +
      '<div class="field" style="margin-top:12px"><label>识别文字</label><textarea class="input import-textarea" id="import-text" rows="8" placeholder="把截图中的交易文字粘贴到这里，例如：&#10;2025-05-13&#10;实时买入  ¥10,000.00&#10;克数:13.0833克&#10;交易价:¥764.33"></textarea></div>' +
      '<div class="import-actions"><button class="btn ghost sm" data-action="import-clipboard">' + icon('file') + '读取剪贴板</button><button class="btn primary sm" data-action="import-parse">' + icon('search') + '解析</button></div>' +
      '<div class="import-steps"><b>快捷指令</b><br>截图 → 分享 → 运行「提取图像文字并复制」→ 回到本页点「读取剪贴板」。<br>下一步会先预览，再确认写入。</div>' +
      '<div id="import-preview" class="import-preview"></div>' +
      '<div id="import-footer" class="import-footer"></div>' +
    '</div>';
}
function bindImportPage() {
  const accountSel = $('#import-account');
  const instSel = $('#import-instrument');
  const textEl = $('#import-text');
  const previewEl = $('#import-preview');
  const footerEl = $('#import-footer');
  if (!accountSel || !textEl || !previewEl) return;
  const syncInstruments = () => {
    const account = accountById(accountSel.value);
    importAccountId = accountSel.value;
    const opts = (account && account.instruments) || [];
    if (!opts.some(i => i.id === importInstrumentId)) importInstrumentId = (opts[0] || {}).id || '';
    if (instSel) {
      instSel.innerHTML = opts.map(i => '<option value="' + esc(i.id) + '">' + esc(i.name) + ' · ' + esc(i.symbol || '') + '</option>').join('');
      instSel.value = importInstrumentId;
    }
    importDrafts = [];
    renderImportPreview();
  };
  accountSel.addEventListener('change', syncInstruments);
  if (instSel) instSel.addEventListener('change', () => { importInstrumentId = instSel.value; });
  textEl.addEventListener('input', () => { importDrafts = []; renderImportPreview(); });
  const readClipboard = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (!txt.trim()) { toast('剪贴板是空的', 'error'); return; }
      textEl.value = txt;
      toast('已读取剪贴板', 'success');
    } catch (e) {
      toast('无法读取剪贴板，请手动粘贴', 'error');
    }
  };
  const parse = () => {
    let account = accountById(accountSel.value);
    const detected = detectImportTarget(textEl.value, account);
    if (detected.account && detected.account.id !== accountSel.value) {
      accountSel.value = detected.account.id;
      importAccountId = detected.account.id;
      syncInstruments();
      account = detected.account;
    }
    if (detected.instrument) {
      importInstrumentId = detected.instrument.id;
      if (instSel) instSel.value = importInstrumentId;
    }
    const instrumentId = (detected.instrument && detected.instrument.id) || (instSel && instSel.value) || importInstrumentId || '';
    importAccountId = account ? account.id : accountSel.value;
    importInstrumentId = instrumentId;
    importDrafts = parseImportText(textEl.value, account, instrumentId);
    renderImportPreview();
    if (!importDrafts.length) toast('没有识别到交易，请检查文字格式', 'error');
    else if (!instrumentId && importDrafts.some(d => d.type === 'buy' || d.type === 'sell')) toast('未识别到标的，请补充标的信息', 'error');
  };
  const render = () => {
    const previewAccount = accountById(accountSel.value);
    previewEl.innerHTML = importPreviewHTML(importDrafts, previewAccount ? previewAccount.currency : 'CNY');
    footerEl.innerHTML = importDrafts.length ? '<button class="btn primary wide" data-action="import-confirm">导入 ' + importDrafts.filter(x => x.checked && !x.error).length + ' 条记录</button>' : '';
    previewEl.querySelectorAll('[data-import-index]').forEach(cb => cb.addEventListener('change', () => {
      const d = importDrafts[Number(cb.getAttribute('data-import-index'))];
      if (d) d.checked = cb.checked;
      footerEl.innerHTML = importDrafts.length ? '<button class="btn primary wide" data-action="import-confirm">导入 ' + importDrafts.filter(x => x.checked && !x.error).length + ' 条记录</button>' : '';
    }));
  };
  window.__renderImportPreview = render;
  const actions = {
    'import-clipboard': readClipboard,
    'import-parse': parse,
    'import-confirm': confirmImport
  };
  const onClick = e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const fn = actions[btn.getAttribute('data-action')];
    if (fn) { e.preventDefault(); fn(); }
  };
  const wrap = document.querySelector('.detail-screen .page') || document;
  wrap.addEventListener('click', onClick);
  render();
}
function renderImportPreview() { if (typeof window.__renderImportPreview === 'function') window.__renderImportPreview(); }

function parseImportText(text, account, instrumentId) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  if (raw[0] === '[' || raw[0] === '{') {
    try {
      const obj = JSON.parse(raw);
      const arr = Array.isArray(obj) ? obj : (Array.isArray(obj.records) ? obj.records : []);
      if (arr.length) return arr.map(x => normalizeImportDraft(x, account, instrumentId)).filter(Boolean);
    } catch (e) {}
  }
  const lines = raw.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const dateRe = /(20\d{2}[-/]\d{1,2}[-/]\d{1,2})/;
  const starts = [];
  lines.forEach((line, i) => { if (dateRe.test(line)) starts.push(i); });
  if (!starts.length) return [];
  const bounds = starts.map(idx => {
    const prev = lines[idx - 1] || '';
    const includePrev = !dateRe.test(prev) && /活期结息|实时买入|实时卖出|买入|卖出|存入|取出|利息|费用|更新收益/.test(prev) && !/[¥￥]/.test(prev) && !/交易价|克数|价格/.test(prev);
    return { idx, start: includePrev ? idx - 1 : idx };
  });
  return bounds.map((b, n) => {
    const end = n + 1 < bounds.length ? bounds[n + 1].start : lines.length;
    return parseImportBlock(lines.slice(b.start, end).join('\n'), account, instrumentId);
  }).filter(Boolean);
}
function parseImportBlock(block, account, instrumentId) {
  const text = String(block || '').replace(/\u00a0/g, ' ');
  const dm = text.match(/(20\d{2}[-/]\d{1,2}[-/]\d{1,2})/);
  if (!dm) return null;
  const date = dm[1].replace(/\//g, '-').split('-').map((x, i) => i === 0 ? x : x.padStart(2, '0')).join('-');
  const qtyM = text.match(/(?:克数|数量|份额|股数)\s*[:：]?\s*([\d,]+(?:\.\d+)?)/i);
  const priceM = text.match(/(?:交易价|成交价|单价|价格)\s*[:：]?\s*[¥￥]?\s*([\d,]+(?:\.\d+)?)/i);
  const feeM = text.match(/(?:手续费|费用|佣金)\s*[:：]?\s*[¥￥]?\s*([\d,]+(?:\.\d+)?)/i);
  const inst = instrumentId ? instrumentById(instrumentId) : null;
  let qty = normalizeFundQty(qtyM ? parseNum(qtyM[1]) : 0, inst ? inst.cls : '');
  let price = priceM ? parseNum(priceM[1]) : 0;
  const money = [];
  const mr = /[¥￥]\s*([\d,]+(?:\.\d+)?)/g;
  let mm;
  while ((mm = mr.exec(text)) !== null) money.push(parseNum(mm[1]));
  const units = { yuan: [], share: [] };
  const ur = /([\d,]+(?:\.\d+)?)\s*(元|份|股)/g;
  let um;
  while ((um = ur.exec(text)) !== null) {
    const v = parseNum(um[1]);
    if (um[2] === '元') units.yuan.push(v);
    else units.share.push(v);
  }
  const amountLabel = text.match(/(?:金额|成交金额|发生额)\s*[:：]?\s*[¥￥]?\s*([\d,]+(?:\.\d+)?)/);
  let amount = amountLabel ? parseNum(amountLabel[1]) : (money.length ? money[0] : 0);
  let type = detectImportType(text);
  let fee = feeM ? parseNum(feeM[1]) : 0;
  const isGram = /克数|克/.test(text);
  if (type === 'interest' && isGram && !money.length) type = 'buy';
  let parsedQty = qtyM ? qty : (units.share.length ? units.share[0] : 0);
  if (type === 'buy' || type === 'sell') {
    if (!(qty > 0) && parsedQty > 0) qty = parsedQty;
    if (!(amount > 0) && units.yuan.length) amount = type === 'sell' ? units.yuan[1] || units.yuan[0] : units.yuan[0];
    if (!(price > 0) && units.yuan.length > 1) price = type === 'sell' ? units.yuan[0] : units.yuan[1];
    if (!fee && units.yuan.length > 2) fee = units.yuan[2];
    if (!(amount > 0) && qty > 0 && price > 0) amount = qty * price;
    if (!(price > 0) && qty > 0 && amount > 0) price = amount / qty;
  }
  const draft = {
    date, type, amount: round(amount, 2), qty: qty, price: price, fee: round(fee, 2),
    note: (text.match(/活期结息|实时买入|实时卖出|买入|卖出|存入|取出|利息|费用/) || ['截图导入'])[0],
    instrumentId: (type === 'buy' || type === 'sell') ? instrumentId : null,
    checked: true, error: '', duplicate: false
  };
  if (!['deposit','withdraw','interest','fee','cashProfit','buy','sell'].includes(type)) draft.error = '无法识别类型';
  if (type === 'buy' || type === 'sell') {
    if (!(draft.qty > 0)) draft.error = '缺少数量';
    else if (type === 'sell' && !(draft.price > 0)) draft.error = '缺少卖出价格';
    else if (!draft.instrumentId) draft.error = '缺少标的';
  } else if (type !== 'cashProfit' && !(draft.amount > 0)) draft.error = '缺少金额';
  if (draft.error) draft.checked = false;
  const existing = account ? recordsForAccount(account.id) : [];
  const fp = importFingerprint(draft, account ? account.id : '');
  if (existing.some(r => importFingerprint(r, account.id) === fp)) { draft.duplicate = true; draft.checked = false; draft.error = '疑似重复'; }
  return draft;
}
function normalizeImportDraft(x, account, instrumentId) {
  if (!x || !x.date) return null;
  const type = x.type || detectImportType(JSON.stringify(x));
  return Object.assign({}, x, {
    type, instrumentId: (type === 'buy' || type === 'sell') ? (x.instrumentId || instrumentId) : null,
    amount: Number(x.amount) || 0, qty: normalizeFundQty(Number(x.qty) || 0, (instrumentId && instrumentById(instrumentId) || {}).cls), price: Number(x.price) || 0,
    checked: x.checked !== false, error: '', duplicate: false
  });
}
function detectImportType(text) {
  const s = String(text || '');
  if (/活期结息|结息|利息/.test(s)) return /克数|克/.test(s) && !/[¥￥]/.test(s) ? 'buy' : 'interest';
  if (/实时卖出|卖出|证券卖出/.test(s)) return 'sell';
  if (/实时买入|买入|证券买入/.test(s)) return 'buy';
  if (/存入|转入|充值/.test(s)) return 'deposit';
  if (/取出|转出|提现/.test(s)) return 'withdraw';
  if (/更新收益/.test(s)) return 'cashProfit';
  if (/费用|手续费/.test(s)) return 'fee';
  return '';
}
function parseNum(v) { return Number(String(v || '').replace(/[,，\s]/g, '')) || 0; }
function importFingerprint(r, accountId) {
  return [r.date, r.type, accountId, r.instrumentId || '', Math.round((Number(r.amount) || 0) * 100), Math.round((Number(r.qty) || 0) * 1000000), Math.round((Number(r.price) || 0) * 10000), Math.round((Number(r.fee) || 0) * 100)].join('|');
}
function importPreviewHTML(list, currency) {
  if (!list.length) return '';
  return '<div class="import-list">' + list.map((d, i) => '<div class="import-row ' + (d.error ? 'bad' : '') + '"><input type="checkbox" data-import-index="' + i + '" ' + (d.checked && !d.error ? 'checked' : '') + ' ' + (d.error ? 'disabled' : '') + '><div class="import-main"><b>' + esc(d.date) + ' · ' + esc(importTypeLabel(d.type)) + '</b><small>' + (d.qty ? esc(fmtQty(d.qty)) + ' · ' : '') + (d.price ? esc(fmtPrice(d.price)) + ' · ' : '') + esc(d.note || '') + '</small>' + (d.fee ? '<small>手续费 ' + esc(fmtMoney(d.fee, { currency: currency || 'CNY' })) + '</small>' : '') + (d.error ? '<em>' + esc(d.error) + '</em>' : '') + '</div><span class="import-amt">' + fmtMoney(d.amount || 0, { compact: true, currency: currency || 'CNY' }) + '</span></div>').join('') + '</div>';
}
function importTypeLabel(t) { return { deposit: '存入', withdraw: '取出', interest: '利息', fee: '费用', cashProfit: '更新收益', buy: '买入', sell: '卖出' }[t] || t; }
function confirmImport() {
  const valid = importDrafts.filter(d => d.checked && !d.error);
  if (!valid.length) { toast('没有可导入的记录', 'error'); return; }
  const account = accountById(importAccountId);
  if (!account) return;
  const now = Date.now();
  valid.forEach((d, i) => {
    const rec = {
      id: uid('rec'), date: d.date, type: d.type, accountId: account.id,
      instrumentId: d.instrumentId || null, amount: round(d.amount, 2), qty: normalizeFundQty(d.qty || 0, (d.instrumentId && instrumentById(d.instrumentId) || {}).cls),
      price: d.price || 0, fee: d.fee || 0, fxRate: fxAt(account.currency, d.date),
      note: d.note || '截图导入', createdAt: new Date(now + i * 1000).toISOString()
    };
    state.records.push(rec);
  });
  saveState();
  toast('已导入 ' + valid.length + ' 条记录', 'success');
  navigate('#/account/' + encodeURIComponent(account.id));
}
