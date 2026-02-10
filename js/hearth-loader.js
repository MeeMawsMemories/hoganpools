(() => {
  const SCRIPT_ID = 'hearth-script';
  const SCRIPT_SRC = 'https://widget.gethearth.com/script.js';
  const ORG_ID = '58414';
  const PARTNER = 'hogan-pools';
  const IFRAME_ID = 'hearth-widget_calculator_v1';

  function injectHearthScript() {
    const old = document.getElementById(SCRIPT_ID);
    if (old) old.remove(); // force re-run (important for SPA navigation)

    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    s.dataset.orgid = ORG_ID;
    s.dataset.partner = PARTNER;
    document.head.appendChild(s);
  }

  // Call this after your router injects /pages/financing.html into the DOM
  window.initHearthCalculator = () => {
    const iframe = document.getElementById(IFRAME_ID);
    if (!iframe) return false;

    // If already initialized, don’t thrash
    if (iframe.getAttribute('src')) return true;

    injectHearthScript();
    return true;
  };

  // On full page loads (non-SPA), attempt once
  document.addEventListener('DOMContentLoaded', () => {
    window.initHearthCalculator?.();
  });
})();