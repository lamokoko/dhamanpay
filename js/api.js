// ======================
// BASE URL
// ======================
const BASE_URL = "https://dhamanpay.onrender.com/api";


// ======================
// TOKEN HELPERS
// ======================
function getToken() {
  return localStorage.getItem("token");
}

function saveToken(token) {
  localStorage.setItem("token", token);
}

function clearToken() {
  localStorage.removeItem("token");
}


// ======================
// GENERIC REQUEST
// ======================
async function apiRequest(endpoint, method = "GET", body = null, auth = false) {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  if (auth) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const options = {
    method,
    headers
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);

  let data;
  try {
    data = await response.json();
  } catch {
    data = { message: "Invalid server response" };
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}


// ======================
// AUTH
// ======================
async function loginUser(phone, password) {
  return apiRequest("/login", "POST", { phone, password }, false);
}

async function registerUser(data) {
  return apiRequest("/register", "POST", data, false);
}

async function getMe() {
  return apiRequest("/me", "GET", null, true);
}

async function logoutUser() {
  return apiRequest("/logout", "POST", null, true);
}


// ======================
// ORDERS
// ======================
async function getOrders() {
  return apiRequest("/orders", "GET", null, true);
}

async function getOrderById(id) {
  return apiRequest(`/orders/${id}`, "GET", null, true);
}

async function getOrderHistory(id) {
  return apiRequest(`/orders/${id}/history`, "GET", null, true);
}


// ======================
// MERCHANT
// ======================
async function searchCustomers(fullName = "", phone = "") {
  let query = [];

  if (fullName) query.push(`full_name=${encodeURIComponent(fullName)}`);
  if (phone) query.push(`phone=${encodeURIComponent(phone)}`);

  const queryString = query.length ? "?" + query.join("&") : "";

  return apiRequest(`/customers/search${queryString}`, "GET", null, true);
}

async function createOrder(data) {
  return apiRequest("/orders", "POST", data, true);
}


// ======================
// CUSTOMER
// ======================
async function confirmOrder(id) {
  return apiRequest(`/orders/${id}/confirm`, "POST", {}, true);
}

async function cancelOrder(id) {
  return apiRequest(`/orders/${id}/cancel`, "POST", {}, true);
}

async function openDispute(id, data) {
  return apiRequest(`/orders/${id}/dispute`, "POST", data, true);
}


// ======================
// COURIER
// ======================
async function shipOrder(id) {
  return apiRequest(`/orders/${id}/ship`, "POST", {}, true);
}

async function submitProof(id, proofUrl) {
  return apiRequest(`/orders/${id}/proof`, "POST", {
    proof_url: proofUrl
  }, true);
}

async function getCourierProfile() {
  return apiRequest("/courier/profile", "GET", null, true);
}


// ======================
// ADMIN
// ======================
async function releaseOrder(id, note) {
  return apiRequest(`/orders/${id}/release`, "POST", {
    admin_note: note
  }, true);
}

async function refundOrder(id, note) {
  return apiRequest(`/orders/${id}/refund`, "POST", {
    admin_note: note
  }, true);
}

async function addMoney(userId, amount) {
  return apiRequest("/wallets/add-money", "POST", {
    user_id: userId,
    amount: amount
  }, true);
}


// ======================
// WALLET / TRANSACTIONS
// ======================
async function getWallet(userId) {
  return apiRequest(`/wallets/${userId}`, "GET", null, true);
}

async function getTransactions() {
  return apiRequest("/transactions", "GET", null, true);
}

async function getDisputes() {
  return apiRequest("/disputes", "GET", null, true);
}