// The work strip: covers on springs, moving between a row, a large focus
// strip, and a packed grid. Ported from the prototype (prototype/index.html on
// the fervent-hopper branch); see HANDOFF.md there for the interaction model.
//
// Visual values (sizes, radii, colors) come from tokens.css. The numbers in
// this file are motion tuning, dialed in on the prototype.
import { squirclePath } from './squircle';
import { shapeGlassFrames } from './glass-frame';
import { mountBackdrop } from './backdrop-shader';

const TUNING = {
  k: 240, c: 30,                    // layout spring stiffness / damping
  rubber: 0.55, rubberD: 360,       // overscroll strength / distance
  decay: 4.5, brake: 1400,          // glide: exponential decay (/s) + constant brake (px/s²)
  rippleDelay: 30, falloff: 0.86,   // squish chain reaction: ms per step, falloff per step
  focusBlur: 56,
  // Row edge: kept subtle. A light blur (on-screen px at row size) and fade,
  // no grain, and covers keep their smoothed corners.
  rowBlur: 3, rowFade: 0.2,
  edgeStart: 0.33,                  // a row cover starts to blur when its inner edge is this share of the screen from the edge
  edgeW: 8, edgeBlur: 7, edgeCurve: 5, edgeFade: 0.25,
};
const EDGE_K = 280, EDGE_C = 33;     // overscroll spring-back (critically damped, quick)
const SNAP_K = 220, SNAP_C = 29;     // settling onto a snap point (just under critical)
const SQ_K = 900, SQ_C = 60;         // grabbed cover returning from a squish (no bounce)
const NB_K = 700, NB_C = 53;         // neighbors catching up to the ripple
const HV_K = 600, HV_C = 44;         // hover lift: quick and smooth (ζ ≈ 0.9, no visible overshoot)
const HOVER_SCALE = 1.025;           // covers grow this much under the cursor
const LB_K = 900, LB_C = 34;         // title pill: quick, underdamped (ζ ≈ 0.57) for a little pop
const OV_K = 320, OV_C = 36;         // per-cover overscroll lag (gaps stretch, then relax)
const PULL = 300;                    // px of vertical drag for a full row <-> focus scrub
const SQUISH_D = 160, MAX_SQ = 0.6;  // squish resistance: 432px of pull lands near 0.56 scale
const COMMIT_D = 0.3, COMMIT_V = 100; // commit thresholds: 90px of drag, or 0.10 px/ms
const FLING_D = 230;                 // focused cover: drag this far (or flick) to dismiss
const FIGMA_ROW_H = 617, FIGMA_VH = 1024, FIGMA_BELOW = 183;  // row height, frame height, space under the row

type Rect = { x: number; y: number; w: number; h: number };
type Scroll = { pos: number; vel: number; min: number; max: number; wheel: boolean; to: number | null; raw: number; wt: number; from: number | null };

const stage = document.getElementById('stage');
if (stage) init(stage);

