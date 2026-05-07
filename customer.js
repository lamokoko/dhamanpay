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
  const emptyState = document.getElementById("emptyState");

  if (!container) return;

  container.innerHTML = "";

  if (!orders.length) {
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  orders.forEach(o => {
    const div = document.createElement("div");
    div.className = "list-card";

    div.innerHTML = `
      <b>#${o.id}</b> — ${o.status}<br>
      ${o.product_name} | ${o.amount} DZD<br>
      ${o.delivery_address}
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

  if (typeof topUpWallet !== "function") {
    showWalletMessage("topUpWallet() is missing in api.js.", "error");
    return;
  }

  try {
    showWalletMessage("Adding money...");

    await topUpWallet(amount);

    showWalletMessage(`Successfully added ${amount} DZD to wallet!`, "success");
    amountInput.value = "";

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
document.addEventListener("DOMContentLoaded", () => {
  if (!getToken()) {
    window.location.href = "login.html";
    return;
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;

  const topUpBtn = document.getElementById("topUpBtn");
  if (topUpBtn) topUpBtn.onclick = topUpMoney;

  loadProfile();
  loadOrders();
});