/* ============================================================
   Invoice Maker — Portal JavaScript
   ============================================================ */

'use strict';

// ---- State ----
let currentTemplate = 'classic';
let gstMode = false;
let bankEnabled = false;
let notesEnabled = false;
let previewTimer = null;
let itemCounter = 0;

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  // Default due date (30 days from today)
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 30);
  document.getElementById('due_date').value = due.toISOString().split('T')[0];

  // Track manual edits on invoice number
  const invEl = document.getElementById('invoice_number');
  if (invEl) invEl.addEventListener('input', () => { invEl.dataset.userEdited = 'true'; });

  addLineItem();
  schedulePreview();
});

// ---- Template Drawer ----
function toggleTemplateDrawer() {
  const drawer = document.getElementById('template-drawer');
  const btn = document.getElementById('templates-toggle-btn');
  const backdrop = document.getElementById('template-backdrop');
  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    closeTemplateDrawer();
  } else {
    drawer.classList.add('open');
    btn.classList.add('open');
    backdrop.classList.add('open');
  }
}

function closeTemplateDrawer() {
  document.getElementById('template-drawer').classList.remove('open');
  document.getElementById('templates-toggle-btn').classList.remove('open');
  document.getElementById('template-backdrop').classList.remove('open');
}

// ---- Template Selection ----
function selectTemplate(name, el) {
  currentTemplate = name;
  document.querySelectorAll('.template-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  // Update badge in topbar button
  const labels = { classic: 'Classic', modern: 'Modern Blue', minimal: 'Minimal', corporate: 'Corporate' };
  document.getElementById('current-template-label').textContent = labels[name] || name;
  closeTemplateDrawer();
  schedulePreview();
}

// ---- GST Toggle ----
function handleGSTToggle() {
  gstMode = document.getElementById('gst-toggle').checked;
  const formPanel = document.getElementById('form-panel');
  const gstTypeWrap = document.getElementById('gst-type-wrap');

  if (gstMode) {
    formPanel.classList.add('gst-mode');
    gstTypeWrap.style.display = 'block';
  } else {
    formPanel.classList.remove('gst-mode');
    gstTypeWrap.style.display = 'none';
  }

  rebuildLineItemGrids();
  schedulePreview();
}

// ---- Optional Section Toggle (Bank / Notes) ----
function toggleSection(name) {
  const checkbox = document.getElementById(name + '-toggle');
  checkbox.checked = !checkbox.checked;
  handleSectionToggle(name);
  schedulePreview();
}

function handleSectionToggle(name) {
  const enabled = document.getElementById(name + '-toggle').checked;
  const body  = document.getElementById(name + '-body');
  const badge = document.getElementById(name + '-badge');

  if (enabled) {
    body.style.display = 'block';
    badge.textContent = 'On';
    badge.classList.add('on');
  } else {
    body.style.display = 'none';
    badge.textContent = 'Off';
    badge.classList.remove('on');
  }

  if (name === 'bank')  bankEnabled  = enabled;
  if (name === 'notes') notesEnabled = enabled;
}

// ---- Line Items ----
function addLineItem() {
  const container = document.getElementById('line-items-container');
  const id = ++itemCounter;
  const row = document.createElement('div');
  row.className = 'line-item-row';
  row.dataset.id = id;
  row.innerHTML = buildLineItemHTML(id);
  container.appendChild(row);
  schedulePreview();
}

function buildLineItemHTML(id, itemType) {
  itemType = itemType || 'service';
  const isExpense = itemType === 'expense';

  const sacCol = gstMode && !isExpense
    ? `<div class="li-field"><label class="li-label">SAC Code</label><input type="text" placeholder="998314" data-field="sac_code" oninput="schedulePreview()"></div>`
    : '';

  const expenseSuggestions = isExpense ? 'expense-suggestions' : 'service-suggestions';
  const placeholder = isExpense ? 'Select or type an expense…' : 'Select or type a service…';

  return `
    <div class="li-desc-row">
      <div class="li-type-toggle">
        <button class="li-type-btn ${!isExpense ? 'active' : ''}" onclick="setItemType(${id},'service')" title="Service fee">Service</button>
        <button class="li-type-btn expense-btn ${isExpense ? 'active' : ''}" onclick="setItemType(${id},'expense')" title="Reimbursable expense">Expense</button>
      </div>
      <div class="li-field li-desc">
        <label class="li-label">${isExpense ? 'Expense Description' : 'Description of Service'}</label>
        <input list="${expenseSuggestions}" type="text" placeholder="${placeholder}" data-field="description" oninput="schedulePreview()" onchange="schedulePreview()">
      </div>
      <button class="btn-remove-item" onclick="removeLineItem(${id})" title="Remove row">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="li-nums-row">
      ${sacCol}
      <div class="li-field">
        <label class="li-label">Unit</label>
        <select data-field="unit" onchange="schedulePreview()">
          <option value="Hours">Hours</option>
          <option value="Days">Days</option>
          <option value="Months">Months</option>
          <option value="Fixed">Fixed</option>
          <option value="Units">Units</option>
          <option value="Trips">Trips</option>
          <option value="Nights">Nights</option>
        </select>
      </div>
      <div class="li-field">
        <label class="li-label">Qty</label>
        <input type="number" placeholder="0" min="0" step="0.5" data-field="quantity" oninput="calcRow(this); schedulePreview()">
      </div>
      <div class="li-field">
        <label class="li-label">Rate (₹)</label>
        <input type="number" placeholder="0.00" min="0" step="0.01" data-field="rate" oninput="calcRow(this); schedulePreview()">
      </div>
      <div class="li-field">
        <label class="li-label">Amount</label>
        <div class="amount-display ${isExpense ? 'expense-amount' : ''}" data-field="amount">₹0.00</div>
      </div>
    </div>
    <input type="hidden" data-field="item_type" value="${itemType}">
  `;
}

function setItemType(id, type) {
  const row = document.querySelector(`.line-item-row[data-id="${id}"]`);
  if (!row) return;
  // Save current values
  const vals = {};
  row.querySelectorAll('[data-field]').forEach(el => {
    if (!el.classList.contains('amount-display')) vals[el.dataset.field] = el.value;
  });
  row.innerHTML = buildLineItemHTML(id, type);
  // Restore
  row.querySelectorAll('[data-field]').forEach(el => {
    const f = el.dataset.field;
    if (f !== 'item_type' && vals[f] !== undefined && !el.classList.contains('amount-display')) {
      if (el.tagName === 'SELECT') el.value = vals[f];
      else el.value = vals[f];
    }
  });
  row.classList.toggle('expense-row', type === 'expense');
  const qtyEl = row.querySelector('[data-field="quantity"]');
  if (qtyEl) calcRow(qtyEl);
  schedulePreview();
}

function rebuildLineItemGrids() {
  document.querySelectorAll('.line-item-row').forEach(row => {
    const id = row.dataset.id;
    const vals = {};
    row.querySelectorAll('[data-field]').forEach(el => {
      if (el.tagName === 'SELECT') vals[el.dataset.field] = el.value;
      else if (!el.classList.contains('amount-display')) vals[el.dataset.field] = el.value;
    });

    const itemType = vals['item_type'] || 'service';
    row.innerHTML = buildLineItemHTML(id, itemType);
    row.classList.toggle('expense-row', itemType === 'expense');

    row.querySelectorAll('[data-field]').forEach(el => {
      const f = el.dataset.field;
      if (vals[f] !== undefined && !el.classList.contains('amount-display')) {
        if (el.tagName === 'SELECT') el.value = vals[f];
        else el.value = vals[f];
      }
    });

    const qtyEl = row.querySelector('[data-field="quantity"]');
    if (qtyEl) calcRow(qtyEl);
  });
}

function calcRow(inputEl) {
  const row = inputEl.closest('.line-item-row');
  const qty  = parseFloat(row.querySelector('[data-field="quantity"]')?.value || 0);
  const rate = parseFloat(row.querySelector('[data-field="rate"]')?.value || 0);
  const amount = isNaN(qty) || isNaN(rate) ? 0 : qty * rate;
  const amountEl = row.querySelector('[data-field="amount"]');
  if (amountEl) amountEl.textContent = '₹' + amount.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function removeLineItem(id) {
  const row = document.querySelector(`.line-item-row[data-id="${id}"]`);
  if (row) { row.remove(); schedulePreview(); }
}

// ---- Collect Form Data ----
function collectFormData() {
  const gstType = document.getElementById('gst-type')?.value || 'cgst_sgst';

  const items = [];
  document.querySelectorAll('.line-item-row').forEach(row => {
    const get = (field) => {
      const el = row.querySelector(`[data-field="${field}"]`);
      return el ? (el.classList.contains('amount-display') ? null : el.value) : null;
    };
    const typeEl = row.querySelector('[data-field="item_type"]');
    items.push({
      description: get('description') || '',
      sac_code:    get('sac_code')    || '',
      unit:        get('unit')        || 'Hours',
      quantity:    parseFloat(get('quantity')) || 0,
      rate:        parseFloat(get('rate'))     || 0,
      item_type:   typeEl ? typeEl.value : 'service',
    });
  });

  const bankOn  = document.getElementById('bank-toggle')?.checked  || false;
  const notesOn = document.getElementById('notes-toggle')?.checked || false;

  return {
    template:  currentTemplate,
    gst_mode:  gstMode,
    gst_type:  gstType,

    invoice_number:   document.getElementById('invoice_number')?.value   || '',
    invoice_date:     document.getElementById('invoice_date')?.value     || '',
    due_date:         document.getElementById('due_date')?.value         || '',
    place_of_supply:  document.getElementById('place_of_supply')?.value  || '',

    consultant_name:    document.getElementById('consultant_name')?.value    || '',
    consultant_address: document.getElementById('consultant_address')?.value || '',
    consultant_phone:   document.getElementById('consultant_phone')?.value   || '',
    consultant_email:   document.getElementById('consultant_email')?.value   || '',
    consultant_pan:     document.getElementById('consultant_pan')?.value     || '',
    consultant_gstin:   document.getElementById('consultant_gstin')?.value   || '',

    client_company: document.getElementById('client_company')?.value || '',
    client_address: document.getElementById('client_address')?.value || '',
    client_contact: document.getElementById('client_contact')?.value || '',
    client_gstin:   document.getElementById('client_gstin')?.value   || '',

    // Bank — only send if enabled
    show_bank:      bankOn,
    bank_name:      bankOn ? (document.getElementById('bank_name')?.value      || '') : '',
    account_number: bankOn ? (document.getElementById('account_number')?.value || '') : '',
    ifsc_code:      bankOn ? (document.getElementById('ifsc_code')?.value      || '') : '',
    account_type:   bankOn ? (document.getElementById('account_type')?.value   || 'Savings') : '',

    // Notes — only send if enabled
    show_notes: notesOn,
    notes:      notesOn ? (document.getElementById('notes')?.value || '') : '',

    items: items,
  };
}

// ---- Live Preview ----
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 350);
}