function init(stage: HTMLElement) {
  const backdrop = document.getElementById('backdrop')!;
  const header = document.querySelector<HTMLElement>('.site-header')!;
  const who = header.querySelector<HTMLElement>('.who')!;
  const gridBtn = document.getElementById('grid-button')!;
  const themeBtn = document.getElementById('theme-button')!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const P = { ...TUNING };
  if (reduce) Object.assign(P, { k: 700, c: 53, rippleDelay: 0 });

  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const soft = (x: number, d: number) => (1 - 1 / (x / d + 1)) * d;  // starts 1:1, resists more the further you go
  const squishOf = (d: number) => 1 - 1 / (1 + d / SQUISH_D);
  const rootStyle = getComputedStyle(document.documentElement);
  const token = (name: string) => parseFloat(rootStyle.getPropertyValue(name)) || 0;

  class Spring {
    v: number; t: number; vel = 0;
    constructor(v: number) { this.v = v; this.t = v; }
    step(dt: number, k: number, c: number) { const f = -k * (this.v - this.t) - c * this.vel; this.vel += f * dt; this.v += this.vel * dt; }
    snap(v: number) { this.v = this.t = v; this.vel = 0; }
    near(e = 0.5) { return Math.abs(this.v - this.t) < e && Math.abs(this.vel) < e * 10; }
  }

  // Rubber banding: displacement past an edge grows ever more slowly.
  const rubber = (x: number, d: number) => (1 - 1 / ((x * P.rubber) / d + 1)) * d;
  const unrubber = (r: number, d: number) => (r * d) / ((d - r) * P.rubber);
  const rubberClamp = (raw: number, s: Scroll, d: number) => raw < s.min ? s.min - rubber(s.min - raw, d) : raw > s.max ? s.max + rubber(raw - s.max, d) : raw;
  const unrubberClamp = (pos: number, s: Scroll, d: number) => pos < s.min ? s.min - unrubber(s.min - pos, d) : pos > s.max ? s.max + unrubber(pos - s.max, d) : pos;

  // ---- cards ----
  const cards = [...stage.querySelectorAll<HTMLElement>('.card')].map((el, i) => ({
    i, el, a: parseFloat(el.dataset.aspect || '1'),
    cover: el.querySelector<HTMLElement>('.cover')!,
    content: el.querySelector<HTMLElement>('.cover .content')!,
    outline: el.querySelector<SVGPathElement>('.outline path')!,
    veil: el.querySelector<HTMLElement>('.veil')!,
    label: el.querySelector<HTMLElement>('.label'),
    labelLast: '',
    video: el.querySelector<HTMLVideoElement>('video'),
    playing: false,
    W: 1, kRow: 1, clip: '', rBlur: 0, blurred: false,
    last: {} as { dim?: number; edge?: number; z?: number; ti?: number },
    x: new Spring(0), y: new Spring(0), w: new Spring(10), h: new Spring(10),
    sq: new Spring(0),
    hv: new Spring(0),   // hover lift (0..1)
    lb: new Spring(0),   // title pill: snappier, with a little overshoot
    ox: new Spring(0), oy: new Spring(0), os: new Spring(1),   // free-drag offset from layout
    ovR: new Spring(0), ovB: new Spring(0),                    // overscroll stretch, row + focus strip
    row: null as unknown as Rect, big: null as unknown as Rect, grid: null as unknown as Rect,
    follow: false, held: false, delay: 0, hold: null as Rect | null,
  }));
  type Card = (typeof cards)[number];
  const N = cards.length;
  if (!N) return;
  // Videos rest paused on their start frame, and play while their cover is
  // hovered (mouse) or open in the focus strip or grid lightbox.
  const restOn = (v: HTMLVideoElement) => {
    const start = parseFloat(v.dataset.start || '0');
    const seek = () => { v.currentTime = Math.min(start, Math.max(0, (v.duration || start) - 0.1)); };
    if (v.readyState >= 1) seek(); else v.addEventListener('loadedmetadata', seek, { once: true });
  };
  let hovered = -1;
  for (const c of cards) {
    if (c.video) restOn(c.video);
    c.el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovered = c.i; });
    c.el.addEventListener('pointerleave', () => { if (hovered === c.i) hovered = -1; });
  }
  function syncVideos() {
    for (const c of cards) {
      if (!c.video) continue;
      const open = mode === 'row' ? p.t >= 0.5 && c.i === anchor : c.i === gridOpen;
      const hover = c.i === hovered && !reduce && !ptr && (mode === 'row' ? p.t < 0.5 : gridOpen < 0);
      const want = open || hover;
      if (want === c.playing) continue;
      c.playing = want;
      if (want) c.video.play().catch(() => {});
      else { c.video.pause(); restOn(c.video); }
    }
  }

  // ---- state ----
  let mode: 'row' | 'grid' = 'row';
  const p = new Spring(0);          // row -> focus progress
  const gp = new Spring(0);         // grid lightbox progress
  let anchor = 0, gridOpen = -1, gridActive = -1, pull = 0;
  const mk = (): Scroll => ({ pos: 0, vel: 0, min: 0, max: 0, wheel: false, to: null, raw: 0, wt: 0, from: null });
  const S = { row: mk(), big: mk(), grid: mk() };
  let vw = 0, vh = 0, pad = 16, rowGap = 24, gridTop = 0, dragDist = 0;
  let simT = 0;
  const hist: [number, number][] = [];  // recent [time, squish] samples of the anchor, replayed by neighbors

  const centerBig = (i: number) => cards[i].big.x + cards[i].big.w / 2 - vw / 2;
  const rowSnap = (i: number) => clamp(cards[i].row.x + cards[i].row.w / 2 - vw / 2, 0, S.row.max);
  const nearest = (fn: (i: number) => number, x: number) => { let b = 0, bd = Infinity; for (let i = 0; i < N; i++) { const d = Math.abs(fn(i) - x); if (d < bd) { bd = d; b = i; } } return b; };
  const snapFn = (s: Scroll) => (s === S.big ? centerBig : null);
  const layer = () => (mode === 'grid' ? S.grid : p.t >= 0.5 ? S.big : S.row);
  const dimOf = (s: Scroll) => (s === S.grid ? vh : vw);
  // How far past an edge the strip can stretch before it stops giving.
  const rubberDim = (s: Scroll) => Math.min(P.rubberD, dimOf(s) * 0.5);

  function layout() {
    vw = stage.clientWidth; vh = stage.clientHeight;
    pad = parseFloat(getComputedStyle(header).left) || 16;
    rowGap = token('--row-gap');
    const headerBottom = header.getBoundingClientRect().bottom;
    const mobile = vw < 640;

    // Row (Figma 53:324): every cover the same height, top-aligned under the
    // header. 617px tall at 1440 × 1024; shorter windows keep Figma's share of
    // the height, and on narrow screens the narrowest cover leaves room for the
    // next one to peek in.
    const top = headerBottom + token('--row-gap-below-header');
    const minA = Math.min(...cards.map((c) => c.a));
    const H = Math.max(160, Math.min(
      token('--row-height'),
      vh * (FIGMA_ROW_H / FIGMA_VH),
      vh - top - vh * (FIGMA_BELOW / FIGMA_VH),
      (vw - 2 * pad - 40) / minA,
    ));
    let x = pad;
    for (const c of cards) {
      c.row = { x, y: top, w: H * c.a, h: H };
      x += H * c.a + rowGap;
    }
    S.row.min = 0; S.row.max = Math.max(0, x - rowGap + pad - vw);

    // Focus strip: each cover near full screen, centered; while one is centered
    // its neighbors sit just past the viewport edges.
    const vPad = mobile ? 72 : 40;
    const maxH = vh - 2 * vPad, maxW = vw - 2 * pad;
    let cx = 0, prevW = 0;
    cards.forEach((c, i) => {
      let h = maxH, w = h * c.a;
      if (w > maxW) { w = maxW; h = w / c.a; }
      if (i) cx += vw / 2 + Math.max(w, prevW) / 2 + 32;
      c.big = { x: cx - w / 2, y: (vh - h) / 2, w, h };
      prevW = w;
    });
    S.big.min = centerBig(0); S.big.max = centerBig(N - 1);

    // Grid: shortest-column packing under the header.
    gridTop = headerBottom + rowGap;
    const cols = clamp(Math.round((vw - 2 * pad) / 300), 2, 6);
    const cw = (vw - 2 * pad - (cols - 1) * rowGap) / cols;
    const hs = new Array(cols).fill(gridTop);
    for (const c of cards) {
      const col = hs.indexOf(Math.min(...hs));
      const h = cw / c.a;
      c.grid = { x: pad + col * (cw + rowGap), y: hs[col], w: cw, h };
      hs[col] += h + rowGap;
    }
    S.grid.min = 0; S.grid.max = Math.max(0, Math.max(...hs) - rowGap + pad - vh);

    // Every layout keeps a cover's aspect ratio, so each card renders once at its
    // largest size and only ever scales down. Text and images stay crisp.
    for (const c of cards) {
      c.W = Math.max(c.big.w, lightboxRect(c).w, c.row.w);
      c.kRow = c.row.w / c.W;
      c.el.style.width = c.W + 'px'; c.el.style.height = c.W / c.a + 'px';
    }
    updateCorners();
    shapeGlassFrames(stage);
    for (const s of Object.values(S)) { s.pos = clamp(s.pos, s.min, s.max); s.to = null; }
  }

  // Corners, border and shadow are specified at row size (Figma's frame); cards
  // are drawn at their largest size and scaled, so convert to that size.
  function updateCorners() {
    const radius = token('--cover-radius') * (cards[0].row.h / token('--row-height'));
    const smoothing = token('--cover-smoothing');
    const border = token('--cover-border-width');
    const shY = token('--cover-shadow-y'), shB = token('--cover-shadow-blur');
    for (const c of cards) {
      const k = c.W / c.row.w, h = c.W / c.a, r = radius * k;
      const path = squirclePath(c.W, h, r, smoothing);
      c.clip = `path("${path}")`;
      c.outline.setAttribute('d', path);
      c.outline.style.strokeWidth = String(border * k * 2);   // half falls outside the clip
      c.el.style.borderRadius = r * 0.6 + 'px';               // sits inside the clip; also the focus ring
      c.el.style.filter = `drop-shadow(0 ${shY * k}px ${shB * k}px var(--color-cover-shadow))`;
      c.rBlur = r * 1.2;                                       // round stand-in for the squircle while blurred
      c.cover.style.clipPath = c.blurred ? '' : c.clip;
      c.cover.style.borderRadius = c.blurred ? c.rBlur + 'px' : '';
    }
  }

  function lightboxRect(c: Card): Rect {
    const vPad = vw < 640 ? 72 : 40;
    const maxW = vw - 2 * pad, maxH = vh - 2 * vPad;
    let w = maxW, h = w / c.a;
    if (h > maxH) { h = maxH; w = h * c.a; }
    return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
  }

  // Where a card wants to be on screen right now.
  function targetRect(c: Card): Rect {
    if (mode === 'row') {
      const a = c.row, b = c.big, t = clamp(p.v, 0, 1.2);
      const rx = a.x - clamp(S.row.pos, S.row.min, S.row.max) - c.ovR.v;
      const bx = b.x - clamp(S.big.pos, S.big.min, S.big.max) - c.ovB.v;
      return { x: lerp(rx, bx, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) };
    }
    if (c.i === gridOpen) return lightboxRect(c);
    const g = c.grid;
    return { x: g.x, y: g.y - S.grid.pos, w: g.w, h: g.h };
  }

  // ---- row <-> focus ----
  function openRow(c: Card) {
    if (mode !== 'row') return;
    anchor = c.i;
    if (p.v < 0.02) { S.big.pos = centerBig(c.i); S.big.vel = 0; S.big.to = null; }
    else S.big.to = centerBig(c.i);
    S.row.vel = 0; S.row.to = null;
    p.t = 1;
  }
  function closeRow() {
    const i = nearest(centerBig, S.big.to ?? S.big.pos);
    anchor = i;
    if (p.v > 0.98) { S.row.pos = rowSnap(i); S.row.vel = 0; S.row.to = null; }
    p.t = 0;
  }

  // Focused cover released after a free drag: fly home to the row, or settle back.
  function releaseFling(c: Card, v: { x: number; y: number }, commit: boolean) {
    c.held = false;
    c.ox.t = 0; c.ox.vel = v.x;
    c.oy.t = 0; c.oy.vel = v.y;
    c.os.t = 1;
    if (commit) closeRow();
  }
  // How much each cover moves with an overscroll. Covers under and behind the
  // finger move fully; covers toward the stretched end trail behind, so the gaps
  // open up like a spring and close again as it settles.
  function stretchWeight(c: Card, lay: 'row' | 'big', s: Scroll) {
    const o = s.pos - clamp(s.pos, s.min, s.max);
    if (!o) return 0;
    const r = c[lay], cx = r.x + r.w / 2;
    const ref = ptr && ptr.kind === 'scroll' && ptr.s === s ? ptr.grabC : clamp(s.pos, s.min, s.max) + vw / 2;
    const d = Math.max(0, o < 0 ? ref - cx : cx - ref);
    return o * (0.25 + 0.75 * Math.exp(-d / (vw * 0.3)));
  }
  // Safety net for the stretch: covers may spread apart but never close a gap
  // past half its width.
  function keepGaps() {
    if (mode !== 'row') return;
    const minGap = rowGap * 0.5 * (1 - clamp(p.v, 0, 1));
    for (let i = 1; i < N; i++) {
      const a = cards[i - 1], b = cards[i];
      // Only between covers that have landed in the row; covers flying in from
      // the grid sit in columns, out of row order, and must not be shoved.
      if (!a.follow || !b.follow) continue;
      const over = a.x.v + a.w.v + minGap - b.x.v;
      if (over > 0 && p.v < 0.02) b.x.v += over;
    }
  }

  // ---- grid lightbox ----
  function openGrid(c: Card) {
    gridOpen = gridActive = c.i; c.follow = false; gp.t = 1;
    S.grid.vel = 0; S.grid.to = null;
  }
  function closeGrid(vel?: { x: number; y: number }) {
    if (gridOpen < 0) return;
    const c = cards[gridOpen];
    gridOpen = -1; c.follow = false; gp.t = 0;
    if (vel) { c.x.vel = vel.x; c.y.vel = vel.y; }
  }

  function setMode(m: 'row' | 'grid') {
    if (m === mode) return;
    closeGrid();
    const now = performance.now();
    // Into the grid, release covers by where they are now; back to the row,
    // release them in row order so the strip assembles from left to right.
    const order = m === 'row' ? [...cards] : [...cards].sort((a, b) => a.y.v - b.y.v || a.x.v - b.x.v);
    order.forEach((c, k) => {
      c.follow = false;
      c.hold = { x: c.x.v, y: c.y.v, w: c.w.v, h: c.h.v };
      c.delay = now + (reduce ? 0 : k * 16);
    });
    if (p.t >= 0.5) S.row.pos = rowSnap(nearest(centerBig, S.big.pos));
    p.snap(0);
    mode = m;
    gridBtn.setAttribute('aria-pressed', String(m === 'grid'));
    gridBtn.setAttribute('aria-label', m === 'grid' ? 'Show as row' : 'Show as grid');
  }

  function tap(c: Card | null) {
    if (mode === 'grid') { if (gridOpen >= 0) closeGrid(); else if (c) openGrid(c); return; }
    if (p.t >= 0.5) {
      const cur = nearest(centerBig, S.big.to ?? S.big.pos);
      if (c && c.i !== cur) { S.big.to = centerBig(c.i); anchor = c.i; }
      else closeRow();
    } else if (c) openRow(c);
  }

  // Pull-down squish. The finger drives the anchor; each neighbor replays the
  // anchor's recent history, one ripple delay later per step out, so the shrink
  // travels down the row as a chain reaction.
  const setSquish = (a: number) => cards[anchor].sq.snap(a);
  function releaseSquish(vy: number) {
    const c = cards[anchor];
    c.sq.t = 0;
    c.sq.vel = clamp((vy * (1 - c.sq.v) ** 2) / SQUISH_D, -8, 8);
  }
  function sampleHist(t: number) {
    if (!hist.length || t <= hist[0][0]) return hist.length ? hist[0][1] : 0;
    for (let i = hist.length - 1; i > 0; i--) {
      const [t1, v1] = hist[i], [t0, v0] = hist[i - 1];
      if (t >= t0) return t1 === t0 ? v1 : lerp(v0, v1, (t - t0) / (t1 - t0));
    }
    return hist[0][1];
  }
  // Keep row gaps constant while covers shrink: re-flow outward from the anchor.
  const flow = new Array(N).fill(0);
  function reflow() {
    const sc = cards.map((c) => 1 - MAX_SQ * clamp(c.sq.v, -0.1, 1));
    const k = anchor, A = cards[k].row, cx = A.x + A.w / 2;
    flow[k] = 0;
    let edge = cx + (A.w * sc[k]) / 2;
    for (let i = k + 1; i < N; i++) {
      const r = cards[i].row, w = r.w * sc[i];
      flow[i] = edge + rowGap + w / 2 - (r.x + r.w / 2);
      edge += rowGap + w;
    }
    edge = cx - (A.w * sc[k]) / 2;
    for (let i = k - 1; i >= 0; i--) {
      const r = cards[i].row, w = r.w * sc[i];
      flow[i] = edge - rowGap - w / 2 - (r.x + r.w / 2);
      edge -= rowGap + w;
    }
    return sc;
  }

  // ---- pointer ----
  type Ptr = {
    id: number; x0: number; y0: number; card: Card | null; kind: string | null;
    samples: [number, number, number][]; lastX?: number;
    s?: Scroll; raw0?: number; grabC?: number; startIdx?: number | null;
    p0?: number; origin?: 'row' | 'big'; lock?: 'up' | 'down';
    o0?: { x: number; y: number }; rect?: Rect; fx?: number; fy?: number;
  };
  let ptr: Ptr | null = null;
  // Release velocity from the last ~100ms of moves, using each event's own
  // timestamp. A pause before letting go reads as zero.
  const velocityOf = (samples: [number, number, number][], upT: number) => {
    const n = samples.length, last = samples[n - 1];
    if (n < 2 || upT - last[2] > 80) return { x: 0, y: 0 };
    let j = n - 2;
    while (j > 0 && last[2] - samples[j - 1][2] <= 100) j--;
    const first = samples[j], dt = (last[2] - first[2]) / 1000;
    return dt > 0.004 ? { x: (last[0] - first[0]) / dt, y: (last[1] - first[1]) / dt } : { x: 0, y: 0 };
  };
  const cardOf = (t: EventTarget | null) => {
    const el = (t as Element | null)?.closest?.('.card') as HTMLElement | null;
    return el ? cards[+el.dataset.i!] : null;
  };

  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || ptr) return;
    ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, card: cardOf(e.target), kind: null, samples: [[e.clientX, e.clientY, e.timeStamp]] };
    stage.setPointerCapture(e.pointerId);
    const s = layer();
    if (s !== S.big) { s.vel = 0; s.to = null; }  // catch a moving strip; the focus strip keeps settling
  });

  stage.addEventListener('pointermove', (e) => {
    if (!ptr || e.pointerId !== ptr.id) return;
    // A mouse moving with no button held means we missed the release (outside
    // the window): end the drag instead of sticking to the cursor.
    if (e.pointerType === 'mouse' && e.buttons === 0) { endPointer(e, false); return; }
    ptr.samples.push([e.clientX, e.clientY, e.timeStamp]);
    if (ptr.samples.length > 30) ptr.samples.shift();
    ptr.lastX = e.clientX;
    let dx = e.clientX - ptr.x0, dy = e.clientY - ptr.y0;

    if (!ptr.kind && Math.hypot(dx, dy) > 6) {
      const horiz = Math.abs(dx) > Math.abs(dy);
      if (mode === 'grid') {
        if (gridOpen >= 0) {
          const c = ptr.card && ptr.card.i === gridOpen ? ptr.card : null;
          ptr.kind = c ? 'card' : 'none';
          if (c) {
            const r = lightboxRect(c);
            ptr.rect = r;
            ptr.fx = clamp((ptr.x0 - r.x) / r.w, 0, 1); ptr.fy = clamp((ptr.y0 - r.y) / r.h, 0, 1);
            c.held = true;
          }
        } else ptr.kind = 'scroll';
      } else if (p.t >= 0.5 && !horiz) {
        // Focus view: a vertical drag picks up the focused cover. It then follows
        // the finger in any direction; far enough or fast enough sends it home.
        ptr.kind = 'fling'; anchor = nearest(centerBig, S.big.to ?? S.big.pos);
        S.big.to = centerBig(anchor);
        S.row.pos = rowSnap(anchor); S.row.vel = 0; S.row.to = null;
        const c = cards[anchor];
        ptr.o0 = { x: c.ox.v, y: c.oy.v };
        c.held = true;
      } else if (horiz) {
        ptr.kind = 'scroll';
      } else if (ptr.card) {
        ptr.kind = 'vert'; ptr.origin = 'row';
        // Lock the gesture to the direction it started in: down only squishes,
        // up only opens.
        ptr.lock = dy > 0 ? 'down' : 'up';
        anchor = ptr.card.i;
        if (p.v < 0.02) { S.big.pos = centerBig(anchor); S.big.vel = 0; S.big.to = null; }
      } else ptr.kind = 'none';

      if (ptr.kind === 'scroll') {
        const s = layer();
        ptr.s = s; s.to = null; s.vel = 0;
        ptr.raw0 = unrubberClamp(s.pos, s, rubberDim(s));
        ptr.grabC = clamp(s.pos, s.min, s.max) + e.clientX;
        ptr.startIdx = s === S.big ? nearest(centerBig, s.pos) : null;
        stage.classList.add('dragging');
      }
      if (ptr.kind === 'vert') ptr.p0 = p.v;
      if (ptr.kind === 'scroll' || ptr.kind === 'vert' || ptr.kind === 'fling') { ptr.x0 = e.clientX; ptr.y0 = e.clientY; dx = dy = 0; }
    }

    if (ptr.kind === 'scroll') {
      const s = ptr.s!;
      s.pos = rubberClamp(ptr.raw0! - (s === S.grid ? dy : dx), s, rubberDim(s));
      dragDist = Math.abs(s === S.grid ? dy : dx);
    } else if (ptr.kind === 'vert') {
      // Up opens; down squishes against a rubber band.
      let q = ptr.p0! - dy / PULL;
      if (ptr.lock === 'down') { setSquish(squishOf(Math.max(0, dy))); q = ptr.p0!; }
      else { setSquish(0); q = Math.max(ptr.p0!, q); }
      if (q > 1) q = 1 + (rubber((q - 1) * PULL, PULL) / PULL) * 0.3;
      p.snap(q);
      dragDist = Math.abs(dy);
    } else if (ptr.kind === 'fling') {
      const c = cards[anchor];
      const rx = ptr.o0!.x + dx, ry = ptr.o0!.y + dy, dist = Math.hypot(rx, ry);
      const k = dist ? soft(dist, 1100) / dist : 1;
      c.ox.snap(rx * k); c.oy.snap(ry * k);
      c.os.snap(1 - 0.32 * (1 - 1 / (1 + dist / 320)));
      pull = clamp(dist / FLING_D, 0, 1);
      dragDist = dist;
    } else if (ptr.kind === 'card') {
      // Grid lightbox: follow the finger, shrink as you pull down.
      const c = cards[gridOpen], r = ptr.rect!;
      const ey = dy >= 0 ? dy : -rubber(-dy, vh * 0.5);
      pull = clamp(ey / (vh * 0.35), 0, 1);
      const sc = 1 - 0.45 * pull;
      const w = r.w * sc, h = r.h * sc;
      c.x.snap(ptr.x0 + dx - ptr.fx! * w); c.y.snap(ptr.y0 + ey - ptr.fy! * h);
      c.w.snap(w); c.h.snap(h);
      gp.snap(1 - pull * 0.9);
      dragDist = Math.hypot(dx, ey);
    }
  });

  function endPointer(e: { pointerId: number; timeStamp: number }, cancelled: boolean) {
    if (!ptr || e.pointerId !== ptr.id) return;
    const v = velocityOf(ptr.samples, e.timeStamp);
    stage.classList.remove('dragging');

    if (!ptr.kind && !cancelled) tap(ptr.card);
    else if (ptr.kind === 'scroll') {
      const s = ptr.s!;
      s.vel = -(s === S.grid ? v.y : v.x);
      s.from = ptr.startIdx ?? null;
    } else if (ptr.kind === 'vert') {
      const commit = p.v > COMMIT_D || (v.y < -COMMIT_V && p.v > 0.02);
      p.t = commit ? 1 : 0;
      // Only an upward (opening) drag hands its speed to the open spring. A
      // pull-down never moved it, so a downward flick must not shove the layout.
      p.vel = ptr.lock === 'down' ? 0 : clamp(-v.y / PULL, -8, 8);
      releaseSquish(v.y);
      pull = 0;
    } else if (ptr.kind === 'fling') {
      const c = cards[anchor];
      const ox = c.ox.v, oy = c.oy.v, dist = Math.hypot(ox, oy) || 1;
      const outward = (v.x * ox + v.y * oy) / dist;  // release speed away from center
      releaseFling(c, v, dragDist > FLING_D || (outward > COMMIT_V && dragDist > 24));
      pull = 0;
    } else if (ptr.kind === 'card') {
      const c = cards[gridOpen];
      c.held = false;
      if (pull > 0.28 || (v.y > 500 && pull > 0.04)) closeGrid(v);
      else { c.x.vel = v.x; c.y.vel = v.y; gp.t = 1; }
      pull = 0;
    }
    ptr = null;
  }
  stage.addEventListener('pointerup', (e) => endPointer(e, false));
  stage.addEventListener('pointercancel', (e) => endPointer(e, true));
  // Other ways a release can go missing: capture dropped, or the window lost focus.
  stage.addEventListener('lostpointercapture', (e) => endPointer(e, false));
  window.addEventListener('blur', () => { if (ptr) endPointer({ pointerId: ptr.id, timeStamp: performance.now() }, true); });

  // Keyboard activation (pointer taps are handled above).
  stage.addEventListener('click', (e) => {
    if (e.detail !== 0) return;
    const c = cardOf(e.target);
    if (c) tap(c);
  });
  stage.addEventListener('focusin', (e) => {
    const c = cardOf(e.target);
    if (!c) return;
    if (mode === 'row' && p.t >= 0.5) { S.big.to = centerBig(c.i); anchor = c.i; return; }
    if (mode === 'grid' && gridOpen >= 0) return;
    const s = layer(), r = c[mode];
    const lo = mode === 'row' ? r.x - pad : r.y - gridTop, hi = mode === 'row' ? r.x + r.w + pad - vw : r.y + r.h + pad - vh;
    if (s.pos > lo) s.to = clamp(lo, s.min, s.max);
    else if (s.pos < hi) s.to = clamp(hi, s.min, s.max);
  });

  // Wheel and trackpad: scroll directly, rubber-band past the ends, settle once input stops.
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (mode === 'grid' && gridOpen >= 0) { if (Math.abs(e.deltaY) > 24 && !ptr) closeGrid(); return; }
    const s = layer();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? dimOf(s) : 1;
    const d = (s !== S.grid && Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
    if (!s.wheel) s.raw = unrubberClamp(s.pos, s, rubberDim(s));
    s.raw += d; s.pos = rubberClamp(s.raw, s, rubberDim(s));
    s.vel = 0; s.to = null; s.from = null; s.wheel = true;
    clearTimeout(s.wt); s.wt = window.setTimeout(() => { s.wheel = false; }, 140);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { if (mode === 'grid') closeGrid(); else if (p.t >= 0.5) closeRow(); return; }
    if (e.key === 'g' || e.key === 'G') { setMode(mode === 'row' ? 'grid' : 'row'); return; }
    if (e.key === 't' || e.key === 'T') { toggleTheme(); return; }
    if (mode === 'grid' && gridOpen >= 0) return;
    const fwd = mode === 'row' ? 'ArrowRight' : 'ArrowDown', back = mode === 'row' ? 'ArrowLeft' : 'ArrowUp';
    if (e.key !== fwd && e.key !== back) return;
    e.preventDefault();
    const s = layer(), dir = e.key === fwd ? 1 : -1, fn = snapFn(s);
    if (fn) { const i = clamp(nearest(fn, s.to ?? s.pos) + dir, 0, N - 1); s.to = fn(i); if (s === S.big) anchor = i; }
    else { s.vel += dir * 1400; s.to = null; }
  });

  gridBtn.addEventListener('click', () => setMode(mode === 'row' ? 'grid' : 'row'));

  // Theme: follows the system until toggled. Toggling flips what's showing;
  // landing back on the system's choice un-pins it.
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => {
    const pinned = document.documentElement.dataset.scheme;
    return pinned ? pinned === 'dark' : systemDark.matches;
  };
  const labelTheme = () => themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
  function toggleTheme() {
    const next = isDark() ? 'light' : 'dark';
    const root = document.documentElement;
    if ((next === 'dark') === systemDark.matches) delete root.dataset.scheme;
    else root.dataset.scheme = next;
    try {
      if (root.dataset.scheme) localStorage.setItem('theme', next);
      else localStorage.removeItem('theme');
    } catch (err) {}
    labelTheme();
  }
  themeBtn.addEventListener('click', toggleTheme);
  systemDark.addEventListener('change', labelTheme);
  labelTheme();

  // ---- edges ----
  // Blur strength per band follows an ease-in curve, so the ramp starts almost
  // imperceptibly and only gets heavy right at the edge. The fade to the page
  // uses a smootherstep ramp sampled into many stops, which avoids the "knee" a
  // two-stop gradient has.
  const edges = [...document.querySelectorAll<HTMLElement>('.edge')];
  function applyEdges() {
    const root = document.documentElement.style;
    root.setProperty('--edge-w', `clamp(64px, ${P.edgeW}vw, 480px)`);
    edges.forEach((ed) => [...ed.children].forEach((el, k) =>
      (el as HTMLElement).style.setProperty('--b', (P.edgeBlur * Math.pow((k + 1) / 8, P.edgeCurve)).toFixed(2) + 'px')));
    const stops = [];
    for (let j = 0; j <= 16; j++) {
      const t = j / 16, u = clamp((t - 0.15) / 0.85, 0, 1);
      const e = u * u * u * (u * (u * 6 - 15) + 10);
      stops.push(`color-mix(in srgb, var(--color-bg) ${(P.edgeFade * e * 100).toFixed(1)}%, transparent) ${(t * 100).toFixed(1)}%`);
    }
    root.setProperty('--fade', `linear-gradient(to left, ${stops.join(', ')})`);
  }
  // Each edge slides out (0 = in place, 1 = fully off screen). Sliding, not
  // fading: opacity on a backdrop-filter parent would switch the blur off.
  const edgeShift: Record<string, number> = { l: -1, r: -1 };
  function slideEdges(l: number, r: number) {
    for (const [side, amt] of [['l', l], ['r', r]] as const) {
      const a = Math.round(clamp(amt, 0, 1) * 1000) / 1000;
      if (a === edgeShift[side]) continue;
      edgeShift[side] = a;
      for (const el of edges) if (el.classList.contains(side))
        el.style.transform = `${side === 'r' ? 'scaleX(-1) ' : ''}translateX(${(-a * 100).toFixed(2)}%)`;
    }
  }
  // An edge only shows when there is more of the row beyond it.
  function edgeAmounts(pv: number) {
    if (mode === 'grid') return [1, 1];
    const s = S.row, ew = edges[0].offsetWidth || 1;
    const l = 1 - clamp((s.pos - s.min) / ew, 0, 1), r = 1 - clamp((s.max - s.pos) / ew, 0, 1);
    return [Math.max(l, pv), Math.max(r, pv)];
  }

  // ---- simulation ----
  // Where a glide from velocity v comes to rest under dv/dt = -decay*v - brake.
  function glideDist(v: number) {
    const a = P.decay, b = Math.max(1, P.brake), u = Math.abs(v);
    const T = Math.log(1 + (a * u) / b) / a;
    return Math.sign(v) * (u / a - (b / a) * T);
  }
  function stepScroll(s: Scroll, dt: number) {
    if ((ptr && ptr.kind === 'scroll' && ptr.s === s) || s.wheel) return;
    const fn = snapFn(s);
    if (fn && s.to == null) {
      // Project where the glide would stop, then settle on the nearest snap point.
      let i = nearest(fn, s.pos + glideDist(s.vel));
      if (s.from != null) {
        // The focus strip pages like a native carousel: a flick, or a drag past
        // ~a fifth of the screen, moves exactly one cover in that direction.
        const moved = s.pos - fn(s.from);
        const dir = Math.abs(s.vel) > 250 ? Math.sign(s.vel) : Math.abs(moved) > vw * 0.18 ? Math.sign(moved) : 0;
        i = clamp(s.from + dir, 0, N - 1);
      }
      s.from = null;
      const t = fn(i);
      if (Math.abs(t - s.pos) > 0.5 || Math.abs(s.vel) > 2) s.to = t;
    }
    if (s.to != null) {
      const a = -SNAP_K * (s.pos - s.to) - SNAP_C * s.vel;
      s.vel += a * dt; s.pos += s.vel * dt;
      if (Math.abs(s.pos - s.to) < 0.1 && Math.abs(s.vel) < 2) { s.pos = s.to; s.vel = 0; s.to = null; }
    } else if (s.pos < s.min || s.pos > s.max) {
      const b = s.pos < s.min ? s.min : s.max;
      const a = -EDGE_K * (s.pos - b) - EDGE_C * s.vel;
      s.vel += a * dt; s.pos += s.vel * dt;
      if (Math.abs(s.pos - b) < 0.1 && Math.abs(s.vel) < 2) { s.pos = b; s.vel = 0; }
    } else if (s.vel) {
      const sg = Math.sign(s.vel);
      s.vel -= (P.decay * s.vel + sg * P.brake) * dt;
      if (Math.sign(s.vel) !== sg || Math.abs(s.vel) < 4) s.vel = 0;
      s.pos += s.vel * dt;
    }
  }

  let last = performance.now(), whoOpacity = -1;
  function tick(now: number) {
    const dt = Math.min((now - last) / 1000, 1 / 15);
    last = now;

    for (const c of cards) {
      c.ovR.t = stretchWeight(c, 'row', S.row);
      c.ovB.t = stretchWeight(c, 'big', S.big);
      if (c.held && c.i === gridOpen) continue;
      const r = now < c.delay ? c.hold! : targetRect(c);
      c.x.t = r.x; c.y.t = r.y; c.w.t = r.w; c.h.t = r.h;
    }

    // Neighbors chase the anchor's squish from a moment ago, scaled down with distance.
    for (const c of cards) {
      const d = Math.abs(c.i - anchor);
      if (d) c.sq.t = sampleHist(simT - (d * P.rippleDelay) / 1000) * Math.pow(P.falloff, d);
    }

    const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
    const dragging = !!ptr && ptr.kind === 'vert';
    for (let i = 0; i < n; i++) {
      for (const c of cards) {
        if (!c.follow && !c.held) { c.x.step(h, P.k, P.c); c.y.step(h, P.k, P.c); c.w.step(h, P.k, P.c); c.h.step(h, P.k, P.c); }
        c.hv.step(h, HV_K, HV_C);
        c.lb.step(h, LB_K, LB_C);
        if (c.i !== anchor) c.sq.step(h, NB_K, NB_C);
        else if (!dragging) c.sq.step(h, SQ_K, SQ_C);
        if (!c.held) { c.ox.step(h, P.k, P.c); c.oy.step(h, P.k, P.c); c.os.step(h, P.k, P.c); }
        c.ovR.step(h, OV_K, OV_C); c.ovB.step(h, OV_K, OV_C);
      }
      if (!dragging) p.step(h, P.k, P.c);
      if (!(ptr && ptr.kind === 'card')) gp.step(h, P.k, P.c);
      stepScroll(S.row, h); stepScroll(S.big, h); stepScroll(S.grid, h);
    }
    simT += dt;
    hist.push([simT, cards[anchor].sq.v]);
    while (hist.length > 2 && hist[1][0] < simT - 1.5) hist.shift();

    // Cards that have landed lock onto their layout; cards in flight stay on springs.
    for (const c of cards) {
      if (c.held && c.i === gridOpen) continue;
      if (c.follow) { const r = targetRect(c); c.x.snap(r.x); c.y.snap(r.y); c.w.snap(r.w); c.h.snap(r.h); }
      else if (now >= c.delay && c.x.near() && c.y.near() && c.w.near() && c.h.near()) c.follow = true;
    }
    keepGaps();
    if (gridOpen < 0 && gridActive >= 0 && gp.v < 0.002 && cards[gridActive].follow) gridActive = -1;

    const gpv = clamp(gp.v, 0, 1), pv = clamp(p.v, 0, 1);
    const sc = reflow(), fb = mode === 'row' ? 1 - pv : 0;
    const [eL, eR] = edgeAmounts(pv), edgeZone = edges[0].offsetWidth || vw * 0.16;
    for (const c of cards) {
      // Squish shrinks toward the bottom center of the cover's slot.
      const w = Math.max(1, c.w.v) * sc[c.i], h = Math.max(1, c.h.v) * sc[c.i];
      let x = c.x.v + flow[c.i] * fb + (c.w.v - w) / 2, y = c.y.v + c.h.v - h;
      // Free-drag offset, scaled about the cover's center.
      const os = c.os.v, w2 = w * os, h2 = h * os;
      x += c.ox.v + (w - w2) / 2; y += c.oy.v + (h - h2) / 2;
      const st = c.el.style, L = c.last;
      // Hover: a slight lift about the cover's centre, in the row and the grid
      // (not while dragging, or once a cover is open).
      const resting = !ptr && (mode === 'row' ? p.t < 0.5 : gridOpen < 0);
      const pointed = c.i === hovered || c.el.matches(':focus-visible');
      c.hv.t = c.lb.t = pointed && resting ? 1 : 0;
      const hs = 1 + (HOVER_SCALE - 1) * (reduce ? 0 : c.hv.v);
      const tw = w2 * hs;
      st.transform = `translate3d(${x - (tw - w2) / 2}px, ${y - (h2 * hs - h2) / 2}px, 0) scale(${tw / c.W})`;
      // Title pill: pops in on its own spring (--pop may overshoot past 1;
      // --show is the clamped version for opacity), counter-scaled to stay a
      // constant size on screen.
      if (c.label) {
        const pop = reduce ? clamp(c.lb.t, 0, 1) : c.lb.v, show = clamp(pop, 0, 1);
        const key = show < 0.005 ? '0' : `${pop.toFixed(3)}|${(c.W / tw).toFixed(4)}`;
        if (key !== c.labelLast) {
          c.labelLast = key;
          c.label.style.setProperty('--show', show < 0.005 ? '0' : show.toFixed(3));
          c.label.style.setProperty('--pop', pop.toFixed(3));
          c.label.style.setProperty('--unscale', (c.W / tw).toFixed(4));
        }
      }

      // Focus: covers away from center blur, fade and pick up grain. t runs from
      // 0 at the center of the screen to 1 as the cover has fully left it.
      let dim = 0, edge = 0;
      if (mode === 'row' && pv > 0.001 && !(ptr && ptr.kind === 'fling' && c.i === anchor)) {
        const t = clamp((Math.abs(x + w2 / 2 - vw / 2) - w2 * 0.08) / (vw / 2 + w2 * 0.42), 0, 1);
        dim = pv * t;
      }
      // Row: a cover blurs by where its inner edge (the side facing the middle)
      // is: sharp until it's within edgeStart of the screen edge, fully blurred
      // once it reaches the edge zone. Measured in screen space, not cover
      // widths, so Figma's large covers blur in the same strip of screen the
      // prototype's small ones did. Only on a side where the row continues, so
      // the first and last covers stay sharp at rest.
      if (mode === 'row' && pv < 0.999) {
        const start = vw * P.edgeStart, span = Math.max(1, start - edgeZone);
        const tl = clamp((start - (x + w2)) / span, 0, 1) * (1 - eL);
        const tr = clamp((start - (vw - x)) / span, 0, 1) * (1 - eR);
        edge = (1 - pv) * Math.max(tl, tr);
      }
      const dk = Math.round(dim * 400) / 400, ek = Math.round(edge * 400) / 400;
      if (L.dim !== dk || L.edge !== ek) {
        L.dim = dk; L.edge = ek;
        // Row blur is in on-screen px; the card is scaled by kRow in the row.
        const rowBlur = (P.rowBlur / c.kRow) * Math.pow(ek, 1.6);
        const focusBlur = P.focusBlur * Math.pow(dk, 1.5);
        const blur = Math.max(focusBlur, rowBlur);
        const fade = Math.max(dk * dk * (3 - 2 * dk), P.rowFade * ek * ek * (3 - 2 * ek));  // smoothstep
        // Focus blurs the whole cover (shape included) as it drifts away; the
        // row's light edge blur only softens the media inside, so the cover's
        // smoothed corners, border and background stay crisp. Either way the
        // grain in the veil above stays sharp.
        const whole = focusBlur >= rowBlur;
        c.cover.style.filter = whole && blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
        c.content.style.filter = !whole && blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
        // In focus, a heavy blur would be cut hard by the squircle clip, so a
        // round corner a little larger stands in. The row's light blur keeps the
        // clip, so its corners stay smoothed.
        const blurred = focusBlur > 3;
        if (blurred !== c.blurred) {
          c.blurred = blurred;
          c.cover.style.clipPath = blurred ? '' : c.clip;
          c.cover.style.borderRadius = blurred ? c.rBlur + 'px' : '';
        }
        c.veil.style.setProperty('--f', `${blur.toFixed(1)}px`);
        // Grain only in focus, arriving with the blur so sharp covers stay clean.
        c.veil.style.opacity = Math.min(1, Math.pow(dk, 1.4) * 1.5).toFixed(3);
        st.opacity = fade > 0.002 ? (1 - fade).toFixed(3) : '';
      }
      const z = mode === 'grid' ? (c.i === gridActive ? 20 : 1) : c.i === anchor ? 3 : 1;
      if (L.z !== z) { L.z = z; st.zIndex = String(z); }
      const ti = mode === 'grid' && gridOpen >= 0 && c.i !== gridOpen ? -1 : 0;
      if (L.ti !== ti) { L.ti = ti; c.el.tabIndex = ti; }
    }
    backdrop.style.opacity = mode === 'grid' && gridActive >= 0 ? gpv.toFixed(3) : '0';
    // The focus view is near full screen, so the name steps aside for it.
    const wo = Math.round((1 - pv) * 100) / 100;
    if (wo !== whoOpacity) { whoOpacity = wo; who.style.opacity = wo < 1 ? String(wo) : ''; who.style.visibility = wo < 0.01 ? 'hidden' : ''; }
    slideEdges(eL, eR);
    syncVideos();
    requestAnimationFrame(tick);
  }

  layout();
  applyEdges();
  stage.querySelectorAll<HTMLCanvasElement>('canvas[data-shader="backdrop"]').forEach((cv) => {
    try { mountBackdrop(cv); } catch (err) { console.warn('Backdrop shader failed', err); }
  });
  S.big.pos = S.big.min;
  const t0 = performance.now();
  for (const c of cards) {
    // Entrance: covers start spread apart and slide together into the row,
    // the nearest ones first.
    const r = c.row, spread = reduce ? 0 : (r.x - pad) * 1.6 + vw * 0.35;
    c.x.snap(r.x + spread); c.y.snap(r.y); c.w.snap(r.w); c.h.snap(r.h);
    c.hold = { ...r, x: r.x + spread }; c.delay = t0 + (reduce ? 0 : 150 + c.i * 40);
    c.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduce ? 0 : 600, delay: reduce ? 0 : 100 + c.i * 40, fill: 'both' })
      .finished.then((an) => an.cancel());
  }
  window.addEventListener('resize', layout);
  requestAnimationFrame(tick);
}
