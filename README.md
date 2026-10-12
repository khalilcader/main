# khalilcader.com

Portfolio site for Khalil Cader.

## prototype/

`prototype/index.html` is an interaction prototype for the work strip. It's a
single file with no build step; open it in a browser.

- Drag or scroll the row; it glides and rubber-bands at the ends.
- Pull a cover up (or tap it) to scrub the whole row into a large strip that
  pages one project at a time. Pull down or tap to go back.
- Pull a cover down in the row and it squishes against a rubber band, with a
  chain reaction: each neighbor follows a beat later while the gaps stay even.
- In the large strip, covers away from center dim, blur and pick up grain;
  the viewport edges blur progressively.
- Press G for a packed grid view.

The covers are placeholder blocks in Apple system colors. The "Values" panel shows live spring state and
has sliders for stiffness, damping, rubber band strength, deceleration, brake,
and ripple delay and falloff, plus a toggle for snapping the row to covers.
