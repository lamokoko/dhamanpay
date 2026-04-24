let orders = [];
let wallet = {};
let disputes = [];
let user = null;

if (!getToken()) {
  window.location.href = 'login.html';
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value ?? '—';
  }
}

function updateUserUI() {
  if (!user) return;

  setText('heroCustomerName', user.full_name);

  setText('customerName', user.full_name);
  setText('customerEmail', user.email);
  setText('customerPhone', user.phone);
  setText('customerId', user.id);
  setText('customerRole', user.role ? user.role.toUpperCase() : '—');
  setText('customerWilaya', user.wilaya);
  setText('customerDeliveryType', user.delivery_type);
}

async function loadDashboard() {
  try {
    const meRes = await getMe();
    user = meRes.data;

    console.log('CURRENT USER:', user);

    updateUserUI();

    const ordersRes = await getOrders();
    orders = ordersRes.data || [];
    console.log('ORDERS:', orders);

    const walletRes = await getWallet(user.id);
    wallet = walletRes.data || {};

    const disputesRes = await getDisputes();
    disputes = disputesRes.data || [];

    updateWalletUI();
    renderOrders();
    renderDisputes();
  } catch (e) {
    console.error('LOAD ERROR:', e);
  }
}

async function confirmOrderUI(id) {
  try {
    await confirmOrder(id);
    await loadDashboard();
  } catch (e) {
    console.error('CONFIRM ERROR:', e);
  }
}

async function cancelOrderUI(id) {
  try {
    await cancelOrder(id);
    await loadDashboard();
  } catch (e) {
    console.error('CANCEL ERROR:', e);
  }
}

async function submitDispute() {
  const orderCode = $('#disputeOrderCode').val().trim().toUpperCase();
  const explanation = $('#disputeExplanation').val().trim();

  const order = orders.find(o => {
const code = o.order_code || o.code || `ORD-${String(o.id).padStart(3, '0')}`;
    return code.toUpperCase() === orderCode;
  });

  if (!order) {
    alert('Order not found');
    return;
  }

  await openDispute(order.id, {
    reason: 'OTHER',
    dispute_description: explanation
  });

  await loadDashboard();
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboard();
});