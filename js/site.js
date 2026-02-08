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

// WebGL ripple renderer: draws the background gradient and warps it with ripples
const GLRipple = (function () {
  const MAX_RIPPLES = 8;
  let gl = null;
  let program = null;
  let u_time = null;
  let u_rippleCount = null;
  let u_ripples = null;
  let startTime = 0;
  let ripples = [];

  function createShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function createProgram(gl, vsSrc, fsSrc) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(p));
      gl.deleteProgram(p);
      return null;
    }
    return p;
  }

  const vertexSrc = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const fragmentSrc = `
    precision highp float;
    varying vec2 v_uv;
    uniform float u_time;
    uniform int u_rippleCount;
    uniform vec3 u_ripples[8];

    void main() {
      vec2 uv = v_uv;
      
      // Base water color - pool blue
      vec3 col = vec3(0.08, 0.25, 0.42);
      
      // Apply ripple effects (purely additive/subtractive, no normals)
      for(int i = 0; i < 8; i++) {
        if(i >= u_rippleCount) break;
        
        vec3 r = u_ripples[i];
        vec2 rippleCenter = vec2(r.x, r.y);
        float rippleTime = r.z;
        float age = u_time - rippleTime;
        
        if(age > 0.0 && age < 2.0) {
          vec2 delta = uv - rippleCenter;
          float dist = length(delta);

          // Even smaller spread speed so ripples stay extremely tight
          float speed = 0.18;
          float radius = age * speed;

          // Tighter rings but smoother appearance
          float freq = 40.0;
          float falloff = 80.0;

          float distFromWave = abs(dist - radius);

          // Ripple pattern with very small amplitude
          float ripplePattern = sin((dist - radius) * freq) * exp(-distFromWave * falloff);
          ripplePattern *= (1.0 - age * 0.6);  // faster fade

          // MUCH lighter color modulation: tiny darkening and tiny bluish brighten
          col -= vec3(0.003, 0.009, 0.018) * max(0.0, -ripplePattern); // very subtle darkness
          col += vec3(0.0015, 0.003, 0.006) * max(0.0, ripplePattern); // barely-there bluish highlight
        }
      }
      
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function init(canvas) {
    console.log('GLRipple.init() called with canvas:', canvas);
    gl = canvas.getContext('webgl', { antialias: true, alpha: true });
    if (!gl) {
      console.error('WebGL not supported');
      return null;
    }
    console.log('WebGL context created:', gl);

    program = createProgram(gl, vertexSrc, fragmentSrc);
    if (!program) {
      console.error('Failed to create program');
      return null;
    }
    console.log('WebGL program created:', program);

    gl.useProgram(program);

    // Full-screen triangle strip
    const posLoc = gl.getAttribLocation(program, 'a_pos');
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    u_time = gl.getUniformLocation(program, 'u_time');
    u_rippleCount = gl.getUniformLocation(program, 'u_rippleCount');
    u_ripples = gl.getUniformLocation(program, 'u_ripples');
    console.log('Uniforms located:', { u_time, u_rippleCount, u_ripples });

    startTime = performance.now() * 0.001;
    ripples = [];

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        console.log('Canvas resized to:', w, 'x', h);
      }
    }

    function render() {
      resize();
      const now = performance.now() * 0.001;
      const t = now - startTime;

      // Clear to pool water color (will be overwritten by shader anyway)
      gl.clearColor(0.05, 0.2, 0.35, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform1f(u_time, t);

      // Prepare ripples array (max 8)
      const data = new Float32Array(8 * 3);
      let count = 0;
      for (let i = 0; i < ripples.length && count < 8; i++) {
        const r = ripples[i];
        if (t - r.t > 2.5) continue;
        data[count * 3 + 0] = r.x;
        data[count * 3 + 1] = r.y;
        data[count * 3 + 2] = r.t;
        count++;
      }
      ripples = ripples.filter(r => (t - r.t) < 2.5);

      gl.uniform1i(u_rippleCount, count);
      gl.uniform3fv(u_ripples, data);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }

    // Ensure canvas is sized before first render
    resize();
    console.log('Starting render loop');
    requestAnimationFrame(render);

    return {
      addRipple(px, py, nowSec) {
        console.log('Ripple added at:', px, py, 'time:', nowSec);
        ripples.push({ x: px, y: py, t: nowSec });
      }
    };
  }

  return { init };
})();

function wireHeroRipple() {
  console.log('wireHeroRipple() called');
  const hero = document.getElementById("hero-ripple");
  if (!hero) {
    console.error('hero-ripple element not found');
    return;
  }
  console.log('Hero element found:', hero);
  
  const canvas = document.getElementById('hero-canvas');
  let glRenderer = null;
  if (canvas) {
    console.log('Canvas element found:', canvas);
    // ensure canvas matches hero size
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    glRenderer = GLRipple.init(canvas);
    console.log('GLRenderer initialized:', glRenderer);
  } else {
    console.error('Canvas element not found');
  }

  function createRippleAt(x, y, intensity = 1) {
    const rect = hero.getBoundingClientRect();
    const nx = x / rect.width;
    const ny = y / rect.height;
    const nowSec = performance.now() * 0.001;
    if (glRenderer) glRenderer.addRipple(nx, ny, nowSec);

    // keep the 2D DOM ripple for highlights (optional)
    // Use a much smaller size so the DOM ripple doesn't dominate the visual
    const size = Math.max(rect.width, rect.height) * 0.2;
    const ripple = document.createElement("div");
    ripple.classList.add("ripple");
    ripple.style.width = size + "px";
    ripple.style.height = size + "px";
    ripple.style.left = (x - size / 2) + "px";
    ripple.style.top = (y - size / 2) + "px";
    // Lower effective opacity so it's very subtle; scale by intensity
    ripple.style.opacity = Math.min(0.35, 0.08 + (intensity * 0.18));
    hero.appendChild(ripple);
    setTimeout(() => ripple.remove(), 1400);
  }

  hero.addEventListener("click", (e) => {
    const rect = hero.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    console.log('Hero click detected at:', x, y);
    createRippleAt(x, y, 1);
  });

  // auto-ripples (start after 2 seconds, then every 3.5 seconds)
  setTimeout(() => {
    setInterval(() => {
      const rect = hero.getBoundingClientRect();
      const x = Math.random() * rect.width;
      const y = Math.random() * rect.height;
      console.log('Auto-ripple triggered at:', x, y);
      createRippleAt(x, y, 0.5);
    }, 3500);
  }, 2000);
}

(async () => {
  await inject("site-header", "/partials/header.html");
  await inject("site-footer", "/partials/footer.html");
  wireNavToggle();
  wireHeroRipple();
})();
