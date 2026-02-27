// /js/app.js
import { getRouteFromHref, getRouteFromLocation, loadRoute, routeToPath } from "./router.js";

const app = document.getElementById("app");
const siteHeader = document.getElementById("site-header");
const stage = document.querySelector(".stage");
const stageCard = document.querySelector(".stage__card");
const bg = document.querySelector(".bg");
const bgVideo = document.querySelector(".bg__video");
const prevButton = document.querySelector(".stage__control--left");
const nextButton = document.querySelector(".stage__control--right");
const BG_VIDEO_DEFAULT_SRC = "/assets/video/water720p.mp4";
const BG_VIDEO_LARGE_SRC = "/assets/video/water-wipe2.mp4";
const LARGE_SCREEN_MIN_WIDTH = 2561;
const LARGE_SCREEN_MIN_HEIGHT = 1441;

const ROUTE_ORDER = ["home", "process", "gallery", "about", "financing", "careers"];
const SEO_BASE_URL = "https://www.hoganpools.com";
const SEO_ROUTES = {
  home: {
    title: "Hogan Pools | Custom Pool Construction | Ballwin, MO, USA",
    description: "Hogan Pools designs and builds custom gunite pools in Ballwin and the greater St. Louis area, with quality craftsmanship, clear communication, and lasting finishes.",
  },
  process: {
    title: "Our Process | Hogan Pools",
    description: "Learn the Hogan Pools process, from consultation and excavation to gunite application, startup, and long-term pool care.",
  },
  gallery: {
    title: "Pool Gallery | Hogan Pools",
    description: "Browse recent custom pool projects by Hogan Pools and explore design inspiration from completed backyard builds.",
  },
  about: {
    title: "About Hogan Pools | Family-Owned Pool Builders",
    description: "Meet Hogan Pools, a family-owned pool builder serving the St. Louis area with three generations of construction experience.",
  },
  financing: {
    title: "Financing Options | Hogan Pools",
    description: "Review financing options for your custom pool project and estimate monthly payment ranges with Hogan Pools.",
  },
  careers: {
    title: "Careers at Hogan Pools",
    description: "Join the Hogan Pools team and help build premium custom pool projects across Ballwin and the St. Louis area.",
  },
};

let cleanupHomeTestimonialsMobileRotator = null;
let galleryLightboxModulePromise = null;
let hearthLoaderModulePromise = null;
let hasStartedBackgroundVideo = false;

function shouldUseLargeBackgroundVideo() {
  const screenWidth = window.screen?.width || window.innerWidth || 0;
  const screenHeight = window.screen?.height || window.innerHeight || 0;
  return screenWidth >= LARGE_SCREEN_MIN_WIDTH || screenHeight >= LARGE_SCREEN_MIN_HEIGHT;
}

function selectBackgroundVideoSource(videoEl) {
  if (!videoEl) return;

  const nextSrc = shouldUseLargeBackgroundVideo() ? BG_VIDEO_LARGE_SRC : BG_VIDEO_DEFAULT_SRC;
  let source = videoEl.querySelector("source");
  if (!source) {
    source = document.createElement("source");
    source.type = "video/mp4";
    videoEl.appendChild(source);
  }

  const currentSrc = source.getAttribute("src") || "";
  if (currentSrc === nextSrc) return;
  source.setAttribute("src", nextSrc);
  videoEl.load();
}

function ensureMetaByName(name) {
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  return tag;
}

function ensureMetaByProperty(property) {
  let tag = document.head.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  return tag;
}

function ensureCanonicalLink() {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  return link;
}

function updateSeoForRoute(route) {
  const fallback = SEO_ROUTES.home;
  const seo = SEO_ROUTES[route] || fallback;
  const routePath = routeToPath(route);
  const routeUrl = `${SEO_BASE_URL}${routePath}`;

  document.title = seo.title;
  ensureMetaByName("description").setAttribute("content", seo.description);
  ensureMetaByName("twitter:title").setAttribute("content", seo.title);
  ensureMetaByName("twitter:description").setAttribute("content", seo.description);
  ensureMetaByProperty("og:title").setAttribute("content", seo.title);
  ensureMetaByProperty("og:description").setAttribute("content", seo.description);
  ensureMetaByProperty("og:url").setAttribute("content", routeUrl);

  ensureCanonicalLink().setAttribute("href", routeUrl);
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
        // ignore invalid payloads
      }
    });
  });
}

