// Smoothed, concentric corners for the glass device frame (GlassFrame.astro).
// The screen gets an iPhone-like corner (a share of its width, with corner
// smoothing); the frame's corner is the screen's plus the bezel, so the two
// curves run parallel. Sizes come from layout, so call this after it changes.
import { squirclePath } from './squircle';

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
    const w = glass.offsetWidth, h = glass.offsetHeight;
    const sw = screen.offsetWidth, sh = screen.offsetHeight;
    const bezel = (w - sw) / 2;
    const rScreen = sw * share, rFrame = rScreen + bezel;
    const frame = squirclePath(w, h, rFrame, smoothing);
    glass.style.clipPath = `path("${frame}")`;
    outline.setAttribute('d', frame);
    screen.style.clipPath = `path("${squirclePath(sw, sh, rScreen, smoothing)}")`;
    if (shadow) shadow.style.borderRadius = `${rFrame}px`;
  }
}
