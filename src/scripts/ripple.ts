// Hover ripple on the cards: as the mouse moves over a cover, the picture
// inside it (not the card) ripples around the pointer like water, with a
// lens-style colour split at the edges of the wave, and settles when the mouse
// stops. An SVG filter does it: a precomputed field of rings is moved under
// the pointer and bends red, green and blue by slightly different amounts.
// Mouse only; off in focus mode and with reduced motion.

const SVGNS = 'http://www.w3.org/2000/svg';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

const css = getComputedStyle(document.documentElement);
const num = (name: string, fallback: number) => parseFloat(css.getPropertyValue(name)) || fallback;
const RADIUS = num('--ripple-radius', 160);     // px (card pixels): reach of the rings
const STRENGTH = num('--ripple-strength', 9);   // px of push at full speed
const SPLIT = num('--ripple-split', 1);         // how far red and blue part from green (1: red twice green's push, blue none)

// The displacement field: R/G hold the push (0.5 = none), radial, as rings
// that fade out toward the edge.
function ringMap(size = 384) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const h = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - h) / h, dy = (y + 0.5 - h) / h;
      const r = Math.hypot(dx, dy);
      const a = r < 1 ? Math.sin(r * Math.PI * 3) * Math.pow(1 - r, 1.6) * Math.min(1, r / 0.12) : 0;
      const ux = r ? dx / r : 0, uy = r ? dy / r : 0;
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(128 + 127 * a * ux);
      img.data[i + 1] = Math.round(128 + 127 * a * uy);
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}

function makeFilter() {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  // Each channel is bent by its own amount, kept to that channel, and the
  // three added back together.
  const channel = (name: string, matrix: string) => `
      <feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="d${name}" />
      <feColorMatrix in="d${name}" type="matrix" values="${matrix}" result="${name}" />`;
  svg.innerHTML = `
    <filter id="ripple" x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox"
            primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feFlood flood-color="rgb(128,128,128)" result="calm" />
      <feImage href="${ringMap()}" preserveAspectRatio="none" result="rings" />
      <feMerge result="raw"><feMergeNode in="calm" /><feMergeNode in="rings" /></feMerge>
      <feGaussianBlur in="raw" stdDeviation="2" result="map" />
      ${channel('r', '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0')}
      ${channel('g', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0')}
      ${channel('b', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0')}
      <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg" />
      <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" result="bent" />
      <!-- Where a push reaches past the edge there's nothing to pull in; the
           unbent picture fills it, so the edges never tear. -->
      <feComposite in="bent" in2="SourceGraphic" operator="over" />
    </filter>`;
  document.body.appendChild(svg);
  const maps = [...svg.querySelectorAll('feDisplacementMap')];
  return { image: svg.querySelector('feImage')!, r: maps[0], g: maps[1], b: maps[2] };
}

const stage = document.querySelector<HTMLElement>('.stage');
if (stage && fine && !reduce) {
  let filter: ReturnType<typeof makeFilter> | null = null;
  let layer: HTMLElement | null = null;
  let raf = 0, last = 0;
  // Pointer in the layer's own pixels, where the rings sit (lagging a little),
  // how fast the pointer is moving, and the ripple's current strength.
  const ptr = { x: 0, y: 0, lx: 0, ly: 0, speed: 0, amt: 0, scale: 1 };

  const stop = () => {
    if (layer) layer.style.filter = '';
    layer = null; ptr.amt = 0; ptr.speed = 0;
  };

  const step = (now: number) => {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    if (!layer || !filter) { raf = 0; return; }
    // Rings drift after the pointer; strength follows speed, then dies away.
    const follow = 1 - Math.exp(-dt * 12);
    ptr.lx += (ptr.x - ptr.lx) * follow; ptr.ly += (ptr.y - ptr.ly) * follow;
    const want = Math.min(1, ptr.speed / 900);
    ptr.amt += (want - ptr.amt) * (1 - Math.exp(-dt * (want > ptr.amt ? 10 : 2.5)));
    ptr.speed *= Math.exp(-dt * 8);

    const r = RADIUS;
    filter.image.setAttribute('x', String(ptr.lx - r)); filter.image.setAttribute('y', String(ptr.ly - r));
    filter.image.setAttribute('width', String(r * 2)); filter.image.setAttribute('height', String(r * 2));
    const s = STRENGTH * ptr.amt;
    filter.r.setAttribute('scale', String(s * (1 + SPLIT)));
    filter.g.setAttribute('scale', String(s));
    filter.b.setAttribute('scale', String(s * (1 - SPLIT)));

    if (ptr.amt < 0.01 && ptr.speed < 5) { layer.style.filter = ''; raf = 0; return; }
    layer.style.filter = 'url(#ripple)';
    raf = requestAnimationFrame(step);
  };

  let lastMove = { t: 0, x: 0, y: 0 };
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || document.documentElement.hasAttribute('data-focus')) { stop(); return; }
    const next = (e.target as Element).closest('.card')?.querySelector<HTMLElement>('.ripple-layer') ?? null;
    if (next !== layer) { stop(); layer = next; }
    if (!layer) return;
    filter ??= makeFilter();
    // The filter works in the layer's own (unscaled) pixels.
    const b = layer.getBoundingClientRect();
    ptr.scale = b.width / layer.offsetWidth || 1;
    const x = (e.clientX - b.left) / ptr.scale, y = (e.clientY - b.top) / ptr.scale;
    const now = performance.now(), dt = Math.max(1, now - lastMove.t) / 1000;
    if (now - lastMove.t < 100) ptr.speed = Math.max(ptr.speed, Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y) / dt);
    else { ptr.lx = x; ptr.ly = y; }   // entering: start the rings under the pointer
    lastMove = { t: now, x: e.clientX, y: e.clientY };
    ptr.x = x; ptr.y = y;
    if (!raf) { last = 0; raf = requestAnimationFrame(step); }
  });
  stage.addEventListener('pointerleave', stop);
}
