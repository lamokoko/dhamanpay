
const API_BASE = "https://dhamanpay.onrender.com/api";

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`
};

function money(v) {
  return `${Number(v || 0).toFixed(2)} DZD`;
}

let ALL_ORDERS = [];

async function loadOrders() {
  try {
    const res = await fetch(`${API_BASE}/orders`, { headers });
    const data = await res.json();

    ALL_ORDERS = data.data || [];

    renderOrders(ALL_ORDERS);
    calculateDhamanPayWallet(ALL_ORDERS);

  } catch (err) {
    console.error(err);
    alert("Failed to load orders");
  }
}

function calculateDhamanPayWallet(orders) {
  let total = 0;

  orders.forEach(order => {
    const status = String(order.status || "").toUpperCase();

    if (status === "COMPLETED" || status === "RELEASED") {
      const amount = Number(order.amount || order.total_amount || 0);
      total += amount * 0.018;
    }
  });

  const walletEl = document.getElementById("dhamanpayWallet");

  if (walletEl) {
    walletEl.textContent = money(total);
  }
}

function renderOrders(orders) {
  const container =
    document.getElementById("ordersList") ||
    document.getElementById("ordersContainer");

  if (!container) return;

  if (!orders.length) {
    container.innerHTML = `
      <div class="empty-state">
        No orders found
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(o => {
    const amount = Number(o.amount || o.total_amount || 0);
    const fee = amount * 0.018;
    const merchantGets = amount - fee;
    const status = String(o.status || "").toUpperCase();

    const canRelease =
      status === "DELIVERED" ||
      status === "DELIVERED_PENDING" ||
      status === "CONFIRMED";

    return `
      <div class="list-card">
        <div class="list-head">
          <div>
            <div class="list-title">
              Order #${o.id}
            </div>

            <div class="meta">
              <span>Status: ${status}</span>
              <span>Customer: ${o.customer_id || "—"}</span>
              <span>Merchant: ${o.merchant_id || "—"}</span>
            </div>
          </div>
        </div>

        <div class="meta" style="margin-top:10px;">
          <span>Total: ${money(amount)}</span>
          <span>Admin Fee (1.8%): ${money(fee)}</span>
          <span>Merchant Receives: ${money(merchantGets)}</span>
        </div>

        <div class="actions-row" style="margin-top:15px;">
          ${
            canRelease
              ? `
                <button
                  class="dp-gold-btn"
                  onclick="releaseOrder(${o.id})"
                >
                  Release
                </button>
              `
              : `
                <button
                  class="dp-ghost-btn"
                  disabled
                >
                  Not releasable
                </button>
              `
          }
        </div>
      </div>
    `;
  }).join("");
}

async function releaseOrder(orderId) {
  try {
    const order = ALL_ORDERS.find(o => o.id == orderId);

    if (!order) {
      alert("Order not found");
      return;
    }

    const amount = Number(order.amount || order.total_amount || 0);
    const fee = amount * 0.018;
    const merchantGets = amount - fee;

    const confirmRelease = confirm(
      `Release Order #${orderId}?\n\n` +
      `Total: ${money(amount)}\n` +
      `Admin Fee: ${money(fee)}\n` +
      `Merchant Gets: ${money(merchantGets)}`
    );

    if (!confirmRelease) return;

    const res = await fetch(
      `${API_BASE}/orders/${orderId}/release`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          admin_fee: fee,
          merchant_receives: merchantGets
        })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Release failed");
    }

    alert("Order released successfully");

    await loadOrders();

  } catch (err) {
    console.error(err);
    alert(err.message || "Release failed");
  }
}

window.releaseOrder = releaseOrder;

document.addEventListener("DOMContentLoaded", () => {
  loadOrders();
});