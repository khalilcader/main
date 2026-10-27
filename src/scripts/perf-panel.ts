// Preview only: a frame-rate readout with switches that turn effects off, to
// find what slows Safari down. Shows only with ?perf in the address.

if (new URLSearchParams(location.search).has('perf')) {
  // Time the page's own per-frame work (JS) by wrapping requestAnimationFrame.
  const raf = window.requestAnimationFrame.bind(window);
  let js = 0;
  window.requestAnimationFrame = (cb) => raf((t) => {
    const a = performance.now();
    try { cb(t); } finally { js += performance.now() - a; }
  });

  const EFFECTS: [string, string, string][] = [
    ['shader', 'Moving gradient', '.cover canvas.shader { display: none !important; }'],
    ['shadow', 'Device shadows', '.glass-frame { filter: none !important; }'],
    ['blur', 'Frosted blurs', '*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }'],
    ['glow', 'Blurred glow', '.ambient { filter: none !important; }'],
    ['grain', 'Grain', '*, *::before, *::after { mix-blend-mode: normal !important; } .backdrop-grain, .top-scrim::before { display: none !important; }'],
    ['corners', 'Smooth corners', '*, *::before, *::after { clip-path: none !important; }'],
    ['video', 'Videos', 'video { visibility: hidden !important; }'],
  ];

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:64px;right:12px;z-index:99999;font:12px/1.35 -apple-system,system-ui,sans-serif;'
    + 'background:rgba(0,0,0,.82);color:#fff;padding:10px 12px;border-radius:12px;min-width:190px;user-select:none;';
  const read = document.createElement('div');
  read.style.cssText = 'font:600 13px/1.4 ui-monospace,Menlo,monospace;margin-bottom:8px;white-space:pre;';
  panel.append(read);
  for (const [id, label, css] of EFFECTS) {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;padding:3px 0;cursor:pointer;';
    const box = document.createElement('input');
    box.type = 'checkbox'; box.checked = true;
    const style = document.createElement('style');
    style.dataset.perf = id;
    box.addEventListener('change', () => {
      if (box.checked) style.remove(); else { style.textContent = css; document.head.append(style); }
    });
    row.append(box, label);
    panel.append(row);
  }
  // Its own: presses here never reach the strip behind it.
  for (const type of ['pointerdown', 'pointerup', 'click', 'touchstart', 'wheel'] as const)
    panel.addEventListener(type, (e) => e.stopPropagation());
  addEventListener('DOMContentLoaded', () => document.body.append(panel));

  // Last second: frames per second, the slowest frame, and JS per frame.
  const times: { t: number; dt: number; js: number }[] = [];
  let last = 0;
  const loop = (t: number) => {
    if (last) times.push({ t, dt: t - last, js });
    js = 0; last = t;
    while (times.length && times[0].t < t - 1000) times.shift();
    raf(loop);
  };
  raf(loop);
  setInterval(() => {
    if (!times.length) return;
    const fps = times.length;
    const worst = Math.max(...times.map((f) => f.dt));
    const jsAvg = times.reduce((s, f) => s + f.js, 0) / times.length;
    read.textContent = `${fps} fps\nslowest ${worst.toFixed(0)} ms\nscript ${jsAvg.toFixed(1)} ms/frame`;
  }, 250);
}
