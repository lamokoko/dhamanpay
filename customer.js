// ======================
// STATE
// ======================
let orders = [];
let user = null;

// ======================
// HELPERS
// ======================
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "—";
}

function showWalletMessage(text, type = "") {
  const messageEl = document.getElementById("walletMessage");
  if (!messageEl) return;

  messageEl.textContent = text;
  messageEl.className = type ? `message ${type}` : "message";
}

// ======================
// LOAD PROFILE
// ======================
async function loadProfile() {
  try {
    const res = await getMe();
    user = res.data;

    console.log("CUSTOMER:", user);

    setText("heroCustomerName", user.full_name);

    setText("customerName", user.full_name);
    setText("customerEmail", user.email);
    setText("customerPhone", user.phone);
    setText("customerId", user.id);
    setText("customerRole", user.role?.toUpperCase());

    setText("customerWilaya", user.wilaya);
    setText("customerDeliveryType", user.delivery_type);

  } catch (e) {
    console.error("PROFILE ERROR:", e);
  }
}
async function loadWallet() {
  if (!user || !user.id) return;

  try {
    const res = await getWallet(user.id);
    const wallet = res.data || res;

    setText("availableAmountText", `${wallet.available_balance ?? 0} DZD`);
    setText("payableAmountText", `${wallet.frozen_balance ?? 0} DZD`);
    setText("refundedAmountText", `${wallet.refunded_amount ?? 0} DZD`);

    setText("heroWallet", `${wallet.available_balance ?? 0} DZD`);
    setText("heroReserved", `${wallet.frozen_balance ?? 0} DZD`);
    setText("heroRefunded", `${wallet.refunded_amount ?? 0} DZD`);

  } catch (e) {
    console.error("WALLET ERROR:", e);
  }
}
// ======================
// LOAD ORDERS
// ======================
async function loadOrders() {
  try {
    const res = await getOrders();
    orders = res.data || [];

    console.log("ORDERS:", orders);

    renderOrders();
    renderStats();

  } catch (e) {
    console.error("ORDERS ERROR:", e);
  }
}

