// /js/router.js
export const ROUTES = {
  home: "home",
  gunite: "gunite",
  process: "process",
  gallery: "gallery",
  about: "about",
  financing: "financing",
};

export function getRouteFromLocation() {
  const hash = (location.hash || "#home").replace(/^#/, "");
  return ROUTES[hash] ? hash : "home";
}

export async function loadRoute(route, mountEl) {
  const url = `/pages/${route}.html`;
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    mountEl.innerHTML = `<div class="container"><h1>Not found</h1><p>Missing: ${url}</p></div>`;
    return;
  }
  mountEl.innerHTML = await res.text();
}
