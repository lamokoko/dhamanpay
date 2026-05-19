const API_BASE = "https://dhamanpay.onrender.com/api";

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`
};

let ALL_ORDERS = [];
let SELECTED_ORDER = null;

function money(v) {
  return `${Number(v || 0).toFixed(2)} DZD`;
}

function getAmount(order) {
  return Number(
    order.amount ||
    order.total_amount ||
    order.gross_amount ||
    order.price ||
    0
  );
}

function getStatus(order) {
  return String(order.status || "").toUpperCase();
}

function adminFee(amount) {
  return amount * 0.018;
}

function merchantNet(amount) {
  return amount - adminFee(amount);
}

function showMessage(text, type = "success") {
  const box = document.getElementById("adminMessage");

  if (!box) {
    alert(text);
    return;
  }

  box.textContent = text;
  box.className = `message ${type}`;

  setTimeout(() => {
    box.className = "message hidden";
  }, 3500);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function isReleasedStatus(status) {
  return status === "COMPLETED" || status === "RELEASED";
}

function isPendingReleaseStatus(status) {
  return (
    status === "DELIVERED_PENDING" ||
    status === "DELIVERED" ||
    status === "CONFIRMED"
  );
}

function normalizeOrdersResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.orders)) return data.orders;
  return [];
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || data.error || "Request failed");
  }

  return data;
}

async function loadProfile() {
  try {
    const data = await apiFetch("/me");

    const user = data.user || data.data || data;

    setText("adminName", user.name || "Admin");
    setText("heroAdminName", user.name || "Admin");
    setText("heroAdminRole", user.role || "admin");

    setText("adminProfileName", user.name || "—");
    setText("adminProfileRole", user.role || "—");
    setText("adminProfileEmail", user.email || "—");
    setText("adminProfilePhone", user.phone || "—");
    setText("adminProfileId", user.id || "—");

    setText("adminCardName", user.name || "Admin");
    setText("adminCardRole", user.role || "admin");
  } catch (err) {
    console.error(err);
  }
}

async function loadOrders() {
  try {
    const data = await apiFetch("/orders");

    ALL_ORDERS = normalizeOrdersResponse(data);

    updateStats();
    renderOrders(ALL_ORDERS);
    renderAdminQueue();

  } catch (err) {
    console.error(err);
    showMessage("Failed to load orders", "error");
  }
}

async function loadAdminWallet() {
  try {
    const data = await apiFetch("/wallet/me");

    const wallet = data.wallet || data.data || data;

    const available =
      wallet.available_balance ||
      wallet.available ||
      wallet.balance ||
      0;

    setText("adminWalletAmount", money(available));

  } catch (err) {
    calculateAdminWalletFromOrders();
  }
}

function calculateAdminWalletFromOrders() {
  let total = 0;

  ALL_ORDERS.forEach(order => {
    const status = getStatus(order);

    if (isReleasedStatus(status)) {
      total += adminFee(getAmount(order));
    }
  });

  setText("adminWalletAmount", money(total));
}

function updateStats() {
  const total = ALL_ORDERS.length;

  const pendingRelease = ALL_ORDERS.filter(o =>
    isPendingReleaseStatus(getStatus(o))
  ).length;

  const disputes = ALL_ORDERS.filter(o =>
    getStatus(o) === "DISPUTE_OPEN"
  ).length;

  const completed = ALL_ORDERS.filter(o =>
    isReleasedStatus(getStatus(o))
  ).length;

  const created = ALL_ORDERS.filter(o =>
    getStatus(o) === "CREATED"
  ).length;

  const frozen = ALL_ORDERS.filter(o =>
    getStatus(o) === "ESCROW_FROZEN"
  ).length;

  setText("heroOrders", total);
  setText("heroOpenDisputes", disputes);
  setText("heroPendingReleases", pendingRelease);
  setText("heroCompleted", completed);

  setText("statTotalOrders", total);
  setText("statPendingRelease", pendingRelease);
  setText("statOpenDisputes", disputes);
  setText("statTransactions", completed);

  setText("overviewCreated", created);
  setText("overviewFrozen", frozen);
  setText("overviewDeliveredPending", pendingRelease);
  setText("overviewCompleted", completed);

  setText("disputeOpenCount", disputes);
  setText("disputeTotalCount", disputes);

  calculateAdminWalletFromOrders();
}

function renderOrders(orders) {
  const container = document.getElementById("ordersList");
  if (!container) return;

  const search = String(document.getElementById("ordersSearch")?.value || "")
    .toLowerCase()
    .trim();

  const filter = String(
    document.getElementById("ordersStatusFilter")?.value || "all"
  ).toUpperCase();

  const filtered = orders.filter(order => {
    const status = getStatus(order);

    const matchesStatus =
      filter === "ALL" || filter === "all".toUpperCase() || status === filter;

    const text = `
      ${order.id}
      ${order.order_code || ""}
      ${status}
      ${order.customer_id || ""}
      ${order.merchant_id || ""}
      ${order.customer?.name || ""}
      ${order.merchant?.name || ""}
    `.toLowerCase();

    const matchesSearch = !search || text.includes(search);

    return matchesStatus && matchesSearch;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        No orders found.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(order => {
    const amount = getAmount(order);
    const fee = adminFee(amount);
    const net = merchantNet(amount);
    const status = getStatus(order);
    const canRelease = isPendingReleaseStatus(status);

    return `
      <div class="list-card">
        <div class="list-head">
          <div>
            <div class="list-title">
              Order #${order.id}
            </div>

            <div class="meta">
              <span>Customer: ${order.customer?.name || order.customer_id || "—"}</span>
              <span>Merchant: ${order.merchant?.name || order.merchant_id || "—"}</span>
              <span>Total: ${money(amount)}</span>
              <span>Admin Fee 1.8%: ${money(fee)}</span>
              <span>Merchant Gets: ${money(net)}</span>
            </div>
          </div>

          <span class="badge-status ${status.toLowerCase()}">
            ${status || "UNKNOWN"}
          </span>
        </div>

        <div class="actions-row">
          <button class="dp-ghost-btn" onclick="selectOrder(${order.id})">
            Check
          </button>

          ${
            canRelease
              ? `
                <button class="dp-gold-btn" onclick="releaseOrder(${order.id})">
                  Release Money
                </button>
              `
              : `
                <button class="dp-ghost-btn" disabled>
                  Not Releasable
                </button>
              `
          }
        </div>
      </div>
    `;
  }).join("");
}

function renderAdminQueue() {
  const container = document.getElementById("adminQueueList");
  if (!container) return;

  const queue = ALL_ORDERS.filter(order =>
    isPendingReleaseStatus(getStatus(order))
  );

  if (!queue.length) {
    container.innerHTML = `
      <div class="empty-state">
        No pending releases.
      </div>
    `;
    return;
  }

  container.innerHTML = queue.map(order => {
    const amount = getAmount(order);

    return `
      <div class="list-card">
        <div class="list-head">
          <div>
            <div class="list-title">Order #${order.id}</div>
            <div class="meta">
              <span>Status: ${getStatus(order)}</span>
              <span>Total: ${money(amount)}</span>
              <span>Admin Fee: ${money(adminFee(amount))}</span>
            </div>
          </div>

          <button class="dp-gold-btn" onclick="selectOrder(${order.id})">
            Review
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function selectOrder(orderId) {
  const order = ALL_ORDERS.find(o => String(o.id) === String(orderId));

  if (!order) {
    showMessage("Order not found", "error");
    return;
  }

  SELECTED_ORDER = order;

  const amount = getAmount(order);

  const input = document.getElementById("actionOrderId");
  if (input) input.value = order.id;

  setText("selectedOrderStatus", getStatus(order));
  setText("selectedOrderAmount", money(amount));
  setText("selectedOrderCustomer", order.customer?.name || order.customer_id || "—");
  setText("selectedOrderMerchant", order.merchant?.name || order.merchant_id || "—");

  showView("releases-view");
}

