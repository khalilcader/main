// Smoothed, concentric corners for the glass device frame (GlassFrame.astro).
// The screen gets an iPhone-like corner (a share of its width, with corner
// smoothing). The frame's outline is the screen's pushed outward by the bezel
// at every point, so the bezel is the same thickness all the way round.
// (Two smoothed corners whose radii differ by the bezel are not parallel:
// the smoothing makes the bigger one start curving earlier, so the bezel
// thickens at the corners.) Sizes come from layout, so call this after it
// changes.
import { squirclePath } from './squircle';

const SVGNS = 'http://www.w3.org/2000/svg';

// The closed path `d`, offset outward by `off` and shifted by (dx, dy), as a
// polygon path. Points are sampled along the path; the outward normal comes
// from the direction of travel (squirclePath runs clockwise on screen).
function offsetOutline(d: string, off: number, dx: number, dy: number, samples = 480) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden');
  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  document.body.appendChild(svg);
  const len = path.getTotalLength();
  const at = (i: number) => path.getPointAtLength(((i % samples) + samples) % samples * len / samples);
  const pts: string[] = [];
  for (let i = 0; i < samples; i++) {
    const a = at(i - 1), p = at(i), b = at(i + 1);
    let tx = b.x - a.x, ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    pts.push(`${(p.x + ty * off + dx).toFixed(2)} ${(p.y - tx * off + dy).toFixed(2)}`);
  }
  svg.remove();
  return `M ${pts.join(' L ')} Z`;
}

export function shapeGlassFrames(root: ParentNode) {
  const style = getComputedStyle(document.documentElement);
  const share = parseFloat(style.getPropertyValue('--screen-radius')) || 0.12;
  const smoothing = parseFloat(style.getPropertyValue('--screen-smoothing')) || 0.6;
  for (const glass of root.querySelectorAll<HTMLElement>('.glass')) {
    const screen = glass.querySelector<HTMLElement>('.screen');
    const outline = glass.querySelector<SVGPathElement>('.glass-outline path');
    const shadow = glass.parentElement?.querySelector<HTMLElement>('.glass-shadow');
    if (!screen || !outline) continue;
    glass.dataset.shaped = '';
    // offset sizes ignore transforms, so these are the frame's own pixels.
    const w = glass.offsetWidth;
    const sw = screen.offsetWidth, sh = screen.offsetHeight;
    const bezel = (w - sw) / 2;
    const rScreen = sw * share;
    const screenPath = squirclePath(sw, sh, rScreen, smoothing);
    const frame = offsetOutline(screenPath, bezel, bezel, bezel);
    glass.style.clipPath = `path("${frame}")`;
    outline.setAttribute('d', frame);
    screen.style.clipPath = `path("${screenPath}")`;
    if (shadow) shadow.style.borderRadius = `${rScreen + bezel}px`;
  }
}
