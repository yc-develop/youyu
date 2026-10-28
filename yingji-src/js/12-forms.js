/* =========================================================
   12 · 添加账户 / 标的 / 记录 / 菜单
   ========================================================= */
const ACCOUNT_TYPE_OPTIONS = [
  { value: 'payment', label: '支付账户 · 支付宝 / 微信' },
  { value: 'cash', label: '现金' },
  { value: 'bank', label: '银行账户' },
  { value: 'fund', label: '基金账户' },
  { value: 'deposit', label: '存款 / 定存' },
  { value: 'broker', label: '证券账户' }
];
const RECORD_TYPE_INFO = {
  deposit:  { label: '存入', desc: '从外部转入资金', icon: 'arrowDownLeft' },
  withdraw: { label: '取出', desc: '把钱转出账户', icon: 'arrowUpRight' },
  buy:      { label: '买入', desc: '买入基金、股票等', icon: 'plus' },
  sell:     { label: '卖出', desc: '卖出部分或全部持仓', icon: 'minus' },
  dividend: { label: '分红', desc: '现金分红或派息', icon: 'coins' },
  interest: { label: '利息', desc: '存款或现金利息', icon: 'percent' },
  price:    { label: '更新价格', desc: '更新最新净值 / 股价', icon: 'refresh' },
  fee:      { label: '费用', desc: '管理费或其他支出', icon: 'minus' },
  fx:       { label: '换汇', desc: '记录一笔换汇操作', icon: 'swap' }
};

