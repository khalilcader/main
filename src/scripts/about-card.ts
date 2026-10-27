// The About card (AboutCard.astro). Clicking the avatar grows the card out of
// it: it moves and scales from the avatar to the centre of the screen while
// turning 180° in 3D, so the photo side turns away and the card's front comes
// round. The perspective is centred on the card itself (it comes after the
// translate), so the turn doesn't shear as it travels. Closing runs the same path back with the same
// ease-out (not a reversed playback, which would turn it into an ease-in), and
// either can be interrupted mid-way, turning around from where it is.

import { squirclePath } from './squircle';

const DURATION = 700;                                // ms
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';       // quick start, long soft landing
// Closing from fully open is slower and gentler: the card shrinks and travels
// toward the avatar on one smooth curve, and only starts turning over once it
// is CLOSE_TURN_START of the way through, so it doesn't flip the moment you
// close it. Sampled into keyframes, since one transform carries both.
const CLOSE_DURATION = 900;                          // ms
const CLOSE_TURN_START = 0.15;
const CLOSE_STEPS = 16;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const PERSPECTIVE = 1600;                            // px

const dialog = document.getElementById('about');
const card = document.getElementById('about-card');
const scrim = document.getElementById('about-scrim');
const grain = document.getElementById('about-grain');
const closeBtn = document.getElementById('about-close');
const who = document.querySelector<HTMLAnchorElement>('.site-header .who');
const avatar = who?.querySelector<HTMLElement>('.photo');

