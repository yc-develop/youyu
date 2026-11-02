/* =========================================================
   12 · 添加账户 / 标的 / 记录 / 菜单
   ========================================================= */
const RECORD_TYPE_INFO = {
  deposit:  { label: '存入', desc: '从外部转入资金', icon: 'arrowDownLeft' },
  withdraw: { label: '取出', desc: '把钱转出账户', icon: 'arrowUpRight' },
  buy:      { label: '买入', desc: '买入基金、股票等', icon: 'plus' },
  sell:     { label: '卖出', desc: '卖出部分或全部持仓', icon: 'minus' },
  dividend: { label: '分红', desc: '现金分红或派息', icon: 'coins' },
  interest: { label: '利息', desc: '存款或现金利息', icon: 'percent' },
  cashProfit: { label: '更新收益', desc: '现金本身的浮盈浮亏', icon: 'trendUp' },
  price:    { label: '更新价格', desc: '更新最新净值 / 股价', icon: 'refresh' },
  fee:      { label: '费用', desc: '管理费或其他支出', icon: 'minus' },
  fx:       { label: '换汇', desc: '记录一笔换汇操作', icon: 'swap' }
};

/* ---------- account form ---------- */
function openAccountForm(accountId) {
  const editing = accountId ? accountById(accountId) : null;
  const colors = ['#1677ff', '#27b768', '#c69236', '#c23b32', '#ff6b35', '#6d7cff', '#ff7a00', '#2b6bf3', '#b18cff', '#43d6b0'];
  const autoLogo = editing ? matchAccountBrand(editing.name) : null;
  const logoValue = editing ? (editing.logo === autoLogo ? 'auto' : (editing.logo || 'none')) : 'auto';
  const logoOptions = [{ value: 'auto', label: '自动匹配' }, { value: 'none', label: '首字图标' }]
    .concat(ACCOUNT_BRANDS.map(b => ({ value: b.id, label: b.name })));
  const body = '<form id="account-form"><div class="form-grid">' +
    fieldHTML({ id: 'account-name', label: '账户名称', value: editing ? editing.name : '', placeholder: '例如：支付宝', full: true }) +
    fieldHTML({ id: 'account-logo', label: '账户图标', type: 'select', value: logoValue, options: logoOptions, full: true, hint: '自动按账户名称匹配内置品牌图标；匹配不到时使用首字图标' }) +
    fieldHTML({ id: 'account-type', label: '账户类型', type: 'select', value: editing ? editing.type : (accountTypes()[0] ? accountTypes()[0].id : 'payment'), options: accountTypeOptions(), hint: '用于「账户类型分组」和账户筛选；可在「我的 → 类型管理」中维护。' }) +
    (editing ? fieldHTML({ id: 'account-currency', label: '币种', type: 'select', value: editing.currency, options: currencyOptions(), attrs: 'disabled' }) : fieldHTML({ id: 'account-currency', label: '币种', type: 'select', value: 'CNY', options: currencyOptions() })) +
    (editing ? '' : fieldHTML({ id: 'account-initial', label: '初始余额', value: '', placeholder: '0.00', unit: 'CNY', inputmode: 'decimal' })) +
    fieldHTML({ id: 'account-note', label: '备注（可选）', value: editing ? (editing.note || '') : '', placeholder: '例如：日常消费账户', full: true }) +
    '</div>' +
    '<div class="field" style="margin-top:11px"><label>账户颜色</label><div class="color-row">' +
      colors.map(c => '<button type="button" class="color-dot ' + (c === (editing ? editing.color : '#ff9f45') ? 'active' : '') + '" style="background:' + c + '" data-color="' + c + '" aria-label="颜色"></button>').join('') +
    '</div><input type="hidden" name="account-color" id="account-color" value="' + (editing ? editing.color : '#ff9f45') + '"></div>' +
    '<div class="info-banner" style="margin-top:14px">' + icon('info') + '<div>每个账户可以单独使用不同币种。初始余额会记录为一笔「存入」，之后可在账户详情里继续记买卖。</div></div></form>';
  const wrap = openSheet({
    title: editing ? '编辑账户' : '添加账户', sub: editing ? editing.name : '选择一个你能持续记账的维度',
    body, footer: '<button class="btn ghost" data-sheet-close>取消</button><button class="btn primary" data-account-save>' + (editing ? '保存' : '添加账户') + '</button>'
  });
  const form = wrap.querySelector('#account-form');
  form.querySelectorAll('.color-dot').forEach(btn => btn.addEventListener('click', () => {
    form.querySelectorAll('.color-dot').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    form.querySelector('#account-color').value = btn.getAttribute('data-color');
  }));
  const ccySel = form.querySelector('#account-currency');
  if (ccySel && !editing) {
    ccySel.addEventListener('change', () => {
      const unit = wrap.querySelector('#account-initial') ? wrap.querySelector('#account-initial').parentNode.querySelector('.unit') : null;
      if (unit) unit.textContent = ccySel.value;
    });
  }
  wrap.querySelector('[data-account-save]').addEventListener('click', () => {
    const name = cleanText(form.querySelector('#account-name').value, 24);
    if (!name) { toast('请填写账户名称', 'error'); return; }
    const type = form.querySelector('#account-type').value || 'payment';
    const currency = ccySel ? ccySel.value : 'CNY';
    const note = cleanText(form.querySelector('#account-note').value, 40);
    const color = form.querySelector('#account-color').value || '#ff9f45';
    const logoRaw = (form.querySelector('#account-logo') || {}).value || 'auto';
    const logo = logoRaw === 'auto' ? (matchAccountBrand(name) || '') : logoRaw === 'none' ? '' : logoRaw;
    state.isDemo = false;
    if (editing) {
      editing.name = name; editing.type = type; editing.typeName = accountTypeName(type); editing.note = note; editing.color = color; editing.logo = logo;
      editing.color2 = shadeColor(color, -18);
      editing.icon = name.slice(0, 1);
      saveState(); closeSheet(wrap); toast('账户已更新', 'success'); refreshPage(); return;
    }
    const id = uid('acc');
    const account = {
      id, name, type, typeName: accountTypeName(type), currency, color, color2: shadeColor(color, -18), icon: name.slice(0, 1), logo, note,
      instruments: []
    };
    state.accounts.push(account);
    const initial = parseNumber(form.querySelector('#account-initial') ? form.querySelector('#account-initial').value : 0);
    if (initial > 0) {
      state.records.push({
        id: uid('rec'), date: todayKey(), type: 'deposit', accountId: id, instrumentId: null,
        amount: initial, qty: 0, price: 0, fee: 0, fxRate: fxAt(currency, todayKey()), note: '初始资金', createdAt: nowISO()
      });
    }
    saveState(); closeSheet(wrap); toast('账户已添加', 'success');
    navigate('#/account/' + encodeURIComponent(id));
  });
}