/* ---------- account form ---------- */
function openAccountForm(accountId) {
  const editing = accountId ? accountById(accountId) : null;
  const colors = ['#1677ff', '#27b768', '#c69236', '#c23b32', '#ff6b35', '#6d7cff', '#ff7a00', '#2b6bf3', '#b18cff', '#43d6b0'];
  const body = '<form id="account-form"><div class="form-grid">' +
    fieldHTML({ id: 'account-name', label: '账户名称', value: editing ? editing.name : '', placeholder: '例如：支付宝', full: true }) +
    fieldHTML({ id: 'account-type', label: '账户类型', type: 'select', value: editing ? editing.type : 'payment', options: ACCOUNT_TYPE_OPTIONS }) +
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
    state.isDemo = false;
    if (editing) {
      editing.name = name; editing.type = type; editing.typeName = accountTypeLabel(type); editing.note = note; editing.color = color;
      editing.color2 = shadeColor(color, -18);
      editing.icon = name.slice(0, 1);
      saveState(); closeSheet(wrap); toast('账户已更新', 'success'); refreshPage(); return;
    }
    const id = uid('acc');
    const account = {
      id, name, type, typeName: accountTypeLabel(type), currency, color, color2: shadeColor(color, -18), icon: name.slice(0, 1), note,
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
  const editing = instrumentId ? instrumentById(instrumentId) : null;
  const classes = Object.keys(ASSET_CLASSES).filter(c => c !== 'cash').map(c => ({ value: c, label: ASSET_CLASSES[c].name }));
  const colors = ['#ff6b35', '#ff9f45', '#5b8cff', '#b18cff', '#43d6b0', '#f2c45c', '#ff7a00', '#2b6bf3', '#c9d1d9', '#9ca3af'];
  const body = '<form id="instrument-form"><div class="form-grid">' +
    fieldHTML({ id: 'inst-name', label: '标的名称', value: editing ? editing.name : '', placeholder: '例如：苹果 / 沪深300ETF', full: true }) +
    fieldHTML({ id: 'inst-symbol', label: '代码 / 简称', value: editing ? editing.symbol : '', placeholder: 'AAPL / 000051' }) +
    fieldHTML({ id: 'inst-class', label: '资产类别', type: 'select', value: editing ? editing.cls : 'stock', options: classes }) +
    fieldHTML({ id: 'inst-currency', label: '计价币种', type: 'select', value: editing ? editing.currency : account.currency, options: currencyOptions(), attrs: editing ? 'disabled' : '' }) +
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
  form.querySelectorAll('.color-dot').forEach(btn => btn.addEventListener('click', () => {
    form.querySelectorAll('.color-dot').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    form.querySelector('#inst-color').value = btn.getAttribute('data-color');
  }));
  const ccySel = form.querySelector('#inst-currency');
  if (ccySel && !editing) {
    ccySel.addEventListener('change', () => {
      const unit = form.querySelector('#inst-cost-unit');
      if (unit) unit.textContent = ccySel.value;
    });
  }
  wrap.querySelector('[data-inst-save]').addEventListener('click', () => {
    const name = cleanText(form.querySelector('#inst-name').value, 30);
    if (!name) { toast('请填写标的名称', 'error'); return; }
    const symbol = cleanText(form.querySelector('#inst-symbol').value, 16) || name.slice(0, 6);
    const cls = form.querySelector('#inst-class').value || 'other';
    const currency = ccySel ? ccySel.value : account.currency;
    const color = form.querySelector('#inst-color').value || '#ff9f45';
    const note = cleanText(form.querySelector('#inst-note').value, 40);
    const price = Math.max(0, parseNumber(form.querySelector('#inst-price').value));
    if (!editing && !(price > 0)) { toast('请输入当前价格或净值', 'error'); return; }
    state.isDemo = false;
    if (editing) {
      editing.name = name; editing.symbol = symbol; editing.cls = cls; editing.color = color;
      editing.note = note; editing.color2 = shadeColor(color, -18);
      if (price > 0 && Math.abs(price - priceNow(editing.id)) > 0.0000001) {
        upsertPricePoint(editing.id, todayKey(), price);
        state.records.push({ id: uid('rec'), date: todayKey(), type: 'price', accountId: account.id, instrumentId: editing.id, amount: 0, qty: 0, price, fee: 0, fxRate: fxAt(currency, todayKey()), note: '估值更新', createdAt: nowISO() });
      }
      saveState(); closeSheet(wrap); toast('标的已更新', 'success'); refreshPage(); return;
    }
    const id = uid('inst');
    const inst = { id, accountId: account.id, name, symbol, cls, currency, color, color2: shadeColor(color, -18), note };
    account.instruments.push(inst);
    state.prices[id] = [[todayKey(), price > 0 ? price : 1]];
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
    types = types.concat(['interest', 'fee', 'fx']);
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
function fxRateFieldHTML(ccy, full) {
  if (!ccy || ccy === 'CNY') return '';
  return fieldHTML({ id: 'record-fxrate', label: '成交汇率（可选）', placeholder: '留空则按日期自动取汇率', unit: 'CNY / ' + ccy, inputmode: 'decimal', full: !!full, hint: '用于计算这笔交易的汇兑损益' });
}

function openRecordForm(accountId, type, instrumentId) {
  const account = accountById(accountId);
  if (!account) return;
  const insts = account.instruments || [];
  const chosen = instrumentId ? insts.find(i => i.id === instrumentId) : (insts[0] || null);
  const info = RECORD_TYPE_INFO[type] || RECORD_TYPE_INFO.deposit;
  const instSelect = () => fieldHTML({
    id: 'record-instrument', label: '标的', type: 'select', full: true,
    value: chosen ? chosen.id : '',
    options: insts.map(i => ({ value: i.id, label: i.name + ' · ' + i.symbol }))
  });
  let fields = '';
  if (type === 'deposit' || type === 'withdraw') {
    fields = '<div class="form-grid">' + fieldHTML({ id: 'record-amount', label: '金额', placeholder: '0.00', unit: account.currency, inputmode: 'decimal', full: true }) +
      fieldHTML({ id: 'record-date', label: '日期', type: 'date', value: todayKey(), attrs: 'max="' + todayKey() + '"' }) +
      fieldHTML({ id: 'record-note', label: '备注（可选）', placeholder: '例如：工资 / 家庭支出' }) + '</div>' + fxRateFieldHTML(account.currency, true);
  } else if (type === 'buy' || type === 'sell') {
    fields = '<div class="form-grid">' + instSelect() +
      fieldHTML({ id: 'record-qty', label: '数量', placeholder: '0', inputmode: 'decimal' }) +
      fieldHTML({ id: 'record-price', label: '成交价', placeholder: '0.00', unit: chosen ? chosen.currency : account.currency, inputmode: 'decimal' }) +
      fieldHTML({ id: 'record-fee', label: '费用（可选）', placeholder: '0.00', unit: chosen ? chosen.currency : account.currency, inputmode: 'decimal' }) +
      fieldHTML({ id: 'record-date', label: '日期', type: 'date', value: todayKey(), attrs: 'max="' + todayKey() + '"' }) +
      fieldHTML({ id: 'record-note', label: '备注（可选）', placeholder: '买入 / 卖出原因', full: true }) + '</div>' +
      fxRateFieldHTML(chosen ? chosen.currency : account.currency, true) +
      '<div class="record-preview" id="record-preview">成交金额 <b>—</b></div>';
  } else if (type === 'dividend' || type === 'price') {
    fields = '<div class="form-grid">' + instSelect() +
      (type === 'dividend' ? fieldHTML({ id: 'record-amount', label: '分红金额', placeholder: '0.00', unit: chosen ? chosen.currency : account.currency, inputmode: 'decimal' }) : '') +
      fieldHTML({ id: 'record-price', label: type === 'price' ? '最新价格 / 净值' : '价格（可选）', placeholder: '0.00', unit: chosen ? chosen.currency : account.currency, inputmode: 'decimal', full: type === 'price' }) +
      fieldHTML({ id: 'record-date', label: '日期', type: 'date', value: todayKey(), attrs: 'max="' + todayKey() + '"' }) +
      fieldHTML({ id: 'record-note', label: '备注（可选）', placeholder: type === 'price' ? '收盘价 / 净值' : '现金分红', full: true }) + '</div>' +
      (type === 'dividend' ? fxRateFieldHTML(chosen ? chosen.currency : account.currency, true) : '') +
      (type === 'price' ? '<div class="info-banner" style="margin-top:12px">' + icon('info') + '<div>更新价格会同时写入价格曲线，并影响持仓市值与收益。</div></div>' : '');
  } else if (type === 'interest' || type === 'fee') {
    fields = '<div class="form-grid">' + fieldHTML({ id: 'record-amount', label: type === 'interest' ? '利息金额' : '费用金额', placeholder: '0.00', unit: account.currency, inputmode: 'decimal', full: true }) +
      fieldHTML({ id: 'record-date', label: '日期', type: 'date', value: todayKey(), attrs: 'max="' + todayKey() + '"' }) +
      fieldHTML({ id: 'record-note', label: '备注（可选）', placeholder: type === 'interest' ? '结息' : '管理费' }) + '</div>';
  } else if (type === 'fx') {
    fields = '<div class="form-grid">' +
      fieldHTML({ id: 'fx-from-ccy', label: '从', type: 'select', value: account.currency === 'CNY' ? 'CNY' : account.currency, options: currencyOptions() }) +
      fieldHTML({ id: 'fx-to-ccy', label: '换到', type: 'select', value: account.currency === 'CNY' ? 'USD' : 'CNY', options: currencyOptions() }) +
      fieldHTML({ id: 'fx-from-amount', label: '换出金额', placeholder: '0.00', inputmode: 'decimal' }) +
      fieldHTML({ id: 'fx-to-amount', label: '换入金额', placeholder: '0.00', inputmode: 'decimal' }) +
      fieldHTML({ id: 'fx-rate', label: '成交汇率（可选）', placeholder: '自动按当前汇率', inputmode: 'decimal', full: true }) +
      fieldHTML({ id: 'record-date', label: '日期', type: 'date', value: todayKey(), attrs: 'max="' + todayKey() + '"' }) +
      fieldHTML({ id: 'record-note', label: '备注（可选）', placeholder: '银行换汇' }) + '</div>' +
      '<div class="info-banner" style="margin-top:12px">' + icon('info') + '<div>换汇记录用于保留成交汇率与操作痕迹，不会改变账户总资产。跨币种持仓按最新汇率折算。</div></div>';
  }
  const body = '<form id="record-form"><div class="record-type-banner"><span class="rec-icon ' + (['deposit','sell','dividend','interest'].indexOf(type) >= 0 ? 'gain' : ['withdraw','buy','fee'].indexOf(type) >= 0 ? 'loss' : 'blue') + '">' + icon(info.icon) + '</span><div><div class="record-type-title">' + info.label + '</div><div class="record-type-sub">' + info.desc + ' · ' + esc(account.name) + '</div></div></div>' +
    fields + '</form>';
  const wrap = openSheet({
    title: info.label, sub: account.name + ' · ' + account.currency,
    body, footer: '<button class="btn ghost" data-sheet-close>取消</button><button class="btn primary" data-record-save>' + (type === 'price' ? '更新价格' : '保存记录') + '</button>'
  });
  const form = wrap.querySelector('#record-form');
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
  if (instSel && chosen) {
    instSel.addEventListener('change', () => {
      const i = insts.find(x => x.id === instSel.value);
      if (i) {
        form.querySelectorAll('.amount-input .unit').forEach((u, idx) => {
          // 保持简单：价格/费用单位跟随标的币种
          if (idx >= 0 && form.querySelector('#record-price')) {
            // 不强制替换所有单位，币种通常在创建时已确定
          }
        });
      }
    });
  }
  wrap.querySelector('[data-record-save]').addEventListener('click', () => {
    const date = (form.querySelector('#record-date') || {}).value || todayKey();
    const note = cleanText((form.querySelector('#record-note') || {}).value || '', 50);
    const baseRec = { date, note, accountId: account.id, instrumentId: null, amount: 0, qty: 0, price: 0, fee: 0, fxRate: 1, createdAt: nowISO() };
    const fxInput = form.querySelector('#record-fxrate') ? parseNumber(form.querySelector('#record-fxrate').value) : 0;
    if (type === 'deposit' || type === 'withdraw' || type === 'interest' || type === 'fee') {
      const amount = parseNumber(form.querySelector('#record-amount') ? form.querySelector('#record-amount').value : 0);
      if (!(amount > 0)) { toast('请输入金额', 'error'); return; }
      baseRec.type = type; baseRec.amount = amount; baseRec.fxRate = fxInput > 0 ? fxInput : fxAt(account.currency, date);
    } else if (type === 'buy' || type === 'sell') {
      if (!instSel || !instSel.value) { toast('请选择标的', 'error'); return; }
      const inst = instById(instSel.value);
      if (!inst) return;
      const qty = parseNumber(form.querySelector('#record-qty').value);
      const price = parseNumber(priceInput.value);
      const fee = parseNumber(form.querySelector('#record-fee') ? form.querySelector('#record-fee').value : 0);
      if (!(qty > 0) || !(price > 0)) { toast('请填写数量和价格', 'error'); return; }
      if (type === 'sell') {
        const im = computeInstrumentMetrics(inst.id);
        if (qty > im.qty + 0.000001) { toast('卖出数量超过当前持仓（' + fmtQty(im.qty) + '）', 'error'); return; }
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
    baseRec.id = uid('rec');
    state.isDemo = false;
    state.records.push(baseRec);
    saveState();
    closeAllSheets();
    toast(type === 'price' ? '价格已更新' : '记录已保存', 'success');
    refreshPage();
  });
}
function instById(id) { return instrumentById(id); }

/* ---------- records sheet ---------- */
function openRecordsSheet(scope, id) {
  const isAccount = scope === 'account';
  const list = isAccount ? recordsForAccount(id) : recordsForInstrument(id);
  const title = isAccount ? (accountById(id) ? accountById(id).name + ' · 记录' : '账户记录') : (instrumentById(id) ? instrumentById(id).name + ' · 记录' : '标的记录');
  const body = list.length ? '<div class="list-card" style="background:transparent;border:0">' + list.slice().reverse().map(r => recordRowHTML(r, { deletable: true })).join('') + '</div>' :
    '<div class="empty-state" style="padding:32px 10px"><div class="ico">' + icon('file') + '</div><h3>还没有记录</h3><p>买入、卖出、存入与估值更新都会出现在这里。</p></div>';
  const footer = isAccount ?
    '<button class="btn ghost" data-sheet-close>关闭</button><button class="btn primary" data-action="add-record-account" data-account="' + esc(id) + '">记一笔</button>' :
    '<button class="btn ghost" data-sheet-close>关闭</button><button class="btn primary" data-action="add-record-instrument" data-instrument="' + esc(id) + '">记一笔</button>';
  openSheet({ title, sub: list.length + ' 条记录 · 点击垃圾桶删除', body, footer });
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
    '<button class="menu-item" data-action="open-price-update" data-instrument="' + esc(i.id) + '">' + icon('refresh') + '更新最新价格' + '<span class="arrow">' + icon('chevronRight') + '</span></button>' +
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