if (dialog && card && scrim && grain && closeBtn && who && avatar) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Phones: a bottom sheet instead, sliding up from the bottom edge and
  // dragged down to dismiss (the card's styles change with it, AboutCard.astro).
  const sheet = document.documentElement.classList.contains('mobile');
  let state: 'closed' | 'opening' | 'open' | 'closing' = 'closed';
  let anims: Animation[] = [];

  const faces = [...card.querySelectorAll<HTMLElement>('.about-surface')];

  // The two end states. Small: on the avatar, photo side up. Big: the open card.
  // Each is a set of styles per element; the faces' smoothed-corner clips are
  // animated too, so the corners stay in proportion as the card scales.
  type State = { card: Keyframe; faces: Keyframe; scrim: Keyframe; grain: Keyframe };
  type Geo = { dx: number; dy: number; sx: number; sy: number };
  let geo: Geo = { dx: 0, dy: 0, sx: 1, sy: 1 };
  function ends(): { small: State; big: State } {
    if (sheet) {
      const g = String(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scrim-grain')) || 0);
      const off = card!.offsetHeight + 40;
      return {
        small: { card: { transform: `translateY(${off}px)` }, faces: {}, scrim: { opacity: 0 }, grain: { opacity: 0 } },
        big: { card: { transform: 'translateY(0px)' }, faces: {}, scrim: { opacity: 1 }, grain: { opacity: g } },
      };
    }
    const a = avatar!.getBoundingClientRect();
    card!.style.transform = 'none';
    const c = card!.getBoundingClientRect();
    card!.style.transform = '';
    const sx = a.width / c.width, sy = a.height / c.height;
    card!.style.setProperty('--about-back-icon', `${(24 / sx).toFixed(1)}px`);
    const dx = a.left + a.width / 2 - (c.left + c.width / 2);
    const dy = a.top + a.height / 2 - (c.top + c.height / 2);
    geo = { dx, dy, sx, sy };
    const root = getComputedStyle(document.documentElement);
    const rSmall = parseFloat(root.getPropertyValue('--photo-radius')) || 14;
    const rBig = parseFloat(root.getPropertyValue('--cover-radius')) || 48;
    const sm = parseFloat(root.getPropertyValue('--corner-smoothing')) || 0.6;
    const g = String(parseFloat(root.getPropertyValue('--scrim-grain')) || 0);   // the grain's full opacity
    const W = faces[0].offsetWidth, H = faces[0].offsetHeight;
    const clip = (r: number) => `path("${squirclePath(W, H, Math.min(r, Math.min(W, H) / 2), sm)}")`;
    if (reduce) {
      return {
        small: { card: { opacity: 0 }, faces: { clipPath: clip(rBig) }, scrim: { opacity: 0 }, grain: { opacity: 0 } },
        big: { card: { opacity: 1 }, faces: { clipPath: clip(rBig) }, scrim: { opacity: 1 }, grain: { opacity: g } },
      };
    }
    return {
      small: {
        card: { transform: `translate(${dx}px, ${dy}px) perspective(${PERSPECTIVE}px) rotateY(-180deg) scale(${sx}, ${sy})`, borderRadius: `${rSmall / sx}px / ${rSmall / sy}px` },
        faces: { clipPath: clip(rSmall / sx) },
        scrim: { opacity: 0 }, grain: { opacity: 0 },
      },
      big: {
        card: { transform: `translate(0px, 0px) perspective(${PERSPECTIVE}px) rotateY(0deg) scale(1, 1)`, borderRadius: `${rBig}px / ${rBig}px` },
        faces: { clipPath: clip(rBig) },
        scrim: { opacity: 1 }, grain: { opacity: g },
      },
    };
  }

  // Animate to one end with the same ease-out either way, starting from wherever
  // the card is now (so an interrupted open or close turns around smoothly).
  function animateTo(to: 'small' | 'big', fromNow = false) {
    const e = ends();
    let from = to === 'big' ? e.small : e.big;
    if (anims.length || fromNow) {
      const cc = getComputedStyle(card!), fc = getComputedStyle(faces[0]);
      from = {
        card: reduce ? { opacity: cc.opacity } : { transform: cc.transform, borderRadius: cc.borderRadius },
        faces: { clipPath: fc.clipPath },
        scrim: { opacity: getComputedStyle(scrim!).opacity },
        grain: { opacity: getComputedStyle(grain!).opacity },
      };
      anims.forEach((an) => an.cancel());
    }
    if (sheet) from = { ...from, faces: {} };   // the sheet's faces don't change shape
    const target = e[to];
    // A close from fully open gets its own, slower shape (see CLOSE_*).
    const shaped = to === 'small' && !anims.length && !reduce && !sheet && !fromNow;
    const opts: KeyframeAnimationOptions = shaped
      ? { duration: CLOSE_DURATION, easing: 'linear', fill: 'both' }
      : { duration: reduce ? 200 : DURATION, easing: reduce ? 'ease-out' : EASE, fill: 'both' };
    const { dx, dy, sx, sy } = geo;
    const closeFrames = (): Keyframe[] => Array.from({ length: CLOSE_STEPS + 1 }, (_, i) => {
      const t = i / CLOSE_STEPS;
      const m = easeInOut(t);                                                  // travel and size
      const turn = easeInOut(Math.max(0, (t - CLOSE_TURN_START) / (1 - CLOSE_TURN_START)));
      return {
        offset: t,
        transform: `translate(${dx * m}px, ${dy * m}px) perspective(${PERSPECTIVE}px) rotateY(${-180 * turn}deg) scale(${1 + (sx - 1) * m}, ${1 + (sy - 1) * m})`,
        borderRadius: i === CLOSE_STEPS ? target.card.borderRadius : i === 0 ? from.card.borderRadius : undefined,
      };
    }).map((f) => { if (f.borderRadius === undefined) delete f.borderRadius; return f; });
    const cardFrames: Keyframe[] = shaped ? closeFrames() : [from.card, target.card];
    // Everything else on the close follows the travel's curve.
    const otherOpts: KeyframeAnimationOptions = shaped ? { ...opts, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' } : opts;
    anims = [
      card!.animate(cardFrames, opts),
      scrim!.animate([from.scrim, target.scrim], otherOpts),
      grain!.animate([from.grain, target.grain], otherOpts),
      ...(sheet ? [] : faces.map((f) => f.animate([from.faces, target.faces], otherOpts))),
    ];
    state = to === 'big' ? 'opening' : 'closing';
    const mine = anims;
    Promise.all(mine.map((an) => an.finished)).then(() => { if (anims === mine) settle(); }, () => {});
  }

  function settle() {
    anims.forEach((an) => an.cancel());
    anims = [];
    if (state === 'opening') {
      state = 'open';
      scrim!.style.opacity = '1';
      grain!.style.opacity = getComputedStyle(document.documentElement).getPropertyValue('--scrim-grain');
    } else if (state === 'closing') {
      state = 'closed';
      dialog!.hidden = true; scrim!.hidden = true; grain!.hidden = true;
      scrim!.style.opacity = ''; grain!.style.opacity = '';
      avatar!.style.opacity = '';
      // Focus goes back to the avatar, but it shouldn't flip to its book side
      // for that (after Esc it would count as keyboard focus and stay flipped).
      who!.dataset.noflip = '';
      who!.addEventListener('blur', () => delete who!.dataset.noflip, { once: true });
      who!.focus({ preventScroll: true });
    }
  }

  function open() {
    if (state === 'open' || state === 'opening') return;
    // Start from the side the avatar is showing (the book, if it has flipped on
    // hover or focus), so the card turns once rather than flipping back first.
    const flipped = avatar!.matches(':hover') || who!.matches(':focus-visible') || avatar!.classList.contains('peek');
    card!.dataset.small = flipped ? 'book' : 'photo';
    if (state === 'closed') {
      dialog!.hidden = false; scrim!.hidden = false; grain!.hidden = false;
      // The card takes its place. Hidden by opacity, not visibility: its faces
      // swap visibility on a delay (the flip, SiteHeader.astro), so shown again
      // they stayed hidden a few frames and the empty tile flashed.
      if (!sheet) avatar!.style.opacity = '0';
    }
    scrim!.style.opacity = ''; grain!.style.opacity = '';
    animateTo('big');
    // Not on phones: there it lit the X as if hovered (iOS treats it as keyboard focus).
    if (!sheet) closeBtn!.focus({ preventScroll: true });
  }
  function close() {
    if (state === 'closed' || state === 'closing') return;
    card!.dataset.small = 'photo';   // lands back on the avatar's photo side
    scrim!.style.opacity = ''; grain!.style.opacity = '';
    animateTo('small');
  }

  // The sheet follows a finger dragging it down, and goes when let go far or
  // fast enough; otherwise it springs back up. Dragging up resists.
  if (sheet) {
    let y0 = 0, dy = 0, t0 = 0, dragging = false;
    const scrimFull = () => 1;
    card.addEventListener('pointerdown', (e) => {
      if ((state !== 'open' && state !== 'opening') || (e.target as Element).closest('button')) return;
      // Caught while still sliding up: hold it where it is.
      let base = 0;
      if (state === 'opening') {
        base = new DOMMatrix(getComputedStyle(card).transform).m42;
        anims.forEach((an) => an.cancel()); anims = []; state = 'open';
        scrim.style.opacity = '1';
        card.style.transform = `translateY(${base}px)`;
      }
      dragging = true; y0 = e.clientY - base; dy = base; t0 = performance.now();
      card.setPointerCapture(e.pointerId);
    });
    card.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const raw = e.clientY - y0;
      dy = raw > 0 ? raw : -Math.sqrt(-raw) * 2;
      card.style.transform = `translateY(${dy}px)`;
      scrim.style.opacity = String(scrimFull() * Math.max(0, 1 - Math.max(0, dy) / card.offsetHeight));
    });
    const release = () => {
      if (!dragging) return;
      dragging = false;
      const v = dy / Math.max(1, performance.now() - t0);   // px per ms, overall
      const go = dy > card.offsetHeight * 0.25 || (dy > 24 && v > 0.5);
      animateTo(go ? 'small' : 'big', true);
      card.style.transform = '';
      if (!go) state = 'opening';
    };
    card.addEventListener('pointerup', release);
    card.addEventListener('pointercancel', release);
  }

  // Focused by a click or tap, it isn't keyboard focus, but a key pressed
  // afterwards (G for the grid) made it count as one and flipped the avatar.
  who.addEventListener('pointerdown', () => {
    who.dataset.noflip = '';
    who.addEventListener('blur', () => delete who.dataset.noflip, { once: true });
  });
  // The avatar opens About; the name goes back to the start of the work
  // (work-strip.ts listens for work:home).
  who.addEventListener('click', (e) => {
    e.preventDefault();
    if ((e.target as Element).closest('.name')) { window.dispatchEvent(new Event('work:home')); return; }
    open();
  });
  closeBtn.addEventListener('click', close);
  scrim.addEventListener('click', close);
  // While open, the card owns the keyboard: Esc closes, Tab stays inside, and
  // the strip's shortcuts (arrows, G, T, Esc) don't fire underneath.
  window.addEventListener('keydown', (e) => {
    if (state === 'closed') return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); closeBtn!.focus(); }
    e.stopImmediatePropagation();
  }, { capture: true });
}
