(function () {
  const BASE_URL = "https://dhamanpay.onrender.com/api";
  const LOGIN_PAGE = "login.html";

  const state = {
    me: null,
    orders: [],
    disputes: [],
    transactions: [],
    selectedOrder: null
  };

  const $ = (id) => document.getElementById(id);

  function getToken() {
    return localStorage.getItem("token");
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? "—";
  }

  function value(id) {
    return ($(id)?.value || "").trim();
  }

  function money(v) {
    const n = Number(v || 0);
    return `${n.toLocaleString()} DZD`;
  }

  function safe(v) {
    return String(v ?? "—")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function showMessage(msg, ok = true) {
    const box = $("adminMessage");
    if (!box) return alert(msg);

    box.classList.remove("hidden", "success", "error");
    box.classList.add(ok ? "success" : "error");
    box.textContent = msg;

    setTimeout(() => box.classList.add("hidden"), 3500);
  }

  async function api(endpoint, method = "GET", body = null) {
    const token = getToken();

    if (!token) {
      window.location.href = LOGIN_PAGE;
      throw new Error("No token found. Please login.");
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : null
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      throw new Error("Backend returned invalid JSON.");
    }

    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = LOGIN_PAGE;
      throw new Error("Session expired.");
    }

    if (!res.ok || data.success === false) {
      throw new Error(data.message || `Request failed: ${res.status}`);
    }

    return data;
  }

  function normalizeOrder(o) {
    return {
      ...o,
      id: o.id,
      status: String(o.status || "UNKNOWN").toUpperCase(),
      amount: o.amount ?? o.total_amount ?? 0,
      product: o.product_name || o.product || "Order",
      customerId: o.customer_id || o.customer?.id,
      merchantId: o.merchant_id || o.merchant?.id,
      address: o.delivery_address || o.address || "—"
    };
  }

  function statusClass(status) {
    return String(status || "").toLowerCase();
  }

  function computeStats() {
    return {
      total: state.orders.length,
      pendingRelease: state.orders.filter(o =>
        ["DELIVERED_PENDING", "DISPUTE_OPEN"].includes(o.status)
      ).length,
      openDisputes: state.orders.filter(o => o.status === "DISPUTE_OPEN").length || state.disputes.length,
      completed: state.orders.filter(o => o.status === "COMPLETED").length,
      created: state.orders.filter(o => o.status === "CREATED").length,
      frozen: state.orders.filter(o => o.status === "ESCROW_FROZEN").length,
      deliveredPending: state.orders.filter(o => o.status === "DELIVERED_PENDING").length,
      tx: state.transactions.length
    };
  }

  function renderStats() {
    const s = computeStats();

    setText("heroOrders", s.total);
    setText("heroOpenDisputes", s.openDisputes);
    setText("heroPendingReleases", s.pendingRelease);
    setText("heroCompleted", s.completed);

    setText("statTotalOrders", s.total);
    setText("statPendingRelease", s.pendingRelease);
    setText("statOpenDisputes", s.openDisputes);
    setText("statTransactions", s.tx);

    setText("overviewCreated", s.created);
    setText("overviewFrozen", s.frozen);
    setText("overviewDeliveredPending", s.deliveredPending);
    setText("overviewCompleted", s.completed);

    setText("disputeOpenCount", s.openDisputes);
    setText("disputeTotalCount", state.disputes.length);
    setText("disputeWrongItemCount", state.disputes.filter(d =>
      String(d.reason || "").toLowerCase().includes("wrong")
    ).length);
    setText("disputeNeedsAdminCount", s.openDisputes);
  }

  async function loadProfile() {
    const res = await api("/me");
    const admin = res.data || {};
    state.me = admin;

    setText("adminName", admin.full_name || "Admin");
    setText("heroAdminName", admin.full_name || "Admin");
    setText("heroAdminRole", String(admin.role || "admin").toUpperCase());

    setText("adminProfileName", admin.full_name || "Admin");
    setText("adminProfileRole", String(admin.role || "admin").toUpperCase());
    setText("adminProfileEmail", admin.email);
    setText("adminProfilePhone", admin.phone);
    setText("adminProfileId", admin.id);

    setText("adminCardName", admin.full_name || "Admin");
    setText("adminCardRole", String(admin.role || "admin").toUpperCase());
  }

  async function loadOrders() {
    const res = await api("/orders");
    state.orders = Array.isArray(res.data) ? res.data.map(normalizeOrder) : [];

    renderOrders();
    renderQueue();
    renderStats();
  }

  async function loadDisputes() {
    try {
      const res = await api("/disputes");
      state.disputes = Array.isArray(res.data) ? res.data : [];
    } catch {
      state.disputes = [];
    }

    renderDisputes();
    renderStats();
  }

  async function loadTransactions() {
    try {
      const res = await api("/transactions");
      state.transactions = Array.isArray(res.data) ? res.data : [];
    } catch {
      state.transactions = [];
    }

    renderTransactions();
    renderStats();
  }

  function renderOrders() {
    const box = $("ordersList");
    if (!box) return;

    const q = value("ordersSearch").toLowerCase();
    const filter = value("ordersStatusFilter").toUpperCase();

    const list = state.orders.filter(o => {
      const matchSearch =
        !q ||
        String(o.id).includes(q) ||
        String(o.product).toLowerCase().includes(q) ||
        String(o.customerId).includes(q) ||
        String(o.merchantId).includes(q);

      const matchStatus = !filter || o.status === filter;

      return matchSearch && matchStatus;
    });

    if (!list.length) {
      box.innerHTML = `<div class="empty-state">No orders found.</div>`;
      return;
    }

    box.innerHTML = list.map(o => `
      <div class="list-card">
        <div class="list-head">
          <div>
            <p class="list-title">Order #${safe(o.id)} · ${safe(o.product)}</p>
            <div class="meta">
              <span>Amount: ${safe(money(o.amount))}</span>
              <span>Customer: ${safe(o.customerId)}</span>
              <span>Merchant: ${safe(o.merchantId)}</span>
            </div>
            <p class="dp-muted">${safe(o.address)}</p>
          </div>
          <span class="badge-status ${statusClass(o.status)}">${safe(o.status)}</span>
        </div>
        <button class="dp-gold-btn small-pill" data-load-order="${safe(o.id)}">Load for release</button>
      </div>
    `).join("");
  }

  function renderQueue() {
    const box = $("adminQueueList");
    if (!box) return;

    const list = state.orders.filter(o =>
      ["DELIVERED_PENDING", "DISPUTE_OPEN"].includes(o.status)
    );

    if (!list.length) {
      box.innerHTML = `<div class="empty-state">No money release queue yet.</div>`;
      return;
    }

    box.innerHTML = list.map(o => `
      <div class="list-card">
        <div class="list-head">
          <div>
            <p class="list-title">Order #${safe(o.id)} ready for admin decision</p>
            <div class="meta">
              <span>${safe(o.status)}</span>
              <span>${safe(money(o.amount))}</span>
            </div>
          </div>
          <button class="dp-gold-btn small-pill" data-load-order="${safe(o.id)}">Open</button>
        </div>
      </div>
    `).join("");
  }

  function renderDisputes() {
    const box = $("disputesList");
    if (!box) return;

    const list = state.disputes;

    if (!list.length) {
      box.innerHTML = `<div class="empty-state">No disputes loaded.</div>`;
      return;
    }

    box.innerHTML = list.map(d => `
      <div class="list-card">
        <p class="list-title">Dispute #${safe(d.id)} · Order #${safe(d.order_id)}</p>
        <p class="dp-muted">${safe(d.reason || d.description || "No reason")}</p>
        <div class="meta">
          <span>Status: ${safe(d.status || "OPEN")}</span>
        </div>
        ${d.order_id ? `<button class="dp-gold-btn small-pill" data-load-order="${safe(d.order_id)}">Load order</button>` : ""}
      </div>
    `).join("");
  }

  function renderTransactions() {
    const box = $("transactionsList");
    if (!box) return;

    if (!state.transactions.length) {
      box.innerHTML = `<div class="empty-state">No transactions loaded.</div>`;
      return;
    }

    box.innerHTML = state.transactions.map(tx => `
      <div class="list-card">
        <p class="list-title">${safe(tx.type || tx.tx_type || "Transaction")} · ${safe(money(tx.amount))}</p>
        <div class="meta">
          <span>User: ${safe(tx.user_id || tx.wallet_user_id)}</span>
          <span>Order: ${safe(tx.order_id)}</span>
          <span>${safe(tx.created_at || "")}</span>
        </div>
      </div>
    `).join("");
  }

  async function loadSingleOrder(id = null) {
    const orderId = id || value("actionOrderId");

    if (!orderId) {
      showMessage("Enter order ID first.", false);
      return;
    }

    try {
      const res = await api(`/orders/${encodeURIComponent(orderId)}`);
      const order = normalizeOrder(res.data || {});
      state.selectedOrder = order;

      if ($("actionOrderId")) $("actionOrderId").value = order.id || orderId;

      setText("selectedOrderStatus", order.status);
      setText("selectedOrderAmount", money(order.amount));
      setText("selectedOrderCustomer", order.customerId);
      setText("selectedOrderMerchant", order.merchantId);

      updateButtons(order);
      showMessage("Order loaded ✔");
      goToView("releases-view");
    } catch (e) {
      console.error(e);
      state.selectedOrder = null;
      updateButtons(null);
      showMessage(e.message || "Order loading failed.", false);
    }
  }

  function updateButtons(order) {
    const releaseBtn = $("releaseBtn");
    const refundBtn = $("refundBtn");

    if (releaseBtn) {
      releaseBtn.disabled = !order || !["DELIVERED_PENDING", "DISPUTE_OPEN"].includes(order.status);
    }

    if (refundBtn) {
      refundBtn.disabled = !order || order.status !== "DISPUTE_OPEN";
    }
  }

  async function settle(action) {
    const order = state.selectedOrder;

    if (!order?.id) {
      showMessage("Load an order first.", false);
      return;
    }

    const note = value("adminNote");

    if (!note) {
      showMessage("Admin note is required.", false);
      return;
    }

    try {
      await api(`/orders/${encodeURIComponent(order.id)}/${action}`, "POST", {
        admin_note: note
      });

      showMessage(action === "release" ? "Money released ✔" : "Order refunded ✔");

      await loadSingleOrder(order.id);
      await loadOrders();
      await loadDisputes();
      await loadTransactions();
    } catch (e) {
      console.error(e);
      showMessage(e.message || `${action} failed.`, false);
    }
  }

  async function loadWallet() {
    const userId = value("walletUserIdInput");

    if (!userId) {
      showMessage("Enter user ID.", false);
      return;
    }

    try {
      const res = await api(`/wallets/${encodeURIComponent(userId)}`);
      const w = res.data || {};

      setText("walletAvailable", money(w.available_balance));
      setText("walletFrozen", money(w.frozen_balance));

      showMessage("Wallet loaded ✔");
    } catch (e) {
      console.error(e);
      showMessage(e.message || "Wallet loading failed.", false);
    }
  }

  async function addMoneyUI() {
    const userId = value("addMoneyUserId");
    const amount = Number(value("addMoneyAmount"));

    if (!userId || !amount || amount <= 0) {
      showMessage("Enter valid user ID and amount.", false);
      return;
    }

    try {
      await api("/wallets/add-money", "POST", {
        user_id: Number(userId),
        amount
      });

      showMessage("Money added ✔");
      await loadTransactions();

      if (value("walletUserIdInput") === userId) {
        await loadWallet();
      }
    } catch (e) {
      console.error(e);
      showMessage(e.message || "Add money failed.", false);
    }
  }

  function buildNav() {
    document.querySelectorAll("[data-view-link]").forEach(btn => {
      btn.addEventListener("click", () => goToView(btn.dataset.viewLink));
    });
  }

  function goToView(id) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    $(id)?.classList.add("active");

    document.querySelectorAll("[data-view-link]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.viewLink === id);
    });
  }

  function hideLoader() {
    const loader = $("loader");
    if (loader) loader.classList.add("hide");
  }

  async function loadAll() {
    await loadProfile();
    await Promise.allSettled([
      loadOrders(),
      loadDisputes(),
      loadTransactions()
    ]);
    renderStats();
  }

  function bindEvents() {
    buildNav();

    $("refreshProfileBtn")?.addEventListener("click", loadProfile);
    $("refreshAllBtn")?.addEventListener("click", loadAll);
    $("refreshOrdersBtn")?.addEventListener("click", loadOrders);
    $("refreshDisputesBtn")?.addEventListener("click", loadDisputes);
    $("refreshTransactionsBtn")?.addEventListener("click", loadTransactions);

    $("checkOrderBtn")?.addEventListener("click", () => loadSingleOrder());
    $("releaseBtn")?.addEventListener("click", () => settle("release"));
    $("refundBtn")?.addEventListener("click", () => settle("refund"));

    $("loadWalletBtn")?.addEventListener("click", loadWallet);
    $("addMoneyBtn")?.addEventListener("click", addMoneyUI);

    $("ordersSearch")?.addEventListener("input", renderOrders);
    $("ordersStatusFilter")?.addEventListener("change", renderOrders);

    $("logoutBtn")?.addEventListener("click", () => {
      localStorage.removeItem("token");
      window.location.href = LOGIN_PAGE;
    });

    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-load-order]");
      if (btn) loadSingleOrder(btn.dataset.loadOrder);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      bindEvents();
      goToView("home-view");

      if (!getToken()) {
        window.location.href = LOGIN_PAGE;
        return;
      }

      await loadAll();
    } catch (e) {
      console.error(e);
      showMessage(e.message || "Admin page failed.", false);
    } finally {
      hideLoader();
    }
  });
})();