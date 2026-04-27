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


// ======================
// LOAD PROFILE
// ======================
async function loadProfile() {
  try {
    const res = await getMe();
    user = res.data;

    console.log("CUSTOMER:", user);

    // HERO
    setText("heroCustomerName", user.full_name);

    // PROFILE
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
  if (!container) return;

  container.innerHTML = "";

  if (!orders.length) {
    document.getElementById("emptyState").style.display = "block";
    return;
  }

  document.getElementById("emptyState").style.display = "none";

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

  if (order.status === "DELIVERED") {
    return `
      <button onclick="confirmOrderUI(${order.id})">Confirm</button>
      <button onclick="openDisputeUI(${order.id})">Dispute</button>
    `;
  }

  return "";
}


// ======================
// ACTIONS
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
    else if (o.status === "DISPUTED") disputed++;
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

  loadProfile();
  loadOrders();
});