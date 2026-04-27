(function () {

const API_BASE = "https://dhamanpay.onrender.com/api";
const LOGIN_PAGE = "login.html";

let orders = [];
let merchant = null;
let selectedCustomer = null;

// =======================
// TOKEN
// =======================
function getToken() {
  return localStorage.getItem("token");
}

// =======================
// HELPERS
// =======================
function el(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const e = el(id);
  if (e) e.textContent = value ?? "—";
}

function showMessage(id, text, type = "info") {
  const box = el(id);
  if (!box) return;

  box.className = "message-box";

  if (type === "success") box.classList.add("success");
  else if (type === "error") box.classList.add("error");
  else box.classList.add("info");

  box.textContent = text;
}

// =======================
// API
// =======================
async function apiFetch(path, method = "GET", body = null) {
  const token = getToken();

  if (!token) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: body ? JSON.stringify(body) : null
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.message || "API Error");

  return data;
}

// =======================
// LOAD PROFILE
// =======================
async function loadProfile() {
  const res = await apiFetch("/me");
  merchant = res.data;

  setText("merchantName", merchant.full_name);
  setText("merchantRole", merchant.role?.toUpperCase());

  setText("merchantStoreName", merchant.store_name);
  setText("merchantEmail", merchant.email);
  setText("merchantPhone", merchant.phone);
  setText("merchantId", merchant.id);
  setText("merchantCommercialRegister", merchant.commercial_register);

  setText("merchantStoreNameCard", merchant.store_name);
  setText("merchantCommercialRegisterCard", merchant.commercial_register);

  setText("heroStoreName", merchant.store_name);
  setText("heroMerchantName", merchant.full_name);
}

// =======================
// CUSTOMER SEARCH
// =======================
async function searchCustomer() {
  const name = el("customerSearchName").value.trim();
  const phone = el("customerSearchPhone").value.trim();

  if (!name && !phone) {
    showMessage("customerSearchMessage", "Enter name or phone", "error");
    return;
  }

  try {
    const res = await apiFetch(`/customers/search?full_name=${name}&phone=${phone}`);
    const customers = res.data;

    const box = el("customerSearchResults");
    box.innerHTML = "";

    customers.forEach(c => {
      const div = document.createElement("div");
      div.className = "list-card";
      div.innerHTML = `
        <b>${c.full_name}</b><br>
        Phone: ${c.phone}<br>
        ID: ${c.id}
      `;

      div.onclick = () => {
        selectedCustomer = c;
        el("customerId").value = `${c.full_name} (#${c.id})`;
      };

      box.appendChild(div);
    });

  } catch (e) {
    showMessage("customerSearchMessage", e.message, "error");
  }
}

// =======================
// CREATE ORDER
// =======================
async function createOrder(e) {
  e.preventDefault();

  if (!selectedCustomer) {
    showMessage("formMessage", "Select a customer first", "error");
    return;
  }

  const payload = {
    customer_id: selectedCustomer.id,
    amount: Number(el("amount").value),
    delivery_address: el("deliveryAddress").value,
    product_name: el("productName").value,
    expected_serial_number: el("expectedSerialNumber").value
  };

  try {
    await apiFetch("/orders", "POST", payload);

    showMessage("formMessage", "Order created successfully", "success");

    e.target.reset();
    selectedCustomer = null;
    el("customerId").value = "";

    loadOrders();

  } catch (err) {
    showMessage("formMessage", err.message, "error");
  }
}

// =======================
// LOAD ORDERS
// =======================
async function loadOrders() {
  try {
    const res = await apiFetch("/orders");
    orders = res.data || [];

    renderOrders();
    renderStats();

  } catch (e) {
    console.error(e);
  }
}

// =======================
// RENDER ORDERS
// =======================
function renderOrders() {
  const container = el("ordersList");
  container.innerHTML = "";

  if (!orders.length) {
    el("emptyState").style.display = "block";
    return;
  }

  el("emptyState").style.display = "none";

  orders.forEach(o => {
    const div = document.createElement("div");
    div.className = "list-card";

    div.innerHTML = `
      <b>#${o.id}</b> — ${o.status}<br>
      ${o.product_name} | ${o.amount} DZD<br>
      ${o.delivery_address}
    `;

    container.appendChild(div);
  });
}

// =======================
// STATS
// =======================
function renderStats() {
  let earned = 0;
  let pending = 0;
  let active = 0;
  let completed = 0;

  orders.forEach(o => {
    if (o.status === "COMPLETED") {
      earned += o.amount;
      completed++;
    } else {
      active++;
      pending += o.amount;
    }
  });

  setText("heroEarned", earned + " DZD");
  setText("heroPending", pending + " DZD");
  setText("heroActive", active);
  setText("heroCompleted", completed);

  setText("totalEarned", earned + " DZD");
  setText("pendingEscrow", pending + " DZD");
  setText("visibleOrders", orders.length);
  setText("completedOrders", completed);
}

// =======================
// LOGOUT
// =======================
function logout() {
  localStorage.removeItem("token");
  window.location.href = LOGIN_PAGE;
}

// =======================
// INIT
// =======================
document.addEventListener("DOMContentLoaded", () => {

  if (!getToken()) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  el("searchCustomerBtn").onclick = searchCustomer;
  el("createOrderForm").onsubmit = createOrder;
  el("logoutBtn").onclick = logout;

  loadProfile();
  loadOrders();

});
})();