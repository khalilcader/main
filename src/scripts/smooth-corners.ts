// Figma-style smoothed corners for UI elements, the same squircle clip-path
// the covers and the device frame use. Mark an element with data-smooth:
//
//   data-smooth="surface"  A filled surface (glass, tooltip, button tile). Its
//     background, border and backdrop blur move onto an injected layer behind
//     its content, and only that layer is clipped, so the element's shadow and
//     focus ring stay visible. Style it with --surface-bg, --surface-border and
//     --surface-blur (custom properties, so hover and pressed states still work).
//
//   data-smooth="clip"  A container whose content must be clipped too (a photo).
//     The element itself is clipped; its border is redrawn along the curve from
//     --surface-border. Put its shadow on a parent: a clip cuts shadows off.
//
// The corner radius comes from the element's CSS border-radius, which stays in
// place as the no-JavaScript fallback and the shape of its shadow.
import { squirclePath } from './squircle';

const SVGNS = 'http://www.w3.org/2000/svg';

function smoothing() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--corner-smoothing')) || 0.6;
}

function setup(el: HTMLElement) {
  if (el.dataset.smoothReady) return;
  el.dataset.smoothReady = '';
  const kind = el.dataset.smooth;
  const cs = getComputedStyle(el);
  if (cs.position === 'static') el.style.position = 'relative';
  const bw = parseFloat(cs.borderTopWidth) || 0;

  // The curve-following border: stroked at twice the width, half of it clipped away.
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'smooth-border');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('stroke-width', String(bw * 2));
  svg.appendChild(path);

  let target = el;
  if (kind === 'surface') {
    const layer = document.createElement('span');
    layer.className = 'smooth-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.appendChild(svg);
    el.prepend(layer);
    target = layer;
    el.classList.add('smooth-host');
  } else {
    el.appendChild(svg);
    el.classList.add('smooth-clip');
  }
  el.style.setProperty('--smooth-bw', `${bw}px`);
  if (!bw) svg.style.display = 'none';

  const update = () => {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, Math.min(w, h) / 2);
    const d = squirclePath(w, h, r, smoothing());
    target.style.clipPath = `path("${d}")`;
    path.setAttribute('d', d);
  };
  update();
  new ResizeObserver(update).observe(el, { box: 'border-box' });
}

export function smoothCorners(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-smooth]').forEach(setup);
}

smoothCorners();