/* ---------- instrument form ---------- */
function openInstrumentForm(accountId, instrumentId) {
  const account = accountById(accountId);
  if (!account) return;
  const editing = instrumentId ? (account.instruments || []).find(i => i.id === instrumentId) || null : null;
  const classes = instrumentTypeOptions();
  const colors = ['#ff6b35', '#ff9f45', '#5b8cff', '#b18cff', '#43d6b0', '#f2c45c', '#ff7a00', '#2b6bf3', '#c9d1d9', '#9ca3af'];
  const body = '<form id="instrument-form">' +
    '<div class="market-search-block">' +
      '<div class="market-search-head"><span>行情匹配</span><span class="market-source">新浪搜索 · 腾讯报价 · 仅供估值参考</span></div>' +
      '<div class="market-search-row"><input class="input" id="market-query" placeholder="搜索名称 / 代码：茅台、AAPL、110008、国债ETF" autocomplete="off" spellcheck="false"><button type="button" class="btn sm" id="market-search-btn">' + icon('search') + '搜索</button></div>' +
      '<div id="market-results" class="market-results"></div>' +
      '<div id="market-status" class="market-status">支持 A股、场外基金、场内 ETF、美股、港股、债券。选中后自动填入最新价格。</div>' +
    '</div>' +
    '<div class="form-grid">' +
    fieldHTML({ id: 'inst-name', label: '标的名称', value: editing ? editing.name : '', placeholder: '例如：苹果 / 沪深300ETF', full: true }) +
    fieldHTML({ id: 'inst-symbol', label: '代码 / 简称', value: editing ? editing.symbol : '', placeholder: 'AAPL / 000051' }) +
    fieldHTML({ id: 'inst-class', label: '标的类型', type: 'select', value: editing ? editing.cls : (instrumentTypes().find(t => t.id === 'stock') ? 'stock' : (instrumentTypes()[0] || {}).id), options: classes, hint: '用于资产归类、默认分组和统计口径；可在「我的 → 类型管理」中新增或改名。' }) +
    fieldHTML({ id: 'inst-currency', label: '计价币种', type: 'select', value: account.currency, options: currencyOptions(), attrs: 'disabled', hint: '跟随账户币种，一个账户只使用一种币种' }) +
    fieldHTML({ id: 'inst-price', label: editing ? '当前价格' : '当前价格 / 净值', value: editing ? fmtNumber(priceNow(editing.id), { decimals: 4 }) : '', placeholder: '0.00', inputmode: 'decimal' }) +
    (editing ? '' : fieldHTML({ id: 'inst-qty', label: '初始持有数量', value: '', placeholder: '可不填', inputmode: 'decimal' })) +
    (editing ? '' : '<div class="field"><label>初始成本价</label><div class="amount-input"><input class="input" id="inst-cost" inputmode="decimal" placeholder="默认等于当前价"><span class="unit" id="inst-cost-unit">' + (editing ? editing.currency : account.currency) + '</span></div><div class="hint">仅填写数量时，按当前价建仓</div></div>') +
    fieldHTML({ id: 'inst-note', label: '备注（可选）', value: editing ? (editing.note || '') : '', placeholder: '例如：长期配置', full: true }) +
  '</div>' +
  '<div class="field" style="margin-top:11px"><label>标的颜色</label><div class="color-row">' +
    colors.map(c => '<button type="button" class="color-dot ' + (c === (editing ? editing.color : '#ff9f45') ? 'active' : '') + '" style="background:' + c + '" data-color="' + c + '" aria-label="颜色"></button>').join('') +
  '</div><input type="hidden" name="inst-color" id="inst-color" value="' + (editing ? editing.color : '#ff9f45') + '"></div>' +
  '<div class="info-banner" style="margin-top:14px">' + icon('info') + '<div>标的归属于「' + esc(account.name) + '」。如果填了初始数量，会自动生成一笔买入记录。之后的价格与买卖都在标的详情里维护。</div></div></form>';
  const wrap = openSheet({
    title: editing ? '编辑标的' : '添加标的', sub: account.name + ' · ' + account.currency,
    body, footer: '<button class="btn ghost" data-sheet-close>取消</button><button class="btn primary" data-inst-save>' + (editing ? '保存' : '添加标的') + '</button>'
  });
  const form = wrap.querySelector('#instrument-form');
  let selectedMarket = editing && editing.market ? JSON.parse(JSON.stringify(editing.market)) : null;
  const marketStatus = form.querySelector('#market-status');
  const marketResults = form.querySelector('#market-results');
  const marketQuery = form.querySelector('#market-query');
  let searchTimer = null;
  const setMarketStatus = (html, cls) => {
    if (!marketStatus) return;
    marketStatus.className = 'market-status ' + (cls || '');
    marketStatus.innerHTML = html;
  };
  const showMarketStatus = () => {
    if (selectedMarket) {
      setMarketStatus('已连接 <b>' + esc(selectedMarket.label || '') + '</b> · ' + esc(selectedMarket.symbol || '') + (selectedMarket.lastUpdated ? ' · ' + esc(selectedMarket.lastUpdated) : '') + ' · 可手动刷新行情', 'ok');
    } else if (!editing) {
      setMarketStatus('支持 A股、场外基金、场内 ETF、美股、港股、债券。选中后自动填入最新价格。');
    }
  };
  const fillFromMarket = (meta, quote) => {
    form.querySelector('#inst-name').value = meta.name || '';
    form.querySelector('#inst-symbol').value = meta.symbol || meta.code || '';
    const clsSel = form.querySelector('#inst-class');
    if (clsSel && meta.cls) clsSel.value = meta.cls;
    const priceInput = form.querySelector('#inst-price');
    if (priceInput && quote && quote.price > 0) priceInput.value = String(quote.price);
    const unit = form.querySelector('#inst-cost-unit');
    if (unit && meta.currency) unit.textContent = meta.currency;
    selectedMarket = Object.assign({}, meta, quote ? { lastPrice: quote.price, lastUpdated: normalizeMarketTime(quote.time) } : {});
    showMarketStatus();
  };
  const pickMarketResult = async (meta) => {
    if (meta.currency && meta.currency !== account.currency) {
      setMarketStatus('该行情币种为 ' + esc(meta.currency) + '，与当前账户币种 ' + esc(account.currency) + ' 不一致。请先创建对应币种的账户，再添加该标的。', 'warn');
      return;
    }
    marketResults.innerHTML = '';
    setMarketStatus('正在获取 <b>' + esc(meta.name) + '</b> 的最新行情…');
    try {
      const quote = await fetchTencentQuote(meta);
      fillFromMarket(meta, quote);
      setMarketStatus('已匹配 <b>' + esc(meta.name) + '</b> · 最新价 ' + fmtPrice(quote.price, meta.currency) + ' · ' + esc(normalizeMarketTime(quote.time)), 'ok');
    } catch (e) {
      fillFromMarket(meta, null);
      setMarketStatus('已选择 <b>' + esc(meta.name) + '</b>，但行情获取失败，请手动填写价格后保存。', 'warn');
    }
  };
  const runMarketSearch = async () => {
    const q = marketQuery.value.trim();
    if (!q) { marketResults.innerHTML = ''; setMarketStatus('输入名称或代码后搜索，例如：贵州茅台、AAPL、110008。'); return; }
    setMarketStatus('正在搜索「' + esc(q) + '」…');
    try {
      const results = await marketSearch(q);
      if (!results.length) {
        marketResults.innerHTML = '';
        setMarketStatus('没有匹配到「' + esc(q) + '」。可尝试输入代码，或直接手动填写。', 'warn');
        return;
      }
      marketResults.innerHTML = results.map((r, i) => '<button type="button" class="market-result" data-market-index="' + i + '"><span class="mr-main"><b>' + esc(r.name) + '</b><em>' + esc(r.symbol) + ' · ' + esc(r.label) + '</em></span><span class="mr-arrow">' + icon('chevronRight') + '</span></button>').join('');
      marketResults.querySelectorAll('[data-market-index]').forEach(btn => btn.addEventListener('click', () => pickMarketResult(results[Number(btn.getAttribute('data-market-index'))])));
      setMarketStatus('找到 ' + results.length + ' 个匹配，选择一个自动填入。', 'ok');
    } catch (e) {
      marketResults.innerHTML = '';
      setMarketStatus('行情搜索暂不可用，请检查网络，或直接手动填写。', 'warn');
    }
  };
  if (marketQuery) {
    marketQuery.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = marketQuery.value.trim();
      if (q.length < 2) { marketResults.innerHTML = ''; setMarketStatus('输入至少 2 个字符开始搜索。'); return; }
      searchTimer = setTimeout(runMarketSearch, 450);
    });
    marketQuery.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runMarketSearch(); } });
  }
  const searchBtn = form.querySelector('#market-search-btn');
  if (searchBtn) searchBtn.addEventListener('click', runMarketSearch);
  showMarketStatus();
  form.querySelectorAll('.color-dot').forEach(btn => btn.addEventListener('click', () => {
    form.querySelectorAll('.color-dot').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    form.querySelector('#inst-color').value = btn.getAttribute('data-color');
  }));
  wrap.querySelector('[data-inst-save]').addEventListener('click', () => {
    const name = cleanText(form.querySelector('#inst-name').value, 30);
    if (!name) { toast('请填写标的名称', 'error'); return; }
    const symbol = cleanText(form.querySelector('#inst-symbol').value, 16) || name.slice(0, 6);
    const cls = form.querySelector('#inst-class').value || 'other';
    const currency = account.currency;
    const color = form.querySelector('#inst-color').value || '#ff9f45';
    const note = cleanText(form.querySelector('#inst-note').value, 40);
    const price = Math.max(0, parseNumber(form.querySelector('#inst-price').value));
    if (!editing && !(price > 0)) { toast('请输入当前价格或净值', 'error'); return; }
    if (editing && editing.currency && editing.currency !== account.currency) {
      toast('该标的币种与账户币种不一致，请将该标的拆分到对应币种账户', 'error');
      return;
    }
    state.isDemo = false;
    if (editing) {
      editing.name = name; editing.symbol = symbol; editing.cls = cls; editing.color = color;
      editing.note = note; editing.color2 = shadeColor(color, -18);
      editing.market = selectedMarket || null;
      if (price > 0 && Math.abs(price - priceNow(editing.id)) > 0.0000001) {
        upsertPricePoint(editing.id, todayKey(), price);
        state.records.push({ id: uid('rec'), date: todayKey(), type: 'price', accountId: account.id, instrumentId: editing.id, amount: 0, qty: 0, price, fee: 0, fxRate: fxAt(currency, todayKey()), note: '估值更新', createdAt: nowISO() });
      }
      saveState(); closeSheet(wrap); toast('标的已更新', 'success'); refreshPage(); return;
    }
    const id = uid('inst');
    const inst = { id, accountId: account.id, name, symbol, cls, currency, color, color2: shadeColor(color, -18), note, market: selectedMarket || null };
    account.instruments.push(inst);
    state.prices[id] = [[todayKey(), price > 0 ? price : 1, 'record']];
    const qty = Math.max(0, parseNumber(form.querySelector('#inst-qty') ? form.querySelector('#inst-qty').value : 0));
    if (qty > 0) {
      const cost = parseNumber(form.querySelector('#inst-cost') ? form.querySelector('#inst-cost').value : 0) || price || 1;
      state.records.push({
        id: uid('rec'), date: todayKey(), type: 'buy', accountId: account.id, instrumentId: id,
        amount: round(qty * cost, 2), qty, price: cost, fee: 0, fxRate: fxAt(currency, todayKey()), note: '初始建仓', createdAt: nowISO()
      });
    }
    saveState(); closeSheet(wrap); toast('标的已添加', 'success');
    navigate('#/instrument/' + encodeURIComponent(id));
  });
}

