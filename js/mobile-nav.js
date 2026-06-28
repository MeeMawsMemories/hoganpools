(() => {
  const debugNav = window.location.search.includes("navdebug=1");
  if (window.__hoganMobileDrawerBound) {
    if (debugNav) console.log("[nav]", "drawer binding skipped from mobile-nav.js", window.__hoganMobileDrawerBound);
    return;
  }

  const toggles = Array.from(document.querySelectorAll('.navtoggle[aria-controls="site-nav"], .topbar__icon--menu'));
  if (!toggles.length) return;

  window.__hoganMobileDrawerBound = "mobile-nav.js";

  function ensureDrawer() {
    let drawer = document.getElementById("mobile-menu-drawer");
    if (!drawer) {
      drawer = document.createElement("div");
      drawer.id = "mobile-menu-drawer";
      drawer.className = "mobile-menu-drawer";
      drawer.hidden = true;
      drawer.innerHTML = `
        <div class="mobile-menu-drawer__backdrop" data-mobile-menu-close></div>
        <nav class="mobile-menu-drawer__panel" aria-label="Mobile navigation">
          <button type="button" class="mobile-menu-drawer__close" data-mobile-menu-close aria-label="Close menu">&times;</button>
          <a href="/">Home</a>
          <a href="/our-process/">Our Process</a>
          <a href="/gallery/">Gallery</a>
          <a href="/about-us/">About Us</a>
          <a href="/financing/">Financing</a>
          <a href="/careers/">Careers</a>
        </nav>
      `;
      document.body.appendChild(drawer);
    }
    if (debugNav) {
      console.log("[nav]", "drawer ready from mobile-nav.js", {
        exists: Boolean(drawer),
        hidden: drawer.hidden,
        className: drawer.className,
      });
    }
    return drawer;
  }

  const drawer = ensureDrawer();
  if (!drawer) return;

  function syncButtons(open) {
    toggles.forEach((button) => {
      button.setAttribute("aria-expanded", String(open));
      if (button.dataset.iconToggle === "true") {
        button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        const icon = button.querySelector("span[aria-hidden='true']");
        if (icon) icon.textContent = open ? "✕" : "☰";
      } else {
        button.textContent = open ? "Close" : "Menu";
      }
    });
  }

  function openDrawer() {
    drawer.hidden = false;
    drawer.classList.add("is-open");
    document.body.classList.add("mobile-menu-open");
    syncButtons(true);
    if (debugNav) {
      console.log("[nav]", "drawer opened from mobile-nav.js", {
        hidden: drawer.hidden,
        className: drawer.className,
      });
    }
  }

  function closeDrawer(reason = "close") {
    drawer.classList.remove("is-open");
    drawer.hidden = true;
    document.body.classList.remove("mobile-menu-open");
    syncButtons(false);
    if (debugNav) {
      console.log("[nav]", "drawer closed from mobile-nav.js", {
        reason,
        hidden: drawer.hidden,
        className: drawer.className,
      });
    }
  }

  if (debugNav) console.log("[nav]", "drawer binding from mobile-nav.js");

  toggles.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openDrawer();
    });
  });

  document.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-mobile-menu-close]")) {
      event.preventDefault();
      closeDrawer("close-control");
      return;
    }
    if (event.target?.closest?.("#mobile-menu-drawer a")) {
      closeDrawer("link");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer("escape");
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 920px)").matches) {
      closeDrawer("desktop-resize");
    }
  });

  closeDrawer("init");
})();
