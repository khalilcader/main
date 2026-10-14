// Figma-style smoothed corners ("corner smoothing"), as an SVG path. Same math
// as the figma-squircle library: each corner is a curve, a short circular arc,
// then a curve, spread over p = (1 + smoothing) * radius.
export function squirclePath(w: number, h: number, r: number, s: number): string {
  const budget = Math.min(w, h) / 2;
  r = Math.min(r, budget);
  let p = (1 + s) * r;
  s = Math.min(s, budget / Math.max(r, 1e-6) - 1);
  p = Math.min(p, budget);
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const arcMeasure = 90 * (1 - s);
  const arc = Math.sin(rad(arcMeasure / 2)) * r * Math.SQRT2;
  const alpha = (90 - arcMeasure) / 2;
  const p34 = r * Math.tan(rad(alpha / 2));
  const beta = 45 * s;
  const c = p34 * Math.cos(rad(beta));
  const d = c * Math.tan(rad(beta));
  const b = (p - arc - c - d) / 3, a = 2 * b;
  const f = (n: number) => +n.toFixed(2);
  const [A, AB, ABC, C, D, BC, ARC, R] = [a, a + b, a + b + c, c, d, b + c, arc, r].map(f);
  return [
    `M ${f(w - p)} 0`,
    `c ${A} 0 ${AB} 0 ${ABC} ${D} a ${R} ${R} 0 0 1 ${ARC} ${ARC} c ${D} ${C} ${D} ${BC} ${D} ${ABC}`,
    `L ${w} ${f(h - p)}`,
    `c 0 ${A} 0 ${AB} ${-D} ${ABC} a ${R} ${R} 0 0 1 ${-ARC} ${ARC} c ${-C} ${D} ${-BC} ${D} ${-ABC} ${D}`,
    `L ${f(p)} ${h}`,
    `c ${-A} 0 ${-AB} 0 ${-ABC} ${-D} a ${R} ${R} 0 0 1 ${-ARC} ${-ARC} c ${-D} ${-C} ${-D} ${-BC} ${-D} ${-ABC}`,
    `L 0 ${f(p)}`,
    `c 0 ${-A} 0 ${-AB} ${D} ${-ABC} a ${R} ${R} 0 0 1 ${ARC} ${-ARC} c ${C} ${-D} ${BC} ${-D} ${ABC} ${-D}`,
    'Z',
  ].join(' ');
}
