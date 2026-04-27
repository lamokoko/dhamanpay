(function () {
  const API_BASE = (localStorage.getItem("DHAMANPAY_API_BASE") || "https://dhamanpay.onrender.com/api")
    .trim()
    .replace(/\/+$/, "");

  const LOGIN_PAGE = "login.html";

  const state = {
    me: null,
    profile: null,
    orders: [],
    activeOrder: null,
    selectedPdf: null
  };

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

  function setInputValue(id, value) {
    const node = el(id);
    if (node) node.value = value ?? "";
  }

  function showMessage(id, text, type = "info") {
    const box = el(id);
    if (!box) return;

    box.className = "message-box";

    if (type === true || type === "success") box.classList.add("success");
    else if (type === false || type === "error") box.classList.add("error");
    else box.classList.add("info");

    box.textContent = text;
  }

  function formatCoord(lat, lng) {
    if (!lat || !lng) return "—";

    const a = Number(lat);
    const b = Number(lng);

    if (Number.isNaN(a) || Number.isNaN(b)) return "—";

    return `${a.toFixed(5)}, ${b.toFixed(5)}`;
  }

  async function apiFetch(path, options = {}) {
    const token = getToken();

    if (!token) {
      window.location.href = LOGIN_PAGE;
      throw new Error("Missing token. Please login again.");
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    let data = {};
    try {
      data = await response.json();
    } catch (e) {
      throw new Error(`Invalid JSON response from ${path}`);
    }

    if (response.status === 401) {
      localStorage.removeItem("token");
      window.location.href = LOGIN_PAGE;
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
  }

  async function logoutUser() {
    try {
      await apiFetch("/logout", {
        method: "POST",
        body: {}
      });
    } catch (err) {
      console.warn("Logout request failed:", err.message);
    }

    localStorage.removeItem("token");
    window.location.href = LOGIN_PAGE;
  }

  async function loadMe() {
    const res = await apiFetch("/me");
    state.me = res.data || {};

    const courier = state.me;

    setText("heroCourierName", courier.full_name || "Courier");
    setText("profileName", courier.full_name || "Courier");
    setText("profileRole", courier.role ? courier.role.toUpperCase() : "COURIER");
    setText("profileEmail", courier.email);
    setText("profilePhone", courier.phone);
    setText("profileCourierId", courier.id);

    setText("heroCourierCompany", courier.delivery_company || courier.company || "Delivery Company");
    setText("profileCompany", courier.delivery_company || courier.company);

    setText("profileVehicle", courier.vehicle_matricule || courier.vehicle || "—");

    const rating = Number(courier.rating || 0).toFixed(1);
    setText("heroRating", rating);
    setText("profileRating", rating);

    setInputValue("shipCourierId", courier.id ?? "");
  }

  async function loadProfile() {
    try {
      const res = await apiFetch("/courier/profile");
      state.profile = res.data || {};

      const profile = state.profile;

      setText("profileCourierId", profile.id ?? state.me?.id);
      setText("profileVehicle", profile.vehicle_matricule || profile.vehicle || "—");

      const company = profile.delivery_company || profile.company || state.me?.delivery_company || "—";
      setText("heroCourierCompany", company);
      setText("profileCompany", company);

      const rating = Number(profile.rating || state.me?.rating || 0).toFixed(1);
      setText("heroRating", rating);
      setText("profileRating", rating);

      setInputValue("shipCourierId", profile.id ?? state.me?.id ?? "");
    } catch (err) {
      console.warn("Courier profile endpoint failed, using /me data only:", err.message);
    }
  }

  async function loadOrders() {
    const res = await apiFetch("/orders");
    state.orders = Array.isArray(res.data) ? res.data : [];

    setText("heroAssigned", state.orders.length);

    const deliveredCount = state.orders.filter(order =>
      order.status === "DELIVERED_PENDING" || order.status === "COMPLETED"
    ).length;

    setText("heroDelivered", deliveredCount);
    setText("profileDeliveredToday", deliveredCount);

    if (state.activeOrder) {
      const refreshed = state.orders.find(order => String(order.id) === String(state.activeOrder.id));
      state.activeOrder = refreshed || null;
    }
  }

  function findOrderByInputValue(value) {
    const clean = String(value || "").trim();
    if (!clean) return null;

    return state.orders.find(order => String(order.id) === clean) || null;
  }

  function syncManualPreviewFields() {
    setText("previewFromText", el("shipFromText")?.value?.trim() || "—");
    setText("previewToText", el("shipToText")?.value?.trim() || "—");
    setText("previewFromGps", formatCoord(el("fromLat")?.value, el("fromLng")?.value));
    setText("previewToGps", formatCoord(el("toLat")?.value, el("toLng")?.value));
  }

  function syncOrderPreview(order) {
    state.activeOrder = order || null;

    setText("previewOrderTitle", order ? `Order #${order.id}` : "No Shipment Started");
    setText("proofPreviewTitle", order ? `Order #${order.id}` : "No Proof Yet");
    setText("proofPrevOrder", order ? `#${order.id}` : "—");

    setText("customerStatus", order?.status || "Waiting for shipment");
    setText("heroStatus", order?.status || "Online");
    setText("customerUpdatedAt", order?.updated_at || "—");

    const badge = el("previewShipBadge");
    if (badge) badge.textContent = order?.status || "Waiting";

    syncManualPreviewFields();
  }

  async function startShipping() {
    const orderInput = el("shipOrderCode")?.value;
    const order = findOrderByInputValue(orderInput);

    if (!order) {
      showMessage("shippingMessage", "Enter a valid order ID from your assigned orders.", false);
      return;
    }

    if (order.status !== "ESCROW_FROZEN") {
      showMessage("shippingMessage", "Ship is allowed only when order status is ESCROW_FROZEN.", false);
      return;
    }

    await apiFetch(`/orders/${order.id}/ship`, {
      method: "POST",
      body: {}
    });

    showMessage("shippingMessage", `Order #${order.id} shipped successfully.`, true);

    await loadOrders();

    const updatedOrder =
      state.orders.find(item => String(item.id) === String(order.id)) ||
      { ...order, status: "SHIPPED" };

    syncOrderPreview(updatedOrder);

    if (el("proofOrderCode")) {
      el("proofOrderCode").value = String(order.id);
    }
  }

  function handlePdfSelection(file) {
    if (!file) return;

    const isPdf =
      file.type === "application/pdf" ||
      String(file.name || "").toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      showMessage("proofMessage", "Only PDF files are allowed.", false);
      return;
    }

    state.selectedPdf = file;
    setText("pdfFileName", file.name);

    showMessage(
      "proofMessage",
      "PDF selected. Backend still needs a proof_url, so paste the uploaded file link when submitting.",
      "info"
    );
  }

  async function submitProof() {
    const orderInput = el("proofOrderCode")?.value;
    const order = findOrderByInputValue(orderInput);

    if (!order) {
      showMessage("proofMessage", "Enter a valid shipped order ID first.", false);
      return;
    }

    if (order.status !== "SHIPPED") {
      showMessage("proofMessage", "Proof is allowed only when order status is SHIPPED.", false);
      return;
    }

    const proofUrl = window.prompt("Paste the uploaded proof URL required by backend:");

    if (!proofUrl || !proofUrl.trim()) {
      showMessage("proofMessage", "Backend requires proof_url.", false);
      return;
    }

    await apiFetch(`/orders/${order.id}/proof`, {
      method: "POST",
      body: {
        proof_url: proofUrl.trim()
      }
    });

    setText("proofPrevKind", el("proofKind")?.value || "Proof");
    setText("proofPrevFile", state.selectedPdf?.name || proofUrl.trim());
    setText("proofPrevDesc", el("proofDescription")?.value?.trim() || "—");

    const badge = el("proofPreviewBadge");
    if (badge) badge.textContent = "Submitted";

    showMessage("proofMessage", `Proof submitted for order #${order.id}.`, true);

    await loadOrders();

    const updatedOrder =
      state.orders.find(item => String(item.id) === String(order.id)) ||
      { ...order, status: "DELIVERED_PENDING" };

    syncOrderPreview(updatedOrder);
  }

  function getCurrentPositionInto(latSelector, lngSelector, messageId, successText) {
    if (!navigator.geolocation) {
      showMessage(messageId, "Geolocation is not supported on this browser.", false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const latNode = document.querySelector(latSelector);
        const lngNode = document.querySelector(lngSelector);

        if (latNode) latNode.value = position.coords.latitude.toFixed(6);
        if (lngNode) lngNode.value = position.coords.longitude.toFixed(6);

        setText("customerPosition", formatCoord(position.coords.latitude, position.coords.longitude));
        syncManualPreviewFields();

        if (messageId) showMessage(messageId, successText, true);
      },
      error => {
        showMessage(messageId, `GPS access failed: ${error.message}`, false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  function attachUi() {
    const logoutBtn = el("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async function () {
        const confirmed = window.confirm("Are you sure you want to logout?");
        if (!confirmed) return;
        await logoutUser();
      });
    }

    el("startShippingBtn")?.addEventListener("click", async function () {
      try {
        await startShipping();
      } catch (err) {
        showMessage("shippingMessage", err.message, false);
      }
    });

    el("submitProofBtn")?.addEventListener("click", async function () {
      try {
        await submitProof();
      } catch (err) {
        showMessage("proofMessage", err.message, false);
      }
    });

    if (el("choosePdfBtn") && el("proofPdf")) {
      el("choosePdfBtn").addEventListener("click", function () {
        el("proofPdf").click();
      });

      el("proofPdf").addEventListener("change", function (e) {
        handlePdfSelection(e.target.files?.[0]);
      });
    }

    const dropzone = el("pdfDropzone");
    if (dropzone) {
      ["dragenter", "dragover"].forEach(evt => {
        dropzone.addEventListener(evt, function (e) {
          e.preventDefault();
          dropzone.classList.add("dragover");
        });
      });

      ["dragleave", "drop"].forEach(evt => {
        dropzone.addEventListener(evt, function (e) {
          e.preventDefault();
          dropzone.classList.remove("dragover");
        });
      });

      dropzone.addEventListener("drop", function (e) {
        handlePdfSelection(e.dataTransfer?.files?.[0]);
      });
    }

    el("capturePickupGpsBtn")?.addEventListener("click", function () {
      getCurrentPositionInto(
        "#fromLat",
        "#fromLng",
        "shippingMessage",
        "Pickup GPS captured from browser location."
      );
    });

    el("captureLiveGpsBtn")?.addEventListener("click", function () {
      getCurrentPositionInto(
        "#liveLat",
        "#liveLng",
        "positionMessage",
        "Current live position captured from browser location."
      );
    });

    el("useBrowserLiveGpsBtn")?.addEventListener("click", function () {
      getCurrentPositionInto(
        "#liveLat",
        "#liveLng",
        "positionMessage",
        "Live GPS inserted successfully."
      );
    });

    el("pushLocationBtn")?.addEventListener("click", function () {
      const lat = el("liveLat")?.value;
      const lng = el("liveLng")?.value;
      const status = el("liveStatus")?.value || "On The Way";

      if (!lat || !lng) {
        showMessage("positionMessage", "Insert current latitude and longitude.", false);
        return;
      }

      setText("customerPosition", formatCoord(lat, lng));
      setText("customerStatus", status);
      setText("customerUpdatedAt", new Date().toLocaleString());

      showMessage("positionMessage", "Position updated locally in the UI.", true);
    });

    el("autoSimulateBtn")?.addEventListener("click", function () {
      const fromLat = Number(el("fromLat")?.value);
      const fromLng = Number(el("fromLng")?.value);
      const toLat = Number(el("toLat")?.value);
      const toLng = Number(el("toLng")?.value);

      if ([fromLat, fromLng, toLat, toLng].some(Number.isNaN)) {
        showMessage("positionMessage", "Valid pickup and destination GPS values are required.", false);
        return;
      }

      const midLat = ((fromLat + toLat) / 2).toFixed(6);
      const midLng = ((fromLng + toLng) / 2).toFixed(6);

      if (el("liveLat")) el("liveLat").value = midLat;
      if (el("liveLng")) el("liveLng").value = midLng;
      if (el("liveStatus")) el("liveStatus").value = "On The Way";

      setText("customerPosition", formatCoord(midLat, midLng));
      setText("customerStatus", "On The Way");
      setText("customerUpdatedAt", new Date().toLocaleString());

      showMessage("positionMessage", "Progress simulated locally in the UI.", true);
    });

    ["shipFromText", "shipToText", "fromLat", "fromLng", "toLat", "toLng"].forEach(id => {
      const node = el(id);
      if (node) node.addEventListener("input", syncManualPreviewFields);
    });
  }

  async function init() {
    if (!getToken()) {
      window.location.href = LOGIN_PAGE;
      return;
    }

    try {
      attachUi();

      await loadMe();
      await loadProfile();
      await loadOrders();

      syncManualPreviewFields();
      syncOrderPreview(null);

      setText("heroStatus", "Online");

      console.log("Courier dashboard connected to backend:", API_BASE);
    } catch (err) {
      console.error("Courier integration error:", err);
      alert(`Courier integration error: ${err.message}`);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();