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
function importBlockCandidate(text) {
  const lines = String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const m = line.match(/^(.+?)\s+(?:买入|卖出|分红|派息|存入|取出|利息|费用)/);
    if (!m) continue;
    let name = m[1].trim().replace(/^(?:标的|名称)\s*[:：]\s*/, '').trim();
    if (!name || name.length < 2 || name.length > 40) continue;
    if (/[¥￥]/.test(name) || /20\d{2}[-/]\d{1,2}[-/]\d{1,2}/.test(name)) continue;
    if (/^(标的|交易类型|交易日期|交易金额|确认净值|确认份额|手续费)$/.test(name)) continue;
    return name;
  }
  return '';
}
function inferImportInstrumentClass(name) {
  const n = String(name || '');
  if (/货币|现金|余额/.test(n)) return 'moneyFund';
  if (/债|债券|存单|同业/.test(n)) return 'bondFund';
  return 'equityFund';
}
function findImportInstrument(name, preferredAccount) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  const list = accounts().slice().sort((a, b) => (preferredAccount && a.id === preferredAccount.id ? -1 : 0) - (preferredAccount && b.id === preferredAccount.id ? -1 : 0));
  for (const a of list) {
    for (const i of (a.instruments || [])) {
      if (String(i.name || '').trim().toLowerCase() === n || String(i.symbol || '').trim().toLowerCase() === n) return { account: a, instrument: i, matched: true };
    }
  }
  return null;
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
  if (best) return { account: best.account, instrument: best.instrument, matched: true };
  let account = selectedAccount || all[0] || null;
  const acctMatch = all.slice().sort((a, b) => String(b.name).length - String(a.name).length).find(a => raw.indexOf(String(a.name).toLowerCase()) >= 0);
  if (acctMatch) account = acctMatch;
  const insts = (account && account.instruments) || [];
  return { account, instrument: insts.length === 1 ? insts[0] : null, matched: false };
}
function renderImportPage() {
  const list = accounts();
  if (!list.length) return backHead('截图导入', '', '#/settings') + '<div class="detail-body">' + emptyBlock('还没有账户', '先添加账户，再导入交易记录。', '<a class="btn primary sm" href="#/assets">去添加账户</a>', 'wallet') + '</div>';
  if (!importAccountId || !accountById(importAccountId)) importAccountId = list[0].id;
  const account = importAccount();
  if (!importInstrumentId || !(account.instruments || []).some(i => i.id === importInstrumentId)) importInstrumentId = (account.instruments || []).length === 1 ? account.instruments[0].id : '';
  return backHead('截图导入', '', '#/settings') +
    '<div class="detail-body">' +
      '<div class="import-help">' + icon('search') + '<div><b>从截图导入</b><p>用 iPhone 相册或分享菜单提取文字，复制后回到这里读取。没有自动上传，截图不会离开手机。</p></div></div>' +
      '<div class="form-grid" style="margin-top:14px">' +
        fieldHTML({ id: 'import-account', label: '导入到账户', type: 'select', value: importAccountId, options: list.map(a => ({ value: a.id, label: a.name + ' · ' + a.currency })) }) +
        '<div class="field"><label>标的</label><div class="import-auto-target">按每行文字自动识别，不需要选择</div></div>' +
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
  const textEl = $('#import-text');
  const previewEl = $('#import-preview');
  const footerEl = $('#import-footer');
  if (!accountSel || !textEl || !previewEl) return;
  const syncInstruments = () => {
    const account = accountById(accountSel.value);
    importAccountId = accountSel.value;
    const opts = (account && account.instruments) || [];
    if (!opts.some(i => i.id === importInstrumentId)) importInstrumentId = (opts[0] || {}).id || '';
    importInstrumentId = opts.length === 1 ? opts[0].id : '';
    importDrafts = [];
    renderImportPreview();
  };
  accountSel.addEventListener('change', syncInstruments);
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
    }
    const instrumentId = (detected.instrument && detected.instrument.id) || importInstrumentId || '';
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
    const block = lines.slice(b.start, end).join('\n');
    const context = lines.slice(Math.max(0, b.start - 3), b.start).join('\n');
    const candidate = importBlockCandidate(block) || importBlockCandidate(context);
    let target = detectImportTarget(block, account);
    const exact = candidate ? findImportInstrument(candidate, account) : null;
    if (exact) target = exact;
    if (!target.matched && !exact && !candidate) {
      const contextTarget = detectImportTarget(context, account);
      if (contextTarget.matched) target = contextTarget;
    }
    const blockAccount = target.account || account;
    const blockInstrument = target.matched && target.instrument ? target.instrument.id : (candidate ? '' : instrumentId);
    return parseImportBlock(block, blockAccount, blockInstrument, candidate, context);
  }).filter(Boolean);
}
function parseImportBlock(block, account, instrumentId, candidate, context) {
  const text = String(block || '').replace(/\u00a0/g, ' ');
  const typeText = String(context || '') + '\n' + text;
  const dm = text.match(/(20\d{2}[-/]\d{1,2}[-/]\d{1,2})/);
  if (!dm) return null;
  const date = dm[1].replace(/\//g, '-').split('-').map((x, i) => i === 0 ? x : x.padStart(2, '0')).join('-');
  const qtyM = text.match(/(?:克数|数量|份额|股数)\s*[:：]?\s*([\d,]+(?:\.\d+)?)/i);
  const priceM = text.match(/(?:交易价|成交价|单价|价格)\s*[:：]?\s*[¥￥]?\s*([\d,]+(?:\.\d+)?)/i);
  const feeM = text.match(/(?:手续费|费用|佣金)\s*[:：]?\s*[¥￥]?\s*([\d,]+(?:\.\d+)?)/i);
  const inst = instrumentId ? instrumentById(instrumentId) : null;
  const inferredClass = inst ? inst.cls : (candidate ? inferImportInstrumentClass(candidate) : '');
  let qty = normalizeFundQty(qtyM ? parseNum(qtyM[1]) : 0, inferredClass);
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
  let type = detectImportType(typeText);
  let fee = feeM ? parseNum(feeM[1]) : 0;
  const isGram = /克数|克/.test(text);
  if (type === 'interest' && isGram && !money.length) type = 'buy';
  let parsedQty = qtyM ? qty : (units.share.length ? units.share[0] : 0);
  if (type === 'dividend' && !(amount > 0) && units.yuan.length) amount = units.yuan[0];
  if (type === 'buy' || type === 'sell') {
    if (!(qty > 0) && parsedQty > 0) qty = parsedQty;
    if (!(amount > 0) && units.yuan.length) amount = type === 'sell' ? units.yuan[1] || units.yuan[0] : units.yuan[0];
    if (!(price > 0) && units.yuan.length > 1) price = type === 'sell' ? units.yuan[0] : units.yuan[1];
    if (!fee && units.yuan.length > 2) fee = units.yuan[2];
    if (!(amount > 0) && qty > 0 && price > 0) amount = qty * price;
    if (!(price > 0) && qty > 0 && amount > 0) price = amount / qty;
  }
  const draft = {
    date, type, accountId: account ? account.id : null, amount: round(amount, 2), qty: qty, price: price, fee: round(fee, 2),
    note: (typeText.match(/活期结息|实时买入|实时卖出|分红|派息|买入|卖出|存入|取出|利息|费用/) || ['截图导入'])[0],
    instrumentId: (type === 'buy' || type === 'sell' || type === 'dividend') ? instrumentId : null,
    newInstrumentName: (type === 'buy' || type === 'sell' || type === 'dividend') && !instrumentId && candidate ? candidate : '',
    checked: true, error: '', duplicate: false
  };
  if (!['deposit','withdraw','interest','fee','cashProfit','buy','sell','dividend'].includes(type)) draft.error = '无法识别类型';
  if (type === 'buy' || type === 'sell') {
    if (!(draft.qty > 0)) draft.error = '缺少数量';
    else if (type === 'sell' && !(draft.price > 0)) draft.error = '缺少卖出价格';
    else if (!draft.instrumentId && !draft.newInstrumentName) draft.error = '缺少标的';
  } else if (type === 'dividend') {
    if (!draft.instrumentId && !draft.newInstrumentName) draft.error = '缺少标的';
    else if (!(draft.amount > 0)) draft.error = '缺少金额';
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
    type, accountId: x.accountId || (account && account.id) || null, instrumentId: (type === 'buy' || type === 'sell' || type === 'dividend') ? (x.instrumentId || instrumentId) : null,
    amount: Number(x.amount) || 0, qty: normalizeFundQty(Number(x.qty) || 0, (instrumentId && instrumentById(instrumentId) || {}).cls), price: Number(x.price) || 0,
    checked: x.checked !== false, error: '', duplicate: false
  });
}
function detectImportType(text) {
  const s = String(text || '');
  if (/活期结息|结息|利息/.test(s)) return /克数|克/.test(s) && !/[¥￥]/.test(s) ? 'buy' : 'interest';
  if (/分红|派息/.test(s)) return 'dividend';
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
  return '<div class="import-list">' + list.map((d, i) => '<div class="import-row ' + (d.error ? 'bad' : '') + '"><input type="checkbox" data-import-index="' + i + '" ' + (d.checked && !d.error ? 'checked' : '') + ' ' + (d.error ? 'disabled' : '') + '><div class="import-main"><b>' + esc(d.date) + ' · ' + esc(importTypeLabel(d.type)) + (accountById(d.accountId) ? ' · ' + esc(accountById(d.accountId).name) : '') + (instrumentById(d.instrumentId) ? ' · ' + instrumentById(d.instrumentId).name : (d.newInstrumentName ? ' · 新标的 · ' + esc(d.newInstrumentName) : '')) + '</b><small>' + (d.qty ? esc(fmtQty(d.qty)) + ' · ' : '') + (d.price ? esc(fmtPrice(d.price)) + ' · ' : '') + esc(d.note || '') + '</small>' + (d.fee ? '<small>手续费 ' + esc(fmtMoney(d.fee, { currency: currency || 'CNY' })) + '</small>' : '') + (d.error ? '<em>' + esc(d.error) + '</em>' : '') + '</div><span class="import-amt">' + fmtMoney(d.amount || 0, { compact: true, currency: currency || 'CNY' }) + '</span></div>').join('') + '</div>';
}
function importTypeLabel(t) { return { deposit: '存入', withdraw: '取出', interest: '利息', fee: '费用', cashProfit: '更新收益', buy: '买入', sell: '卖出', dividend: '分红' }[t] || t; }
function confirmImport() {
  const valid = importDrafts.filter(d => d.checked && !d.error);
  if (!valid.length) { toast('没有可导入的记录', 'error'); return; }
  const fallbackAccount = accountById(importAccountId);
  if (!fallbackAccount) return;
  const now = Date.now();
  const colors = ['#ff9f45', '#5b8cff', '#b18cff', '#43d6b0', '#f2c45c', '#ff7aa2', '#7c9cff', '#ff5d6c'];
  valid.forEach((d, i) => {
    const account = accountById(d.accountId) || fallbackAccount;
    let inst = d.instrumentId ? instrumentById(d.instrumentId) : null;
    if (!inst && d.newInstrumentName) {
      inst = (account.instruments || []).find(x => String(x.name).trim() === String(d.newInstrumentName).trim()) || null;
      if (!inst) {
        const cls = inferImportInstrumentClass(d.newInstrumentName);
        const color = colors[account.instruments.length % colors.length];
        inst = {
          id: uid('inst'), accountId: account.id, name: d.newInstrumentName, symbol: d.newInstrumentName.slice(0, 20),
          cls, currency: account.currency, color, color2: shadeColor(color, -18), note: '截图导入自动创建'
        };
        account.instruments.push(inst);
        state.prices[inst.id] = [];
      }
      if (inst && d.price > 0) upsertPricePoint(inst.id, d.date, d.price);
      d.instrumentId = inst ? inst.id : '';
    }
    const rec = {
      id: uid('rec'), date: d.date, type: d.type, accountId: account.id,
      instrumentId: inst ? inst.id : null, amount: round(d.amount, 2), qty: normalizeFundQty(d.qty || 0, inst ? inst.cls : ''),
      price: d.price || 0, fee: d.fee || 0, fxRate: fxAt(account.currency, d.date),
      note: d.note || '截图导入', createdAt: new Date(now + i * 1000).toISOString()
    };
    state.records.push(rec);
  });
  saveState();
  toast('已导入 ' + valid.length + ' 条记录', 'success');
  navigate('#/account/' + encodeURIComponent(valid[0].accountId || fallbackAccount.id));
}
