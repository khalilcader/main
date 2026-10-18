// Cinematic camera for a glass device frame (GlassFrame.astro): while its
// video plays, the frame pans and zooms between keyframes so the shot follows
// the interaction, then settles back to the full view when it stops. Around
// the loop point the device drops out of the frame and rises back in, so the
// jump back to the start happens off-screen.
//
// Keyframes come from the cover's content (cover.video.camera) as
// [seconds, x, y, zoom]: x/y is the point on the device (0..1 across its width
// and height) brought to the middle of the cover.

type Key = [number, number, number, number];

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EXIT = 0.8;   // s: the drop out before the loop, and the rise back in after

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function sample(keys: Key[], t: number): [number, number, number] {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2], keys[0][3]];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b[0]) {
      const k = ease((t - a[0]) / Math.max(1e-3, b[0] - a[0]));
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
    }
  }
  const z = keys[keys.length - 1];
  return [z[1], z[2], z[3]];
}

export function mountCameras(root: ParentNode = document) {
  if (reduce) return;
  for (const frame of root.querySelectorAll<HTMLElement>('.glass-frame[data-camera]')) {
    const video = frame.querySelector('video');
    const cover = frame.closest<HTMLElement>('.cover');
    let keys: Key[];
    try { keys = JSON.parse(frame.dataset.camera!); } catch { continue; }
    if (!video || !cover || !keys.length) continue;

    // The shot eases in when the video starts and back out when it stops.
    let on = 0, raf = 0, last = 0;
    const cur = { x: 0.5, y: 0.5, s: 1, drop: 0 };
    const step = (now: number) => {
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      const playing = !video.paused && !video.ended;
      on += ((playing ? 1 : 0) - on) * (1 - Math.exp(-dt * 3));

      const t = video.currentTime, D = video.duration || 0;
      const [kx, ky, ks] = sample(keys, t);
      // Drop out over the last EXIT seconds, rise back in over the first.
      let drop = 0;
      if (D && playing) drop = t > D - EXIT ? ease(clamp01((t - (D - EXIT)) / EXIT)) : t < EXIT ? 1 - ease(clamp01(t / EXIT)) : 0;
      // A light follow, so a jump (the loop, a seek) never snaps.
      const f = 1 - Math.exp(-dt * 3);   // slow, so moves drift rather than dart
      cur.x += (kx - cur.x) * f; cur.y += (ky - cur.y) * f; cur.s += (ks - cur.s) * f;
      cur.drop = drop;   // already eased, and has to land exactly at the loop

      const w = frame.offsetWidth, h = frame.offsetHeight;
      const s = 1 + (cur.s - 1) * on;
      // The frame is centred by its own transform (translate -50%), which
      // the scale applies after; (s - 1) / 2 of its size undoes that drift.
      const tx = (0.5 - cur.x) * w * s * on + (s - 1) * w / 2;
      const ty = (0.5 - cur.y) * h * s * on + (s - 1) * h / 2 + cur.drop * (cover.offsetHeight + h * s) / 2 * 1.05;
      frame.style.scale = s.toFixed(4);
      frame.style.translate = `${tx.toFixed(2)}px ${ty.toFixed(2)}px`;

      if (playing || on > 0.002) raf = requestAnimationFrame(step);
      else { raf = 0; frame.style.scale = ''; frame.style.translate = ''; }
    };
    const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(step); } };
    video.addEventListener('playing', start);
    video.addEventListener('pause', start);   // ease back out
  }
}