// ======================
// RENDER ORDERS
// ======================
function renderOrders() {
  const container = document.getElementById("ordersList");
  const emptyState = document.getElementById("ordersEmptyState");

  if (!container) return;

  const searchValue = (document.getElementById("searchOrdersInput")?.value || "")
    .trim()
    .toLowerCase();

  const statusValue = document.getElementById("statusOrdersFilter")?.value || "all";

  const filteredOrders = orders.filter(o => {
    // Search based on ONE thing only: order ID / order code
    const orderKey = String(o.code || o.order_code || o.id || "").toLowerCase();

    const matchesSearch = !searchValue || orderKey.includes(searchValue);
    const matchesStatus = statusValue === "all" || o.status === statusValue;

    return matchesSearch && matchesStatus;
  });

  container.innerHTML = "";

  if (!filteredOrders.length) {
    if (emptyState) {
      emptyState.classList.remove("hidden");
      emptyState.textContent = "No orders match your search or filter.";
    }
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  filteredOrders.forEach(o => {
    const div = document.createElement("div");
    div.className = "list-card";

    div.innerHTML = `
      <b>#${o.id}</b> — ${o.status}<br>
      ${o.product_name || o.productName || "—"} | ${o.amount || 0} DZD<br>
      ${o.delivery_address || o.deliveryAddress || "—"}
      <div style="margin-top:10px;">
        ${actionButtons(o)}
      </div>
    `;

    container.appendChild(div);
  });
}

// ======================
// ACTION BUTTONS
// ======================
function actionButtons(order) {
  if (order.status === "SHIPPED") {
    return `
      <button onclick="confirmOrderUI(${order.id})">Confirm</button>
      <button onclick="cancelOrderUI(${order.id})">Cancel</button>
    `;
  }

  if (order.status === "DELIVERED" || order.status === "DELIVERED_PENDING") {
    return `
      <button onclick="confirmOrderUI(${order.id})">Confirm</button>
      <button onclick="openDisputeUI(${order.id})">Dispute</button>
    `;
  }

  return "";
}

// ======================
// ORDER ACTIONS
// ======================
let selectedOrder = null;

async function loadOrderAction() {
  const input = document.getElementById("actionOrderId");
  const orderId = input?.value.trim();

  if (!orderId) {
    alert("Enter an order ID first.");
    return;
  }

  try {
    const res = await getOrderById(orderId);
    const order = res.data || res;
    selectedOrder = order;

    setText("previewOrderCode", order.code || order.order_code || order.id);
    setText("previewMerchant", order.merchant_code || order.merchant_id || "—");
    setText("previewCourier", order.courier_id || "Not assigned");
    setText("previewAmount", `${order.amount || 0} DZD`);
    setText("previewStatus", order.status || "UNKNOWN");

  } catch (e) {
    console.error("LOAD ORDER ERROR:", e);
    alert(e.message || "Order not found.");
  }
}
async function confirmOrderUI(id) {
  try {
    await confirmOrder(id);
    await loadOrders();
  } catch (e) {
    alert(e.message);
  }
}

async function cancelOrderUI(id) {
  try {
    await cancelOrder(id);
    await loadOrders();
  } catch (e) {
    alert(e.message);
  }
}

async function openDisputeUI(id) {
  const reason = prompt("Enter dispute reason:");
  if (!reason) return;

  try {
    await openDispute(id, { reason });
    await loadOrders();
  } catch (e) {
    alert(e.message);
  }
}

// ======================
// STATS
// ======================
function renderStats() {
  let active = 0;
  let completed = 0;
  let disputed = 0;

  orders.forEach(o => {
    if (o.status === "COMPLETED") completed++;
    else if (o.status === "DISPUTED" || o.status === "DISPUTE_OPEN") disputed++;
    else active++;
  });

  setText("heroActive", active);
  setText("heroCompleted", completed);
  setText("heroDisputed", disputed);

  setText("activeOrders", active);
  setText("completedOrders", completed);
  setText("disputedOrders", disputed);
}

// ======================
// TOP UP MONEY
// requires window.topUpWallet(amount) in api.js
// ======================
// ======================
// TOP UP MONEY
// uses backend /wallets/add-money through window.addMoney(user.id, amount)
// ======================
async function topUpMoney() {
  const amountInput = document.getElementById("topUpAmount");

  if (!amountInput) {
    console.error("Top up amount input not found");
    return;
  }

  const amount = Number(amountInput.value);

  if (!amount || amount <= 0) {
    showWalletMessage("Please enter a valid amount.", "error");
    return;
  }

  if (!user || !user.id) {
    showWalletMessage("Profile not loaded yet. Refresh and try again.", "error");
    return;
  }

  if (typeof window.addMoney !== "function") {
    showWalletMessage("addMoney() is missing in api.js.", "error");
    return;
  }

  try {
    showWalletMessage("Adding money...");

    await window.addMoney(user.id, amount);

   showWalletMessage(`Successfully added ${amount} DZD to wallet!`, "success");
amountInput.value = "";

await loadWallet();
  } catch (e) {
    console.error("TOP UP ERROR:", e);
    showWalletMessage(e.message || "Failed to add money.", "error");
  }
}
// ======================
// LOGOUT
// ======================
function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

// ======================
// INIT
// ======================
document.addEventListener("DOMContentLoaded", async () => {
  if (!getToken()) {
    window.location.href = "login.html";
    return;
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;

  const topUpBtn = document.getElementById("topUpBtn");
  if (topUpBtn) topUpBtn.onclick = topUpMoney;

  document.getElementById("searchOrdersInput")?.addEventListener("input", renderOrders);

  document.getElementById("statusOrdersFilter")?.addEventListener("change", renderOrders);

  document.getElementById("resetOrdersBtn")?.addEventListener("click", () => {
    document.getElementById("searchOrdersInput").value = "";
    document.getElementById("statusOrdersFilter").value = "all";
    renderOrders();
    const loadOrderBtn = document.getElementById("loadOrderBtn");
if (loadOrderBtn) loadOrderBtn.onclick = loadOrderAction;
  });

  document.getElementById("refreshOrdersBtn")?.addEventListener("click", loadOrders);

  await loadProfile();
  await loadWallet();
  await loadOrders();
});