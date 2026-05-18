(function () {
  const API_BASE = "https://dhamanpay.onrender.com/api";
  const LOGIN_PAGE = "login.html";

  let courier = null;
  let profile = null;
  let orders = [];
  let selectedOrder = null;
  let selectedPdf = null;

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

    if (type === "success" || type === true) box.classList.add("success");
    else if (type === "error" || type === false) box.classList.add("error");
    else box.classList.add("info");

    box.textContent = text;
  }

  async function apiFetch(path, method = "GET", body = null) {
    const token = getToken();

    if (!token) {
      window.location.href = LOGIN_PAGE;
      throw new Error("Missing token. Please login again.");
    }

    const response = await fetch(API_BASE + path, {
      method,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: body ? JSON.stringify(body) : null
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      throw new Error("Invalid server response.");
    }

    if (response.status === 401) {
      localStorage.removeItem("token");
      window.location.href = LOGIN_PAGE;
      throw new Error("Session expired.");
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "API request failed.");
    }

    return data;
  }

  function normalizeStatus(status) {
    return String(status || "").trim().toUpperCase();
  }

  function isEscrowFrozen(order) {
    return normalizeStatus(order.status) === "ESCROW_FROZEN";
  }

  function isDelivering(order) {
    const status = normalizeStatus(order.status);
    return (
      status === "DELIVERING_PENDING" ||
      status === "DELIVERING" ||
      status === "SHIPPED"
    );
  }

  function isDelivered(order) {
    const status = normalizeStatus(order.status);
    return (
      status === "DELIVERED" ||
      status === "DELIVERED_PENDING" ||
      status === "COMPLETED"
    );
  }

  function getEscrowOrders() {
    return orders.filter(isEscrowFrozen);
  }

  function getDeliveringOrders() {
    return orders.filter(isDelivering);
  }

  function getDeliveredOrders() {
    return orders.filter(isDelivered);
  }

  function findOrder(id) {
    return orders.find(o => String(o.id) === String(id));
  }

  async function loadCourierInfo() {
    const meRes = await apiFetch("/me");
    courier = meRes.data || {};

    setText("heroCourierName", courier.full_name || "Courier");
    setText("profileName", courier.full_name || "Courier");
    setText("profileRole", courier.role ? courier.role.toUpperCase() : "COURIER");
    setText("profileEmail", courier.email);
    setText("profilePhone", courier.phone);
    setText("profileCourierId", courier.id);

    setText("profileCompany", courier.delivery_company || courier.company || "—");
    setText("profileVehicle", courier.vehicle_matricule || courier.vehicle || "—");
    setText("profileRating", courier.rating ?? "—");

    try {
      const profileRes = await apiFetch("/courier/profile");
      profile = profileRes.data || {};

      setText("profileCourierId", profile.id ?? courier.id);
      setText("profileCompany", profile.delivery_company || profile.company || courier.delivery_company || "—");
      setText("profileVehicle", profile.vehicle_matricule || profile.vehicle || courier.vehicle_matricule || "—");
      setText("profileRating", profile.rating ?? courier.rating ?? "—");
    } catch (err) {
      console.warn("Courier profile endpoint failed, using /me only:", err.message);
    }
  }

  async function loadOrders() {
    const res = await apiFetch("/orders");
    orders = Array.isArray(res.data) ? res.data : [];

    renderStats();
    renderEscrowOrders();

    console.log("ALL ORDERS:", orders);
    console.log("ESCROW FROZEN ORDERS:", getEscrowOrders());
  }

  function renderStats() {
    const escrow = getEscrowOrders().length;
    const delivering = getDeliveringOrders().length;
    const delivered = getDeliveredOrders().length;
    const completed = orders.filter(o => normalizeStatus(o.status) === "COMPLETED").length;

    setText("heroEscrowOrders", escrow);
    setText("heroDelivering", delivering);
    setText("heroDelivered", delivered);
    setText("heroStatus", "Online");

    setText("profileEscrowOrders", escrow);
    setText("profileDelivering", delivering);
    setText("profileDelivered", delivered);
    setText("profileCompleted", completed);
  }

  function renderEscrowOrders() {
    const container = el("ordersList");
    const empty = el("emptyOrders");
    if (!container) return;

    const escrowOrders = getEscrowOrders();
    container.innerHTML = "";

    if (!escrowOrders.length) {
      if (empty) empty.style.display = "block";
      return;
    }

    if (empty) empty.style.display = "none";

    escrowOrders.forEach(order => {
      const card = document.createElement("div");
      card.className = "list-card";

      card.innerHTML = `
        <div class="list-head">
          <div>
            <div class="list-title">Order #${order.id}</div>
            <div class="meta">
              <span>Product: ${order.product_name || "—"}</span>
              <span>Amount: ${order.amount ?? "—"} DZD</span>
              <span>Address: ${order.delivery_address || "—"}</span>
            </div>
          </div>
          <span class="badge-status">${order.status}</span>
        </div>

        <div class="actions-row">
          <button class="dp-ghost-btn" data-preview="${order.id}">Preview</button>
          <button class="dp-gold-btn" data-ship="${order.id}">Ship Order</button>
        </div>
      `;

      container.appendChild(card);
    });

    container.querySelectorAll("[data-preview]").forEach(btn => {
      btn.addEventListener("click", () => {
        const order = findOrder(btn.dataset.preview);
        previewOrder(order);
      });
    });

    container.querySelectorAll("[data-ship]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await shipOrderUI(btn.dataset.ship);
      });
    });
  }

  function previewOrder(order) {
    if (!order) return;

    selectedOrder = order;

    setText("previewOrderId", "#" + order.id);
    setText("previewOrderStatus", order.status);
    setText("previewProductName", order.product_name);
    setText("previewAmount", (order.amount ?? "—") + " DZD");
    setText("previewAddress", order.delivery_address);

    if (el("updateOrderCode")) el("updateOrderCode").value = order.id;
    if (el("proofOrderCode")) el("proofOrderCode").value = order.id;

    setText("updatePreviewOrder", "#" + order.id);
    setText("updatePreviewStatus", order.status);
  }

  async function shipOrderUI(id) {
    const order = findOrder(id);

    if (!order) {
      showMessage("ordersMessage", "Order not found.", "error");
      return;
    }

    if (!isEscrowFrozen(order)) {
      showMessage("ordersMessage", "Only ESCROW_FROZEN orders can be shipped.", "error");
      return;
    }

    try {
      await apiFetch(`/orders/${id}/ship`, "POST", {
        status: "DELIVERING_PENDING"
      });

      showMessage("ordersMessage", `Order #${id} shipped successfully.`, "success");

      order.status = "DELIVERING_PENDING";
      previewOrder(order);

      await loadOrders();
    } catch (err) {
      showMessage("ordersMessage", err.message, "error");
    }
  }

  async function updatePlaceUI(e) {
    e.preventDefault();

    const orderId = el("updateOrderCode")?.value?.trim();
    const place = el("currentPlace")?.value?.trim();
    const status = el("updateDeliveryStatus")?.value;
    const note = el("placeNote")?.value?.trim();

    if (!orderId) {
      showMessage("updateMessage", "Enter order ID.", "error");
      return;
    }

    if (!place) {
      showMessage("updateMessage", "Enter current place.", "error");
      return;
    }

    const order = findOrder(orderId);

    if (!order) {
      showMessage("updateMessage", "This order does not exist in loaded orders.", "error");
      return;
    }

    try {
      await apiFetch(`/orders/${orderId}/location`, "POST", {
        current_place: place,
        status: status,
        note: note
      });

      order.status = status;
      order.current_place = place;

      showMessage("updateMessage", "Delivery place updated successfully.", "success");
    } catch (err) {
      console.warn("Location endpoint failed:", err.message);

      order.status = status;
      order.current_place = place;

      showMessage(
        "updateMessage",
        "Place updated locally. Ask backend if /orders/{id}/location exists.",
        "info"
      );
    }

    setText("updatePreviewOrder", "#" + orderId);
    setText("updatePreviewStatus", status);
    setText("updatePreviewPlace", place);
    setText("updatePreviewTime", new Date().toLocaleString());

    setText("previewOrderStatus", status);

    renderStats();
    renderEscrowOrders();
  }

  function handlePdfSelection(file) {
    if (!file) return;

    const isPdf =
      file.type === "application/pdf" ||
      String(file.name || "").toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      showMessage("proofMessage", "Only PDF files are allowed.", "error");
      return;
    }

    selectedPdf = file;
    setText("pdfFileName", file.name);
    showMessage("proofMessage", "PDF selected. Paste proof URL when submitting.", "info");
  }

  async function submitProofUI() {
    const orderId = el("proofOrderCode")?.value?.trim();
    const kind = el("proofKind")?.value;
    const desc = el("proofDescription")?.value?.trim();

    if (!orderId) {
      showMessage("proofMessage", "Enter order ID.", "error");
      return;
    }

    const order = findOrder(orderId);

    if (!order) {
      showMessage("proofMessage", "This order does not exist in loaded orders.", "error");
      return;
    }

    const proofUrl = window.prompt("Paste the uploaded proof URL required by backend:");

    if (!proofUrl || !proofUrl.trim()) {
      showMessage("proofMessage", "Backend requires proof_url.", "error");
      return;
    }

    try {
      await apiFetch(`/orders/${orderId}/proof`, "POST", {
        proof_url: proofUrl.trim(),
        proof_type: kind,
        description: desc
      });

      showMessage("proofMessage", "Proof submitted successfully.", "success");

      setText("proofPrevOrder", "#" + orderId);
      setText("proofPrevKind", kind);
      setText("proofPrevFile", selectedPdf?.name || proofUrl.trim());
      setText("proofPrevDesc", desc || "—");
      setText("proofPreviewBadge", "Submitted");

      await loadOrders();
    } catch (err) {
      showMessage("proofMessage", err.message, "error");
    }
  }

  function setupNavigation() {
    const navButtons = document.querySelectorAll(".view-nav-btn");
    const views = document.querySelectorAll(".view-panel");

    navButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.view;

        navButtons.forEach(b => b.classList.remove("active-nav"));
        views.forEach(view => view.classList.remove("active"));

        btn.classList.add("active-nav");
        document.getElementById(targetId)?.classList.add("active");
      });
    });
  }

  function setupEvents() {
    el("logoutBtn")?.addEventListener("click", () => {
      localStorage.removeItem("token");
      window.location.href = LOGIN_PAGE;
    });

    el("updatePlaceForm")?.addEventListener("submit", updatePlaceUI);

    el("submitProofBtn")?.addEventListener("click", submitProofUI);

    el("choosePdfBtn")?.addEventListener("click", () => {
      el("proofPdf")?.click();
    });

    el("proofPdf")?.addEventListener("change", e => {
      handlePdfSelection(e.target.files?.[0]);
    });

    const dropzone = el("pdfDropzone");

    if (dropzone) {
      ["dragenter", "dragover"].forEach(eventName => {
        dropzone.addEventListener(eventName, e => {
          e.preventDefault();
          dropzone.classList.add("dragover");
        });
      });

      ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, e => {
          e.preventDefault();
          dropzone.classList.remove("dragover");
        });
      });

      dropzone.addEventListener("drop", e => {
        handlePdfSelection(e.dataTransfer?.files?.[0]);
      });
    }

    ["updateOrderCode", "updateDeliveryStatus", "currentPlace"].forEach(id => {
      el(id)?.addEventListener("input", () => {
        setText("updatePreviewOrder", el("updateOrderCode")?.value ? "#" + el("updateOrderCode").value : "—");
        setText("updatePreviewStatus", el("updateDeliveryStatus")?.value || "—");
        setText("updatePreviewPlace", el("currentPlace")?.value || "—");
      });
    });
  }

  async function init() {
    if (!getToken()) {
      window.location.href = LOGIN_PAGE;
      return;
    }

    setupNavigation();
    setupEvents();

    try {
      await loadCourierInfo();
      await loadOrders();
    } catch (err) {
      console.error("Courier page error:", err);
      alert("Courier page error: " + err.message);
    } finally {
      setTimeout(() => {
        el("loader")?.classList.add("hide");
      }, 700);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();