async function updatePreview() {
  const data = collectFormData();
  const loading = document.getElementById('preview-loading');
  const status  = document.getElementById('preview-status');

  loading.classList.add('visible');
  status.textContent = 'Updating…';

  try {
    const res = await fetch('/preview', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const html = await res.text();
    const iframe = document.getElementById('preview-iframe');
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    // Resize iframe to match rendered content height
    setTimeout(() => {
      try {
        const h = doc.body.scrollHeight;
        if (h > 400) iframe.style.height = h + 'px';
      } catch(e) {}
    }, 80);

    status.textContent = 'Up to date';
  } catch (err) {
    status.textContent = 'Preview error';
    console.error('Preview error:', err);
  } finally {
    loading.classList.remove('visible');
  }
}

// ---- Export ----
async function exportInvoice(format) {
  const data = collectFormData();
  showToast(format === 'pdf' ? 'Generating PDF…' : 'Generating DOCX…', 'info');

  try {
    const res = await fetch(`/export/${format}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `Export failed (${res.status})`);
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;

    const cd    = res.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename="?([^";\n]+)"?/);
    const invNum = data.invoice_number || 'invoice';
    a.download = match ? match[1] : `${invNum}.${format}`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`${format.toUpperCase()} downloaded!`, 'success');
    refreshInvoiceNumber();

  } catch (err) {
    console.error('Export error:', err);
    showToast('Export failed: ' + err.message, 'error');
  }
}

async function refreshInvoiceNumber() {
  try {
    const res  = await fetch('/api/next-invoice-number');
    const data = await res.json();
    const el   = document.getElementById('invoice_number');
    if (el && el.dataset.userEdited !== 'true') el.value = data.invoice_number;
  } catch(e) {}
}

// ---- Toast ----
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'show ' + type;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = ''; }, 3200);
}
