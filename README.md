# khalilcader.com

Portfolio site for Khalil Cader.

## prototype/

`prototype/index.html` is an interaction prototype for the work strip. It's a
single file with no build step; open it in a browser.

- Drag or scroll the row; it glides and rubber-bands at the ends, and the gaps
  between covers stretch and settle back like a spring.
- Pull a cover up (or tap it) to scrub the whole row into a large strip that
  pages one project at a time, with neighbors pushed just off screen. Swipe
  left or right to move between covers; drag up or down (or flick) to send the
  focused cover back to the row.
- Pull a cover down in the row and it squishes against a rubber band, with a
  chain reaction: each neighbor follows a beat later while the gaps stay even.
- In the large strip, covers blur and fade progressively as they move off
  center, reaching 0% and a heavy blur (48px, tunable) as they leave, and
  pick up grain.
  The viewport edges use a progressive blur: eight stacked backdrop blurs, each
  masked to its own band, plus a fade to the page so covers blur and dissolve
  together, with light grain on top. Each edge only shows when there is more
  row beyond it, and both slide away in focus view. Edge
  width, max blur, blur easing and fade are tunable in the Values panel.
- Press G for a packed grid view, T (or the theme button) to cycle Auto / Light /
  Dark.

The covers are placeholder blocks in Apple system colors. The "Values" panel shows live spring state and
has sliders for stiffness, damping, rubber band strength and distance,
deceleration, brake,
and ripple delay and falloff, edge blur and grain, plus a toggle for snapping
the row to covers.

### Tuned values

The defaults in `prototype/index.html` (`DEFAULTS`) are the values dialed in
on Oct 12: stiffness 240, damping 30, rubber band 0.55 / 360px, deceleration
4.5/s, brake 1400 px/s², ripple 30ms / 0.86, focus blur 56px, grain 1.0, edge
width 16vw, edge max blur 7px, blur easing 5.0, edge fade 0.25.

Slider changes are saved in the browser on top of those defaults. "Copy
settings" copies every value as JSON (paste it back to update the defaults);
"Reset" returns to the defaults.