/* ---------- record chooser / picker ---------- */
function openRecordPicker() {
  const rows = allAccountMetrics();
  const body = '<div class="check-list">' + (rows.length ? rows.map(m => '<button class="check-row" style="width:100%;text-align:left" data-pick-account="' + esc(m.account.id) + '">' +
    accountIconHTML(m.account) + '<span class="check-name" style="margin-left:2px">' + esc(m.account.name) + '<span class="check-sub">' + m.account.currency + ' · ' + fmtMoney(m.marketBase, { compact: true }) + '</span></span>' + icon('chevronRight') + '</button>').join('') : '<div class="tiny" style="padding:20px;text-align:center">还没有账户</div>') + '</div>' +
    '<button class="btn wide ghost" style="margin-top:14px" data-action="open-add-account">' + icon('plus') + '添加账户</button>';
  const wrap = openSheet({ title: '记一笔', sub: '先选择要记账的账户', body });
  wrap.querySelectorAll('[data-pick-account]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-pick-account');
    closeSheet(wrap);
    setTimeout(() => openRecordChooser(id), 60);
  }));
}
function openRecordChooser(accountId, instrumentId) {
  const account = accountById(accountId);
  if (!account) return;
  let types;
  if (instrumentId) types = ['buy', 'sell', 'dividend', 'price'];
  else {
    types = ['deposit', 'withdraw'];
    if (account.instruments.length) types = types.concat(['buy', 'sell', 'dividend', 'price']);
    types = types.concat(['interest', 'fee', 'cashProfit', 'fx']);
  }
  const body = '<div class="type-grid">' + types.map(t => {
    const info = RECORD_TYPE_INFO[t];
    return '<button class="type-card" data-record-type="' + t + '"><span class="type-icon">' + icon(info.icon) + '</span><span class="type-name">' + info.label + '</span><span class="type-desc">' + info.desc + '</span></button>';
  }).join('') + '</div>' +
  (account.instruments.length ? '' : '<div class="info-banner" style="margin-top:14px">' + icon('info') + '<div>当前账户还没有标的。先添加标的，才能记录买入、卖出和估值。</div></div>');
  const wrap = openSheet({ title: '记一笔', sub: account.name + ' · ' + account.currency, body });
  wrap.querySelectorAll('[data-record-type]').forEach(btn => btn.addEventListener('click', () => {
    const t = btn.getAttribute('data-record-type');
    closeSheet(wrap);
    setTimeout(() => openRecordForm(account.id, t, instrumentId), 60);
  }));
}
function fxRateFieldHTML(ccy, full, value) {
  if (!ccy || ccy === 'CNY') return '';
  return fieldHTML({ id: 'record-fxrate', label: '成交汇率（可选）', value: value == null ? '' : value, placeholder: '留空则按日期自动取汇率', unit: 'CNY / ' + ccy, inputmode: 'decimal', full: !!full, hint: '用于计算这笔交易的汇兑损益' });
}

