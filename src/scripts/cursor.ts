// Custom cursor: a glass bubble that magnifies what's under it (its lens is
// at the end of this file), morphing into controls after the iPad's pointer.
//   data-cursor="halo"    it morphs into the control's shape, a thick halo
//                         around it (data-cursor-halo and --cursor-radius tune
//                         it), and the control leans toward the pointer.
//   data-cursor="magnet"  the element only leans; the cursor stays a circle.
//                         data-cursor-pull/-pull-max tune the lean.
// In focus mode (html[data-focus]) only elements with data-cursor-focus react.
// Mouse and trackpad only; touch devices keep their own behaviour.

import { squirclePath } from './squircle';

const fine = matchMedia('(hover: hover) and (pointer: fine)');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = document.getElementById('cursor');

if (el && fine.matches) {
  const root = document.documentElement;
  root.classList.add('has-cursor');
  mountLens();
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
    // The radius is in the element's own pixels; scale it to the screen
    // (the cards are drawn scaled down).
    const k = t.offsetWidth ? b.width / t.offsetWidth : 1;
    const r = (parseFloat(cs.getPropertyValue('--cursor-radius')) || parseFloat(cs.borderTopLeftRadius) || 0) * k;
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

  const allowed = (t: HTMLElement) => !root.hasAttribute('data-focus') || t.hasAttribute('data-cursor-focus');
  const pick = (under: Element | null) => {
    const t = under?.closest<HTMLElement>('[data-cursor]') ?? null;
    return t && allowed(t) ? t : null;
  };
  function setTarget(t: HTMLElement | null) {
    if (t === target) return;
    release(target);
    target = t;
    el!.classList.toggle('halo', t?.dataset.cursor === 'halo');
  }

  function frame(now: number) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000) || 1 / 60;
    last = now;
    // Let go the moment focus mode starts (unless the element takes part in
    // it), or when something else comes over the control or hides it (the
    // About card opening over the avatar) with the pointer standing still.
    if (target) setTarget(pick(document.elementFromPoint(mx, my)));

    let tx = mx, ty = my, tw = SIZE, th = SIZE, tr = SIZE / 2;
    if (target) {
      const h = haloOf(target);
      // Magnetic: the element (and its halo) leans toward the pointer, a little.
      const pull = target.dataset.cursorPull != null ? parseFloat(target.dataset.cursorPull) : PULL;
      const max = target.dataset.cursorPullMax != null ? parseFloat(target.dataset.cursorPullMax) : MAX_PULL;
      const clamp = (v: number) => Math.max(-max, Math.min(max, v));
      const lx = reduce ? 0 : clamp((mx - h.x) * pull), ly = reduce ? 0 : clamp((my - h.y) * pull);
      lean(target, lx, ly);
      if (target.dataset.cursor === 'halo') { tx = h.x + lx; ty = h.y + ly; tw = h.w; th = h.h; tr = h.r; }
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
    setTarget(pick(e.target as Element | null));
    wake();
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { pressed = true; wake(); } });
  window.addEventListener('pointerup', () => { pressed = false; wake(); });
  // Out of the window: hide until it comes back.
  document.addEventListener('pointerleave', () => { shown = false; el.classList.remove('shown'); setTarget(null); });
  window.addEventListener('blur', () => { shown = false; el.classList.remove('shown'); });
  // A scroll or layout change under a still pointer moves the control.
  window.addEventListener('resize', wake);
}

// The glass bubble's lens: an SVG filter the cursor applies to what's behind
// it (backdrop-filter: url(#cursor-lens), Chrome). A radial displacement map
// pulls the backdrop in toward the middle, magnifying it, and bends it harder
// at the rim; red, green and blue bend by slightly different amounts, which
// fringes the rim with colour. Sized in the cursor's own box, so it scales
// with it. Browsers without SVG backdrop filters just show the rim.
function mountLens(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const h = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - h) / h, dy = (y + 0.5 - h) / h;
      const r = Math.hypot(dx, dy);
      // A smooth fisheye: the backdrop is sampled from nearer the middle
      // (about 1.25x in the centre), squeezing harder toward the rim, but
      // never so hard that neighbouring pixels cross (that would tear).
      // In units of the bubble's radius; the filter's scale of 1 (its full
      // width) makes a map value of a push by a radius.
      const a = r < 1 ? -0.35 * r * (1 + 0.8 * Math.pow(r, 4)) / 1.8 : 0;
      const ux = r ? dx / r : 0, uy = r ? dy / r : 0;
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(128 + 127 * a * ux);
      img.data[i + 1] = Math.round(128 + 127 * a * uy);
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const channel = (n: string, scale: number, m: string) => `
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d${n}" />
      <feColorMatrix in="d${n}" type="matrix" values="${m}" result="${n}" />`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.innerHTML = `
    <filter id="cursor-lens" x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox"
            primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
      <feImage href="${c.toDataURL()}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map" />
      ${channel('r', 1.03, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0')}
      ${channel('g', 1, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0')}
      ${channel('b', 0.97, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0')}
      <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg" />
      <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" />
    </filter>`;
  document.body.appendChild(svg);
}
