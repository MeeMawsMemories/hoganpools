(() => {
  const BG_VIDEO_BASELINE_SRC = "/assets/video/water720p-baseline.mp4";
  const BG_VIDEO_DEFAULT_SRC = "/assets/video/water720p.mp4";
  let hasArmedBackgroundVideoRetry = false;

  function selectBackgroundVideoSource(videoEl) {
    if (!videoEl) return;

    const desiredSources = [BG_VIDEO_BASELINE_SRC, BG_VIDEO_DEFAULT_SRC];
    const existingSources = Array.from(videoEl.querySelectorAll('source[type="video/mp4"]'));
    let changed = false;

    desiredSources.forEach((src, index) => {
      let source = existingSources[index];
      if (!source) {
        source = document.createElement("source");
        source.type = "video/mp4";
        videoEl.appendChild(source);
        changed = true;
      }

      if (source.getAttribute("src") !== src) {
        source.setAttribute("src", src);
        changed = true;
      }
    });

    existingSources.slice(desiredSources.length).forEach((source) => {
      source.remove();
      changed = true;
    });

    if (changed) {
      videoEl.load();
    }
  }

  function armBackgroundVideoRetry(videoEl) {
    if (!videoEl || hasArmedBackgroundVideoRetry) return;
    hasArmedBackgroundVideoRetry = true;

    const retryPlay = () => {
      window.removeEventListener("touchstart", retryPlay, true);
      window.removeEventListener("click", retryPlay, true);
      hasArmedBackgroundVideoRetry = false;

      try {
        const retryPromise = videoEl.play();
        if (retryPromise && typeof retryPromise.catch === "function") {
          retryPromise.catch(() => {
            // Ignore second-play failures and keep poster fallback.
          });
        }
      } catch {
        // Ignore second-play failures and keep poster fallback.
      }
    };

    window.addEventListener("touchstart", retryPlay, true);
    window.addEventListener("click", retryPlay, true);
  }

  function initStageVisibility() {
    const root = document.documentElement;
    const stage = document.querySelector(".stage");
    const bg = document.querySelector(".bg");
    const bgVideo = document.querySelector(".bg__video");

    // Match SPA boot behavior so static pages don't keep stage content hidden.
    root.classList.add("bg-ready");
    if (stage) {
      stage.classList.add("is-ready", "is-controls");
      stage.classList.remove("is-intro");
    }

    if (!bg || !bgVideo) return;

    selectBackgroundVideoSource(bgVideo);
    bgVideo.muted = true;
    bgVideo.defaultMuted = true;
    bgVideo.playsInline = true;
    bgVideo.setAttribute("muted", "");
    bgVideo.setAttribute("playsinline", "");

    const revealVideo = () => bg.classList.add("is-video-ready");
    if (bgVideo.readyState >= 3) {
      revealVideo();
    } else {
      bgVideo.addEventListener("canplay", revealVideo, { once: true });
      bgVideo.addEventListener("playing", revealVideo, { once: true });
    }

    try {
      const p = bgVideo.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          armBackgroundVideoRetry(bgVideo);
        });
      }
    } catch {
      armBackgroundVideoRetry(bgVideo);
    }
  }

  function initObfuscatedPhoneLinks(root = document) {
    root.querySelectorAll("a[data-obf-tel]").forEach((link) => {
      if (link.dataset.obfBound === "true") return;
      link.dataset.obfBound = "true";

      link.addEventListener("click", (event) => {
        event.preventDefault();
        const encoded = link.getAttribute("data-obf-tel") || "";
        try {
          const decoded = window.atob(encoded);
          if (decoded.startsWith("tel:")) {
            window.location.href = decoded;
          }
        } catch {
          // Ignore malformed values.
        }
      });
    });
  }

  function initHeaderBubbles() {
    const header = document.querySelector(".site-header");
    if (!header) return;

    const buttons = Array.from(header.querySelectorAll(".topbar__icon[aria-controls]"));
    if (!buttons.length) return;

    const closeAll = () => {
      buttons.forEach((btn) => {
        const targetId = btn.getAttribute("aria-controls");
        const bubble = targetId ? header.querySelector(`#${targetId}`) : null;
        btn.setAttribute("aria-expanded", "false");
        if (bubble) {
          bubble.classList.remove("is-open");
          bubble.setAttribute("aria-hidden", "true");
        }
      });
    };

    buttons.forEach((btn) => {
      const targetId = btn.getAttribute("aria-controls");
      const bubble = targetId ? header.querySelector(`#${targetId}`) : null;
      if (!bubble) return;

      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = btn.getAttribute("aria-expanded") === "true";
        closeAll();
        if (!isOpen) {
          btn.setAttribute("aria-expanded", "true");
          bubble.classList.add("is-open");
          bubble.setAttribute("aria-hidden", "false");
        }
      });
    });

    document.addEventListener("click", (event) => {
      if (!header.contains(event.target)) closeAll();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAll();
    });
  }

  function initNavToggles() {
    const nav = document.getElementById("site-nav");
    const toggles = Array.from(document.querySelectorAll(".navtoggle[aria-controls='site-nav']"));
    if (!nav || !toggles.length) return;

    const sync = (open) => {
      nav.classList.toggle("nav--open", open);
      toggles.forEach((toggle) => {
        toggle.setAttribute("aria-expanded", String(open));
        if (toggle.dataset.iconToggle === "true") {
          toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
          const icon = toggle.querySelector("span[aria-hidden='true']");
          if (icon) icon.textContent = open ? "✕" : "☰";
        } else {
          toggle.textContent = open ? "Close" : "Menu";
        }
      });
    };

    toggles.forEach((toggle) => {
      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        sync(!nav.classList.contains("nav--open"));
      });
    });

    document.addEventListener("click", (event) => {
      const navLink = event.target?.closest?.("#site-nav a");
      if (navLink) sync(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") sync(false);
    });

    sync(false);
  }

  function boot() {
    initStageVisibility();
    initObfuscatedPhoneLinks(document);
    initHeaderBubbles();
    initNavToggles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
