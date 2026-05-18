(function () {
  const API_BASE = "https://dhamanpay.onrender.com/api";
  const LOGIN_PAGE = "login.html";

  let orders = [];
  let merchant = null;
  let selectedCustomer = null;

  function el(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return localStorage.getItem("token");
  }

  function setText(id, value) {
    const node = el(id);
    if (node) node.textContent = value ?? "—";
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

  function safe(value) {
    if (value === null || value === undefined || value === "") return "—";
    return String(value);
  }

  function escapeHTML(value) {
    return safe(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function money(value) {
    const n = Number(value || 0);
    return `${n.toLocaleString("en-US")} DZD`;
  }

  function getCustomerName(order) {
    return (
      order.customer_name ||
      order.customer_full_name ||
      order.customer?.full_name ||
      order.customer?.name ||
      order.buyer_name ||
      order.user?.full_name ||
      "Customer not shown"
    );
  }

  function getProductName(order) {
    return (
      order.product_name ||
      order.product?.name ||
      order.product_title ||
      order.title ||
      "Product not shown"
    );
  }

  function getDeliveryAddress(order) {
    return (
      order.delivery_address ||
      order.address ||
      order.customer_address ||
      "Address not shown"
    );
  }

  async function apiFetch(path, method = "GET", body = null) {
    const token = getToken();

    if (!token) {
      window.location.href = LOGIN_PAGE;
      throw new Error("No token found");
    }

    const res = await fetch(API_BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Bearer " + token
      },
      body: body ? JSON.stringify(body) : null
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      throw new Error("Invalid server response");
    }

    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = LOGIN_PAGE;
      throw new Error("Session expired");
    }

    if (!res.ok || data.success === false) {
      throw new Error(data.message || "API Error");
    }

    return data;
  }

  async function loadProfile() {
    try {
      const res = await apiFetch("/me");
      merchant = res.data || {};

      setText("merchantName", merchant.full_name);
      setText("merchantRole", merchant.role?.toUpperCase());
      setText("merchantStoreName", merchant.store_name);
      setText("merchantEmail", merchant.email);
      setText("merchantPhone", merchant.phone);
      setText("merchantId", merchant.id);
      setText("merchantCommercialRegister", merchant.commercial_register);

      setText("merchantStoreNameCard", merchant.store_name);
      setText("merchantCommercialRegisterCard", merchant.commercial_register);

      setText("heroStoreName", merchant.store_name || "Your Store");
      setText("heroMerchantName", merchant.full_name || "Merchant");
    } catch (err) {
      console.error("Profile error:", err);
    }
  }

  async function searchCustomer() {
    const name = el("customerSearchName")?.value.trim() || "";
    const phone = el("customerSearchPhone")?.value.trim() || "";
    const box = el("customerSearchResults");

    if (!name && !phone) {
      showMessage("customerSearchMessage", "Enter customer name or phone.", "error");
      return;
    }

    try {
      showMessage("customerSearchMessage", "Searching customer...", "info");

      const params = new URLSearchParams();
      if (name) params.append("full_name", name);
      if (phone) params.append("phone", phone);

      const res = await apiFetch(`/customers/search?${params.toString()}`);
      const customers = Array.isArray(res.data) ? res.data : [];

      if (box) box.innerHTML = "";

      if (!customers.length) {
        showMessage("customerSearchMessage", "No customer found.", "error");
        return;
      }

      showMessage("customerSearchMessage", "Select a customer from the list.", "success");

      customers.forEach(c => {
        const div = document.createElement("div");
        div.className = "list-card";
        div.style.cursor = "pointer";

        div.innerHTML = `
          <div class="list-head">
            <div>
              <div class="list-title">${escapeHTML(c.full_name || c.name)}</div>
              <div class="meta">
                <span>Phone: ${escapeHTML(c.phone)}</span>
                <span>ID: ${escapeHTML(c.id)}</span>
              </div>
            </div>
          </div>
        `;

        div.onclick = () => {
          selectedCustomer = c;
          if (el("customerId")) {
            el("customerId").value = `${c.full_name || c.name} (#${c.id})`;
          }
          showMessage("customerSearchMessage", "Customer selected.", "success");
        };

        box?.appendChild(div);
      });
    } catch (err) {
      showMessage("customerSearchMessage", err.message, "error");
    }
  }

  async function createOrder(e) {
    e.preventDefault();

    if (!selectedCustomer) {
      showMessage("formMessage", "Select a customer first.", "error");
      return;
    }

    const payload = {
      customer_id: selectedCustomer.id,
      amount: Number(el("amount")?.value || 0),
      product_name: el("productName")?.value.trim(),
      expected_serial_number: el("expectedSerialNumber")?.value.trim(),
      delivery_address: el("deliveryAddress")?.value.trim()
    };

    if (!payload.amount || payload.amount <= 0) {
      showMessage("formMessage", "Enter a valid amount.", "error");
      return;
    }

    if (!payload.product_name || !payload.delivery_address) {
      showMessage("formMessage", "Product name and delivery address are required.", "error");
      return;
    }

    try {
      showMessage("formMessage", "Creating order...", "info");

      await apiFetch("/orders", "POST", payload);

      showMessage("formMessage", "Order created successfully.", "success");

      e.target.reset();
      selectedCustomer = null;
      if (el("customerId")) el("customerId").value = "";

      await loadOrders();
    } catch (err) {
      showMessage("formMessage", err.message, "error");
    }
  }

  async function loadOrders() {
    try {
      const container = el("ordersList");
      if (container) container.innerHTML = "";

      const res = await apiFetch("/orders");
      orders = Array.isArray(res.data) ? res.data : [];

      renderOrders();
      renderStats();
    } catch (err) {
      console.error("Orders error:", err);

      const empty = el("emptyState");
      if (empty) {
        empty.style.display = "block";
        empty.textContent = err.message || "Failed to load orders.";
      }
    }
  }

  function getFilteredOrders() {
    const searchValue = (el("searchInput")?.value || "").trim().toLowerCase();
    const statusValue = el("statusFilter")?.value || "all";

    return orders.filter(order => {
      const searchable = [
        order.id,
        order.status,
        order.amount,
        getCustomerName(order),
        getProductName(order),
        getDeliveryAddress(order),
        order.expected_serial_number,
        order.serial_number,
        order.customer_id,
        order.created_at
      ]
        .map(v => safe(v).toLowerCase())
        .join(" ");

      const matchesSearch = !searchValue || searchable.includes(searchValue);
      const matchesStatus = statusValue === "all" || order.status === statusValue;

      return matchesSearch && matchesStatus;
    });
  }

  function renderOrders() {
    const container = el("ordersList");
    const empty = el("emptyState");

    if (!container) return;

    container.innerHTML = "";

    const filteredOrders = getFilteredOrders();

    if (!filteredOrders.length) {
      if (empty) {
        empty.style.display = "block";
        empty.textContent = orders.length
          ? "No orders match your search or filter."
          : "No orders yet. Create your first order to see it here.";
      }
      return;
    }

    if (empty) empty.style.display = "none";

    filteredOrders.forEach(order => {
      const card = document.createElement("div");
      card.className = "list-card";

      const statusClass = safe(order.status).toLowerCase();

      card.innerHTML = `
        <div class="list-head">
          <div>
            <div class="list-title">
              #${escapeHTML(order.id)} — ${escapeHTML(getProductName(order))}
            </div>

            <div class="meta">
              <span>Customer: ${escapeHTML(getCustomerName(order))}</span>
              <span>Amount: ${escapeHTML(money(order.amount))}</span>
              <span>Customer ID: ${escapeHTML(order.customer_id)}</span>
            </div>
          </div>

          <span class="badge-status ${escapeHTML(statusClass)}">
            ${escapeHTML(order.status)}
          </span>
        </div>

        <div class="meta">
          <span>Address: ${escapeHTML(getDeliveryAddress(order))}</span>
          <span>Serial: ${escapeHTML(order.expected_serial_number || order.serial_number)}</span>
          <span>Created: ${escapeHTML(order.created_at)}</span>
        </div>
      `;

      container.appendChild(card);
    });
  }

  function renderStats() {
    let earned = 0;
    let pending = 0;
    let active = 0;
    let completed = 0;

    orders.forEach(order => {
      const amount = Number(order.amount || 0);

      if (order.status === "COMPLETED") {
        earned += amount;
        completed++;
      } else {
        active++;
        pending += amount;
      }
    });

    setText("heroEarned", money(earned));
    setText("heroPending", money(pending));
    setText("heroActive", active);
    setText("heroCompleted", completed);

    setText("totalEarned", money(earned));
    setText("pendingEscrow", money(pending));
    setText("visibleOrders", getFilteredOrders().length);
    setText("completedOrders", completed);
  }

  function resetFilters() {
    if (el("searchInput")) el("searchInput").value = "";
    if (el("statusFilter")) el("statusFilter").value = "all";

    renderOrders();
    renderStats();
  }

  function clearCreateForm() {
    selectedCustomer = null;

    if (el("createOrderForm")) el("createOrderForm").reset();
    if (el("customerId")) el("customerId").value = "";
    if (el("customerSearchResults")) el("customerSearchResults").innerHTML = "";

    showMessage("formMessage", "Form cleared.", "info");
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.href = LOGIN_PAGE;
  }

  function setupNavigation() {
    const buttons = document.querySelectorAll(".view-nav-btn");
    const panels = document.querySelectorAll(".view-panel");
    const track = el("views-track");

    buttons.forEach((btn, index) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.view;

        buttons.forEach(b => b.classList.remove("active-nav"));
        btn.classList.add("active-nav");

        panels.forEach(panel => panel.classList.remove("mobile-active"));
        el(target)?.classList.add("mobile-active");

        if (track && window.innerWidth > 900) {
          track.style.transform = `translateX(-${index * 100}vw)`;
        }
      });
    });
  }

  function hideLoader() {
    const loader = el("loader");
    if (!loader) return;

    setTimeout(() => {
      loader.classList.add("hide");
      loader.style.transform = "translateY(-100%)";
    }, 700);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!getToken()) {
      window.location.href = LOGIN_PAGE;
      return;
    }

    setupNavigation();

    el("searchCustomerBtn")?.addEventListener("click", searchCustomer);
    el("createOrderForm")?.addEventListener("submit", createOrder);
    el("clearCreateFormBtn")?.addEventListener("click", clearCreateForm);

    el("searchInput")?.addEventListener("input", () => {
      renderOrders();
      renderStats();
    });

    el("statusFilter")?.addEventListener("change", () => {
      renderOrders();
      renderStats();
    });

    el("refreshOrdersBtn")?.addEventListener("click", loadOrders);
    el("resetBtn")?.addEventListener("click", resetFilters);
    el("logoutBtn")?.addEventListener("click", logout);

    await loadProfile();
    await loadOrders();

    hideLoader();
  });
})();