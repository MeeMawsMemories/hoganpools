// /js/router.js
export const ROUTES = {
  home: "home",
  process: "process",
  gallery: "gallery",
  about: "about",
  financing: "financing",
  careers: "careers",
};

const ROUTE_PATHS = {
  home: "/",
  process: "/our-process/",
  gallery: "/gallery/",
  about: "/about-us/",
  financing: "/financing/",
  careers: "/careers/",
};

const PATH_ROUTES = {
  "/": "home",
  "/our-process/": "process",
  "/gallery/": "gallery",
  "/about-us/": "about",
  "/financing/": "financing",
  "/careers/": "careers",
};

function normalizePath(pathname = "/") {
  const base = pathname.trim() || "/";
  if (base === "/") return "/";
  return base.endsWith("/") ? base : `${base}/`;
}

export function routeToPath(route) {
  return ROUTE_PATHS[route] || "/";
}

export function getRouteFromHref(href) {
  try {
    const u = new URL(href, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    return PATH_ROUTES[normalizePath(u.pathname)] || null;
  } catch {
    return null;
  }
}

export function getRouteFromLocation() {
  const hash = (location.hash || "").replace(/^#/, "");
  if (ROUTES[hash]) return hash;

  const byPath = PATH_ROUTES[normalizePath(location.pathname)];
  if (byPath) return byPath;

  return "home";
}

export async function loadRoute(route, mountEl) {
  const url = `/pages/${route}.html`;
  const res = await fetch(url, { cache: "no-store" });
  const targetEl = mountEl || document.getElementById("app");
  if (!res.ok) {
    if (targetEl) {
      targetEl.innerHTML = `<div class="container"><h1>Not found</h1><p>Missing: ${url}</p></div>`;
    }
    return;
  }
  if (targetEl) {
    const html = await res.text();
    targetEl.innerHTML = html; // whatever your injection line is
    window.initHearthCalculator?.(); // <-- add this
  }
}
