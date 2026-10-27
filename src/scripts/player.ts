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
      // Over the bottom of the cover, centred, never wider than it allows.
      const r = cover.getBoundingClientRect();
      const gap = px('--player-gap'), h = px('--player-height');
      const w = Math.min(px('--player-width'), r.width - 2 * gap);
      player!.style.width = `${w}px`;
      player!.style.transform = `translate(${(r.left + (r.width - w) / 2).toFixed(1)}px, ${(r.bottom - gap - h).toFixed(1)}px)`;
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
    v.dataset.held = ''; v.pause();
    track.setPointerCapture(e.pointerId);
    seekTo(e.clientX);
  });
  track.addEventListener('pointermove', (e) => { if (scrub && e.pointerId === scrub.id) seekTo(e.clientX); });
  const endScrub = (e: PointerEvent) => {
    if (!scrub || e.pointerId !== scrub.id) return;
    const v = video;
    if (v && scrub.wasPlaying) { delete v.dataset.held; v.play().catch(() => {}); }
    scrub = null;
  };
  track.addEventListener('pointerup', endScrub);
  track.addEventListener('pointercancel', endScrub);
  // Keyboard on the scrubber: arrows step 5%.
  track.addEventListener('keydown', (e) => {
    const v = video;
    if (!v || !v.duration || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault(); e.stopPropagation();
    v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + (e.key === 'ArrowRight' ? 0.05 : -0.05) * v.duration));
  });
}