function editableRecordTypes(type) {
  const cash = ['deposit', 'withdraw', 'interest', 'fee', 'cashProfit'];
  const trade = ['buy', 'sell'];
  if (cash.indexOf(type) >= 0) return cash;
  if (trade.indexOf(type) >= 0) return trade;
  return [type];
}
function openRecordForm(accountId, type, instrumentId, editId, draft) {
  const editRec = editId ? state.records.find(r => r.id === editId) : null;
  if (editRec) {
    accountId = accountId || editRec.accountId;
    if (instrumentId === undefined) instrumentId = editRec.instrumentId;
    if (!type) type = editRec.type;
  }
  const account = accountById(accountId);
  if (!account) return;
  const insts = account.instruments || [];
  const chosen = instrumentId ? insts.find(i => i.id === instrumentId) : (insts[0] || null);
  const info = RECORD_TYPE_INFO[type] || RECORD_TYPE_INFO.deposit;
  const valueOf = (key, fallback) => draft && draft[key] != null ? draft[key] : (editRec && editRec[key] != null ? editRec[key] : (fallback == null ? '' : fallback));
  const dateVal = valueOf('date', todayKey());
  const noteVal = valueOf('note', '');
  const fxVal = editRec && editRec.fxRate ? editRec.fxRate : '';
  const instSelect = () => fieldHTML({
    id: 'record-instrument', label: '标的', type: 'select', full: true,
    value: chosen ? chosen.id : '',
    options: insts.map(i => ({ value: i.id, label: i.name + ' · ' + i.symbol }))
  });
  let fields = '';
  if (type === 'deposit' || type === 'withdraw' || type === 'interest' || type === 'fee' || type === 'cashProfit') {
    const before = accountCashBefore(account.id, dateVal, editRec && editRec.id);
    const oldAmount = Number(valueOf('amount', 0)) || 0;
    const signedOld = (type === 'withdraw' || type === 'fee') ? -oldAmount : oldAmount;
    const targetVal = round(before + signedOld, 2);
    const amountMode = ui.recordAmountMode === 'target' ? 'target' : 'delta';
    const amountLabel = type === 'interest' ? '利息金额' : type === 'fee' ? '费用金额' : type === 'cashProfit' ? '收益金额（可负）' : '变化金额';
    const amountHint = type === 'interest' ? '利息会增加账户现金' : type === 'fee' ? '费用会减少账户现金' : type === 'cashProfit' ? '正数表示浮盈，负数表示浮亏' : '填写本次增加或减少的金额';
    fields = '<div class="form-grid">' +
      '<div class="field full"><label>输入方式</label><div class="segmented field-seg" id="record-amount-mode">' +
        '<button type="button" class="seg ' + (amountMode === 'delta' ? 'active' : '') + '" data-amount-mode="delta">变化金额</button>' +
        '<button type="button" class="seg ' + (amountMode === 'target' ? 'active' : '') + '" data-amount-mode="target">变化后余额</button>' +
      '</div></div>' +
      '<div class="field full' + (amountMode === 'target' ? ' hidden' : '') + '" id="record-delta-field"><label>' + amountLabel + '</label><div class="amount-input">' +
        '<input class="input" id="record-amount" inputmode="decimal" placeholder="0.00" value="' + (valueOf('amount', '') || '') + '">' +
        '<span class="unit">' + account.currency + '</span></div><div class="hint">' + amountHint + '</div></div>' +
      '<div class="field full' + (amountMode === 'target' ? '' : ' hidden') + '" id="record-target-field"><label>变化后余额</label><div class="amount-input">' +
        '<input class="input" id="record-target" inputmode="decimal" placeholder="0.00" value="' + targetVal + '">' +
        '<span class="unit">' + account.currency + '</span></div><div class="hint">直接填写操作完成后的账户余额</div></div>' +
      fieldHTML({ id: 'record-date', label: '日期', type: 'date', value: dateVal, attrs: 'max="' + todayKey() + '"' }) +
      fieldHTML({ id: 'record-note', label: '备注（可选）', value: noteVal, placeholder: type === 'cashProfit' ? '例如：现金收益调整' : '例如：工资 / 家庭支出' }) +
    '</div>' +
    '<div class="record-preview" id="record-balance-preview">操作前余额 —</div>' +
    ((type === 'deposit' || type === 'withdraw') ? fxRateFieldHTML(account.currency, true, fxVal) : '');
  } else if (type === 'buy' || type === 'sell') {
    fields = '<div class="form-grid">' + instSelect() +
      fieldHTML({ id: 'record-qty', label: '数量', value: valueOf('qty', ''), placeholder: '0', inputmode: 'decimal' }) +
      fieldHTML({ id: 'record-price', label: '成交价', value: valueOf('price', ''), placeholder: '0.00', unit: chosen ? chosen.currency : account.currency, inputmode: 'decimal' }) +
      fieldHTML({ id: 'record-fee', label: '费用（可选）', value: valueOf('fee', ''), placeholder: '0.00', unit: chosen ? chosen.currency : account.currency, inputmode: 'decimal' }) +
      fieldHTML({ id: 'record-date', label: '日期', type: 'date', value: dateVal, attrs: 'max="' + todayKey() + '"' }) +
      fieldHTML({ id: 'record-note', label: '备注（可选）', value: noteVal, placeholder: '买入 / 卖出原因', full: true }) + '</div>' +
      fxRateFieldHTML(chosen ? chosen.currency : account.currency, true, fxVal) +
      '<div class="record-preview" id="record-preview">成交金额 <b>—</b></div>';
  } else if (type === 'dividend' || type === 'price') {
    fields = '<div class="form-grid">' + instSelect() +
      (type === 'dividend' ? fieldHTML({ id: 'record-amount', label: '分红金额', value: valueOf('amount', ''), placeholder: '0.00', unit: chosen ? chosen.currency : account.currency, inputmode: 'decimal' }) : '') +
      fieldHTML({ id: 'record-price', label: type === 'price' ? '最新价格 / 净值' : '价格（可选）', value: valueOf('price', ''), placeholder: '0.00', unit: chosen ? chosen.currency : account.currency, inputmode: 'decimal', full: type === 'price' }) +
      fieldHTML({ id: 'record-date', label: '日期', type: 'date', value: dateVal, attrs: 'max="' + todayKey() + '"' }) +
      fieldHTML({ id: 'record-note', label: '备注（可选）', value: noteVal, placeholder: type === 'price' ? '收盘价 / 净值' : '现金分红', full: true }) + '</div>' +
      (type === 'dividend' ? fxRateFieldHTML(chosen ? chosen.currency : account.currency, true, fxVal) : '') +
      (type === 'price' ? '<div class="info-banner" style="margin-top:12px">' + icon('info') + '<div>更新价格会同时写入价格曲线，并影响持仓市值与收益。</div></div>' : '');
  } else if (type === 'interest' || type === 'fee') {
    fields = '<div class="form-grid">' + fieldHTML({ id: 'record-amount', label: type === 'interest' ? '利息金额' : '费用金额', value: valueOf('amount', ''), placeholder: '0.00', unit: account.currency, inputmode: 'decimal', full: true }) +
      fieldHTML({ id: 'record-date', label: '日期', type: 'date', value: dateVal, attrs: 'max="' + todayKey() + '"' }) +
      fieldHTML({ id: 'record-note', label: '备注（可选）', value: noteVal, placeholder: type === 'interest' ? '结息' : '管理费' }) + '</div>';
  } else if (type === 'fx') {
    fields = '<div class="form-grid">' +
      fieldHTML({ id: 'fx-from-ccy', label: '从', type: 'select', value: editRec ? editRec.fromCcy : (account.currency === 'CNY' ? 'CNY' : account.currency), options: currencyOptions() }) +
      fieldHTML({ id: 'fx-to-ccy', label: '换到', type: 'select', value: editRec ? editRec.toCcy : (account.currency === 'CNY' ? 'USD' : 'CNY'), options: currencyOptions() }) +
      fieldHTML({ id: 'fx-from-amount', label: '换出金额', value: valueOf('fromAmount', ''), placeholder: '0.00', inputmode: 'decimal' }) +
      fieldHTML({ id: 'fx-to-amount', label: '换入金额', value: valueOf('toAmount', ''), placeholder: '0.00', inputmode: 'decimal' }) +
      fieldHTML({ id: 'fx-rate', label: '成交汇率（可选）', value: fxVal, placeholder: '自动按当前汇率', inputmode: 'decimal', full: true }) +
      fieldHTML({ id: 'record-date', label: '日期', type: 'date', value: dateVal, attrs: 'max="' + todayKey() + '"' }) +
      fieldHTML({ id: 'record-note', label: '备注（可选）', value: noteVal, placeholder: '银行换汇' }) + '</div>' +
      '<div class="info-banner" style="margin-top:12px">' + icon('info') + '<div>换汇记录用于保留成交汇率与操作痕迹，不会改变账户总资产。跨币种持仓按最新汇率折算。</div></div>';
  }
  const allowedTypes = editRec ? editableRecordTypes(type) : [type];
  const typeSelectorHTML = editRec && allowedTypes.length > 1
    ? '<div class="form-grid" style="margin-bottom:12px">' + fieldHTML({
        id: 'record-type-edit', label: '记录类型', type: 'select', full: true, value: type,
        options: allowedTypes.map(t => ({ value: t, label: RECORD_TYPE_INFO[t] ? RECORD_TYPE_INFO[t].label : t })),
        hint: '只允许在字段结构相同的记录类型之间切换'
      }) + '</div>'
    : '';
  const body = '<form id="record-form">' + typeSelectorHTML + '<div class="record-type-banner"><span class="rec-icon ' + (['deposit','sell','dividend','interest','cashProfit'].indexOf(type) >= 0 ? 'gain' : ['withdraw','buy','fee'].indexOf(type) >= 0 ? 'loss' : 'blue') + '">' + icon(info.icon) + '</span><div><div class="record-type-title">' + (editRec ? '编辑 · ' + info.label : info.label) + '</div><div class="record-type-sub">' + info.desc + ' · ' + esc(account.name) + '</div></div></div>' +
    fields + '</form>';
  const wrap = openSheet({
    title: editRec ? '编辑记录' : info.label, sub: account.name + ' · ' + account.currency,
    body, footer: '<button class="btn ghost" data-sheet-close>取消</button><button class="btn primary" data-record-save>' + (editRec ? '保存修改' : (type === 'price' ? '更新价格' : '保存记录')) + '</button>'
  });
  const form = wrap.querySelector('#record-form');
  const typeSelect = form.querySelector('#record-type-edit');
  if (typeSelect) typeSelect.addEventListener('change', () => {
    const nextType = typeSelect.value;
    const draftValues = {
      date: (form.querySelector('#record-date') || {}).value || dateVal,
      note: (form.querySelector('#record-note') || {}).value || '',
      amount: (form.querySelector('#record-amount') || {}).value || '',
      qty: (form.querySelector('#record-qty') || {}).value || '',
      price: (form.querySelector('#record-price') || {}).value || '',
      fee: (form.querySelector('#record-fee') || {}).value || '',
      instrumentId: (form.querySelector('#record-instrument') || {}).value || instrumentId || '',
      fxRate: (form.querySelector('#record-fxrate') || {}).value || fxVal
    };
    closeSheet(wrap);
    setTimeout(() => openRecordForm(accountId, nextType, draftValues.instrumentId || null, editId, draftValues), 60);
  });
  const instSel = form.querySelector('#record-instrument');
  const priceInput = form.querySelector('#record-price');
  const preview = form.querySelector('#record-preview');
  const updatePreview = () => {
    if (!preview) return;
    const q = parseNumber(form.querySelector('#record-qty') ? form.querySelector('#record-qty').value : 0);
    const p = parseNumber(priceInput ? priceInput.value : 0);
    const fee = parseNumber(form.querySelector('#record-fee') ? form.querySelector('#record-fee').value : 0);
    preview.innerHTML = '成交金额 <b>' + fmtMoney(q * p, { currency: chosen ? chosen.currency : account.currency }) + '</b>' + (fee ? '<span> + 费用 ' + fmtMoney(fee, { currency: chosen ? chosen.currency : account.currency }) + '</span>' : '');
  };
  if (preview) {
    form.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updatePreview));
    updatePreview();
  }
  const balancePreview = form.querySelector('#record-balance-preview');
  if (balancePreview) {
    const amountInput = form.querySelector('#record-amount');
    const targetInput = form.querySelector('#record-target');
    const deltaField = form.querySelector('#record-delta-field');
    const targetField = form.querySelector('#record-target-field');
    const dateInput = form.querySelector('#record-date');
    const modeButtons = form.querySelectorAll('[data-amount-mode]');
    let balanceMode = ui.recordAmountMode === 'target' ? 'target' : 'delta';
    const beforeAtDate = () => accountCashBefore(account.id, (dateInput && dateInput.value) || dateVal, editRec && editRec.id);
    const money = v => fmtMoney(v, { currency: account.currency });
    const signedOf = amount => (type === 'withdraw' || type === 'fee') ? -amount : amount;
    const renderBalance = () => {
      const before = beforeAtDate();
      let signed = 0, target = null;
      if (balanceMode === 'target') {
        if (targetInput.value.trim() !== '') {
          target = parseNumber(targetInput.value);
          signed = target - before;
        }
      } else {
        const amount = parseNumber(amountInput.value);
        signed = signedOf(amount);
        target = before + signed;
      }
      let hint = '';
      if (balanceMode === 'target' && target !== null) {
        if ((type === 'deposit' || type === 'interest') && signed < -0.005) hint = type === 'interest' ? '低于操作前余额，请改用费用或更新收益' : '低于操作前余额，请改用「取出」';
        if ((type === 'withdraw' || type === 'fee') && signed > 0.005) hint = type === 'fee' ? '高于操作前余额，请改用利息或更新收益' : '高于操作前余额，请改用「存入」';
      }
      balancePreview.innerHTML = '操作前余额 <b>' + money(before) + '</b>' +
        '<span>变化 <b class="' + (signed >= 0 ? 'gain' : 'loss') + '">' + (signed > 0 ? '+' : '') + money(signed) + '</b>' +
        (target === null ? ' · 变化后 —' : ' · 变化后 ' + money(target)) + '</span>' +
        (hint ? '<span style="color:var(--gain)">' + hint + '</span>' : '');
    };
    const setMode = next => {
      if (next === balanceMode) { renderBalance(); return; }
      const before = beforeAtDate();
      if (next === 'target') {
        const amount = parseNumber(amountInput.value);
        targetInput.value = round(before + signedOf(amount), 2);
      } else {
        if (targetInput.value.trim() !== '') {
          const target = parseNumber(targetInput.value);
          amountInput.value = round(Math.abs(target - before), 2);
        }
      }
      balanceMode = next;
      ui.recordAmountMode = next;
      modeButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-amount-mode') === next));
      deltaField.classList.toggle('hidden', next !== 'delta');
      targetField.classList.toggle('hidden', next !== 'target');
      renderBalance();
      setTimeout(() => { const el = next === 'target' ? targetInput : amountInput; if (el) { el.focus(); el.select(); } }, 60);
    };
    modeButtons.forEach(btn => btn.addEventListener('click', () => setMode(btn.getAttribute('data-amount-mode'))));
    [amountInput, targetInput, dateInput].forEach(inp => { if (inp) inp.addEventListener('input', renderBalance); });
    if (dateInput) dateInput.addEventListener('change', renderBalance);
    renderBalance();
  }
  wrap.querySelector('[data-record-save]').addEventListener('click', () => {
    const date = (form.querySelector('#record-date') || {}).value || todayKey();
    const note = cleanText((form.querySelector('#record-note') || {}).value || '', 50);
    const baseRec = { date, note, accountId: account.id, instrumentId: null, amount: 0, qty: 0, price: 0, fee: 0, fxRate: 1, createdAt: nowISO() };
    const fxInput = form.querySelector('#record-fxrate') ? parseNumber(form.querySelector('#record-fxrate').value) : 0;
    if (type === 'deposit' || type === 'withdraw' || type === 'interest' || type === 'fee' || type === 'cashProfit') {
      const targetField = form.querySelector('#record-target-field');
      const useTarget = targetField && !targetField.classList.contains('hidden');
      let amount = 0;
      if (useTarget) {
        const targetInput = form.querySelector('#record-target');
        if (!targetInput || targetInput.value.trim() === '') { toast('请输入变化后余额', 'error'); return; }
        const target = parseNumber(targetInput.value);
        const before = accountCashBefore(account.id, date, editRec && editRec.id);
        const signed = round(target - before, 2);
        if (Math.abs(signed) < 0.005) { toast('余额没有变化', 'error'); return; }
        if (type === 'deposit' && signed < 0) { toast('变化后余额低于操作前余额，请改用取出', 'error'); return; }
        if (type === 'withdraw' && signed > 0) { toast('变化后余额高于操作前余额，请改用存入', 'error'); return; }
        if (type === 'interest' && signed < 0) { toast('利息会使余额增加，请改用费用或更新收益', 'error'); return; }
        if (type === 'fee' && signed > 0) { toast('费用会使余额减少，请改用利息或更新收益', 'error'); return; }
        amount = type === 'cashProfit' ? signed : Math.abs(signed);
      } else {
        amount = parseNumber(form.querySelector('#record-amount') ? form.querySelector('#record-amount').value : 0);
      }
      if (type === 'cashProfit') {
        if (Math.abs(amount) < 0.005) { toast('请输入收益金额', 'error'); return; }
      } else if (!(amount > 0)) { toast('请输入金额', 'error'); return; }
      baseRec.type = type; baseRec.amount = amount; baseRec.fxRate = fxInput > 0 ? fxInput : fxAt(account.currency, date);
    } else if (type === 'buy' || type === 'sell') {
      if (!instSel || !instSel.value) { toast('请选择标的', 'error'); return; }
      const inst = instById(instSel.value);
      if (!inst) return;
      const qty = parseNumber(form.querySelector('#record-qty').value);
      const price = parseNumber(priceInput.value);
      const fee = parseNumber(form.querySelector('#record-fee') ? form.querySelector('#record-fee').value : 0);
      if (!(qty > 0)) { toast('请填写数量', 'error'); return; }
      if (price < 0) { toast('价格不能为负数', 'error'); return; }
      if (type === 'sell' && !(price > 0)) { toast('请填写卖出价格', 'error'); return; }
      if (type === 'sell') {
        const im = computeInstrumentMetrics(inst.id);
        let available = im.qty;
        if (editRec && editRec.instrumentId === inst.id) {
          if (editRec.type === 'sell') available += Number(editRec.qty) || 0;
          if (editRec.type === 'buy') available -= Number(editRec.qty) || 0;
        }
        available = Math.max(0, available);
        if (qty > available + 0.000001) { toast('卖出数量超过当前持仓（' + fmtQty(available) + '）', 'error'); return; }
      }
      baseRec.type = type; baseRec.instrumentId = inst.id; baseRec.qty = qty; baseRec.price = price;
      baseRec.amount = round(qty * price, 2); baseRec.fee = fee; baseRec.fxRate = fxInput > 0 ? fxInput : fxAt(inst.currency, date);
    } else if (type === 'dividend') {
      if (!instSel || !instSel.value) { toast('请选择标的', 'error'); return; }
      const inst = instById(instSel.value);
      const amount = parseNumber(form.querySelector('#record-amount').value);
      if (!(amount > 0)) { toast('请输入分红金额', 'error'); return; }
      baseRec.type = type; baseRec.instrumentId = inst.id; baseRec.amount = amount; baseRec.fxRate = fxInput > 0 ? fxInput : fxAt(inst.currency, date);
    } else if (type === 'price') {
      if (!instSel || !instSel.value) { toast('请选择标的', 'error'); return; }
      const inst = instById(instSel.value);
      const price = parseNumber(priceInput.value);
      if (!(price > 0)) { toast('请输入最新价格', 'error'); return; }
      baseRec.type = type; baseRec.instrumentId = inst.id; baseRec.price = price; baseRec.fxRate = fxAt(inst.currency, date);
      baseRec.pricePoint = true;
      if (editRec && editRec.pricePoint) removePricePoint(editRec.instrumentId, editRec.date, editRec.price);
      upsertPricePoint(inst.id, date, price);
    } else if (type === 'fx') {
      const fromCcy = form.querySelector('#fx-from-ccy').value;
      const toCcy = form.querySelector('#fx-to-ccy').value;
      const fromAmount = parseNumber(form.querySelector('#fx-from-amount').value);
      const toAmount = parseNumber(form.querySelector('#fx-to-amount').value);
      if (!(fromAmount > 0) || !(toAmount > 0)) { toast('请填写换出与换入金额', 'error'); return; }
      baseRec.type = 'fx'; baseRec.fromCcy = fromCcy; baseRec.toCcy = toCcy; baseRec.fromAmount = fromAmount; baseRec.toAmount = toAmount;
      baseRec.fxRate = parseNumber(form.querySelector('#fx-rate').value) || (fromAmount / toAmount);
    } else {
      toast('暂不支持这种记录', 'error'); return;
    }
    state.isDemo = false;
    if (editRec) {
      const keepId = editRec.id;
      const keepCreated = editRec.createdAt;
      Object.keys(editRec).forEach(k => { if (['id', 'createdAt'].indexOf(k) < 0) delete editRec[k]; });
      Object.assign(editRec, baseRec, { id: keepId, createdAt: keepCreated });
      rebuildAllRecordPrices();
      saveState();
      closeAllSheets();
      toast('记录已更新', 'success');
    } else {
      baseRec.id = uid('rec');
      state.records.push(baseRec);
      rebuildAllRecordPrices();
      saveState();
      closeAllSheets();
      toast(type === 'price' ? '价格已更新' : '记录已保存', 'success');
    }
    refreshPage();
  });
}
function instById(id) { return instrumentById(id); }