function checkOrderFromInput() {
  const id = document.getElementById("actionOrderId")?.value;

  if (!id) {
    showMessage("Enter order ID first", "error");
    return;
  }

  selectOrder(id);
}

async function releaseOrder(orderId) {
  try {
    const order =
      ALL_ORDERS.find(o => String(o.id) === String(orderId)) ||
      SELECTED_ORDER;

    if (!order) {
      showMessage("Order not found", "error");
      return;
    }

    const amount = getAmount(order);
    const fee = adminFee(amount);
    const net = merchantNet(amount);

    const note =
      document.getElementById("adminNote")?.value ||
      "Released by admin";

    const ok = confirm(
      `Release Order #${order.id}?\n\n` +
      `Total: ${money(amount)}\n` +
      `Admin Wallet gets 1.8%: ${money(fee)}\n` +
      `Merchant gets: ${money(net)}`
    );

    if (!ok) return;

    await apiFetch(`/orders/${order.id}/release`, {
      method: "POST",
      body: JSON.stringify({
        admin_note: note,
        admin_fee: fee,
        merchant_net_amount: net
      })
    });

    order.status = "COMPLETED";

    updateStats();
    renderOrders(ALL_ORDERS);
    renderAdminQueue();
    await loadAdminWallet();

    showMessage(`Order released. Admin wallet received ${money(fee)}.`, "success");

  } catch (err) {
    console.error(err);
    showMessage(err.message || "Release failed", "error");
  }
}

async function refundSelectedOrder() {
  try {
    const order = SELECTED_ORDER;

    if (!order) {
      showMessage("Select an order first", "error");
      return;
    }

    const note =
      document.getElementById("adminNote")?.value ||
      "Refunded by admin";

    const ok = confirm(`Refund Order #${order.id}?`);
    if (!ok) return;

    await apiFetch(`/orders/${order.id}/refund`, {
      method: "POST",
      body: JSON.stringify({
        admin_note: note
      })
    });

    order.status = "REFUNDED";

    updateStats();
    renderOrders(ALL_ORDERS);
    renderAdminQueue();

    showMessage("Order refunded successfully", "success");

  } catch (err) {
    console.error(err);
    showMessage(err.message || "Refund failed", "error");
  }
}

