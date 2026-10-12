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
- In the large strip, covers away from center dim, blur and pick up grain.
  The viewport edges use a progressive blur: eight stacked backdrop blurs, each
  masked to its own band, plus a fade to the page so covers blur and dissolve
  together, with light grain on top. The edges slide away in focus view. Edge
  width, max blur, blur easing and fade are tunable in the Values panel.
- Press G for a packed grid view.

The covers are placeholder blocks in Apple system colors. The "Values" panel shows live spring state and
has sliders for stiffness, damping, rubber band strength, deceleration, brake,
and ripple delay and falloff, plus a toggle for snapping the row to covers.
