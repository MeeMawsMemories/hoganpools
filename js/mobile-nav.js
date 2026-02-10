(() => {
  function getEls() {
    const btn = document.querySelector(".navtoggle");
    const nav = document.querySelector("#site-nav");
    return { btn, nav };
  }

  function setOpen(open) {
    const { btn, nav } = getEls();
    if (!btn || !nav) return;
    nav.classList.toggle("nav--open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  function handleToggle(e) {
    const toggle = e.target?.closest?.(".navtoggle");
    if (!toggle) return;
    e.preventDefault();
    const nav = document.querySelector("#site-nav");
    if (!nav) return;
    setOpen(!nav.classList.contains("nav--open"));
  }

  document.addEventListener("click", handleToggle, true);
  document.addEventListener("touchstart", handleToggle, { capture: true, passive: false });

  document.addEventListener("click", (e) => {
    const link = e.target?.closest?.("#site-nav a");
    if (link) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });

  // Ensure closed on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setOpen(false));
  } else {
    setOpen(false);
  }
})();