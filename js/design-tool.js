const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const HTML2CANVAS_JS_URL = "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js";
const DEFAULT_CENTER = [38.627, -90.1994];
const DEFAULT_ZOOM = 11;
const DRAW_ZOOM = 20;

let leafletLoadPromise = null;
let html2canvasLoadPromise = null;

function ensureLeafletAssets() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = LEAFLET_CSS_URL;
      document.head.appendChild(css);
    }

    const existingScript = document.querySelector(`script[src="${LEAFLET_JS_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.L), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Leaflet.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS_URL;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Failed to load Leaflet."));
    document.head.appendChild(script);
  });

  return leafletLoadPromise;
}

function ensureHtml2CanvasAsset() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (html2canvasLoadPromise) return html2canvasLoadPromise;

  html2canvasLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${HTML2CANVAS_JS_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.html2canvas), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load screenshot utility.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = HTML2CANVAS_JS_URL;
    script.async = true;
    script.onload = () => resolve(window.html2canvas);
    script.onerror = () => reject(new Error("Failed to load screenshot utility."));
    document.head.appendChild(script);
  });

  return html2canvasLoadPromise;
}

function formatLatLng(point) {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

function buildMailto(subject, body) {
  return `mailto:anthony@hoganpools.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function setStatus(statusEl, text, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("is-error", Boolean(isError));
}

function setButtonBusy(buttonEl, busy) {
  if (!buttonEl) return;
  buttonEl.dataset.busy = busy ? "true" : "false";
  buttonEl.setAttribute("aria-busy", busy ? "true" : "false");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFilenamePart(input) {
  return (input || "pool-drawing")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "pool-drawing";
}

async function captureMapSnapshotCanvas(mapEl) {
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  await ensureHtml2CanvasAsset();

  return window.html2canvas(mapEl, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
    scale: Math.min(2, window.devicePixelRatio || 1.5),
    logging: false,
  });
}

async function canvasToBlob(canvas) {
  const blob = await new Promise((resolve) => {
    canvas.toBlob((value) => resolve(value), "image/png", 0.92);
  });

  if (!blob) throw new Error("Screenshot export failed.");
  return blob;
}

function drawPoolOverlayOnCanvas(canvas, mapEl, map, poolPoints) {
  if (!canvas || !mapEl || !map || !Array.isArray(poolPoints) || poolPoints.length < 2) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const scaleX = canvas.width / Math.max(1, mapEl.clientWidth);
  const scaleY = canvas.height / Math.max(1, mapEl.clientHeight);

  const points = poolPoints
    .map((latLng) => map.latLngToContainerPoint(latLng))
    .map((point) => ({ x: point.x * scaleX, y: point.y * scaleY }));

  if (points.length < 2) return;

  ctx.save();
  ctx.lineWidth = Math.max(2, 2 * Math.max(scaleX, scaleY));
  ctx.strokeStyle = "rgba(120,170,210,0.98)";
  ctx.fillStyle = "rgba(120,170,210,0.28)";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  if (points.length >= 3) {
    ctx.closePath();
    ctx.fill();
  }

  ctx.stroke();
  ctx.restore();
}

export async function initDesignTool(root = document) {
  const designRoot = root?.querySelector?.("[data-design-root]") || (root?.matches?.("[data-design-root]") ? root : null);
  if (!designRoot || designRoot.dataset.designBound === "true") return;

  const mapEl = designRoot.querySelector("#design-map");
  const addressInput = designRoot.querySelector("#design-address");
  const nameInput = designRoot.querySelector("#design-name");
  const phoneInput = designRoot.querySelector("#design-phone");
  const emailInput = designRoot.querySelector("#design-email");
  const statusEl = designRoot.querySelector("[data-design-status]");
  const searchBtn = designRoot.querySelector('[data-design-action="search"]');
  const toggleDrawBtn = designRoot.querySelector('[data-design-action="toggle-draw"]');
  const clearBtn = designRoot.querySelector('[data-design-action="clear"]');
  const downloadSnapshotBtn = designRoot.querySelector('[data-design-action="download-snapshot"]');
  const sendBtn = designRoot.querySelector('[data-design-action="send"]');
  const callbackBtn = designRoot.querySelector('[data-design-action="callback"]');

  if (!mapEl || !addressInput || !searchBtn || !toggleDrawBtn || !clearBtn || !downloadSnapshotBtn || !sendBtn || !callbackBtn) return;

  designRoot.dataset.designBound = "true";

  try {
    await ensureLeafletAssets();
  } catch (error) {
    setStatus(statusEl, "Map failed to load. Please refresh and try again.", true);
    return;
  }

  const map = window.L.map(mapEl, { zoomControl: true, scrollWheelZoom: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 21,
    crossOrigin: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  window.setTimeout(() => map.invalidateSize(), 120);

  let homeMarker = null;
  let poolPoints = [];
  let poolShapeLayer = null;
  let isDrawMode = false;
  let downloadedSnapshotFilename = "";
  let hasFreshSnapshot = false;

  function syncSendAvailability() {
    sendBtn.classList.toggle("is-disabled", !hasFreshSnapshot);
    sendBtn.setAttribute("aria-disabled", hasFreshSnapshot ? "false" : "true");
  }

  function invalidateSnapshot() {
    downloadedSnapshotFilename = "";
    hasFreshSnapshot = false;
    syncSendAvailability();
  }

  function updateDrawButtonLabel() {
    toggleDrawBtn.textContent = isDrawMode ? "Stop Drawing" : "Draw your Pool";
    toggleDrawBtn.classList.toggle("is-active", isDrawMode);
  }

  function clearShape() {
    poolPoints = [];
    if (poolShapeLayer) {
      map.removeLayer(poolShapeLayer);
      poolShapeLayer = null;
    }
    invalidateSnapshot();
  }

  function redrawShape() {
    if (poolShapeLayer) {
      map.removeLayer(poolShapeLayer);
      poolShapeLayer = null;
    }

    if (poolPoints.length >= 3) {
      poolShapeLayer = window.L.polygon(poolPoints, {
        color: "#78aad2",
        weight: 2,
        fillColor: "#78aad2",
        fillOpacity: 0.28,
      }).addTo(map);
      setStatus(statusEl, `Pool shape has ${poolPoints.length} points. You can keep adding points or send it now.`);
      return;
    }

    if (poolPoints.length >= 2) {
      poolShapeLayer = window.L.polyline(poolPoints, {
        color: "#78aad2",
        weight: 2,
      }).addTo(map);
      setStatus(statusEl, "Keep tapping points to complete your pool shape.");
      return;
    }

    setStatus(statusEl, "Draw mode is on. Tap the map to add pool corners.");
  }

  async function findAddress() {
    const query = addressInput.value.trim();
    if (!query) {
      setStatus(statusEl, "Please enter an address first.", true);
      return;
    }

    setStatus(statusEl, "Searching for address...");

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) throw new Error("Address lookup failed");

      const results = await response.json();
      if (!Array.isArray(results) || results.length === 0) {
        setStatus(statusEl, "Address not found. Try a more specific address.", true);
        return;
      }

      const hit = results[0];
      const lat = Number(hit.lat);
      const lng = Number(hit.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setStatus(statusEl, "Address found, but map coordinates were invalid.", true);
        return;
      }

      map.setView([lat, lng], DRAW_ZOOM);

      if (homeMarker) {
        homeMarker.setLatLng([lat, lng]);
      } else {
        homeMarker = window.L.marker([lat, lng]).addTo(map);
      }

      const label = hit.display_name || query;
      homeMarker.bindPopup(`<strong>Property:</strong><br/>${label}`).openPopup();
      setStatus(statusEl, "Address located. Switch to Draw your Pool mode to sketch your shape.");
    } catch {
      setStatus(statusEl, "Could not search this address right now. Please try again.", true);
    }
  }

  async function handleDownloadSnapshot() {
    if (poolPoints.length < 3) {
      setStatus(statusEl, "Please draw at least 3 points to create a pool shape before downloading a snapshot.", true);
      return;
    }

    const address = addressInput.value.trim() || "pool-drawing";
    const addressFilePart = sanitizeFilenamePart(address);
    const snapshotFilename = `${addressFilePart || "pool-drawing"}-${Date.now()}.png`;

    setButtonBusy(downloadSnapshotBtn, true);
    setStatus(statusEl, "Preparing your map snapshot...");

    try {
      const snapshotCanvas = await captureMapSnapshotCanvas(mapEl);
      drawPoolOverlayOnCanvas(snapshotCanvas, mapEl, map, poolPoints);
      const finalBlob = await canvasToBlob(snapshotCanvas);

      downloadBlob(finalBlob, snapshotFilename);
      downloadedSnapshotFilename = snapshotFilename;
      hasFreshSnapshot = true;
      syncSendAvailability();
      setStatus(statusEl, `Snapshot downloaded as ${snapshotFilename}. Attach this file to your email draft.`);
    } catch {
      setStatus(statusEl, "Snapshot export failed on this device. Please try again.", true);
    } finally {
      setButtonBusy(downloadSnapshotBtn, false);
    }
  }

  async function handleSend() {
    if (!hasFreshSnapshot) {
      setStatus(statusEl, "Please download a snapshot first, then attach it to your email.", true);
      return;
    }

    if (poolPoints.length < 3) {
      setStatus(statusEl, "Please draw at least 3 points to create a pool shape before sending.", true);
      return;
    }

    const address = addressInput.value.trim() || "Not provided";
    const contactName = nameInput.value.trim() || "Not provided";
    const contactPhone = phoneInput.value.trim() || "Not provided";
    const contactEmail = emailInput.value.trim() || "Not provided";

    const pointsBlock = poolPoints
      .map((point, index) => `${index + 1}. ${formatLatLng(point)}`)
      .join("\n");

    setButtonBusy(sendBtn, true);

    const body = [
      "Hello Hogan Pools,",
      "",
      "I used the Design tool and would like to share my pool concept.",
      "",
      `Address: ${address}`,
      `Name: ${contactName}`,
      `Phone: ${contactPhone}`,
      `Email: ${contactEmail}`,
      "",
      downloadedSnapshotFilename
        ? `Attached map snapshot filename: ${downloadedSnapshotFilename}`
        : "I will attach the downloaded map snapshot image from the Design tool.",
      "",
      "Pool drawing points (lat, lng):",
      pointsBlock,
      "",
      "Please review and let me know next steps.",
    ].join("\n");

    try {
      sendBtn.setAttribute("href", buildMailto("Pool Design Drawing Submission", body));
      window.location.href = sendBtn.getAttribute("href");
      setStatus(statusEl, "Email draft opened. Attach your downloaded snapshot image before sending.");
    } finally {
      setButtonBusy(sendBtn, false);
    }
  }

  function handleCallback() {
    const address = addressInput.value.trim() || "Not provided";
    const contactName = nameInput.value.trim() || "Not provided";
    const contactPhone = phoneInput.value.trim() || "Not provided";
    const contactEmail = emailInput.value.trim() || "Not provided";

    const body = [
      "Hello Hogan Pools,",
      "",
      "I would like to schedule a call-back consultation for my pool project.",
      "",
      `Address: ${address}`,
      `Name: ${contactName}`,
      `Phone: ${contactPhone}`,
      `Email: ${contactEmail}`,
      "",
      "Please contact me with available times.",
    ].join("\n");

    callbackBtn.setAttribute("href", buildMailto("Callback Consultation Request", body));
    window.location.href = callbackBtn.getAttribute("href");
  }

  searchBtn.addEventListener("click", findAddress);
  addressInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      findAddress();
    }
  });

  toggleDrawBtn.addEventListener("click", () => {
    isDrawMode = !isDrawMode;
    updateDrawButtonLabel();
    setStatus(statusEl, isDrawMode ? "Draw mode is on. Tap the map to add pool corners." : "Draw mode is off.");
  });

  clearBtn.addEventListener("click", () => {
    clearShape();
    downloadedSnapshotFilename = "";
    setStatus(statusEl, "Drawing cleared. Enable Draw your Pool to start again.");
  });

  downloadSnapshotBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    await handleDownloadSnapshot();
  });

  map.on("click", (event) => {
    if (!isDrawMode) return;
    poolPoints.push(event.latlng);
    invalidateSnapshot();
    redrawShape();
  });

  map.on("moveend", () => {
    if (poolPoints.length >= 3) {
      invalidateSnapshot();
    }
  });

  sendBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    if (sendBtn.getAttribute("aria-disabled") === "true") {
      setStatus(statusEl, "Download and attach a snapshot before sending.", true);
      return;
    }
    await handleSend();
  });

  callbackBtn.addEventListener("click", (event) => {
    event.preventDefault();
    handleCallback();
  });

  updateDrawButtonLabel();
  syncSendAvailability();
  setStatus(statusEl, "Enter your address to begin.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initDesignTool(document));
} else {
  initDesignTool(document);
}
