/*
  Figma-exact rounded corners. Figma's "corner smoothing" isn't a CSS
  border-radius curve, so we draw the same path Figma does (figma-squircle)
  and clip to it. The path is in pixels, so it's redrawn whenever the
  element's size changes.
*/
import { getSvgPath } from 'figma-squircle';

export function squirclePath(width: number, height: number, radius: number, smoothing: number) {
  return getSvgPath({ width, height, cornerRadius: radius, cornerSmoothing: smoothing });
}

/** Clip `el` to a smoothed rounded rect; `onPath` gets each new path (e.g. to draw a stroke). */
export function clipSquircle(
  el: HTMLElement,
  getRadius: () => number,
  smoothing: number,
  onPath?: (d: string, w: number, h: number) => void,
) {
  const update = () => {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    const d = squirclePath(w, h, getRadius(), smoothing);
    el.style.clipPath = `path('${d}')`;
    el.style.borderRadius = '0';  // the CSS radius is only the no-JS fallback
    onPath?.(d, w, h);
  };
  new ResizeObserver(update).observe(el);
  update();
}
