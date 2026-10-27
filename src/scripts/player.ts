// Video controls for the focused cover (WorkStrip.astro): play/pause and a
// scrubber, floating over the bottom of the cover that's open, in the focus
// strip or the grid lightbox (desktop) or the full-screen viewer (phones).
//
// Shows when a cover opens, and while the pointer moves; hides 2s after the
// last movement while the video plays. Stays while paused, while the pointer
// is on it and while scrubbing. On phones a tap brings it back.
//
// Paused by hand, a video is marked data-held, so the camera (camera.ts)
// holds its shot instead of easing back to the thumbnail; the work strip
// clears it when the cover closes.

const player = document.getElementById('player');
const toggle = player?.querySelector<HTMLButtonElement>('.player-toggle');
const track = player?.querySelector<HTMLElement>('.player-track');
const fill = player?.querySelector<HTMLElement>('.player-fill');

if (player && toggle && track && fill) {
  const HIDE_AFTER = 2000;   // ms of stillness while playing
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const px = (name: string) => parseFloat(css.getPropertyValue(name)) || 0;

  let video: HTMLVideoElement | null = null;
  let lastMove = 0, show = 0, raf = 0, last = 0;
  let over = false, scrub: { id: number; wasPlaying: boolean } | null = null;

  // The open cover: on phones the one in the viewer; on desktop the one the
  // work strip marks open (the focus strip's centre, or the grid lightbox).
  function openCover(): HTMLElement | null {
    if (root.hasAttribute('data-viewing')) return document.querySelector<HTMLElement>('.cover.viewing');
    if (!root.hasAttribute('data-focus')) return null;
    return document.querySelector<HTMLElement>('.stage .card[data-open] .cover');
  }

  // The cover's corner radius on screen: on phones a share of its width; on
  // desktop the work strip's radius for it (--shadow-r, in the card's own
  // pixels), scaled to how big it's drawn.
  function cornerOf(cover: HTMLElement, r: DOMRect) {
    if (root.classList.contains('mobile')) return px('--cover-radius-share') * r.width;
    const own = parseFloat(cover.closest<HTMLElement>('.card')?.style.getPropertyValue('--shadow-r') || '') || 0;
    return own * (r.width / (cover.offsetWidth || r.width));
  }

  // Paused by hand, not just stopped: a cover that's still loading counts as
  // playing (its icon stays Pause, and the bar still hides).
  const held = (v: HTMLVideoElement) => v.dataset.held !== undefined;

  function step(now: number) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    const cover = openCover();
    const v = cover?.querySelector('video') ?? null;
    if (v !== video) { video = v; lastMove = now; }   // a new cover: show it
    const want = !!(v && (held(v) || over || scrub || now - lastMove < HIDE_AFTER));
    show += ((want ? 1 : 0) - show) * (1 - Math.exp(-dt * 14));
    if (Math.abs(show - (want ? 1 : 0)) < 0.01) show = want ? 1 : 0;

    if (cover && v) {
      // Over the bottom of the cover, edge to edge, the same gap all round:
      // its round ends concentric with the cover's corners (the corner's
      // radius less its own), never under --player-gap.
      const r = cover.getBoundingClientRect();
      const h = px('--player-height');
      const gap = Math.max(px('--player-gap'), cornerOf(cover, r) - h / 2);
      const w = r.width - 2 * gap;
      player!.style.width = `${w}px`;
      player!.style.transform = `translate(${(r.left + gap).toFixed(1)}px, ${(r.bottom - gap - h).toFixed(1)}px)`;
      const d = v.duration;
      const t = d ? v.currentTime / d : 0;
      fill!.style.setProperty('--p', t.toFixed(4));
      track!.setAttribute('aria-valuenow', String(Math.round(t * 100)));
      const paused = held(v);
      if (player!.classList.contains('paused') !== paused) {
        player!.classList.toggle('paused', paused);
        toggle!.setAttribute('aria-label', paused ? 'Play' : 'Pause');
      }
    }
    player!.hidden = show === 0;
    player!.style.setProperty('--show', show.toFixed(3));
    player!.style.pointerEvents = show > 0.5 ? '' : 'none';

    if (cover || show > 0) raf = requestAnimationFrame(step);
    else { raf = 0; video = null; }
  }
  const wake = () => { if (!raf) { last = 0; raf = requestAnimationFrame(step); } };
  new MutationObserver(wake).observe(root, { attributes: true, attributeFilter: ['data-focus', 'data-viewing'] });
  wake();

  // Movement (or a tap, on phones) shows it again.
  for (const type of ['pointermove', 'pointerdown', 'wheel', 'keydown'] as const)
    addEventListener(type, () => { lastMove = performance.now(); wake(); }, { passive: true });

  player.addEventListener('pointerenter', () => { over = true; });
  player.addEventListener('pointerleave', () => { over = false; });
  // Its own: presses here never reach the strip, the viewer or the page.
  for (const type of ['pointerdown', 'click', 'touchstart'] as const)
    player.addEventListener(type, (e) => e.stopPropagation());

  toggle.addEventListener('click', () => {
    const v = video;
    if (!v) return;
    if (held(v)) { delete v.dataset.held; v.play().catch(() => {}); }
    else { v.dataset.held = ''; v.pause(); }
  });

  // Scrubbing: pressed and dragged along the pill, the video follows the
  // pointer (paused meanwhile, and playing on after if it was).
  const seekTo = (x: number) => {
    const v = video;
    if (!v || !v.duration) return;
    const r = track.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (x - r.left) / r.width));
    v.currentTime = t * v.duration;
    fill.style.setProperty('--p', t.toFixed(4));
  };
  track.addEventListener('pointerdown', (e) => {
    const v = video;
    if (!v || e.button !== 0) return;
    scrub = { id: e.pointerId, wasPlaying: !held(v) };
    track.classList.add('scrubbing');
    v.dataset.held = ''; v.pause();
    track.setPointerCapture(e.pointerId);
    seekTo(e.clientX);
  });
  // Only while pressed: a mouse moving with no button held ends it (the
  // release was missed), so hovering never seeks.
  track.addEventListener('pointermove', (e) => {
    if (!scrub || e.pointerId !== scrub.id) return;
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) { endScrub(e); return; }
    seekTo(e.clientX);
  });
  function endScrub(e: PointerEvent) {
    if (!scrub || e.pointerId !== scrub.id) return;
    const v = video;
    if (v && scrub.wasPlaying) { delete v.dataset.held; v.play().catch(() => {}); }
    scrub = null;
    track!.classList.remove('scrubbing');
    if (track!.hasPointerCapture(e.pointerId)) track!.releasePointerCapture(e.pointerId);
  }
  track.addEventListener('pointerup', endScrub);
  track.addEventListener('pointercancel', endScrub);
  track.addEventListener('lostpointercapture', endScrub);
  // Keyboard on the scrubber: arrows step 5%.
  track.addEventListener('keydown', (e) => {
    const v = video;
    if (!v || !v.duration || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault(); e.stopPropagation();
    v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + (e.key === 'ArrowRight' ? 0.05 : -0.05) * v.duration));
  });
}
