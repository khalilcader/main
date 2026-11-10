---
title: Stickers
summary: Placeholder summary. Replace with a one-line description of the project.
role: Product designer
year: "2026"
order: 1.5
cover:
  aspect: 1.25   # 771 × 617: wide, for desktop
  shader: gradient
  angle: 50
  palette: caramel
  alt: A whiteboard of sticky notes, searching the sticker picker for a heart, a thumbs up, a star, coffee and a party popper and placing each on a note
  video:
    webm: images/work/stickers.webm
    mp4: images/work/stickers.mp4
    poster: images/work/stickers.jpg
    dark:   # the same take recorded in dark mode, shown when the site is dark
      webm: images/work/stickers-dark.webm
      mp4: images/work/stickers-dark.mp4
      poster: images/work/stickers-dark.jpg
    start: 13.4
    device: desktop   # the recording trimmed 2 px top and bottom to the frame's 1600 × 1000
    rest: [0.5, 0.5, 1]   # thumbnail: the whole board, the stickers placed, no picker or selection showing
    # [seconds, x, y, zoom]. The stickies span the board, so the whole board stays
    # in view (pushing in would cut the outer ones at the cover's edges): motion
    # comes from gentle drifts in zoom, out to 0.94 and back: at 1 the window already
    # fills 86% of the cover's width, and pushing in left only a thin band of backdrop.
    camera:
      - [0, 0.5, 0.5, 1]
      - [3, 0.5, 0.5, 0.94]        # a heart
      - [6, 0.5, 0.5, 1]           # a thumbs up
      - [9, 0.5, 0.5, 0.94]        # a star
      - [12, 0.5, 0.5, 1]          # coffee
      - [15, 0.5, 0.5, 0.94]       # the star moves to the blue sticky
      - [18, 0.5, 0.5, 1]          # a party popper
      - [20.8, 0.5, 0.5, 1]
---

Placeholder case study.
