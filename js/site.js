async function inject(id, url) {
  const el = document.getElementById(id);
  if (!el) return;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  el.innerHTML = await res.text();
}

function wireNavToggle() {
  const btn = document.querySelector(".navtoggle");
  const nav = document.getElementById("site-nav");
  if (!btn || !nav) return;

  btn.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("nav--open");
    btn.setAttribute("aria-expanded", String(isOpen));
    btn.textContent = isOpen ? "Close" : "Menu";
  });
}

(async () => {
  await inject("site-header", "/partials/header.html");
  await inject("site-footer", "/partials/footer.html");
  wireNavToggle();
})();
