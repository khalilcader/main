// Figma-style smoothed corners for UI elements, the same squircle clip-path
// the covers and the device frame use. Mark an element with data-smooth:
//
//   data-smooth="surface"  A filled surface (glass, tooltip, button tile). Its
//     background, border and backdrop blur move onto an injected layer behind
//     its content, and only that layer is clipped, so the element's shadow and
//     focus ring stay visible. Style it with --surface-bg, --surface-border and
//     --surface-blur (custom properties, so hover and pressed states still work).
//     Its border is drawn just outside the shape (an outer border).
//
//   data-smooth="clip"  A container whose content must be clipped too (a photo).
//     The element itself is clipped; its border is redrawn along the curve,
//     inside the edge, over the content. Put its shadow on a parent: a clip
//     cuts shadows off.
//
// Borders come from --surface-border.
//
// The corner radius comes from the element's CSS border-radius, which stays in
// place as the no-JavaScript fallback and the shape of its shadow.
import { squirclePath } from './squircle';

const SVGNS = 'http://www.w3.org/2000/svg';
let uid = 0;

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

  // The curve-following border: stroked at twice the width, half of it
  // dropped: outside the shape for a surface (masked), inside it for a clip
  // (clipped with the element).
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'smooth-border');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('stroke-width', String(bw * 2));
  // Uniform by default. Set --surface-border-top below 1 to light it from
  // above: lighter along the top, full strength underneath.
  const id = `smooth-${++uid}`;
  const grad = document.createElementNS(SVGNS, 'linearGradient');
  grad.id = id;
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0'); grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
  for (const [offset, opacity] of [['0', 'var(--surface-border-top, 1)'], ['1', '1']]) {
    const stop = document.createElementNS(SVGNS, 'stop');
    stop.setAttribute('offset', offset);
    stop.setAttribute('style', `stop-color: var(--surface-border, transparent); stop-opacity: ${opacity}`);
    grad.appendChild(stop);
  }
  const mask = document.createElementNS(SVGNS, 'mask');
  mask.id = `${id}-out`;
  mask.setAttribute('maskUnits', 'userSpaceOnUse');
  const maskAll = document.createElementNS(SVGNS, 'rect');
  maskAll.setAttribute('fill', '#fff');
  const maskShape = document.createElementNS(SVGNS, 'path');
  maskShape.setAttribute('fill', '#000');
  mask.append(maskAll, maskShape);
  const defs = document.createElementNS(SVGNS, 'defs');
  defs.append(grad, mask);
  svg.appendChild(defs);
  path.setAttribute('stroke', `url(#${id})`);
  if (kind === 'surface') path.setAttribute('mask', `url(#${id}-out)`);
  svg.appendChild(path);

  let target = el;
  if (kind === 'surface') {
    const layer = document.createElement('span');
    layer.className = 'smooth-layer';
    layer.setAttribute('aria-hidden', 'true');
    el.prepend(layer);
    el.appendChild(svg);   // outside the clipped layer, so the outer border shows
    target = layer;
    el.classList.add('smooth-host');
  } else {
    el.appendChild(svg);
    el.classList.add('smooth-clip');
  }
  el.style.setProperty('--smooth-bw', `${bw}px`);
  if (!bw) svg.style.display = 'none';

  // Exact (fractional) border-box size, ignoring transforms. offsetWidth rounds
  // to whole pixels, which clipped hairline borders off the bottom and right.
  let w = 0, h = 0;
  // A surface's own box casts its shadow; it's rounded more than the clip so
  // the shadow stays inside the smoothed outline (no sliver at the corners).
  // The clip keeps the CSS radius, read once before that.
  const radius = parseFloat(cs.borderTopLeftRadius) || 0;
  // Or a share of its width (--smooth-radius-share), for shapes that scale:
  // a fixed radius came out smaller than a recording's own corners when the
  // cover was laid out bigger, and those peeked inside it.
  const share = parseFloat(cs.getPropertyValue('--smooth-radius-share')) || 0;
  const update = () => {
    if (!w || !h) return;
    const r = Math.min(share ? share * w : radius, Math.min(w, h) / 2);
    const d = squirclePath(w, h, r, smoothing());
    target.style.clipPath = `path("${d}")`;
    path.setAttribute('d', d);
    maskShape.setAttribute('d', d);
    maskAll.setAttribute('x', String(-bw * 4)); maskAll.setAttribute('y', String(-bw * 4));
    maskAll.setAttribute('width', String(w + bw * 8)); maskAll.setAttribute('height', String(h + bw * 8));
    if (kind === 'surface') {
      el.style.borderRadius = `${Math.min(r * (1 + smoothing()), Math.min(w, h) / 2)}px`;
      el.style.setProperty('--smooth-r', `${r}px`);   // the shape's real radius
    }
  };
  new ResizeObserver(([entry]) => {
    const box = entry.borderBoxSize?.[0];
    w = box ? box.inlineSize : el.offsetWidth;
    h = box ? box.blockSize : el.offsetHeight;
    update();
  }).observe(el, { box: 'border-box' });
}

export function smoothCorners(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-smooth]').forEach(setup);
}

smoothCorners();