/* ---------- records sheet ---------- */
function openRecordsSheet(scope, id) {
  const isAccount = scope === 'account';
  const list = isAccount ? recordsForAccount(id) : recordsForInstrument(id);
  const title = isAccount ? (accountById(id) ? accountById(id).name + ' · 记录' : '账户记录') : (instrumentById(id) ? instrumentById(id).name + ' · 记录' : '标的记录');
  const body = list.length ? '<div class="list-card" style="background:transparent;border:0">' + list.slice().reverse().map(r => recordRowHTML(r, { deletable: true, editable: true })).join('') + '</div>' :
    '<div class="empty-state" style="padding:32px 10px"><div class="ico">' + icon('file') + '</div><h3>还没有记录</h3><p>买入、卖出、存入与估值更新都会出现在这里。</p></div>';
  const footer = isAccount ?
    '<button class="btn ghost" data-sheet-close>关闭</button><button class="btn primary" data-action="add-record-account" data-account="' + esc(id) + '">记一笔</button>' :
    '<button class="btn ghost" data-sheet-close>关闭</button><button class="btn primary" data-action="add-record-instrument" data-instrument="' + esc(id) + '">记一笔</button>';
  openSheet({ title, sub: list.length + ' 条记录 · 铅笔编辑 / 垃圾桶删除', body, footer });
}