function syncHomeHeroPriority(route) {
  const heroImg = app?.querySelector(".home-hero-media__media img");
  if (!heroImg) return;

  if (route === "home") {
    heroImg.loading = "eager";
    heroImg.fetchPriority = "high";
  } else {
    heroImg.loading = "lazy";
    heroImg.fetchPriority = "auto";
  }
}

async function ensureRouteAssets(route) {
  if (route === "gallery") {
    if (!galleryLightboxModulePromise) {
      galleryLightboxModulePromise = import("./gallery-lightbox.js");
    }
    await galleryLightboxModulePromise;
  }

  if (route === "financing") {
    if (!hearthLoaderModulePromise) {
      hearthLoaderModulePromise = import("./hearth-loader.js");
    }
    await hearthLoaderModulePromise;
  }
}

function syncRouteBodyClasses(route) {
  document.body.classList.toggle("is-home", route === "home");
}

function updateHomeFitScale() {
  if (!stageCard) return;

  const isHome = document.body.classList.contains("is-home");
  const homeStack = document.querySelector(".home-stack");

  // Always clean up when not on Home
  if (!isHome || !homeStack) {
    stageCard.classList.remove("is-home-fit");
    // Home sets an inline paddingBottom for its fit behavior; clear it when leaving Home
    // so other routes (e.g. Gunite) don't inherit extra space below their content.
    stageCard.style.paddingBottom = "";
    if (homeStack) homeStack.style.setProperty("--home-fit-scale", "1");
    return;
  }

  stageCard.classList.add("is-home-fit");

  // Measure header height (already injected into #site-header)
  const headerEl = document.getElementById("site-header");
  const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0;

  // Pull stage vertical padding from CSS variables (fallbacks are safe)
  const rootStyle = getComputedStyle(document.documentElement);
  const stagePadTotal = parseFloat(rootStyle.getPropertyValue("--stage-pad-total")) || 64;

  // Available viewport height for the card CONTENT (not the card box)
  const viewportH = window.innerHeight || 0;

  const stageContent = document.querySelector(".stage__content");
  const contentStyle = stageContent ? getComputedStyle(stageContent) : null;
  const padTop = contentStyle ? (parseFloat(contentStyle.paddingTop) || 0) : 0;
  const padBot = contentStyle ? (parseFloat(contentStyle.paddingBottom) || 0) : 0;

  const desiredBottomPad = 32;
  const buffer = 38;
  const available = Math.max(0, viewportH - headerH - stagePadTotal - padTop - desiredBottomPad - buffer);

  // Measure natural height with scaling disabled
  const prevTransform = homeStack.style.transform;
  homeStack.style.transform = "none";
  const natural = homeStack.getBoundingClientRect().height;
  homeStack.style.transform = prevTransform;

  // ONLY scale down (never scale up)
  let scale = available / natural;
  scale = Math.min(1, scale);
  if (!Number.isFinite(scale)) scale = 1;

  homeStack.style.setProperty("--home-fit-scale", String(scale));

  // Ensure bottom padding is always present
  stageCard.style.paddingBottom = `${padBot || 32}px`;
}

