// Click ripple on the cards, after Janum Trivedi's ripple shader: a subtle
// wave rings out from where the card was pressed, bending the picture inside
// it (not the card itself), and dies away. An SVG displacement filter does the bending: its map is a precomputed
// ring of outward/inward pushes (a few damped wavelets behind the front),
// scaled up from the press point over the ripple's life while the push fades.

const SVGNS = 'http://www.w3.org/2000/svg';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const css = getComputedStyle(document.documentElement);
const num = (name: string, fallback: number) => parseFloat(css.getPropertyValue(name)) || fallback;
const DURATION = num('--ripple-duration', 850);   // ms
const STRENGTH = num('--ripple-strength', 5);    // px of push at the start

// The displacement map: R/G hold the push (0.5 = none), radial, as a damped
// wave whose front sits near the edge of the image.
function ringMap(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const h = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - h) / h, dy = (y + 0.5 - h) / h;
      const r = Math.hypot(dx, dy);
      const front = 0.9, behind = front - r;
      // A crest at the front, then a couple of smaller wavelets trailing it,
      // calm at the centre and nothing beyond the front.
      let a = 0;
      if (r < front + 0.06) {
        a = Math.sin(Math.max(behind, -0.06) * 26 + Math.PI / 2) * Math.exp(-Math.max(behind, 0) * 5.5);
        a *= Math.min(1, (front + 0.06 - r) / 0.06) * Math.min(1, r / 0.25);
      }
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
  svg.innerHTML = `
    <filter id="ripple" x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox"
            primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feFlood flood-color="rgb(128,128,128)" result="calm" />
      <feImage href="${ringMap()}" preserveAspectRatio="none" result="ring" />
      <feMerge result="raw"><feMergeNode in="calm" /><feMergeNode in="ring" /></feMerge>
      <!-- Smooth the map so bent edges flow like water rather than tear. -->
      <feGaussianBlur in="raw" stdDeviation="3" result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="bent" />
      <!-- Where a push reaches past the edge there's nothing to pull in; the
           unbent picture fills it, so the edges never tear. -->
      <feComposite in="bent" in2="SourceGraphic" operator="over" />
    </filter>`;
  document.body.appendChild(svg);
  return {
    image: svg.querySelector('feImage')!,
    displace: svg.querySelector('feDisplacementMap')!,
  };
}

const stage = document.querySelector<HTMLElement>('.stage');
if (stage && !reduce) {
  let filter: ReturnType<typeof makeFilter> | null = null;
  let current: HTMLElement | null = null, raf = 0;

  stage.addEventListener('pointerdown', (e) => {
    // The media layer inside the cover bends; the card's shape stays put.
    const card = (e.target as Element).closest<HTMLElement>('.card')?.querySelector<HTMLElement>('.ripple-layer');
    if (!card || e.button !== 0) return;
    filter ??= makeFilter();
    const f = filter;
    if (current && current !== card) current.style.filter = '';
    cancelAnimationFrame(raf);
    current = card;

    // The filter works in the layer's own (unscaled) pixels.
    const b = card.getBoundingClientRect();
    const scale = b.width / card.offsetWidth || 1;
    const px = (e.clientX - b.left) / scale, py = (e.clientY - b.top) / scale;
    const reach = Math.hypot(Math.max(px, card.offsetWidth - px), Math.max(py, card.offsetHeight - py)) * 1.15;

    card.style.filter = 'url(#ripple)';
    let t0 = -1;   // timed from its first frame, on the frame clock
    const step = (now: number) => {
      if (t0 < 0) t0 = now;
      const t = Math.min(1, (now - t0) / DURATION);
      const grow = 1 - Math.pow(1 - t, 2.2);            // quick out, easing as it spreads
      const r = Math.max(1, reach * grow);
      f.image.setAttribute('x', String(px - r)); f.image.setAttribute('y', String(py - r));
      f.image.setAttribute('width', String(r * 2)); f.image.setAttribute('height', String(r * 2));
      f.displace.setAttribute('scale', String(STRENGTH * Math.pow(1 - t, 1.6)));
      if (t < 1) raf = requestAnimationFrame(step);
      else { card.style.filter = ''; current = null; }
    };
    raf = requestAnimationFrame(step);
  });
}
