// /js/app.js
import { getRouteFromLocation, loadRoute } from "./router.js";

const app = document.getElementById("app");
const siteHeader = document.getElementById("site-header");
const overlay = document.getElementById("transition-overlay");
const stage = document.querySelector(".stage");
const stageVideo = document.querySelector(".stage__bg-video");
const prevButton = document.querySelector(".stage__control--left");
const nextButton = document.querySelector(".stage__control--right");

const ROUTE_ORDER = ["home", "gunite", "process", "gallery", "about", "financing"];

function syncHeaderHeight() {
  if (!siteHeader) return;
  const height = siteHeader.getBoundingClientRect().height;
  document.documentElement.style.setProperty("--header-height", `${height}px`);
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

function setOverlay(active, direction = "forward") {
  if (!overlay) return;
  if (prefersReducedMotion()) {
    overlay.classList.remove("active");
    return;
  }

  if (active) {
    // Remove and re-add the class to force animation restart
    overlay.classList.remove("active", "dir-forward", "dir-backward");
    // Force reflow
    void overlay.offsetWidth;
    overlay.classList.add("active", direction === "backward" ? "dir-backward" : "dir-forward");
    // Restart video
    const video = overlay.querySelector(".wash-video");
    if (video) {
      video.pause();
      video.currentTime = 0;
      video.play().catch(e => console.log("Video play prevented:", e));
    }
  } else {
    overlay.classList.remove("active", "dir-forward", "dir-backward");
  }
}

function setIntroState() {
  if (!stage) return;
  stage.classList.add("is-intro");
  stage.classList.remove("is-ready", "is-controls");

  if (prefersReducedMotion()) {
    stage.classList.add("is-ready", "is-controls");
    stage.classList.remove("is-intro");
    if (stageVideo) {
      stageVideo.pause();
    }
    document.documentElement.classList.add("reduced-motion");
    return;
  }

  document.documentElement.classList.remove("reduced-motion");
  if (stageVideo) {
    stageVideo.play().catch(() => {});
  }

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
  const forwardSteps = (toIndex - fromIndex + ROUTE_ORDER.length) % ROUTE_ORDER.length;
  const backwardSteps = (fromIndex - toIndex + ROUTE_ORDER.length) % ROUTE_ORDER.length;
  return forwardSteps <= backwardSteps ? "forward" : "backward";
}

let currentRoute = getRouteFromLocation();

async function navigate(route, direction = "forward") {
  document.body.classList.toggle("is-home", route === "home");
  // transition on
  setOverlay(true, direction);
  // let the overlay become visible
  await new Promise(r => setTimeout(r, 80));

  await loadRoute(route, app);

  syncHeaderHeight();

  // wait for full animation (3500ms desktop / 2200ms mobile, use 3600ms to be safe)
  await new Promise(r => setTimeout(r, 3600));
  setOverlay(false);
  currentRoute = route;
}

function onNavClick(e) {
  const a = e.target.closest("a[data-nav]");
  if (!a) return;
  e.preventDefault();
  const route = a.getAttribute("data-nav");
  if (!route) return;
  if (location.hash.replace("#", "") === route) return;
  location.hash = `#${route}`;
}

function onStageControl(direction) {
  const next = getNextRoute(direction);
  if (location.hash.replace("#", "") === next) return;
  location.hash = `#${next}`;
}

async function boot() {
  await injectPartials();

  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);

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
  await navigate(getRouteFromLocation(), "forward");

  // hash changes
  window.addEventListener("hashchange", async () => {
    const nextRoute = getRouteFromLocation();
    const direction = getDirection(currentRoute, nextRoute);
    await navigate(nextRoute, direction);
  });
}

boot();