/* ---------- menus ---------- */
function openAccountMenu(accountId) {
  const a = accountById(accountId);
  if (!a) return;
  const body = '<div class="detail-menu">' +
    '<button class="menu-item" data-action="edit-account" data-id="' + esc(a.id) + '">' + icon('edit') + '编辑账户信息' + '<span class="arrow">' + icon('chevronRight') + '</span></button>' +
    '<button class="menu-item" data-action="go" data-href="#/groups/' + encodeURIComponent(rebalanceSchemeId()) + '">' + icon('sliders') + '管理分组与目标' + '<span class="arrow">' + icon('chevronRight') + '</span></button>' +
    '<button class="menu-item" data-action="open-records" data-scope="account" data-id="' + esc(a.id) + '">' + icon('file') + '查看全部记录' + '<span class="arrow">' + icon('chevronRight') + '</span></button>' +
    '<button class="menu-item danger" data-action="delete-account" data-id="' + esc(a.id) + '">' + icon('trash') + '删除账户' + '<span class="arrow">' + icon('chevronRight') + '</span></button>' +
  '</div>';
  openSheet({ title: a.name, sub: '账户设置与操作', body });
}
function openInstrumentMenu(instrumentId) {
  const i = instrumentById(instrumentId);
  if (!i) return;
  const body = '<div class="detail-menu">' +
    '<button class="menu-item" data-action="edit-instrument" data-id="' + esc(i.id) + '">' + icon('edit') + '编辑标的信息' + '<span class="arrow">' + icon('chevronRight') + '</span></button>' +
    (i.market ? '<button class="menu-item" data-action="refresh-quote" data-id="' + esc(i.id) + '">' + icon('refresh') + '刷新行情 · ' + esc(i.market.symbol || i.market.code || '') + '<span class="arrow">' + icon('chevronRight') + '</span></button>' : '<button class="menu-item" data-action="match-market" data-id="' + esc(i.id) + '">' + icon('search') + '匹配行情数据' + '<span class="arrow">' + icon('chevronRight') + '</span></button>') +
    '<button class="menu-item" data-action="open-price-update" data-instrument="' + esc(i.id) + '">' + icon('refresh') + '手动更新价格' + '<span class="arrow">' + icon('chevronRight') + '</span></button>' +
    '<button class="menu-item" data-action="open-records" data-scope="instrument" data-id="' + esc(i.id) + '">' + icon('file') + '查看全部记录' + '<span class="arrow">' + icon('chevronRight') + '</span></button>' +
    '<button class="menu-item danger" data-action="delete-instrument" data-id="' + esc(i.id) + '">' + icon('trash') + '删除标的' + '<span class="arrow">' + icon('chevronRight') + '</span></button>' +
  '</div>';
  openSheet({ title: i.name, sub: i.symbol + ' · ' + i.account.name, body });
}

