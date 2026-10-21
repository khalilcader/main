---
name: project-video
description: Khalil's rules for adding or adjusting a project cover video (screen recording in a device frame, camera, thumbnail, background). Use whenever a new project video comes in or a cover's framing, thumbnail, spacing or background is being changed.
---

# Project cover videos

Each project in `src/content/work/` is a screen recording shown on a gradient
cover (see `src/content.config.ts`, `src/components/GlassFrame.astro`,
`src/scripts/camera.ts`). Follow these every time; Khalil has asked for each
of them more than once.

## Before shipping
- Show options (screenshots) before committing when the framing or look is a
  judgement call. Verify every change with screenshots of the real cover, in
  light and dark, at rest and at several points while playing.
- New video file names on every re-encode (`name-2.mp4`, …) so browsers don't
  serve the cached one.

## The recording
- Crop exactly to the screen. Measure it; never trim the edges of the app.
- Sit the video flush against the bezel: no black display edge or padding
  inside the frame.
- Breathing room at the bottom: the home indicator and the bar above it (tab
  bar, composer, dictation bar) need clear space above the bezel. The approved
  recipe (Tool Use, Oct 2026: Khalil said "nice, remember this") is
  `scripts/rebottom.py`: the content down to the end of the bar/disclaimer
  moves up by P1 + P2, the area below is rebuilt from the screen's own flat
  colour (never stretched, so the recording's rounded corners and wallpaper
  never show), and the home indicator is redrawn P2 above the bottom. Values
  that landed: P1 = 34, P2 = 24 on an ~800 x 1740 screen (about 2% and 1.4%
  of the height). Khalil tried 16 / 10 and preferred these. Fill
  the recording's rounded corners with the screen colour first. Never stretch
  the UI itself or add a band at the top over content.
- Status bar: never cramped against the top; it sits beside the notch / island.
- Fill the recording's own rounded corners so nothing black peeks out.
- If the recording already shows a device, use it (`iphone-recorded`) instead
  of adding a frame. Exception: an iOS Simulator recording (its phone looks
  flat) goes in our `iphone` frame: crop to the screen, paint out the
  Simulator's own Dynamic Island (the frame draws one) and fill the screen's
  rounded corners with the screen colour.

## Touch
- iOS Simulator recordings (Tool Use, Oct 2026): keep the Simulator's own
  grey pointer as it is. Khalil: "no need to remove the pointer from the demo".
- Replace a Mac pointer or iOS touch indicator with the touch circle: a plain
  grey fill (the background blurred and darkened ~20%), no outline, ~62px on
  an ~800px-wide screen, shrinking a little while pressed. Erase every trace of
  the original, including frames where it enters or leaves half off-screen;
  scan the output frame by frame to confirm.

## Camera and thumbnail
- Follow the action with gentle held shots that ease between steps; never
  static for long, never jittery. Keep the phone centred horizontally.
- Never show the app's top bar or the top of the phone when Khalil says the
  action is lower down; check every keyframe, not just the thumbnail.
- Never let the bezel run along the cover's edges, and never let the bottom
  of the phone touch the cover's bottom edge. Every shot is one of two kinds:
  the device with backdrop around it (below it too), or pushed in far enough
  that the screen alone fills the cover with app content clear of the edges.
  Khalil dislikes UI (cards, bubbles) cut by the cover's edges, so when the
  app's cards span the screen, stay on the device-with-backdrop shot and get
  motion from gentle drifts in zoom and position instead.
- The thumbnail (`rest`) is the frame Khalil names (a timestamp or a photo):
  match it exactly, including how much backdrop shows.

## Background
- One colour family per cover, soft and light; no dark or heavy covers.
- Don't reuse a palette another cover already has, and vary the gradient
  `angle` so neighbours don't all glow from the same side.

## Labels
- Title in full text colour with the year under it, smaller and lighter.

## Grid lightbox stills (after any cover change)
- Behind an open cover in grid view, the other covers cross-fade to blurred
  stills of themselves (`public/images/work/blur/<slug>-light|dark.webp`,
  placed by `src/data/blur-stills.json`). No live blur: a backdrop blur left
  zoomed device bezels sharp, and blurring the covers themselves made Chrome
  redraw them blank for a frame (Khalil saw it as flicker).
- Whenever a cover is added or its look changes (thumbnail, rest framing,
  palette, angle, device), regenerate them: `npm run build`, start the
  preview, then
  `node .claude/skills/project-video/scripts/blur-stills.mjs <tmp dir>` and
  `python3 .claude/skills/project-video/scripts/blur-stills.py <tmp dir> .`
  A cover without a still just stays sharp under the tint.
