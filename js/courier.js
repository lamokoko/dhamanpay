(function () {
  const API_BASE = (localStorage.getItem('DHAMANPAY_API_BASE') || 'http://127.0.0.1:8000/api').replace(/\/+$/, '');
  const TOKEN = localStorage.getItem('token');

  const state = {
    me: null,
    profile: null,
    orders: [],
    activeOrder: null,
    selectedPdf: null
  };

  function el(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const node = el(id);
    if (node) node.textContent = value ?? '—';
  }

  function setInputValue(id, value) {
    const node = el(id);
    if (node) node.value = value ?? '';
  }

  function showMessage(id, text, ok = null) {
    const box = el(id);
    if (!box) return;

    box.classList.remove(
      'hidden',
      'bg-green-50',
      'text-green-700',
      'bg-red-50',
      'text-red-700',
      'bg-blue-50',
      'text-blue-700'
    );

    if (ok === true) {
      box.classList.add('bg-green-50', 'text-green-700');
    } else if (ok === false) {
      box.classList.add('bg-red-50', 'text-red-700');
    } else {
      box.classList.add('bg-blue-50', 'text-blue-700');
    }

    box.textContent = text;
  }

  function formatCoord(lat, lng) {
    if (lat == null || lng == null || lat === '' || lng === '') return '—';
    const a = Number(lat);
    const b = Number(lng);
    if (Number.isNaN(a) || Number.isNaN(b)) return '—';
    return `${a.toFixed(5)}, ${b.toFixed(5)}`;
  }

  async function apiFetch(path, options = {}) {
    if (!TOKEN) {
      throw new Error('Missing token in localStorage');
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    let data;
    try {
      data = await response.json();
    } catch (e) {
      throw new Error(`Invalid JSON response from ${path}`);
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
  }

  async function logoutUser() {
    try {
      await apiFetch('/logout', {
        method: 'POST',
        body: {}
      });
    } catch (err) {
      console.warn('Logout request failed, clearing local session anyway:', err.message);
    }

    localStorage.removeItem('token');
    window.location.href = 'login.html';
  }

  async function loadMe() {
    const res = await apiFetch('/me');
    state.me = res.data || null;

    setText('heroCourierName', state.me?.full_name || 'Courier');
    setText('profileName', state.me?.full_name || 'Courier');

    const emailNode = document.querySelector('#profile-view .space-y-4 div:nth-child(1) .font-semibold');
    if (emailNode) emailNode.textContent = state.me?.email || '—';

    const phoneNode = document.querySelector('#profile-view .space-y-4 div:nth-child(2) .font-semibold');
    if (phoneNode) phoneNode.textContent = state.me?.phone || '—';
  }

  async function loadProfile() {
    const res = await apiFetch('/courier/profile');
    state.profile = res.data || null;

    const rating = Number(state.profile?.rating || 0).toFixed(1);

    setText('profileCourierId', state.profile?.id ?? '—');
    setText('profileVehicle', state.profile?.vehicle_matricule || '—');
    setText('profileRating', rating);
    setText('heroRating', rating);

    const company = state.profile?.delivery_company || '—';
    setText('profileZone', company);

    setInputValue('shipCourierId', state.profile?.id ?? '');
  }

  async function loadOrders() {
    const res = await apiFetch('/orders');
    state.orders = Array.isArray(res.data) ? res.data : [];

    setText('heroAssigned', state.orders.length);

    const deliveredCount = state.orders.filter(order =>
      order.status === 'DELIVERED_PENDING' ||
      order.status === 'COMPLETED'
    ).length;

    setText('heroDelivered', deliveredCount);
    setText('profileDeliveredToday', deliveredCount);

    if (state.activeOrder) {
      const refreshed = state.orders.find(order => String(order.id) === String(state.activeOrder.id));
      state.activeOrder = refreshed || null;
    }
  }

  function findOrderByInputValue(value) {
    const clean = String(value || '').trim();
    if (!clean) return null;
    return state.orders.find(order => String(order.id) === clean) || null;
  }

  function syncManualPreviewFields() {
    setText('previewFromText', el('shipFromText')?.value?.trim() || '—');
    setText('previewToText', el('shipToText')?.value?.trim() || '—');
    setText('previewFromGps', formatCoord(el('fromLat')?.value, el('fromLng')?.value));
    setText('previewToGps', formatCoord(el('toLat')?.value, el('toLng')?.value));
  }

  function syncOrderPreview(order) {
    state.activeOrder = order || null;

    setText('previewOrderTitle', order ? `Order #${order.id}` : 'No Shipment Started');
    setText('proofPreviewTitle', order ? `Order #${order.id}` : 'No Proof Yet');
    setText('proofPrevOrder', order ? `#${order.id}` : '—');

    setText('customerStatus', order?.status || 'Waiting for shipment');
    setText('heroStatus', order?.status || 'Online');

    const badge = el('previewShipBadge');
    if (badge) {
      badge.className = 'px-3 py-2 rounded-full text-xs font-bold uppercase tracking-[0.2em] bg-white/10 text-white';
      badge.textContent = order?.status || 'Waiting';
    }

    if (order) {
      setText('customerUpdatedAt', order.updated_at || '—');
    } else {
      setText('customerUpdatedAt', '—');
    }

    syncManualPreviewFields();
  }

  async function startShipping() {
    const orderInput = el('shipOrderCode')?.value;
    const order = findOrderByInputValue(orderInput);

    if (!order) {
      showMessage('shippingMessage', 'Enter a valid order ID from your assigned orders.', false);
      return;
    }

    if (order.status !== 'ESCROW_FROZEN') {
      showMessage('shippingMessage', 'Ship is allowed only when order status is ESCROW_FROZEN.', false);
      return;
    }

    await apiFetch(`/orders/${order.id}/ship`, {
      method: 'POST',
      body: {}
    });

    showMessage('shippingMessage', `Order #${order.id} shipped successfully.`, true);

    await loadOrders();

    const updatedOrder =
      state.orders.find(item => String(item.id) === String(order.id)) ||
      { ...order, status: 'SHIPPED' };

    syncOrderPreview(updatedOrder);

    if (el('proofOrderCode')) {
      el('proofOrderCode').value = String(order.id);
    }
  }

  function handlePdfSelection(file) {
    if (!file) return;

    const isPdf =
      file.type === 'application/pdf' ||
      String(file.name || '').toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      showMessage('proofMessage', 'Only PDF files are allowed here.', false);
      return;
    }

    state.selectedPdf = file;
    setText('pdfFileName', file.name);
    showMessage(
      'proofMessage',
      'PDF selected. Backend still needs a proof_url, so you will paste a file link when submitting.',
      null
    );
  }

  async function submitProof() {
    const orderInput = el('proofOrderCode')?.value;
    const order = findOrderByInputValue(orderInput);

    if (!order) {
      showMessage('proofMessage', 'Enter a valid shipped order ID first.', false);
      return;
    }

    if (order.status !== 'SHIPPED') {
      showMessage('proofMessage', 'Proof is allowed only when order status is SHIPPED.', false);
      return;
    }

    const proofUrl = window.prompt('Paste the uploaded proof URL required by backend (proof_url):');

    if (!proofUrl || !proofUrl.trim()) {
      showMessage('proofMessage', 'Backend requires proof_url. Upload the file somewhere, then paste its URL.', false);
      return;
    }

    await apiFetch(`/orders/${order.id}/proof`, {
      method: 'POST',
      body: {
        proof_url: proofUrl.trim()
      }
    });

    setText('proofPrevKind', el('proofKind')?.value || 'Proof');
    setText('proofPrevFile', state.selectedPdf?.name || proofUrl.trim());
    setText('proofPrevDesc', el('proofDescription')?.value?.trim() || '—');

    const badge = el('proofPreviewBadge');
    if (badge) {
      badge.className = 'px-3 py-2 rounded-full text-xs font-bold uppercase tracking-[0.2em] bg-green-100 text-green-700';
      badge.textContent = 'Submitted';
    }

    showMessage('proofMessage', `Proof submitted for order #${order.id}.`, true);

    await loadOrders();

    const updatedOrder =
      state.orders.find(item => String(item.id) === String(order.id)) ||
      { ...order, status: 'DELIVERED_PENDING' };

    syncOrderPreview(updatedOrder);
  }

  function getCurrentPositionInto(latSelector, lngSelector, messageId, successText) {
    if (!navigator.geolocation) {
      showMessage(messageId, 'Geolocation is not supported on this browser.', false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const latNode = document.querySelector(latSelector);
        const lngNode = document.querySelector(lngSelector);

        if (latNode) latNode.value = position.coords.latitude.toFixed(6);
        if (lngNode) lngNode.value = position.coords.longitude.toFixed(6);

        if (messageId) {
          showMessage(messageId, successText, true);
        }

        setText('customerPosition', formatCoord(position.coords.latitude, position.coords.longitude));
        syncManualPreviewFields();
      },
      error => {
        showMessage(messageId, `GPS access failed: ${error.message}`, false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  function buildTopNav() {
    const nav = document.getElementById('topViewNav');
    if (!nav) return;

    const items = [
      ['home-view', 'Home'],
      ['shipping-view', 'Shipping'],
      ['proof-view', 'Proof'],
      ['gps-view', 'GPS'],
      ['profile-view', 'Profile']
    ];

    nav.innerHTML = items
      .map(([id, label]) => {
        return `<button class="view-nav-btn px-4 py-2 rounded-2xl border border-white/10 bg-white/5 text-white/80 uppercase text-[11px] tracking-[0.18em] font-bold hover:bg-white/10 transition-all" data-view="${id}">${label}</button>`;
      })
      .join('');
  }

  function setActiveNav(viewId) {
    document.querySelectorAll('.view-nav-btn').forEach(btn => btn.classList.remove('active-nav'));
    const active = document.querySelector(`.view-nav-btn[data-view="${viewId}"]`);
    if (active) active.classList.add('active-nav');
  }

  function goToView(viewId) {
    const order = ['home-view', 'shipping-view', 'proof-view', 'gps-view', 'profile-view'];
    const index = order.indexOf(viewId);
    if (index === -1) return;

    const track = el('views-track');
    if (track) {
      track.style.transform = `translateX(-${index * 100}vw)`;
    }

    setActiveNav(viewId);
  }

  function attachUi() {
    buildTopNav();

    document.addEventListener('click', function (e) {
      const navBtn = e.target.closest('.view-nav-btn');
      if (navBtn) {
        goToView(navBtn.dataset.view);
      }

      const homeBtn = e.target.closest('.home-nav-btn');
      if (homeBtn) {
        goToView(homeBtn.dataset.view);
      }
    });

    if (el('logoutBtn')) {
      el('logoutBtn').addEventListener('click', async function () {
        const confirmed = window.confirm('Are you sure you want to logout?');
        if (!confirmed) return;
        await logoutUser();
      });
    }

    if (el('startShippingBtn')) {
      el('startShippingBtn').addEventListener('click', async function () {
        try {
          await startShipping();
        } catch (err) {
          showMessage('shippingMessage', err.message, false);
        }
      });
    }

    if (el('submitProofBtn')) {
      el('submitProofBtn').addEventListener('click', async function () {
        try {
          await submitProof();
        } catch (err) {
          showMessage('proofMessage', err.message, false);
        }
      });
    }

    if (el('choosePdfBtn') && el('proofPdf')) {
      el('choosePdfBtn').addEventListener('click', function () {
        el('proofPdf').click();
      });

      el('proofPdf').addEventListener('change', function (e) {
        handlePdfSelection(e.target.files?.[0]);
      });
    }

    const dropzone = el('pdfDropzone');
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, function (e) {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, function (e) {
          e.preventDefault();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', function (e) {
        handlePdfSelection(e.dataTransfer?.files?.[0]);
      });
    }

    if (el('capturePickupGpsBtn')) {
      el('capturePickupGpsBtn').addEventListener('click', function () {
        getCurrentPositionInto('#fromLat', '#fromLng', 'shippingMessage', 'Pickup GPS captured from browser location.');
      });
    }

    if (el('captureLiveGpsBtn')) {
      el('captureLiveGpsBtn').addEventListener('click', function () {
        getCurrentPositionInto('#liveLat', '#liveLng', 'positionMessage', 'Current live position captured from browser location.');
      });
    }

    if (el('useBrowserLiveGpsBtn')) {
      el('useBrowserLiveGpsBtn').addEventListener('click', function () {
        getCurrentPositionInto('#liveLat', '#liveLng', 'positionMessage', 'Live GPS inserted successfully.');
      });
    }

    if (el('pushLocationBtn')) {
      el('pushLocationBtn').addEventListener('click', function () {
        const lat = el('liveLat')?.value;
        const lng = el('liveLng')?.value;
        const status = el('liveStatus')?.value || 'On The Way';

        if (!lat || !lng) {
          showMessage('positionMessage', 'Insert current latitude and longitude.', false);
          return;
        }

        setText('customerPosition', formatCoord(lat, lng));
        setText('customerStatus', status);
        setText('customerUpdatedAt', new Date().toLocaleString());
        showMessage('positionMessage', 'Position updated locally in the UI.', true);
      });
    }

    if (el('autoSimulateBtn')) {
      el('autoSimulateBtn').addEventListener('click', function () {
        const fromLat = Number(el('fromLat')?.value);
        const fromLng = Number(el('fromLng')?.value);
        const toLat = Number(el('toLat')?.value);
        const toLng = Number(el('toLng')?.value);

        if ([fromLat, fromLng, toLat, toLng].some(Number.isNaN)) {
          showMessage('positionMessage', 'Valid pickup and destination GPS values are required.', false);
          return;
        }

        const midLat = ((fromLat + toLat) / 2).toFixed(6);
        const midLng = ((fromLng + toLng) / 2).toFixed(6);

        if (el('liveLat')) el('liveLat').value = midLat;
        if (el('liveLng')) el('liveLng').value = midLng;
        if (el('liveStatus')) el('liveStatus').value = 'On The Way';

        setText('customerPosition', formatCoord(midLat, midLng));
        setText('customerStatus', 'On The Way');
        setText('customerUpdatedAt', new Date().toLocaleString());
        showMessage('positionMessage', 'Progress simulated locally in the UI.', true);
      });
    }

    ['shipFromText', 'shipToText', 'fromLat', 'fromLng', 'toLat', 'toLng'].forEach(id => {
      const node = el(id);
      if (node) {
        node.addEventListener('input', syncManualPreviewFields);
      }
    });
  }

  async function init() {
    if (!TOKEN) {
      window.location.href = 'login.html';
      return;
    }

    try {
      attachUi();
      await loadMe();
      await loadProfile();
      await loadOrders();
      syncManualPreviewFields();
      setText('heroStatus', 'Online');
      goToView('home-view');
      console.log('Courier dashboard connected to backend:', API_BASE);
    } catch (err) {
      console.error(err);
      alert(`Courier integration error: ${err.message}`);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();