/* ---------- delete helpers ---------- */
function deleteAccountById(id) {
  const a = accountById(id);
  if (!a) return;
  const name = a.name;
  const instIds = a.instruments.map(i => i.id);
  confirmDialog({
    title: '删除「' + name + '」？', message: '账户下的持仓、记录和价格历史都会被删除。此操作不可撤销。', confirmText: '删除', danger: true,
    onConfirm: () => {
      state.isDemo = false;
      state.accounts = state.accounts.filter(x => x.id !== id);
      state.records = state.records.filter(r => r.accountId !== id);
      instIds.forEach(iid => delete state.prices[iid]);
      state.schemes.forEach(s => s.groups.forEach(g => { g.includeAccounts = (g.includeAccounts || []).filter(x => x !== id); g.includeInstruments = (g.includeInstruments || []).filter(x => instIds.indexOf(x) < 0); }));
      saveState(); closeAllSheets(); toast('账户已删除'); navigate('#/assets', true); renderPage();
    }
  });
}
function deleteInstrumentById(id) {
  const i = instrumentById(id);
  if (!i) return;
  const accountId = i.account.id;
  confirmDialog({
    title: '删除「' + i.name + '」？', message: '该标的的买卖记录和价格历史会被删除，账户现金会根据剩余记录重新计算。', confirmText: '删除', danger: true,
    onConfirm: () => {
      state.isDemo = false;
      const acc = accountById(accountId);
      if (acc) acc.instruments = acc.instruments.filter(x => x.id !== id);
      state.records = state.records.filter(r => r.instrumentId !== id);
      delete state.prices[id];
      state.schemes.forEach(s => s.groups.forEach(g => { g.includeInstruments = (g.includeInstruments || []).filter(x => x !== id); }));
      saveState(); closeAllSheets(); toast('标的已删除'); navigate('#/account/' + encodeURIComponent(accountId)); renderPage();
    }
  });
}

