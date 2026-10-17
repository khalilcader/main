// Custom cursor, after the iPad's: a small circle that blurs what's under it.
// Over a control marked data-cursor="halo" it morphs into that control's
// shape, a thick halo around it (data-cursor-halo and --cursor-radius tune it), and the control leans a little toward the
// pointer (magnetic). In focus mode (html[data-focus]) it stays a circle.
// Mouse and trackpad only; touch devices keep their own behaviour.

import { squirclePath } from './squircle';

const fine = matchMedia('(hover: hover) and (pointer: fine)');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = document.getElementById('cursor');

if (el && fine.matches) {
  const root = document.documentElement;
  root.classList.add('has-cursor');
  const css = getComputedStyle(root);
  const px = (name: string, fallback: number) => parseFloat(css.getPropertyValue(name)) || fallback;
  const SIZE = px('--cursor-size', 20);
  const HALO = px('--cursor-halo', 6);       // how far the halo reaches past the control
  const PULL = px('--cursor-pull', 0.12);    // share of the pointer's offset the control follows
  const MAX_PULL = px('--cursor-pull-max', 4);
  const SMOOTH = px('--corner-smoothing', 0.6);

  // Pointer, and the drawn shape (centre, size, radius), which eases toward
  // its target each frame.
  let mx = -100, my = -100, shown = false, pressed = false;
  const cur = { x: -100, y: -100, w: SIZE, h: SIZE, r: SIZE / 2 };
  let target: HTMLElement | null = null;
  let raf = 0, last = 0;

  const haloOf = (t: HTMLElement) => {
    // The control's untranslated box, so its own magnetic lean doesn't feed back.
    const b = t.getBoundingClientRect();
    const tx = parseFloat(t.dataset.cursorTx || '0'), ty = parseFloat(t.dataset.cursorTy || '0');
    // A control can set its own halo reach (data-cursor-halo, px) and corner
    // radius (--cursor-radius, when its shape is drawn by a child).
    const cs = getComputedStyle(t);
    const pad = t.dataset.cursorHalo != null ? parseFloat(t.dataset.cursorHalo) : HALO;
    const r = parseFloat(cs.getPropertyValue('--cursor-radius')) || parseFloat(cs.borderTopLeftRadius) || 0;
    return { x: b.left - tx + b.width / 2, y: b.top - ty + b.height / 2, w: b.width + pad * 2, h: b.height + pad * 2, r: r + pad };
  };
  const lean = (t: HTMLElement | null, x: number, y: number) => {
    if (!t) return;
    t.dataset.cursorTx = String(x); t.dataset.cursorTy = String(y);
    t.style.translate = x || y ? `${x.toFixed(2)}px ${y.toFixed(2)}px` : '';
  };
  const release = (t: HTMLElement | null) => {
    if (!t) return;
    delete t.dataset.cursorTx; delete t.dataset.cursorTy;
    t.style.translate = '';
  };

  function frame(now: number) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000) || 1 / 60;
    last = now;
    // Leave a control the moment focus mode starts.
    if (target && root.hasAttribute('data-focus')) { release(target); target = null; el!.classList.remove('halo'); }

    let tx = mx, ty = my, tw = SIZE, th = SIZE, tr = SIZE / 2;
    if (target) {
      const h = haloOf(target);
      // Magnetic: the control and its halo lean toward the pointer, a little.
      const clamp = (v: number) => Math.max(-MAX_PULL, Math.min(MAX_PULL, v));
      const lx = reduce ? 0 : clamp((mx - h.x) * PULL), ly = reduce ? 0 : clamp((my - h.y) * PULL);
      lean(target, lx, ly);
      tx = h.x + lx; ty = h.y + ly; tw = h.w; th = h.h; tr = h.r;
    }
    if (pressed) { tw *= 0.9; th *= 0.9; tr *= 0.9; }
    // Ease toward the target: quick, so the circle never feels like it lags.
    const k = reduce ? 1 : 1 - Math.exp(-dt * (target ? 22 : 40));
    cur.x += (tx - cur.x) * k; cur.y += (ty - cur.y) * k;
    cur.w += (tw - cur.w) * k; cur.h += (th - cur.h) * k; cur.r += (tr - cur.r) * k;

    const s = el!.style;
    s.width = `${cur.w.toFixed(2)}px`; s.height = `${cur.h.toFixed(2)}px`; s.borderRadius = `${cur.r.toFixed(2)}px`;
    // As a halo, the same smoothed corners as the controls, so the two curves
    // run parallel; as a circle, plain round.
    const round = cur.r >= Math.min(cur.w, cur.h) / 2 - 0.5;
    s.clipPath = round ? '' : `path("${squirclePath(cur.w, cur.h, cur.r, SMOOTH)}")`;
    s.transform = `translate3d(${(cur.x - cur.w / 2).toFixed(2)}px, ${(cur.y - cur.h / 2).toFixed(2)}px, 0)`;

    const settled = Math.abs(tx - cur.x) < 0.05 && Math.abs(ty - cur.y) < 0.05 && Math.abs(tw - cur.w) < 0.05 && Math.abs(th - cur.h) < 0.05;
    raf = settled && !target ? 0 : requestAnimationFrame(frame);
  }
  const wake = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    if (!shown) { shown = true; cur.x = mx; cur.y = my; el.classList.add('shown'); }
    const t = (e.target as Element | null)?.closest<HTMLElement>('[data-cursor="halo"]') ?? null;
    const next = t && !root.hasAttribute('data-focus') ? t : null;
    if (next !== target) { release(target); target = next; el.classList.toggle('halo', !!target); }
    wake();
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { pressed = true; wake(); } });
  window.addEventListener('pointerup', () => { pressed = false; wake(); });
  // Out of the window: hide until it comes back.
  document.addEventListener('pointerleave', () => { shown = false; el.classList.remove('shown'); release(target); target = null; el.classList.remove('halo'); });
  window.addEventListener('blur', () => { shown = false; el.classList.remove('shown'); });
  // A scroll or layout change under a still pointer moves the control.
  window.addEventListener('resize', wake);
}
