# Handoff: work strip prototype → real site

Read this first in a new session. It captures what was decided while
prototyping, so nothing depends on the old conversation.

- Live prototype: https://claude.ai/artifact/NrCGux2sfTtw7BuAW7gU1R (private)
- Source of truth: `prototype/index.html` (single file, no build step) and
  `prototype/media/`
- Design: Figma "khalilcader.com" — layout frame `53:253`, glass frame `43:66`
  (file key `7OtNMCIuwtZKJUGiLk28aT`)
- Hosting plan: Vercel, domain khalilcader.com (DNS at GoDaddy; replace the
  current forwarding with Vercel's records)

## Interaction model (keep all of this)

- **Row (default view):** bottom-aligned covers, drag / wheel / trackpad
  scroll. Momentum with exponential decay + constant brake. Overscroll is a
  rubber band against a fixed distance; covers near the stretched end trail
  so gaps stretch, then relax (critically damped, never overlap).
- **Pull down on a cover:** squish (scale toward ~0.56 at 432px) with a
  chain reaction: each neighbor replays the grabbed cover's squish ~30ms
  later per step, ~0.86 falloff; gaps stay constant (row re-flows around the
  grabbed cover). Returns with no bounce.
- **Pull up / tap:** scrubs the whole row into the **focus strip** (large
  covers, neighbors just off screen). Commit at 90px or 0.10 px/ms.
- **Focus strip:** horizontal swipe pages one cover per flick (or past
  ~18% of the screen). Vertical drag picks up the cover; drag in any
  direction, commit at 230px or 0.10 px/ms outward, flies home with its
  release velocity.
- **Grid (G):** packed columns; tap opens a lightbox; others fade to the page
  background with blur + grain.
- Drags lock to the direction they start in; stuck drags end on missed
  release (no buttons, lost capture, blur). Keyboard: arrows, Tab,
  Enter/Space, Esc, G, T.

## Visual model

- Covers render once at their largest size and only move/scale with
  transforms (no per-frame layout).
- Corners: Figma corner smoothing via a clip-path (figma-squircle math),
  radius 24px at row size, 80% smoothing. While blurred, a round radius at
  1.2× stands in so corners never sharpen.
- Focus: covers blur (ease-in, up to 56px) and fade to 0% (smoothstep) from
  screen center to fully off screen. Grain ramps in with the blur.
- Row edges: each cover blurs (up to 28px) and fades (35%) as it moves into
  the edge zone, only on a side where the row continues. Plus an 8-layer
  progressive backdrop blur at the edges (banded masks, eased strengths) with
  a smootherstep fade to the page. Edges slide (never fade) away in focus.
- Do NOT put a blend-mode grain layer inside or over the edge container:
  inside it isolates the backdrop blur; over it, overlay blend brightened
  mid-tones into a light streak.
- Themes: Auto / Light / Dark. Light bg #FAFAFA. The page's own toggle uses
  `data-scheme` so the host's `data-theme` can't override it.

## Tuned values (`DEFAULTS` in the prototype)

stiffness 240, damping 30, rubber 0.55 / 360px, deceleration 4.5/s, brake
1400 px/s², ripple 30ms / 0.86, focus blur 56px, grain 1.0, edge width 16vw,
edge max blur 7px, blur easing 5.0, edge fade 0.25, corner radius 24px,
corner smoothing 0.8, row blur 28px, row fade 0.35.

## Design specs from Figma (not yet applied)

- Header: photo 50×56 radius 14 with 1px rgba(0,0,0,.2) border; "Khalil
  Cader / Product Designer" 16px, second line 40% opacity; two 40px glass
  buttons (theme, grid): rgba(255,255,255,.8), 20px backdrop blur, 0.5px
  rgba(0,0,0,.2) border, radius 10.
- Covers: 422×617 and 771×617, radius 48, 1px rgba(0,0,0,.15) border, shadow
  0 4 16 rgba(0,0,0,.03), gap 24, starting 224px from the top at 1440×1024.
  Much larger than the prototype's row: decide whether the row grows to this
  size and focus becomes near full screen.
- Glass frame: 390×816, radius 61, rgba(255,255,255,.5) fill, 2px
  rgba(255,255,255,.8) border, shadow 0 4 50 30 rgba(0,0,0,.1). Implemented
  on the first cover with the Mobile spotlight video.
- Font: the file uses "Season Sans TRIAL". A trial license usually can't ship
  on a live site; get the license or keep the system font.

## Open questions

- Row cover size vs the Figma frame (see above).
- Season Sans license.
- Real project content (videos/images, titles, case study pages).
- Stack for the real site (the repo's default branch reports Astro).

## Media

`prototype/media/spotlight.{webm,mp4,jpg}`: the Mobile spotlight recording,
compressed from 24MB (972×2108, 60fps) to ~0.9MB each at 600px / 30fps, plus
a poster frame. WebM is listed first; MP4 (H.264) is the fallback.
