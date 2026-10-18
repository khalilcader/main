// The work strip: covers on springs, moving between a row, a large focus
// strip, and a packed grid. Ported from the prototype (prototype/index.html on
// the fervent-hopper branch); see HANDOFF.md there for the interaction model.
//
// Visual values (sizes, radii, colors) come from tokens.css. The numbers in
// this file are motion tuning, dialed in on the prototype.
import { squirclePath } from './squircle';
import { shapeGlassFrames } from './glass-frame';
import { mountCameras } from './camera';
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
const FOCUS_FADE = 2.2;
// Focus-mode spacing (experiment):
//   'row'       a zoomed-in row: the row's gap scaled up with the covers, so
//               neighbours sit right beside the open cover
//   'peek'      neighbours peek in FOCUS_PEEK px at the sides
//   'offscreen' neighbours just past the screen edges (the original)
// Neighbours are dimmed by PEEK_DIM and blurred PEEK_BLUR px; further ones fade.
const FOCUS_SPACING: 'row' | 'peek' | 'offscreen' = 'row';
const FOCUS_PEEK = 72, FOCUS_GAP = 24, PEEK_DIM = 0.45, PEEK_BLUR = 0;
// In focus mode the progressive edge blur slides back in, widened to the space
// beside the open cover, so neighbours blur, dim and pick up grain gradually
// toward the screen edge instead of all at once.
const FOCUS_EDGE = { blur: 16, curve: 2, fade: 0.75 };              // background covers fade this much faster in focus mode
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
  const backdropGrain = document.getElementById('backdrop-grain');
  let backdropLast = -1;
  const header = document.querySelector<HTMLElement>('.site-header')!;
  const who = header.querySelector<HTMLElement>('.who')!;
  const viewTools = document.getElementById('view-tools');
  const closeGroup = document.getElementById('close-group');
  const focusTitle = document.getElementById('focus-title');
  let focusTitleIdx = -1;
  let chromeLast = -1;
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
    liftShadow: el.querySelector<HTMLElement>('.shadow.lift')!,
    shader: null as null | { setPaused(p: boolean): void },
    label: el.querySelector<HTMLElement>('.label'),
    labelLast: '',
    video: el.querySelector<HTMLVideoElement>('video'),
    playing: false, dimmed: false,
    W: 1, kRow: 1, clip: '', rBlur: 0, blurred: false,
    last: {} as { dim?: number; edge?: number; z?: number; ti?: number },
    x: new Spring(0), y: new Spring(0), w: new Spring(10), h: new Spring(10),
    sq: new Spring(0),
    hv: new Spring(0),   // hover lift (0..1)
    shK: 1, shLast: -1,  // shadow scale (row px → card px); last hover amount applied
    lb: new Spring(0),   // title pill: snappier, with a little overshoot
    ox: new Spring(0), oy: new Spring(0), os: new Spring(1),   // free-drag offset from layout
    ovR: new Spring(0), ovB: new Spring(0),                    // overscroll stretch, row + focus strip
    row: null as unknown as Rect, big: null as unknown as Rect, grid: null as unknown as Rect,
    follow: false, held: false, delay: 0, hold: null as Rect | null,
  }));
  type Card = (typeof cards)[number];
  const N = cards.length;
  if (!N) return;
  // Videos rest paused on their start frame (the thumbnail), and play from the
  // beginning while their cover is hovered (mouse) or open in the focus strip
  // or grid lightbox.
  const restOn = (v: HTMLVideoElement) => {
    const start = parseFloat(v.dataset.start || '0');
    const seek = () => { v.currentTime = Math.min(start, Math.max(0, (v.duration || start) - 0.1)); };
    if (v.readyState >= 1) seek(); else v.addEventListener('loadedmetadata', seek, { once: true });
  };
  let hovered = -1;
  // The card with keyboard focus, tracked by events: asking :focus-visible every
  // frame forced a style recalculation per card per frame.
  let keyFocused = -1;
  stage.addEventListener('focusin', (e) => {
    const el = (e.target as Element).closest?.('.card') as HTMLElement | null;
    keyFocused = el && el.matches(':focus-visible') ? +el.dataset.i! : -1;
  });
  stage.addEventListener('focusout', () => { keyFocused = -1; });
  for (const c of cards) {
    if (c.video) restOn(c.video);
    c.el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovered = c.i; });
    c.el.addEventListener('pointerleave', () => { if (hovered === c.i) hovered = -1; });
  }
  // Backdrop shaders follow the same rule (still otherwise, which saves the
  // GPU redrawing them and re-blurring the glass over them), and also pause
  // while their cover is blurred or dimmed.
  function syncVideos() {
    for (const c of cards) {
      const open = mode === 'row' ? p.t >= 0.5 && c.i === anchor : c.i === gridOpen;
      const hover = c.i === hovered && !reduce && !ptr && (mode === 'row' ? p.t < 0.5 : gridOpen < 0);
      const want = open || hover;
      c.shader?.setPaused(!want || c.dimmed);
      if (!c.video || want === c.playing) continue;
      c.playing = want;
      if (want) { c.video.currentTime = 0; c.video.play().catch(() => {}); }
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
  let vw = 0, vh = 0, pad = 16, rowGap = 24, focusGap = 24, gridTop = 0, dragDist = 0;
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
    // its neighbors peek in FOCUS_PEEK px at the sides (or, with no peek, sit
    // just past the viewport edges).
    const vPad = mobile ? 72 : 40;
    const peek = FOCUS_SPACING === 'peek' ? (mobile ? Math.min(FOCUS_PEEK, 24) : FOCUS_PEEK) : 0;
    const maxH = vh - 2 * vPad, maxW = peek ? vw - 2 * (peek + FOCUS_GAP) : vw - 2 * pad;
    const zoomGap = rowGap * (maxH / H);   // the row's gap, scaled up like the covers
    focusGap = zoomGap;
    let cx = 0, prevW = 0;
    cards.forEach((c, i) => {
      let h = maxH, w = h * c.a;
      if (w > maxW) { w = maxW; h = w / c.a; }
      // With a peek: the narrower of two neighbours shows exactly `peek` px
      // beside the other, and the two never get closer than FOCUS_GAP.
      if (i) cx += FOCUS_SPACING === 'row' ? prevW / 2 + zoomGap + w / 2
        : peek ? Math.max(vw / 2 - peek + Math.min(w, prevW) / 2, prevW / 2 + FOCUS_GAP + w / 2)
        : vw / 2 + Math.max(w, prevW) / 2 + 32;
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

  // Cover shadow sizes [rest y, rest blur, lifted y, lifted blur] at row size.
  let shadowSpec = [4, 16, 10, 32];

  // Corners, border and shadow are specified at row size (Figma's frame); cards
  // are drawn at their largest size and scaled, so convert to that size.
  function updateCorners() {
    const radius = token('--cover-radius') * (cards[0].row.h / token('--row-height'));
    const smoothing = token('--cover-smoothing');
    const border = token('--cover-border-width');
    shadowSpec = [token('--cover-shadow-y'), token('--cover-shadow-blur'), token('--cover-shadow-hover-y'), token('--cover-shadow-hover-blur')];
    for (const c of cards) {
      const k = c.W / c.row.w, h = c.W / c.a, r = radius * k;
      const path = squirclePath(c.W, h, r, smoothing);
      c.clip = `path("${path}")`;
      c.outline.setAttribute('d', path);
      c.outline.style.strokeWidth = String(border * k * 2);   // half falls outside the clip
      c.el.style.borderRadius = r * 0.6 + 'px';               // sits inside the clip; also the focus ring
      c.shK = k; c.shLast = -1;
      // Shadow layers, in the card's own (unscaled) pixels.
      const es = c.el.style;
      es.setProperty('--shadow-r', `${r}px`);
      es.setProperty('--shadow-y0', `${shadowSpec[0] * k}px`); es.setProperty('--shadow-b0', `${shadowSpec[1] * k}px`);
      es.setProperty('--shadow-y1', `${shadowSpec[2] * k}px`); es.setProperty('--shadow-b1', `${shadowSpec[3] * k}px`);
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
    document.documentElement.toggleAttribute('data-grid', m === 'grid');   // labels change style (WorkStrip.astro)
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
  document.getElementById('close-button')?.addEventListener('click', () => {
    if (mode === 'grid') closeGrid(); else closeRow();
  });

  // Theme: three settings, cycled by the button or T: system (follows the
  // device), light, dark. A pinned choice is stored; system clears it.
  const MODES = ['system', 'light', 'dark'] as const;
  type ThemeMode = (typeof MODES)[number];
  const modeNow = (): ThemeMode => (document.documentElement.dataset.scheme as ThemeMode) || 'system';
  const showTheme = () => {
    const m = modeNow();
    themeBtn.dataset.mode = m;
    themeBtn.setAttribute('aria-label', `Theme: ${m}`);
  };
  function toggleTheme() {
    const next = MODES[(MODES.indexOf(modeNow()) + 1) % MODES.length];
    const root = document.documentElement;
    if (next === 'system') delete root.dataset.scheme; else root.dataset.scheme = next;
    try {
      if (next === 'system') localStorage.removeItem('theme'); else localStorage.setItem('theme', next);
    } catch (err) {}
    showTheme();
  }
  themeBtn.addEventListener('click', toggleTheme);
  showTheme();

  // ---- edges ----
  // Blur strength per band follows an ease-in curve, so the ramp starts almost
  // imperceptibly and only gets heavy right at the edge. The fade to the page
  // uses a smootherstep ramp sampled into many stops, which avoids the "knee" a
  // two-stop gradient has.
  const edges = [...document.querySelectorAll<HTMLElement>('.edge')];
  // Edge geometry: width (px), max blur at the screen edge, blur curve, fade.
  // The row's values blend into the focus values as a cover opens (f = 0..1).
  let edgeKey = '';
  function applyEdges(f = 0) {
    const rowW = clamp(vw * P.edgeW / 100, 64, 480);
    let focusW = rowW;
    if (f > 0) {
      // From the screen edge to just short of the cover at the centre.
      const c = cards[nearest(centerBig, S.big.pos)];
      focusW = Math.max(rowW, (vw - c.big.w) / 2 - focusGap / 2);
    }
    const w = lerp(rowW, focusW, f), maxB = lerp(P.edgeBlur, FOCUS_EDGE.blur, f);
    const curve = lerp(P.edgeCurve, FOCUS_EDGE.curve, f), fadeAmt = lerp(P.edgeFade, FOCUS_EDGE.fade, f);
    const key = `${w.toFixed(0)}|${maxB.toFixed(1)}|${curve.toFixed(2)}|${fadeAmt.toFixed(3)}`;
    if (key === edgeKey) return;
    edgeKey = key;
    // Set on the edge elements, not the page root: a root custom property
    // makes the browser re-check every element's style, every frame.
    edges.forEach((ed) => ed.style.setProperty('--edge-w', `${w.toFixed(1)}px`));
    // A band under ~0.3px of blur looks the same as none, so it's switched off
    // rather than paying for a backdrop blur (in the row, half of them).
    edges.forEach((ed) => [...ed.children].forEach((el, k) => {
      const b = maxB * Math.pow((k + 1) / 8, curve);
      (el as HTMLElement).style.setProperty('--b', b.toFixed(2) + 'px');
      el.classList.toggle('off', b < 0.3);
    }));
    const stops = [];
    for (let j = 0; j <= 16; j++) {
      const t = j / 16, u = clamp((t - 0.15) / 0.85, 0, 1);
      const e = u * u * u * (u * (u * 6 - 15) + 10);
      stops.push(`color-mix(in srgb, var(--color-bg) ${(fadeAmt * e * 100).toFixed(1)}%, transparent) ${(t * 100).toFixed(1)}%`);
    }
    const fade = `linear-gradient(to left, ${stops.join(', ')})`;
    edges.forEach((ed) => ed.style.setProperty('--fade', fade));
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
{
        el.style.transform = `${side === 'r' ? 'scaleX(-1) ' : ''}translateX(${(-a * 100).toFixed(2)}%)`;
        el.style.visibility = a >= 1 ? 'hidden' : '';   // off screen: no blur passes
      }
    }
  }
  // An edge only shows when there is more of the row beyond it.
  function edgeAmounts(pv: number) {
    if (mode === 'grid') return [1, 1];
    const s = S.row, ew = edges[0].offsetWidth || 1;
    const l = 1 - clamp((s.pos - s.min) / ew, 0, 1), r = 1 - clamp((s.max - s.pos) / ew, 0, 1);
    // Focus with neighbours alongside: edges come (back) in. Otherwise they slide away.
    if (FOCUS_SPACING !== 'offscreen') return [lerp(l, 0, pv), lerp(r, 0, pv)];
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
  // The loop sleeps once everything has settled (so an idle page costs
  // nothing), and any input wakes it.
  let running = false, calm = 0;
  function wake() {
    calm = 0;
    if (running) return;
    running = true; last = performance.now();
    requestAnimationFrame(tick);
  }
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerout', 'wheel', 'keydown', 'click', 'focusin', 'focusout', 'resize'])
    window.addEventListener(type, wake, { capture: true, passive: true });
  const still = (sp: Spring, e: number) => sp.near(e);
  function atRest(now: number) {
    if (ptr) return false;
    for (const s of [S.row, S.big, S.grid]) if (s.wheel || s.to != null || s.vel || s.pos < s.min || s.pos > s.max) return false;
    if (!still(p, 1e-4) || !still(gp, 1e-4)) return false;   // these scale whole covers
    for (const c of cards) {
      if (now < c.delay || !c.follow && !c.held) return false;
      if (!still(c.hv, 1e-3) || !still(c.lb, 1e-3) || !still(c.sq, 1e-3) || !still(c.ovR, 1e-3) || !still(c.ovB, 1e-3)) return false;
      if (!still(c.ox, 0.05) || !still(c.oy, 0.05) || !still(c.os, 1e-3)) return false;
    }
    return true;
  }
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
      const pointed = c.i === hovered || c.i === keyFocused;
      c.hv.t = c.lb.t = pointed && resting ? 1 : 0;
      const hs = 1 + (HOVER_SCALE - 1) * (reduce ? 0 : c.hv.v);
      const tw = w2 * hs;
      st.transform = `translate3d(${x - (tw - w2) / 2}px, ${y - (h2 * hs - h2) / 2}px, 0) scale(${tw / c.W})`;
      // The shadow deepens and softens with the lift.
      const sh = Math.round(clamp(c.hv.v, 0, 1) * 100) / 100;
      if (sh !== c.shLast) { c.shLast = sh; c.liftShadow.style.opacity = sh > 0 ? String(sh) : ''; }
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
        if (FOCUS_SPACING !== 'offscreen') {
          // 0 centred, 0.5 at a neighbour's spot, 1 one cover further out.
          const slot = FOCUS_SPACING === 'row' ? w2 + focusGap : vw / 2 - FOCUS_PEEK + w2 / 2;
          dim = pv * clamp(Math.abs(x + w2 / 2 - vw / 2) / slot, 0, 2) / 2;
        } else {
          const t = clamp((Math.abs(x + w2 / 2 - vw / 2) - w2 * 0.08) / (vw / 2 + w2 * 0.42), 0, 1);
          dim = pv * t;
        }
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
      // Quantised so a slow scroll doesn't restyle (and re-blur) every cover every frame.
      const dk = Math.round(dim * 120) / 120, ek = Math.round(edge * 120) / 120;
      if (L.dim !== dk || L.edge !== ek) {
        L.dim = dk; L.edge = ek;
        // Row blur is in on-screen px; the card is scaled by kRow in the row.
        const rowBlur = (P.rowBlur / c.kRow) * Math.pow(ek, 1.6);
        let focusBlur: number, focusFade: number;
        if (FOCUS_SPACING !== 'offscreen') {
          // Up to a neighbour: a light dim and blur. Beyond: fade away.
          const a = clamp(dk / 0.5, 0, 1), b = clamp((dk - 0.5) / 0.5, 0, 1);
          focusFade = PEEK_DIM * a + (1 - PEEK_DIM) * b * b * (3 - 2 * b);
          focusBlur = PEEK_BLUR * a + (P.focusBlur - PEEK_BLUR) * Math.pow(b, 1.5);
        } else {
          // Everything but the open cover fades out FOCUS_FADE times faster than
          // it blurs, so the background clears quickly as a cover opens.
          const df = clamp(dk * FOCUS_FADE, 0, 1);
          focusFade = df * df * (3 - 2 * df);
          focusBlur = P.focusBlur * Math.pow(dk, 1.5);
        }
        const blur = Math.max(focusBlur, rowBlur);
        const fade = Math.max(focusFade, P.rowFade * ek * ek * (3 - 2 * ek));  // smoothstep
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
        // The grain layer takes the cover's shape: its smoothed clip while the
        // cover is sharp, and a round shape reaching past it by the blur once
        // blurred (two different curves at the corners read as jank).
        c.veil.style.setProperty('--f', `${c.blurred ? blur.toFixed(1) : 0}px`);
        c.veil.style.clipPath = c.blurred ? '' : c.clip;
        c.veil.style.borderRadius = c.blurred ? `${(c.rBlur + blur).toFixed(1)}px` : '';
        // A live backdrop shader pauses while its cover is blurred or dimmed
        // (see syncVideos): redrawing it forces the blur to be recomputed.
        c.dimmed = blur > 1 || fade > 0.05;
        // Grain only in focus, arriving with the blur so sharp covers stay clean.
        c.veil.style.opacity = Math.min(1, Math.pow(dk, 1.4) * 1.5).toFixed(3);
        st.opacity = fade > 0.002 ? (1 - fade).toFixed(3) : '';
        // Fully faded covers aren't drawn at all (they'd still be blurred and
        // composited every frame otherwise).
        st.visibility = fade > 0.995 ? 'hidden' : '';
      }
      const z = mode === 'grid' ? (c.i === gridActive ? 20 : 1) : c.i === anchor ? 3 : 1;
      if (L.z !== z) { L.z = z; st.zIndex = String(z); }
      const ti = mode === 'grid' && gridOpen >= 0 && c.i !== gridOpen ? -1 : 0;
      if (L.ti !== ti) { L.ti = ti; c.el.tabIndex = ti; }
    }
    const bo = Math.round((mode === 'grid' && gridActive >= 0 ? gpv : 0) * 1000) / 1000;
    if (bo !== backdropLast) {
      backdropLast = bo;
      backdrop.style.opacity = String(bo);
      // Its grain fades with it, up to the theme's grain strength.
      if (backdropGrain) backdropGrain.style.opacity = (bo * (parseFloat(getComputedStyle(backdropGrain).getPropertyValue('--scrim-grain')) || 0)).toFixed(3);
    }
    // The focus view is near full screen, so the name steps aside for it.
    // Focus mode (focus strip or grid lightbox): the name and the view controls
    // step aside, and a close button takes the name's place.
    const focusAmt = mode === 'row' ? pv : gridActive >= 0 ? gpv : 0;
    const wo = Math.round((1 - clamp(focusAmt * FOCUS_FADE, 0, 1)) * 100) / 100;
    if (wo !== whoOpacity) { whoOpacity = wo; who.style.opacity = wo < 1 ? String(wo) : ''; who.style.visibility = wo < 0.01 ? 'hidden' : ''; }
    if (wo !== chromeLast) {
      chromeLast = wo;
      // Focus mode on the page root (the custom cursor drops its halos in it).
      document.documentElement.toggleAttribute('data-focus', wo < 0.99);
      if (viewTools) {
        viewTools.style.opacity = wo < 1 ? String(wo) : '';
        viewTools.style.visibility = wo < 0.01 ? 'hidden' : '';
      }
      if (closeGroup) {
        closeGroup.hidden = wo > 0.99;
        closeGroup.style.opacity = String(1 - wo);
      }
    }
    // The close button's title names the cover in view: the one nearest the
    // centre of the focus strip, or the one open in the grid.
    if (focusTitle && focusAmt > 0) {
      const i = mode === 'row' ? nearest(centerBig, S.big.pos) : gridActive;
      if (i >= 0 && i !== focusTitleIdx) { focusTitleIdx = i; focusTitle.textContent = cards[i].label?.textContent ?? ''; }
    }
    if (FOCUS_SPACING !== 'offscreen') {
      // Only while a cover sits at the centre: mid-swipe the bands ease back to
      // the row's light edge, so the cover coming in isn't blurred on its way.
      let settled = 1;
      if (mode === 'row' && pv > 0) {
        const i = nearest(centerBig, S.big.pos);
        const half = Math.max(1, Math.abs(centerBig(Math.min(i + 1, N - 1)) - centerBig(Math.max(i - 1, 0))) / 4);
        const off = clamp(Math.abs(S.big.pos - centerBig(i)) / half, 0, 1);
        settled = 1 - off * off * (3 - 2 * off);
      }
      applyEdges(mode === 'row' ? Math.round(pv * settled * 50) / 50 : 0);
    }
    slideEdges(eL, eR);
    syncVideos();
    // A few calm frames in a row, and it sleeps until the next input.
    calm = atRest(now) ? calm + 1 : 0;
    if (calm > 30) { running = false; return; }
    requestAnimationFrame(tick);
  }

  layout();
  applyEdges();
  mountCameras(stage);
  for (const c of cards) {
    const cv = c.el.querySelector<HTMLCanvasElement>('canvas[data-shader="backdrop"]');
    if (!cv) continue;
    try { c.shader = mountBackdrop(cv); } catch (err) { console.warn('Backdrop shader failed', err); }
  }
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
  wake();
}
