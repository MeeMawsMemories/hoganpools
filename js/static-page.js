(() => {
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
