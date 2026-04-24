// =========================
// CONFIG
// =========================
const BASE_URL = "https://dhamanpay.onrender.com/api";

// =========================
// TOKEN HELPERS
// =========================
function getToken() {
  return localStorage.getItem("token");
}

// =========================
// GENERIC REQUEST FUNCTION
// =========================
async function apiRequest(endpoint, method = "GET", body = null) {
  const token = getToken();

  if (!token) {
    throw new Error("No token found. Please login.");
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : null
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.message || "API error");
  }

  return data;
}

// =========================
// API FUNCTIONS
// =========================
async function getMe() {
  return apiRequest("/me");
}

async function getOrders() {
  return apiRequest("/orders");
}

async function getDisputes() {
  return apiRequest("/disputes");
}

async function getTransactions() {
  return apiRequest("/transactions");
}

async function getOrderById(id) {
  return apiRequest(`/orders/${id}`);
}

async function releaseOrder(id, note) {
  return apiRequest(`/orders/${id}/release`, "POST", { admin_note: note });
}

async function refundOrder(id, note) {
  return apiRequest(`/orders/${id}/refund`, "POST", { admin_note: note });
}

async function getWallet(userId) {
  return apiRequest(`/wallets/${userId}`);
}

async function addMoney(userId, amount) {
  return apiRequest("/wallets/add-money", "POST", {
    user_id: Number(userId),
    amount: Number(amount)
  });
}

async function logoutUser() {
  return apiRequest("/logout", "POST", {});
}

// =========================
// STATE
// =========================
let orders = [];
let disputes = [];
let transactions = [];
let selectedOrder = null;

// =========================
// UI HELPERS
// =========================
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "—";
}

function showMessage(msg, success = true) {
  const box = document.getElementById("adminMessage");
  if (!box) return;

  box.classList.remove("hidden");
  box.style.background = success ? "#d1fae5" : "#fee2e2";
  box.style.color = success ? "#065f46" : "#7f1d1d";
  box.textContent = msg;

  setTimeout(() => box.classList.add("hidden"), 3000);
}

// =========================
// LOAD DASHBOARD DATA
// =========================
async function loadDashboard() {
  const me = await getMe();
  setText("adminName", me.data.full_name);

  const ordersRes = await getOrders();
  orders = ordersRes.data || [];

  const disputesRes = await getDisputes();
  disputes = disputesRes.data || [];

  const txRes = await getTransactions();
  transactions = txRes.data || [];

  renderStats();
}

// =========================
// RENDER FUNCTIONS
// =========================
function renderStats() {
  const pending = orders.filter(o =>
    o.status === "DELIVERED_PENDING" || o.status === "DISPUTE_OPEN"
  ).length;

  const openDisputes = disputes.length;

  setText("heroPendingReleases", pending);
  setText("heroOpenDisputes", openDisputes);
  setText("heroAutoReleasesDue", pending);
  setText("heroFlags", 0);

  setText("overviewPendingReleases", pending);
  setText("overviewOpenDisputes", openDisputes);
  setText("overviewAutoReleasesDue", pending);
}

// =========================
// ORDER ACTIONS
// =========================
async function loadOrderDetails() {
  const id = document.getElementById("actionOrderId").value;
  if (!id) return showMessage("Enter order ID", false);

  const res = await getOrderById(id);
  selectedOrder = res.data;

  setText("selectedOrderStatus", selectedOrder.status);
  setText("selectedOrderAmount", selectedOrder.amount + " DZD");
  setText("selectedOrderCustomer", selectedOrder.customer_id);
  setText("selectedOrderMerchant", selectedOrder.merchant_id);

  document.getElementById("releaseBtn").disabled = false;
  document.getElementById("refundBtn").disabled = false;
}

async function handleRelease() {
  if (!selectedOrder) return;

  const note = document.getElementById("adminNote").value;
  if (!note) return showMessage("Add admin note", false);

  await releaseOrder(selectedOrder.id, note);
  showMessage("Order released ✔");

  await loadDashboard();
}

async function handleRefund() {
  if (!selectedOrder) return;

  const note = document.getElementById("adminNote").value;
  if (!note) return showMessage("Add admin note", false);

  await refundOrder(selectedOrder.id, note);
  showMessage("Order refunded ✔");

  await loadDashboard();
}

// =========================
// WALLET
// =========================
async function loadWalletUI() {
  const id = document.getElementById("walletUserIdInput").value;
  if (!id) return;

  const res = await getWallet(id);
  setText("walletAvailable", res.data.available_balance + " DZD");
  setText("walletFrozen", res.data.frozen_balance + " DZD");
}

async function addMoneyUI() {
  const id = document.getElementById("addMoneyUserId").value;
  const amount = document.getElementById("addMoneyAmount").value;

  if (!id || !amount) return;

  await addMoney(id, amount);
  showMessage("Money added ✔");
}

// =========================
// LOGOUT
// =========================
async function logout() {
  await logoutUser();
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

// =========================
// EVENTS
// =========================
function attachEvents() {
  document.getElementById("checkOrderBtn")?.addEventListener("click", loadOrderDetails);
  document.getElementById("releaseBtn")?.addEventListener("click", handleRelease);
  document.getElementById("refundBtn")?.addEventListener("click", handleRefund);

  document.getElementById("loadWalletBtn")?.addEventListener("click", loadWalletUI);
  document.getElementById("addMoneyBtn")?.addEventListener("click", addMoneyUI);

  document.getElementById("logoutBtn")?.addEventListener("click", logout);
}

// =========================
// INIT WITH FIXED LOADER
// =========================
async function init() {
  const loader = document.getElementById("loader");
  const bar = document.getElementById("loader-bar");

  try {
    // animate loader bar
    if (bar) bar.style.width = "100%";

    attachEvents();

    if (!getToken()) {
      throw new Error("Not logged in");
    }

    await loadDashboard();

  } catch (err) {
    console.error(err);
    showMessage(err.message, false);
  } finally {
    // 🔥 ALWAYS REMOVE LOADER
    setTimeout(() => {
      if (loader) loader.style.transform = "translateY(-100%)";
    }, 900);
  }
}

// START
document.addEventListener("DOMContentLoaded", init);