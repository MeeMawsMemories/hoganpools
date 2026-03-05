const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_IMAGE_JS_URL = "https://unpkg.com/leaflet-image@0.4.0/leaflet-image.js";
const HTML2CANVAS_JS_URL = "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js";
const DEFAULT_CENTER = [38.627, -90.1994];
const DEFAULT_ZOOM = 11;
const DRAW_ZOOM = 20;

let leafletLoadPromise = null;
let leafletImageLoadPromise = null;
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

function ensureLeafletImageAsset() {
  if (typeof window.leafletImage === "function") return Promise.resolve(window.leafletImage);
  if (leafletImageLoadPromise) return leafletImageLoadPromise;

  leafletImageLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${LEAFLET_IMAGE_JS_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.leafletImage), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load leaflet-image.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = LEAFLET_IMAGE_JS_URL;
    script.async = true;
    script.onload = () => resolve(window.leafletImage);
    script.onerror = () => reject(new Error("Failed to load leaflet-image."));
    document.head.appendChild(script);
  });

  return leafletImageLoadPromise;
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

async function captureMapSnapshotCanvas(mapEl, map) {
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  await new Promise((resolve) => window.requestAnimationFrame(resolve));

  try {
    await ensureLeafletImageAsset();
    if (typeof window.leafletImage === "function" && map) {
      const rendered = await new Promise((resolve, reject) => {
        window.leafletImage(map, (error, canvas) => {
          if (error || !canvas) {
            reject(error || new Error("leaflet-image render failed."));
            return;
          }
          resolve(canvas);
        });
      });

      if (rendered) return rendered;
    }
  } catch {
    // Fall back to html2canvas below.
  }

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

  const zoom = map.getZoom();
  const pixelOrigin = map.getPixelOrigin();
  const mapSize = map.getSize();

  const points = poolPoints
    .map((latLng) => {
      const containerPoint = map.latLngToContainerPoint(latLng);
      const projectedPoint = map.project(latLng, zoom).subtract(pixelOrigin);

      const preferred = Number.isFinite(containerPoint?.x) && Number.isFinite(containerPoint?.y)
        ? containerPoint
        : projectedPoint;

      const fallback = Number.isFinite(projectedPoint?.x) && Number.isFinite(projectedPoint?.y)
        ? projectedPoint
        : null;

      const chosen = (() => {
        if (!preferred) return fallback;

        const inReasonableBounds =
          preferred.x >= (-mapSize.x * 2) &&
          preferred.x <= (mapSize.x * 3) &&
          preferred.y >= (-mapSize.y * 2) &&
          preferred.y <= (mapSize.y * 3);

        if (inReasonableBounds) return preferred;
        return fallback || preferred;
      })();

      if (!chosen || !Number.isFinite(chosen.x) || !Number.isFinite(chosen.y)) return null;

      return {
        x: chosen.x * scaleX,
        y: chosen.y * scaleY,
      };
    })
    .filter(Boolean);

  if (points.length < 2) return;

  ctx.save();
  const baseStroke = Math.max(3, 3 * Math.max(scaleX, scaleY));
  const haloStroke = baseStroke * 2.2;
  const markerRadius = Math.max(4, 4 * Math.max(scaleX, scaleY));

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  if (points.length >= 3) {
    ctx.closePath();
    ctx.fillStyle = "rgba(43, 170, 255, 0.32)";
    ctx.fill();
  }

  ctx.lineWidth = haloStroke;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.stroke();

  ctx.lineWidth = baseStroke;
  ctx.strokeStyle = "rgba(0,120,255,0.98)";
  ctx.stroke();

  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, markerRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();
    ctx.lineWidth = Math.max(2, baseStroke * 0.6);
    ctx.strokeStyle = "rgba(0,120,255,0.95)";
    ctx.stroke();
  });

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
  const viewStreetBtn = designRoot.querySelector('[data-design-action="view-street"]');
  const viewSatelliteBtn = designRoot.querySelector('[data-design-action="view-satellite"]');
  const downloadSnapshotBtn = designRoot.querySelector('[data-design-action="download-snapshot"]');
  const sendBtn = designRoot.querySelector('[data-design-action="send"]');
  const callbackBtn = designRoot.querySelector('[data-design-action="callback"]');

  if (!mapEl || !addressInput || !searchBtn || !toggleDrawBtn || !clearBtn || !viewStreetBtn || !viewSatelliteBtn || !downloadSnapshotBtn || !sendBtn || !callbackBtn) return;

  designRoot.dataset.designBound = "true";

  try {
    await ensureLeafletAssets();
  } catch (error) {
    setStatus(statusEl, "Map failed to load. Please refresh and try again.", true);
    return;
  }

  const map = window.L.map(mapEl, { zoomControl: true, scrollWheelZoom: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  const streetLayer = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 21,
    crossOrigin: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });

  const satelliteLayer = window.L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 21,
    crossOrigin: true,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  });

  streetLayer.addTo(map);
  window.setTimeout(() => map.invalidateSize(), 120);

  let homeMarker = null;
  let poolPoints = [];
  let poolShapeLayer = null;
  let isDrawMode = false;
  let downloadedSnapshotFilename = "";
  let hasFreshSnapshot = false;
  let activeBaseLayer = "street";

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

  function updateViewButtons() {
    viewStreetBtn.classList.toggle("is-active", activeBaseLayer === "street");
    viewSatelliteBtn.classList.toggle("is-active", activeBaseLayer === "satellite");
  }

  function setBaseLayer(nextLayer) {
    const target = nextLayer === "satellite" ? "satellite" : "street";
    if (activeBaseLayer === target) return;

    if (target === "satellite") {
      if (map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
      if (!map.hasLayer(satelliteLayer)) satelliteLayer.addTo(map);
      activeBaseLayer = "satellite";
      updateViewButtons();
      return;
    }

    if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
    if (!map.hasLayer(streetLayer)) streetLayer.addTo(map);
    activeBaseLayer = "street";
    updateViewButtons();
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
      const snapshotCanvas = await captureMapSnapshotCanvas(mapEl, map);
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
      "I have attached the downloaded map snapshot image from the Design tool.",
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

  viewStreetBtn.addEventListener("click", () => {
    setBaseLayer("street");
  });

  viewSatelliteBtn.addEventListener("click", () => {
    setBaseLayer("satellite");
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
  updateViewButtons();
  syncSendAvailability();
  setStatus(statusEl, "Enter your address to begin.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initDesignTool(document));
} else {
  initDesignTool(document);
}