function syncHeaderHeight() {
  if (!siteHeader) return;
  const height = siteHeader.getBoundingClientRect().height;
  document.documentElement.style.setProperty("--header-height", `${height}px`);
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function initHomeTestimonialsMobileRotator() {
  cleanupHomeTestimonialsMobileRotator?.();
  cleanupHomeTestimonialsMobileRotator = null;

  if (!document.body.classList.contains("is-home")) return;
  if (!window.matchMedia?.("(max-width: 820px)")?.matches) return;

  const section = document.querySelector(".home-testimonials");
  const rail = section?.querySelector(".home-testimonials__rail");
  const cards = rail ? Array.from(rail.querySelectorAll(".home-testimonial")) : [];
  if (!section || !rail || cards.length === 0) return;

  const items = cards
    .map((card) => {
      const quote = card.querySelector(".home-testimonial__quote")?.textContent?.trim() || "";
      const name = card.querySelector(".home-testimonial__name")?.textContent?.trim() || "";
      return { quote, name };
    })
    .filter((item) => item.quote.length > 0);

  if (items.length === 0) return;

  let rotator = section.querySelector(".home-testimonial-rotator");
  if (!rotator) {
    rotator = document.createElement("article");
    rotator.className = "home-testimonial home-testimonial-rotator";
    rotator.setAttribute("role", "status");
    rotator.setAttribute("aria-live", "polite");
    rotator.innerHTML = `
      <p class="home-testimonial__quote"></p>
      <div class="home-testimonial__name"></div>
    `.trim();
    rail.insertAdjacentElement("beforebegin", rotator);
  }

  const quoteEl = rotator.querySelector(".home-testimonial__quote");
  const nameEl = rotator.querySelector(".home-testimonial__name");
  if (!quoteEl || !nameEl) return;

  let index = 0;
  let tickTimer = 0;
  let swapTimer = 0;
  const fadeMs = 420;
  const holdMs = 5200;

  const render = () => {
    const next = items[index % items.length];
    quoteEl.textContent = next.quote;
    nameEl.textContent = next.name;
  };

  render();

  if (!prefersReducedMotion() && items.length > 1) {
    const scheduleNext = () => {
      tickTimer = window.setTimeout(() => {
        rotator.classList.add("is-fading");
        swapTimer = window.setTimeout(() => {
          index = (index + 1) % items.length;
          render();
          rotator.classList.remove("is-fading");
          scheduleNext();
        }, fadeMs);
      }, holdMs);
    };
    scheduleNext();
  }

  cleanupHomeTestimonialsMobileRotator = () => {
    if (tickTimer) window.clearTimeout(tickTimer);
    if (swapTimer) window.clearTimeout(swapTimer);
    rotator?.remove();
  };
}

function initBackgroundVideoGate() {
  selectBackgroundVideoSource(bgVideo);
  const root = document.documentElement;
  root.classList.add("bg-ready");
  return Promise.resolve();
}

function startBackgroundVideo() {
  if (!bgVideo || hasStartedBackgroundVideo) return;

  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
  } catch {
    // ignore
  }

  hasStartedBackgroundVideo = true;

  const reveal = () => {
    if (bg) bg.classList.add("is-video-ready");
  };

  if (bgVideo.readyState >= 3) {
    reveal();
  } else {
    bgVideo.addEventListener("playing", reveal, { once: true });
    bgVideo.addEventListener("canplay", reveal, { once: true });
    bgVideo.addEventListener("loadeddata", reveal, { once: true });
  }

  try {
    const p = bgVideo.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        hasStartedBackgroundVideo = false;
      });
    }
  } catch {
    hasStartedBackgroundVideo = false;
  }
}

function startBackgroundVideoAfterInitialPaint() {
  const launch = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        startBackgroundVideo();
      });
    });
  };

  if (document.readyState === "complete") {
    launch();
    return;
  }

  window.addEventListener("load", launch, { once: true });
}

async function injectPartials() {
  if (!siteHeader.querySelector(".site-header")) {
    const h = await fetch("/partials/header.html").then((r) => r.text());
    siteHeader.innerHTML = h;
  }

  // Wire nav toggle for mobile
  const navToggles = Array.from(siteHeader.querySelectorAll(".navtoggle[aria-controls='site-nav']"));
  const siteNav = siteHeader.querySelector("#site-nav");
  if (navToggles.length && siteNav) {
    const syncNavToggleState = (isOpen) => {
      navToggles.forEach((navtoggle) => {
        navtoggle.setAttribute("aria-expanded", String(isOpen));
        if (navtoggle.dataset.iconToggle === "true") {
          navtoggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
          const icon = navtoggle.querySelector("span[aria-hidden='true']");
          if (icon) {
            icon.textContent = isOpen ? "✕" : "☰";
          }
        } else {
          navtoggle.textContent = isOpen ? "Close" : "Menu";
        }
      });
    };

    navToggles.forEach((navtoggle) => {
      navtoggle.addEventListener("click", () => {
      const isOpen = siteNav.classList.toggle("nav--open");
      syncNavToggleState(isOpen);
    });
    });

    syncNavToggleState(siteNav.classList.contains("nav--open"));
  }

  if (document.documentElement.dataset.topbarBubbles !== "true") {
    document.documentElement.dataset.topbarBubbles = "true";
    const closeAll = () => {
      siteHeader.querySelectorAll(".topbar__icon").forEach((btn) => {
        const bubbleId = btn.getAttribute("aria-controls");
        const bubble = bubbleId ? siteHeader.querySelector(`#${bubbleId}`) : null;
        btn.setAttribute("aria-expanded", "false");
        if (bubble) {
          bubble.classList.remove("is-open");
          bubble.setAttribute("aria-hidden", "true");
        }
      });
    };

    siteHeader.querySelectorAll(".topbar__icon").forEach((btn) => {
      const bubbleId = btn.getAttribute("aria-controls");
      const bubble = bubbleId ? siteHeader.querySelector(`#${bubbleId}`) : null;
      if (!bubble) return;

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = btn.getAttribute("aria-expanded") === "true";
        closeAll();
        if (!isOpen) {
          btn.setAttribute("aria-expanded", "true");
          bubble.classList.add("is-open");
          bubble.setAttribute("aria-hidden", "false");
        }
      });
    });

    document.addEventListener("click", (e) => {
      if (!siteHeader.contains(e.target)) closeAll();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });
  }
}