/* ---------- color helper ---------- */
function shadeColor(hex, percent) {
  const h = String(hex || '#ff9f45').replace('#', '');
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  let r = (num >> 16) + Math.round(255 * percent / 100);
  let g = ((num >> 8) & 0x00FF) + Math.round(255 * percent / 100);
  let b = (num & 0x0000FF) + Math.round(255 * percent / 100);
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* ---------- flow adjustments (account ledger) ---------- */
function flowAdjustmentRecords(scope, id, periodKey) {
  if (scope !== 'account') return [];
  return (state.records || []).filter(r => r.type === 'flow' && r.ledgerAdjust && (periodKey === 'all' || r.periodKey === periodKey) && r.accountId === id && !r.instrumentId);
}
function openFlowFieldEditor(scope, id, periodKey, field) {
  if (scope !== 'account') { toast('标的级资金流校正已取消', 'error'); return; }
  const account = accountById(id);
  if (!account) return;
  const flow = accountFlow(id, periodKey);
  if (!flow) return;
  const meta = FLOW_FIELD_META[field];
  if (!meta) return;
  if (field === 'opening' && periodKey === 'all') {
    toast('记账以来的期初固定为 0，请选择具体年份调整', 'error');
    return;
  }
  const current = Number(flow[field]) || 0;
  const descriptions = {
    opening: '调整期初金额会把差额写入该年份开始时的账本，并同步更新之后所有周期的资产统计。',
    ending: '调整期末余额会把差额写入该周期末的账本，资产市值和资产盈亏会同步更新。',
    profit: '调整资产盈亏会把差额写入该周期末的账本，期末余额和资产市值会同步更新。',
    in: '调整投入总额会写入一笔账本资金调整，影响净投入和资产市值，不会改变真实交易记录。',
    out: '调整取出总额会写入一笔账本资金调整，影响净投入和资产市值，不会改变真实交易记录。'
  };
  const body = '<form id="flow-edit-form">' +
    '<div class="info-banner" style="margin-top:0">' + icon('pen') + '<div>' + esc(descriptions[field] || '') + '<br><span class="faint">保存后会写入一条「' + esc(meta.title) + '」账本调整记录，并立即更新资产统计。</span></div></div>' +
    '<div class="form-section">' + esc(meta.label) + '</div>' +
    fieldHTML({ id: 'flow-edit-value', label: meta.label, value: Number(current).toFixed(2), inputmode: 'decimal', unit: account.currency, full: true }) +
    '<div class="flow-edit-current"><span>当前周期</span><b>' + esc(flow.periodLabel || flowPeriodLabel(periodKey)) + '</b></div>' +
    '<div class="flow-edit-current"><span>当前净投入</span><b>' + fmtMoney(flow.net, { currency: account.currency }) + '</b></div>' +
    '<div class="flow-edit-current"><span>当前期末</span><b>' + fmtMoney(flow.ending, { currency: account.currency }) + '</b></div>' +
  '</form>';
  const wrap = openSheet({
    title: '调整' + meta.label, sub: account.name + ' · ' + (flow.periodLabel || flowPeriodLabel(periodKey)),
    body, footer: '<button class="btn ghost" data-sheet-close>取消</button><button class="btn primary" data-flow-save>保存调整</button>'
  });
  wrap.querySelector('[data-flow-save]').addEventListener('click', () => {
    const raw = wrap.querySelector('#flow-edit-value').value;
    if (String(raw).trim() === '') { toast('请输入金额', 'error'); return; }
    const value = round(parseNumber(raw), 2);
    if ((field === 'in' || field === 'out') && value < 0) { toast('投入/转出不能为负数', 'error'); return; }
    const delta = round(value - current, 2);
    if (Math.abs(delta) < 0.005) { toast('金额没有变化', 'info'); return; }
    const bounds = flowPeriodBounds(periodKey);
    const date = field === 'opening' ? bounds.start : bounds.end;
    if (!date) return;
    const fx = fxToBaseAt(account.currency, date) || 1;
    const cashNative = field === 'out' ? -delta : delta;
    const flowDeltaNative = (field === 'in' || field === 'out') ? delta : 0;
    const netDeltaNative = field === 'out' ? -delta : (field === 'in' || field === 'opening') ? delta : 0;
    state.records.push({
      id: uid('rec'),
      date,
      type: 'flow',
      ledgerAdjust: true,
      accountId: id,
      instrumentId: null,
      amount: cashNative,
      cashNative,
      flowDeltaNative,
      netDeltaNative,
      flowValueNative: value,
      flowField: field,
      periodKey,
      qty: 0, price: 0, fee: 0, fxRate: fxAt(account.currency, date),
      note: meta.title + ' · ' + (flow.periodLabel || flowPeriodLabel(periodKey)),
      createdAt: nowISO()
    });
    state.isDemo = false;
    saveState();
    closeAllSheets();
    toast(meta.title + '已写入账本', 'success');
    refreshPage();
  });
}
function resetFlowAdjustments(scope, id, periodKey) {
  const list = flowAdjustmentRecords(scope, id, periodKey);
  if (!list.length) return;
  confirmDialog({
    title: '撤销本周期调整？',
    message: '会删除当前周期的账本调整记录，相关资产市值和盈亏会回滚到调整前。真实交易记录不受影响。',
    confirmText: '撤销调整', danger: true,
    onConfirm: () => {
      const ids = new Set(list.map(r => r.id));
      state.records = state.records.filter(r => !ids.has(r.id));
      saveState();
      closeAllSheets();
      toast('已撤销账本调整', 'success');
      refreshPage();
    }
  });
}
