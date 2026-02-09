// /js/app.js
import { getRouteFromLocation, loadRoute } from "./router.js";

const app = document.getElementById("app");
const siteHeader = document.getElementById("site-header");
const stage = document.querySelector(".stage");
const stageCard = document.querySelector(".stage__card");
const bg = document.querySelector(".bg");
const bgVideo = document.querySelector(".bg__video");
const prevButton = document.querySelector(".stage__control--left");
const nextButton = document.querySelector(".stage__control--right");

const ROUTE_ORDER = ["home", "gunite", "process", "gallery", "about", "financing"];

function updateHomeFitScale() {
  if (!stageCard) return;

  const isHome = document.body.classList.contains("is-home");
  const homeStack = document.querySelector(".home-stack");

  // Always clean up when not on Home
  if (!isHome || !homeStack) {
    stageCard.classList.remove("is-home-fit");
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

  const desiredBottomPad = 32; // or whatever you want
  const buffer = 38; // or 16
  const available = Math.max(0, viewportH - headerH - stagePadTotal - padTop - desiredBottomPad - buffer);

  // Measure natural height with scaling disabled
  const prevTransform = homeStack.style.transform;
  homeStack.style.transform = "none";
  const natural = homeStack.getBoundingClientRect().height;
  homeStack.style.transform = prevTransform;

  // ONLY scale down (never scale up)
  let scale = available / natural;
  scale = Math.min(1, scale); // allows any scale down to 0
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

function initBackgroundVideoGate() {
  const root = document.documentElement;
  root.classList.remove("bg-ready");

  if (!bgVideo) {
    root.classList.add("bg-ready");
    return Promise.resolve();
  }

  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.add("bg-ready");
      return Promise.resolve();
    }
  } catch {
    // ignore
  }

  return new Promise((resolve) => {
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      if (bg) bg.classList.add("is-video-ready");
      root.classList.add("bg-ready");
      cleanup();
      resolve();
    };

    const onReady = () => finish();

    const cleanup = () => {
      bgVideo.removeEventListener("playing", onReady);
      bgVideo.removeEventListener("canplay", onReady);
      bgVideo.removeEventListener("loadeddata", onReady);
    };

    if (bgVideo.readyState >= 3) {
      finish();
      return;
    }

    bgVideo.addEventListener("playing", onReady, { once: true });
    bgVideo.addEventListener("canplay", onReady, { once: true });
    bgVideo.addEventListener("loadeddata", onReady, { once: true });

    try {
      const p = bgVideo.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {
      // ignore
    }

    window.setTimeout(finish, 1500);
  });
}

async function injectPartials() {
  const h = await fetch("/partials/header.html", { cache: "no-cache" }).then(r => r.text());
  siteHeader.innerHTML = h;

  // Wire nav toggle for mobile
  const navtoggle = siteHeader.querySelector(".navtoggle");
  const siteNav = siteHeader.querySelector("#site-nav");
  if (navtoggle && siteNav) {
    navtoggle.addEventListener("click", () => {
      const isOpen = siteNav.classList.toggle("nav--open");
      navtoggle.setAttribute("aria-expanded", String(isOpen));
      navtoggle.textContent = isOpen ? "Close" : "Menu";
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
let ignoreNextHashChange = false;

async function renderRouteIntoCurrent(route) {
  document.body.classList.toggle("is-home", route === "home");
  await loadRoute(route, app);
  currentRoute = route;
  syncHeaderHeight();
  updateHomeFitScale();
}

function waitForCardTransformEnd() {
  if (!stageCard) return Promise.resolve();
  return new Promise(resolve => {
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
    ignoreNextHashChange = true;
    location.hash = `#${route}`;
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

  await loadRoute(route, app);
  currentRoute = route;
  ignoreNextHashChange = true;
  location.hash = `#${route}`;
  syncHeaderHeight();
  updateHomeFitScale();

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
  if (ignoreNextHashChange) {
    ignoreNextHashChange = false;
    return;
  }
  await renderRouteIntoCurrent(route);
}

function onNavClick(e) {
  const a = e.target.closest("a[data-nav]");
  if (!a) return;
  e.preventDefault();
  const route = a.getAttribute("data-nav");
  if (!route) return;
  if (location.hash.replace("#", "") === route) return;
  const direction = getDirection(currentRoute, route);
  slideCardNavigate(route, direction === "forward" ? "right" : "left");
}

function onStageControl(direction) {
  const next = getNextRoute(direction);
  if (next === currentRoute) return;
  slideCardNavigate(next, direction > 0 ? "right" : "left");
}

async function boot() {
  const bgGatePromise = initBackgroundVideoGate();

  await injectPartials();

  syncHeaderHeight();
  window.addEventListener("resize", () => {
    syncHeaderHeight();
    updateHomeFitScale();
  });
  window.addEventListener("DOMContentLoaded", updateHomeFitScale);

  await bgGatePromise;
  setIntroState();

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
  await renderRouteIntoCurrent(getRouteFromLocation());

  // hash changes
  window.addEventListener("hashchange", async () => {
    const nextRoute = getRouteFromLocation();
    await navigate(nextRoute);
  });
}

boot();