function setIntroState() {
  if (!stage) return;
  stage.classList.add("is-intro");
  stage.classList.remove("is-ready", "is-controls");

  if (prefersReducedMotion()) {
    stage.classList.add("is-ready", "is-controls");
    stage.classList.remove("is-intro");
    document.documentElement.classList.add("reduced-motion");
    return;
  }

  document.documentElement.classList.remove("reduced-motion");

  const introDelay = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--intro-delay"), 10) || 1800;
  const cardDelay = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--intro-card"), 10) || 900;
  const controlsDelay = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--intro-controls"), 10) || 700;

  setTimeout(() => {
    stage.classList.add("is-ready");
    setTimeout(() => {
      stage.classList.add("is-controls");
    }, controlsDelay);
  }, introDelay + cardDelay);
}

function getNextRoute(direction) {
  const current = getRouteFromLocation();
  const index = ROUTE_ORDER.indexOf(current);
  const nextIndex = (index + direction + ROUTE_ORDER.length) % ROUTE_ORDER.length;
  return ROUTE_ORDER[nextIndex];
}

function getDirection(fromRoute, toRoute) {
  const fromIndex = ROUTE_ORDER.indexOf(fromRoute);
  const toIndex = ROUTE_ORDER.indexOf(toRoute);
  if (fromIndex === -1 || toIndex === -1) return "forward";
  if (fromIndex === toIndex) return "forward";
  return toIndex > fromIndex ? "forward" : "backward";
}

let currentRoute = getRouteFromLocation();
let isTransitioning = false;

async function renderRouteIntoCurrent(route) {
  syncRouteBodyClasses(route);
  updateSeoForRoute(route);
  await ensureRouteAssets(route);
  await loadRoute(route, app);
  initObfuscatedPhoneLinks(app || document);
  syncHomeHeroPriority(route);
  if (route === "financing") {
    window.initHearthCalculator?.();
  }
  currentRoute = route;
  syncHeaderHeight();
  updateHomeFitScale();
  initHomeTestimonialsMobileRotator();
}

function waitForCardTransformEnd() {
  if (!stageCard) return Promise.resolve();
  return new Promise((resolve) => {
    const onEnd = (e) => {
      if (e.propertyName !== "transform") return;
      stageCard.removeEventListener("transitionend", onEnd);
      resolve();
    };
    stageCard.addEventListener("transitionend", onEnd);
  });
}