async function loadWalletByUserId() {
  try {
    const userId = document.getElementById("walletUserIdInput")?.value;

    if (!userId) {
      showMessage("Enter user ID first", "error");
      return;
    }

    const data = await apiFetch(`/wallet/${userId}`);

    const wallet = data.wallet || data.data || data;

    setText("walletAvailable", money(wallet.available_balance || wallet.available || 0));
    setText("walletFrozen", money(wallet.frozen_balance || wallet.frozen || 0));

  } catch (err) {
    console.error(err);
    showMessage(err.message || "Failed to load wallet", "error");
  }
}

function renderDisputes() {
  const container = document.getElementById("disputesList");
  if (!container) return;

  const disputes = ALL_ORDERS.filter(o => getStatus(o) === "DISPUTE_OPEN");

  if (!disputes.length) {
    container.innerHTML = `
      <div class="empty-state">
        No open disputes.
      </div>
    `;
    return;
  }

  container.innerHTML = disputes.map(order => `
    <div class="list-card">
      <div class="list-head">
        <div>
          <div class="list-title">Dispute Order #${order.id}</div>
          <div class="meta">
            <span>Customer: ${order.customer_id || "—"}</span>
            <span>Merchant: ${order.merchant_id || "—"}</span>
            <span>Amount: ${money(getAmount(order))}</span>
          </div>
        </div>

        <span class="badge-status dispute_open">DISPUTE_OPEN</span>
      </div>
    </div>
  `).join("");
}

function renderTransactions() {
  const container = document.getElementById("transactionsList");
  if (!container) return;

  const released = ALL_ORDERS.filter(o =>
    isReleasedStatus(getStatus(o))
  );

  if (!released.length) {
    container.innerHTML = `
      <div class="empty-state">
        No released transactions yet.
      </div>
    `;
    return;
  }

  container.innerHTML = released.map(order => {
    const amount = getAmount(order);

    return `
      <div class="list-card">
        <div class="list-head">
          <div>
            <div class="list-title">Transaction Order #${order.id}</div>
            <div class="meta">
              <span>Total: ${money(amount)}</span>
              <span>Admin Fee: ${money(adminFee(amount))}</span>
              <span>Merchant Net: ${money(merchantNet(amount))}</span>
            </div>
          </div>

          <span class="badge-status completed">COMPLETED</span>
        </div>
      </div>
    `;
  }).join("");
}

function showView(id) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.remove("active");
  });

  const view = document.getElementById(id);
  if (view) view.classList.add("active");

  document.querySelectorAll("[data-view-link]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.viewLink === id);
  });

  if (id === "disputes-view") renderDisputes();
  if (id === "transactions-view") renderTransactions();
}

function setupNavigation() {
  document.querySelectorAll("[data-view-link]").forEach(btn => {
    btn.addEventListener("click", () => {
      showView(btn.dataset.viewLink);
    });
  });
}

function setupEvents() {
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "login.html";
  });

  document.getElementById("refreshProfileBtn")?.addEventListener("click", loadProfile);
  document.getElementById("refreshAllBtn")?.addEventListener("click", async () => {
    await loadOrders();
    await loadAdminWallet();
  });

  document.getElementById("refreshOrdersBtn")?.addEventListener("click", loadOrders);

  document.getElementById("ordersSearch")?.addEventListener("input", () => {
    renderOrders(ALL_ORDERS);
  });

  document.getElementById("ordersStatusFilter")?.addEventListener("change", () => {
    renderOrders(ALL_ORDERS);
  });

  document.getElementById("checkOrderBtn")?.addEventListener("click", checkOrderFromInput);

  document.getElementById("releaseBtn")?.addEventListener("click", () => {
    const id =
      document.getElementById("actionOrderId")?.value ||
      SELECTED_ORDER?.id;

    releaseOrder(id);
  });

  document.getElementById("refundBtn")?.addEventListener("click", refundSelectedOrder);

  document.getElementById("loadWalletBtn")?.addEventListener("click", loadWalletByUserId);

  document.getElementById("refreshDisputesBtn")?.addEventListener("click", () => {
    renderDisputes();
  });

  document.getElementById("refreshTransactionsBtn")?.addEventListener("click", () => {
    renderTransactions();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  setupNavigation();
  setupEvents();

  showView("home-view");

  await loadProfile();
  await loadOrders();
  await loadAdminWallet();

  const loader = document.getElementById("loader");
  if (loader) {
    setTimeout(() => loader.classList.add("hide"), 600);
  }
});

window.releaseOrder = releaseOrder;
window.selectOrder = selectOrder;