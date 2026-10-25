// Camera for a glass device frame (GlassFrame.astro): while its video plays,
// the frame pans and zooms through keyframes so the shot follows the
// interaction, then settles back to the full view when it stops. Keyframes
// that start and end on the full view make the loop seamless.
//
// Keyframes come from the cover's content (cover.video.camera) as
// [seconds, x, y, zoom]: x/y is the point on the device (0..1 across its width
// and height) brought to the middle of the cover. An optional rest framing
// (cover.video.rest, [x, y, zoom]) holds the cover zoomed in while it isn't
// playing, its thumbnail; without one it rests on the full view.

type Key = [number, number, number, number];

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function sample(keys: Key[], t: number): [number, number, number] {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2], keys[0][3]];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b[0]) {
      // Eased, so each move between held shots starts and lands softly.
      const l = clamp01((t - a[0]) / Math.max(1e-3, b[0] - a[0]));
      const k = l * l * (3 - 2 * l);
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
    }
  }
  const z = keys[keys.length - 1];
  return [z[1], z[2], z[3]];
}

export function mountCameras(root: ParentNode = document) {
  if (reduce) return;
  for (const frame of root.querySelectorAll<HTMLElement>('.glass-frame[data-camera], .glass-frame[data-rest]')) {
    const video = frame.querySelector('video');
    let keys: Key[], rest: [number, number, number] | null;
    try {
      keys = frame.dataset.camera ? JSON.parse(frame.dataset.camera) : [];
      rest = frame.dataset.rest ? JSON.parse(frame.dataset.rest) : null;
    } catch { continue; }
    if (!video || (!keys.length && !rest)) continue;

    // The shot eases in when the video starts and back out when it stops.
    let on = 0, raf = 0, last = 0;
    const cur = { x: 0.5, y: 0.5, s: 1 };
    const step = (now: number) => {
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      const playing = !video.paused && !video.ended;
      const framed = playing || !!rest;   // a rest framing keeps the camera on while idle
      on += ((framed ? 1 : 0) - on) * (1 - Math.exp(-dt * 3));

      const [kx, ky, ks] = playing && keys.length ? sample(keys, video.currentTime) : rest ?? [0.5, 0.5, 1];
      // A light follow, so a jump (the loop, a seek) never snaps.
      const f = 1 - Math.exp(-dt * 5);   // smooths the moves without arriving late
      cur.x += (kx - cur.x) * f; cur.y += (ky - cur.y) * f; cur.s += (ks - cur.s) * f;

      const s = 1 + (cur.s - 1) * on;
      // The frame is centred by its own transform (translate -50%), which
      // the scale applies after; (s - 1) / 2 of its size undoes that drift.
      // In shares of the frame's own size, so the framing holds while the
      // cover resizes (switching views) without waiting a frame to catch up.
      const tx = ((0.5 - cur.x) * s * on + (s - 1) / 2) * 100;
      const ty = ((0.5 - cur.y) * s * on + (s - 1) / 2) * 100;
      frame.style.scale = s.toFixed(4);
      frame.style.setProperty('--cam-s', s.toFixed(4));   // keeps the window's hairline edge a hairline
      frame.style.translate = `${tx.toFixed(3)}% ${ty.toFixed(3)}%`;

      const settled = Math.abs(kx - cur.x) < 1e-4 && Math.abs(ky - cur.y) < 1e-4 && Math.abs(ks - cur.s) < 1e-4 && Math.abs(on - 1) < 1e-3;
      if (playing || (rest ? !settled : on > 0.002)) raf = requestAnimationFrame(step);
      else { raf = 0; if (!rest) { frame.style.scale = ''; frame.style.translate = ''; frame.style.removeProperty('--cam-s'); } }
    };
    const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(step); } };
    video.addEventListener('playing', start);
    video.addEventListener('pause', start);   // ease back out (or to the rest framing)
    if (rest) {   // start on the rest framing, without easing in on load
      on = 1; cur.x = rest[0]; cur.y = rest[1]; cur.s = rest[2];
      start();   // apply it now; it's in shares of the frame, so it holds at any size
    }
  }
}