async function slideCardNavigate(route, dir) {
  if (isTransitioning) return;
  if (!stage || !stageCard) return;

  if (prefersReducedMotion()) {
    await renderRouteIntoCurrent(route);
    history.pushState({ route }, "", routeToPath(route));
    return;
  }

  isTransitioning = true;

  const slideOutClass = dir === "right" ? "slide-out-left" : "slide-out-right";
  const slideInClass = dir === "right" ? "slide-in-from-right" : "slide-in-from-left";

  stage.classList.add("is-sliding", "stage-prep");
  stage.classList.remove("slide-out-left", "slide-out-right", "slide-in-from-left", "slide-in-from-right");
  stageCard.getBoundingClientRect();
  stage.classList.remove("stage-prep");
  stage.classList.add(slideOutClass);

  await waitForCardTransformEnd();

  // Apply route-scoped body classes BEFORE injecting new HTML so page-specific
  // padding (e.g. Gunite) is correct on first paint during the transition.
  syncRouteBodyClasses(route);
  updateSeoForRoute(route);
  await ensureRouteAssets(route);
  await loadRoute(route, app);
  initObfuscatedPhoneLinks(app || document);
  if (route === "financing") {
    window.initHearthCalculator?.();
  }
  currentRoute = route;
  history.pushState({ route }, "", routeToPath(route));
  syncHeaderHeight();
  updateHomeFitScale();
  initHomeTestimonialsMobileRotator();

  stage.classList.add("stage-prep");
  stage.classList.remove(slideOutClass);
  stage.classList.add(slideInClass);
  stageCard.getBoundingClientRect();
  stage.classList.remove("stage-prep");
  stageCard.getBoundingClientRect();
  stage.classList.remove(slideInClass);

  await waitForCardTransformEnd();

  stage.classList.remove("is-sliding", "stage-prep", slideOutClass, slideInClass);
  isTransitioning = false;
}

async function navigate(route) {
  await renderRouteIntoCurrent(route);
}

function onNavClick(e) {
  const a = e.target.closest("a");
  if (!a) return;

  if (a.hasAttribute("download")) return;
  if (a.target && a.target.toLowerCase() === "_blank") return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

  let route = a.getAttribute("data-nav");
  if (!route) {
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;
    route = getRouteFromHref(a.href);
  }
  if (!route) return;
  e.preventDefault();

  const siteNav = siteHeader?.querySelector("#site-nav");
  if (siteNav?.classList.contains("nav--open")) {
    siteNav.classList.remove("nav--open");
    const navToggles = Array.from(siteHeader.querySelectorAll(".navtoggle[aria-controls='site-nav']"));
    navToggles.forEach((navtoggle) => {
      navtoggle.setAttribute("aria-expanded", "false");
      if (navtoggle.dataset.iconToggle === "true") {
        navtoggle.setAttribute("aria-label", "Open menu");
        const icon = navtoggle.querySelector("span[aria-hidden='true']");
        if (icon) {
          icon.textContent = "☰";
        }
      } else {
        navtoggle.textContent = "Menu";
      }
    });
  }

  if (route === currentRoute) return;
  const direction = getDirection(currentRoute, route);
  slideCardNavigate(route, direction === "forward" ? "right" : "left");
}

function onStageControl(direction) {
  const next = getNextRoute(direction);
  if (next === currentRoute) return;
  slideCardNavigate(next, direction > 0 ? "right" : "left");
}

async function boot() {
  initBackgroundVideoGate();

  await injectPartials();
  initObfuscatedPhoneLinks(document);

  syncHeaderHeight();
  window.addEventListener("resize", () => {
    syncHeaderHeight();
    updateHomeFitScale();
    initHomeTestimonialsMobileRotator();
  });
  window.addEventListener("DOMContentLoaded", updateHomeFitScale);

  setIntroState();

  const wakeVideo = () => startBackgroundVideo();
  ["pointerdown", "touchstart", "keydown", "scroll"].forEach((eventName) => {
    window.addEventListener(eventName, wakeVideo, { once: true, passive: true });
  });

  document.addEventListener("click", onNavClick);

  if (prevButton) {
    prevButton.addEventListener("click", () => onStageControl(-1));
  }
  if (nextButton) {
    nextButton.addEventListener("click", () => onStageControl(1));
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") onStageControl(-1);
    if (e.key === "ArrowRight") onStageControl(1);
  });

  // initial load
  const initialRoute = getRouteFromLocation();
  await renderRouteIntoCurrent(initialRoute);

  const expectedPath = routeToPath(currentRoute);
  if (location.pathname !== expectedPath || location.hash) {
    history.replaceState({ route: currentRoute }, "", expectedPath);
  }

  startBackgroundVideoAfterInitialPaint();

  // browser history navigation (back/forward)
  window.addEventListener("popstate", async () => {
    const nextRoute = getRouteFromLocation();
    await navigate(nextRoute);
  });
}

boot();
