

(function () {
  const API_BASE = (localStorage.getItem('DHAMANPAY_API_BASE') || 'https://aftermath-passion-unpack.ngrok-free.dev/api').replace(/\/+$/, '');
  const LOGIN_PAGE = 'login.html';

  const state = {
    me: null,
    orders: [],
    orderHistoryCache: {},
    selectedCustomer: null,
    customerSearchResults: []
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return localStorage.getItem('token');
  }

  function clearSession() {
    localStorage.removeItem('token');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return '0 DZD';
    return amount.toLocaleString('en-US') + ' DZD';
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function showFormMessage(text, isSuccess) {
    const box = byId('formMessage');
    if (!box) return;
    box.classList.remove('hidden', 'bg-green-50', 'text-green-700', 'bg-red-50', 'text-red-700');
    box.classList.add(isSuccess ? 'bg-green-50' : 'bg-red-50', isSuccess ? 'text-green-700' : 'text-red-700');
    box.textContent = text;
  }

  function apiHeaders(extra = {}) {
    const headers = {
      Accept: 'application/json',
      ...extra
    };

    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    return headers;
  }

  async function apiFetch(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers: apiHeaders({
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }),
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error('Invalid server response.');
    }

    if (response.status === 401) {
      clearSession();
      window.location.href = LOGIN_PAGE;
      throw new Error('Your session expired. Please log in again.');
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || 'Request failed.');
    }

    return data;
  }

  async function getMe() {
    return apiFetch('/me');
  }

  async function logoutRequest() {
    return apiFetch('/logout', { method: 'POST', body: {} });
  }

  async function getOrders() {
    return apiFetch('/orders');
  }

  async function getOrderHistory(id) {
    return apiFetch(`/orders/${id}/history`);
  }

  async function searchCustomers(fullName = '', phone = '') {
    const params = new URLSearchParams();
    if (fullName) params.set('full_name', fullName);
    if (phone) params.set('phone', phone);
    return apiFetch(`/customers/search?${params.toString()}`);
  }

  async function createOrder(payload) {
    return apiFetch('/orders', {
      method: 'POST',
      body: payload
    });
  }

  function ensureLogoutButton() {
    if (byId('logoutBtn')) return;

    const nav = $('#navbar .max-w-7xl');
    if (!nav) return;

    const btn = document.createElement('button');
    btn.id = 'logoutBtn';
    btn.className = 'bg-white/10 border border-white/20 text-white px-5 py-3 rounded-2xl uppercase text-xs tracking-[0.2em] font-bold hover:bg-white/20 transition-all';
    btn.textContent = 'Logout';
    nav.appendChild(btn);
  }

  function patchMerchantFields() {
    const customerField = byId('customerId');
    if (customerField) {
      customerField.type = 'text';
      customerField.readOnly = true;
      customerField.placeholder = 'Search and select a customer below';
    }

    const customerLabel = document.querySelector('label[for="customerId"]') || customerField?.closest('div')?.querySelector('label');
    if (customerLabel) customerLabel.textContent = 'Selected Customer';

    const orderCodeWrap = byId('orderCode')?.closest('div');
    const merchantWrap = byId('merchantId')?.closest('div');
    const courierWrap = byId('courierId')?.closest('div');

    [orderCodeWrap, merchantWrap, courierWrap].forEach(node => {
      if (node) node.style.display = 'none';
    });

    const formGrid = byId('createOrderForm')?.querySelector('.grid');
    if (!formGrid) return;

    if (!byId('customerSearchName')) {
      const searchBlock = document.createElement('div');
      searchBlock.className = 'md:col-span-2 rounded-[1.5rem] bg-slate-50 border border-slate-200 p-4';
      searchBlock.innerHTML = `
        <p class="text-xs uppercase tracking-[0.2em] text-dp-gray mb-3">Customer Search</p>
        <div class="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label class="block text-sm font-semibold text-dp-dark mb-2">Customer Name</label>
            <input id="customerSearchName" type="text" placeholder="Search by full name" class="w-full px-4 py-3 rounded-2xl bg-white border border-blue-100 focus:outline-none focus:ring-2 focus:ring-dp-blue/20 focus:border-dp-blue">
          </div>
          <div>
            <label class="block text-sm font-semibold text-dp-dark mb-2">Customer Phone</label>
            <input id="customerSearchPhone" type="text" placeholder="Search by phone" class="w-full px-4 py-3 rounded-2xl bg-white border border-blue-100 focus:outline-none focus:ring-2 focus:ring-dp-blue/20 focus:border-dp-blue">
          </div>
          <button type="button" id="searchCustomerBtn" class="bg-dp-blue text-white px-5 py-3 rounded-2xl uppercase text-xs tracking-[0.2em] font-bold hover:bg-blue-700 transition-colors">Search</button>
        </div>
        <div id="customerSearchMessage" class="hidden mt-3 rounded-2xl p-3 text-sm"></div>
        <div id="customerSearchResults" class="mt-4 space-y-2"></div>
      `;
      formGrid.insertBefore(searchBlock, customerField?.closest('div') || formGrid.firstChild);
    }

    if (!byId('productName')) {
      const productField = document.createElement('div');
      productField.className = 'md:col-span-2';
      productField.innerHTML = `
        <label class="block text-sm font-semibold text-dp-dark mb-2">Product Name</label>
        <input id="productName" type="text" placeholder="iPhone 13" class="w-full px-4 py-3 rounded-2xl bg-blue-50 border border-blue-100 focus:outline-none focus:ring-2 focus:ring-dp-blue/20 focus:border-dp-blue">
      `;
      formGrid.appendChild(productField);
    }

    if (!byId('expectedSerialNumber')) {
      const serialField = document.createElement('div');
      serialField.className = 'md:col-span-2';
      serialField.innerHTML = `
        <label class="block text-sm font-semibold text-dp-dark mb-2">Expected Serial Number</label>
        <input id="expectedSerialNumber" type="text" placeholder="SN123456789" class="w-full px-4 py-3 rounded-2xl bg-blue-50 border border-blue-100 focus:outline-none focus:ring-2 focus:ring-dp-blue/20 focus:border-dp-blue">
      `;
      formGrid.appendChild(serialField);
    }
  }

  function setSearchMessage(text, ok) {
    const box = byId('customerSearchMessage');
    if (!box) return;
    box.classList.remove('hidden', 'bg-green-50', 'text-green-700', 'bg-red-50', 'text-red-700', 'bg-blue-50', 'text-blue-700');

    if (ok === true) box.classList.add('bg-green-50', 'text-green-700');
    else if (ok === false) box.classList.add('bg-red-50', 'text-red-700');
    else box.classList.add('bg-blue-50', 'text-blue-700');

    box.textContent = text;
  }

  function renderCustomerResults(list) {
    const container = byId('customerSearchResults');
    if (!container) return;

    container.innerHTML = '';

    if (!list.length) {
      container.innerHTML = '<div class="rounded-2xl border border-dashed border-blue-200 p-4 text-sm text-dp-gray">No matching customers found.</div>';
      return;
    }

    list.forEach(customer => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'w-full text-left rounded-2xl border border-blue-100 bg-white p-4 hover:bg-blue-50 transition-colors';
      button.innerHTML = `
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p class="font-bold text-dp-dark">${escapeHtml(customer.full_name || 'Unnamed customer')}</p>
            <p class="text-sm text-dp-gray mt-1">Phone: ${escapeHtml(customer.phone || '—')}</p>
          </div>
          <span class="text-xs uppercase tracking-[0.2em] font-bold text-dp-blue">Select</span>
        </div>
      `;
      button.addEventListener('click', function () {
        state.selectedCustomer = customer;
        if (byId('customerId')) {
          byId('customerId').value = `${customer.full_name} (#${customer.id})`;
          byId('customerId').dataset.customerId = String(customer.id);
        }
        updateJsonPreview();
        setSearchMessage(`Selected ${customer.full_name} as the customer for this order.`, true);
      });
      container.appendChild(button);
    });
  }

  function getSelectedCustomerId() {
    const input = byId('customerId');
    return Number(input?.dataset.customerId || 0);
  }

  function getCreatePayload() {
    return {
      customer_id: getSelectedCustomerId(),
      amount: Number(byId('amount')?.value || 0),
      delivery_address: (byId('deliveryAddress')?.value || '').trim(),
      product_name: (byId('productName')?.value || '').trim(),
      expected_serial_number: (byId('expectedSerialNumber')?.value || '').trim()
    };
  }

  function updateJsonPreview() {
    const preview = byId('jsonPreview');
    if (!preview) return;
    preview.textContent = JSON.stringify(getCreatePayload(), null, 2);
  }

  function getStatusTone(status) {
    switch (status) {
      case 'CREATED':
        return 'bg-slate-100 text-slate-700';
      case 'ESCROW_FROZEN':
        return 'bg-blue-50 text-blue-700';
      case 'SHIPPED':
        return 'bg-indigo-50 text-indigo-700';
      case 'DELIVERED_PENDING':
        return 'bg-orange-50 text-orange-700';
      case 'DISPUTE_OPEN':
        return 'bg-red-50 text-red-700';
      case 'COMPLETED':
        return 'bg-green-50 text-green-700';
      case 'REFUNDED':
        return 'bg-yellow-50 text-yellow-700';
      case 'CANCELLED':
        return 'bg-slate-200 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  function normalizeOrder(order) {
    const id = order.id ?? order.order_id ?? order.orderId ?? '';
    const status = order.status || 'UNKNOWN';
    const amount = Number(order.amount || 0);
    const productName = order.product_name || order.productName || '—';
    const customerName =
      order.customer?.full_name ||
      order.customer_name ||
      order.customer?.name ||
      (order.customer_id ? `Customer #${order.customer_id}` : 'Unknown customer');

    const createdAt = order.created_at || order.createdAt || order.updated_at || order.updatedAt || '';
    const dateRank = createdAt ? new Date(createdAt).getTime() || 0 : 0;
    const code = order.order_code || order.code || `#${id}`;

    let group = 'In Progress';
    if (status === 'DELIVERED_PENDING' || status === 'DISPUTE_OPEN') group = 'Needs Attention';
    if (['COMPLETED', 'REFUNDED', 'CANCELLED'].includes(status)) group = 'Completed';

    return {
      raw: order,
      id,
      code,
      status,
      amount,
      productName,
      customer: customerName,
      deliveryAddress: order.delivery_address || '—',
      expectedSerialNumber: order.expected_serial_number || '—',
      createdAt,
      dateLabel: formatDate(createdAt),
      dateRank,
      group
    };
  }

  function computeStats() {
    const stats = {
      earned: 0,
      pending: 0,
      active: 0,
      completed: 0
    };

    state.orders.forEach(order => {
      if (order.status === 'COMPLETED') {
        stats.earned += order.amount;
        stats.completed += 1;
      }

      if (['ESCROW_FROZEN', 'SHIPPED', 'DELIVERED_PENDING', 'DISPUTE_OPEN'].includes(order.status)) {
        stats.pending += order.amount;
      }

      if (!['COMPLETED', 'REFUNDED', 'CANCELLED'].includes(order.status)) {
        stats.active += 1;
      }
    });

    return stats;
  }

  function renderStats() {
    const stats = computeStats();

    const heroEarned = byId('heroEarned');
    const heroPending = byId('heroPending');
    const heroActive = byId('heroActive');
    const heroCompleted = byId('heroCompleted');
    const totalEarned = byId('totalEarned');
    const pendingEscrow = byId('pendingEscrow');
    const completedOrders = byId('completedOrders');

    if (heroEarned) heroEarned.textContent = formatMoney(stats.earned);
    if (heroPending) heroPending.textContent = formatMoney(stats.pending);
    if (heroActive) heroActive.textContent = String(stats.active);
    if (heroCompleted) heroCompleted.textContent = String(stats.completed);
    if (totalEarned) totalEarned.textContent = formatMoney(stats.earned);
    if (pendingEscrow) pendingEscrow.textContent = formatMoney(stats.pending);
    if (completedOrders) completedOrders.textContent = String(stats.completed);
  }

  function clearDetails() {
    const map = {
      detailOrderCode: '—',
      detailCustomer: '—',
      detailAmount: '—',
      detailAddress: '—',
      detailSerial: '—',
      detailStatus: '—',
      detailDate: '—'
    };

    Object.entries(map).forEach(([id, value]) => {
      const node = byId(id);
      if (node) node.textContent = value;
    });

    const badge = byId('detailStatusBadge');
    if (badge) {
      badge.className = 'px-3 py-2 rounded-full text-xs font-bold uppercase tracking-[0.2em] bg-white/10 text-white';
      badge.textContent = 'Empty';
    }

    const timeline = byId('detailTimeline');
    if (timeline) {
      timeline.innerHTML = '<p class="text-white/55 text-sm">No timeline yet.</p>';
    }
  }

  function renderTimeline(historyList) {
    if (!Array.isArray(historyList) || !historyList.length) {
      return '<p class="text-white/55 text-sm">No history available for this order yet.</p>';
    }

    return historyList.map(item => {
      const status = item.status || item.to_status || item.label || 'Updated';
      const time = item.created_at || item.date || item.changed_at || '';
      const note = item.note || item.description || item.message || '';
      return `
        <div class="rounded-[1.25rem] bg-white/5 border border-white/10 p-4">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <p class="font-bold text-white">${escapeHtml(status)}</p>
            <p class="text-xs uppercase tracking-[0.2em] text-white/55">${escapeHtml(formatDate(time))}</p>
          </div>
          <p class="text-sm text-white/65 mt-2">${escapeHtml(note || 'Status recorded by backend.')}</p>
        </div>
      `;
    }).join('');
  }

  async function updateDetails(order) {
    if (!order) {
      clearDetails();
      return;
    }

    const fields = {
      detailOrderCode: order.code,
      detailCustomer: order.customer,
      detailAmount: formatMoney(order.amount),
      detailAddress: order.deliveryAddress,
      detailSerial: order.expectedSerialNumber,
      detailStatus: order.status,
      detailDate: order.dateLabel
    };

    Object.entries(fields).forEach(([id, value]) => {
      const node = byId(id);
      if (node) node.textContent = value;
    });

    const badge = byId('detailStatusBadge');
    if (badge) {
      badge.className = `px-3 py-2 rounded-full text-xs font-bold uppercase tracking-[0.2em] ${getStatusTone(order.status)}`;
      badge.textContent = order.status;
    }

    const timeline = byId('detailTimeline');
    if (!timeline) return;

    if (!state.orderHistoryCache[order.id]) {
      try {
        const res = await getOrderHistory(order.id);
        state.orderHistoryCache[order.id] = Array.isArray(res.data) ? res.data : [];
      } catch (error) {
        state.orderHistoryCache[order.id] = [{
          status: 'History unavailable',
          note: error.message,
          created_at: ''
        }];
      }
    }

    timeline.innerHTML = renderTimeline(state.orderHistoryCache[order.id]);
  }

  function makeCard(order) {
    const wrapper = document.createElement('div');
    wrapper.className = 'order-card rounded-[1.5rem] border border-blue-100 bg-white p-5 shadow-sm';

    wrapper.innerHTML = `
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div class="space-y-2">
          <div class="flex items-center gap-3 flex-wrap">
            <h3 class="text-xl font-bold text-dp-dark">${escapeHtml(order.code)}</h3>
            <span class="px-3 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] ${getStatusTone(order.status)}">${escapeHtml(order.status)}</span>
          </div>
          <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm text-dp-gray">
            <span>Customer: ${escapeHtml(order.customer)}</span>
            <span>Amount: ${escapeHtml(formatMoney(order.amount))}</span>
            <span>Date: ${escapeHtml(order.dateLabel)}</span>
          </div>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-xs text-dp-gray">${escapeHtml(order.productName)}</span>
          <button class="view-btn bg-dp-blue text-white px-5 py-3 rounded-2xl uppercase text-[11px] tracking-[0.2em] font-bold hover:bg-blue-700 transition-colors">View Details</button>
        </div>
      </div>
    `;

    wrapper.querySelector('.view-btn').addEventListener('click', async function () {
      await updateDetails(order);
      byId('details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return wrapper;
  }

  function sortOrders(list, mode) {
    const copy = [...list];
    if (mode === 'oldest') copy.sort((a, b) => a.dateRank - b.dateRank);
    else if (mode === 'amount-high') copy.sort((a, b) => b.amount - a.amount);
    else if (mode === 'amount-low') copy.sort((a, b) => a.amount - b.amount);
    else copy.sort((a, b) => b.dateRank - a.dateRank);
    return copy;
  }

  function renderOrders() {
    const search = (byId('searchInput')?.value || '').trim().toLowerCase();
    const status = byId('statusFilter')?.value || 'all';
    const sort = byId('sortFilter')?.value || 'newest';

    const filtered = state.orders.filter(order => {
      const searchMatch =
        !search ||
        order.code.toLowerCase().includes(search) ||
        order.customer.toLowerCase().includes(search) ||
        order.productName.toLowerCase().includes(search);

      const statusMatch = status === 'all' || order.status === status;
      return searchMatch && statusMatch;
    });

    const grouped = {
      'Needs Attention': [],
      'In Progress': [],
      'Completed': []
    };

    sortOrders(filtered, sort).forEach(order => grouped[order.group].push(order));

    const groupMap = {
      'Needs Attention': byId('group-needs-attention'),
      'In Progress': byId('group-in-progress'),
      'Completed': byId('group-completed')
    };

    Object.entries(groupMap).forEach(([groupName, container]) => {
      if (!container) return;
      container.innerHTML = '';
      grouped[groupName].forEach(order => container.appendChild(makeCard(order)));

      const panel = container.closest('.group-panel');
      const count = grouped[groupName].length;
      if (panel?.querySelector('.group-count')) {
        panel.querySelector('.group-count').textContent = `${count} Order${count === 1 ? '' : 's'}`;
      }
      if (panel) panel.classList.toggle('hidden', count === 0);
    });

    const emptyState = byId('emptyState');
    if (emptyState) emptyState.classList.toggle('hidden', filtered.length !== 0);

    const visible = byId('visibleOrders');
    if (visible) visible.textContent = String(filtered.length);

    renderStats();

    if (!filtered.length) clearDetails();
    else updateDetails(sortOrders(filtered, sort)[0]);
  }

  async function loadMe() {
    const res = await getMe();
    state.me = res.data || null;

    if (!state.me) throw new Error('Could not load current user.');
    if (state.me.role !== 'merchant') throw new Error('This dashboard is only for merchant accounts.');

    const merchantNameNode = document.querySelector('.glass-card h3');
    if (merchantNameNode) merchantNameNode.textContent = state.me.store_name || state.me.full_name || 'Merchant';
  }

  async function loadOrders() {
    const res = await getOrders();
    const list = Array.isArray(res.data) ? res.data : [];
    state.orders = list.map(normalizeOrder);
    renderOrders();
  }

  function openModal() {
    byId('createOrderModal')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateJsonPreview();
  }

  function closeModal() {
    byId('createOrderModal')?.classList.add('hidden');
    document.body.style.overflow = 'auto';
    const msg = byId('formMessage');
    if (msg) msg.classList.add('hidden');
  }

  async function handleCustomerSearch() {
    const fullName = (byId('customerSearchName')?.value || '').trim();
    const phone = (byId('customerSearchPhone')?.value || '').trim();

    if (!fullName && !phone) {
      setSearchMessage('Enter at least a customer name or phone number.', false);
      renderCustomerResults([]);
      return;
    }

    setSearchMessage('Searching customers...', null);

    try {
      const res = await searchCustomers(fullName, phone);
      state.customerSearchResults = Array.isArray(res.data) ? res.data : [];
      renderCustomerResults(state.customerSearchResults);
      setSearchMessage(`${state.customerSearchResults.length} customer match(es) found.`, true);
    } catch (error) {
      renderCustomerResults([]);
      setSearchMessage(error.message, false);
    }
  }

  function validatePayload(payload) {
    if (!payload.customer_id) return 'Select a customer first.';
    if (!payload.amount || payload.amount <= 0) return 'Enter a valid amount.';
    if (!payload.delivery_address) return 'Enter the delivery address.';
    if (!payload.product_name) return 'Enter the product name.';
    if (!payload.expected_serial_number) return 'Enter the expected serial number.';
    return '';
  }

  async function handleCreateOrder(event) {
    event.preventDefault();
    const payload = getCreatePayload();
    const errorText = validatePayload(payload);

    if (errorText) {
      showFormMessage(errorText, false);
      return;
    }

    try {
      showFormMessage('Creating order...', true);
      const res = await createOrder(payload);
      showFormMessage(res.message || 'Order created successfully.', true);

      byId('createOrderForm')?.reset();
      if (byId('customerId')) {
        byId('customerId').value = '';
        delete byId('customerId').dataset.customerId;
      }
      state.selectedCustomer = null;
      renderCustomerResults([]);
      updateJsonPreview();

      await loadOrders();

      setTimeout(() => {
        closeModal();
      }, 900);
    } catch (error) {
      showFormMessage(error.message, false);
    }
  }

  async function handleLogout() {
    try {
      await logoutRequest();
    } catch (error) {
      // Ignore API logout failure and clear local session anyway.
    }
    clearSession();
    window.location.href = LOGIN_PAGE;
  }

  function fillDemoData() {
    if (byId('customerSearchName')) byId('customerSearchName').value = 'Mayuush';
    if (byId('customerSearchPhone')) byId('customerSearchPhone').value = '0557034001';
    if (byId('amount')) byId('amount').value = '3000';
    if (byId('deliveryAddress')) byId('deliveryAddress').value = 'Oran';
    if (byId('productName')) byId('productName').value = 'iPhone 13';
    if (byId('expectedSerialNumber')) byId('expectedSerialNumber').value = 'SN123456789';
    updateJsonPreview();
  }

  function bindUi() {
    byId('openCreateOrderNav')?.addEventListener('click', openModal);
    byId('openCreateOrderHero')?.addEventListener('click', openModal);
    byId('closeCreateOrder')?.addEventListener('click', closeModal);
    byId('cancelCreateOrder')?.addEventListener('click', closeModal);
    byId('modalBackdrop')?.addEventListener('click', closeModal);
    byId('fillDemoData')?.addEventListener('click', fillDemoData);
    byId('searchCustomerBtn')?.addEventListener('click', handleCustomerSearch);
    byId('createOrderForm')?.addEventListener('submit', handleCreateOrder);
    byId('logoutBtn')?.addEventListener('click', handleLogout);

    ['amount', 'deliveryAddress', 'productName', 'expectedSerialNumber', 'customerId'].forEach(id => {
      byId(id)?.addEventListener('input', updateJsonPreview);
    });

    byId('searchInput')?.addEventListener('input', renderOrders);
    byId('statusFilter')?.addEventListener('change', renderOrders);
    byId('sortFilter')?.addEventListener('change', renderOrders);
    byId('resetBtn')?.addEventListener('click', function () {
      if (byId('searchInput')) byId('searchInput').value = '';
      if (byId('statusFilter')) byId('statusFilter').value = 'all';
      if (byId('sortFilter')) byId('sortFilter').value = 'newest';
      renderOrders();
    });

    byId('scroll-top')?.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', function () {
      const navbar = byId('navbar');
      if (navbar) {
        if (window.scrollY > 50) navbar.classList.add('bg-dp-dark/85', 'backdrop-blur-md', 'py-3');
        else navbar.classList.remove('bg-dp-dark/85', 'backdrop-blur-md', 'py-3');
      }

      const scrollTopBtn = byId('scroll-top');
      if (scrollTopBtn) scrollTopBtn.classList.toggle('visible', window.scrollY > 300);
    });
  }

  function startLoader() {
    if (!window.gsap) return;
    gsap.to('#loader-bar', {
      width: '100%',
      duration: 1.1,
      ease: 'power2.inOut',
      onComplete: function () {
        gsap.to('#loader', {
          yPercent: -100,
          duration: 0.8,
          ease: 'power4.inOut'
        });

        gsap.set('.hero-reveal', { y: 80, opacity: 0 });
        gsap.to('.hero-reveal', {
          y: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.12,
          ease: 'power3.out',
          delay: 0.05
        });
      }
    });
  }

  async function init() {
    if (!getToken()) {
      window.location.href = LOGIN_PAGE;
      return;
    }

    ensureLogoutButton();
    patchMerchantFields();
    bindUi();
    updateJsonPreview();
    clearDetails();
    startLoader();

    try {
      await loadMe();
      await loadOrders();
    } catch (error) {
      clearDetails();
      const emptyState = byId('emptyState');
      if (emptyState) {
        emptyState.classList.remove('hidden');
        emptyState.textContent = error.message;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();