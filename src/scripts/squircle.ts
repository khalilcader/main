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

/**
 * Clip every [data-squircle] element under `scope`, reading its radius from
 * CSS: --squircle-ratio (× width) or --squircle-radius. A direct child
 * `svg[data-squircle-rim]` gets the same path, for drawing an inside stroke.
 */
export function applySquircles(scope: ParentNode = document) {
  const smoothing =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--corner-smoothing')) || 0.6;
  for (const el of scope.querySelectorAll<HTMLElement>('[data-squircle]:not([data-squircle-ready])')) {
    el.setAttribute('data-squircle-ready', '');
    const rim = el.querySelector<SVGPathElement>(':scope > svg[data-squircle-rim] path');
    clipSquircle(el, () => squircleRadius(el), smoothing, (d, w, h) => {
      if (!rim) return;
      rim.ownerSVGElement!.setAttribute('viewBox', `0 0 ${w} ${h}`);
      rim.setAttribute('d', d);
    });
  }
}

/** The radius an element's squircle uses right now, in px. */
export function squircleRadius(el: HTMLElement) {
  const css = getComputedStyle(el);
  const ratio = parseFloat(css.getPropertyValue('--squircle-ratio')) || 0;
  return ratio > 0 ? ratio * el.offsetWidth : parseFloat(css.getPropertyValue('--squircle-radius')) || 0;
}
