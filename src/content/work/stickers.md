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
  palette: aqua
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
    # in view (pushing in would cut the outer ones at the cover's edges; at 1 the
    # window already fills 86% of the cover's width). One slow push across the
    # whole take, eased at both ends, instead of drifting in and out: it lands
    # on the full board as the stickers finish, and eases back under the fade-out.
    camera:
      - [0, 0.5, 0.5, 0.93]
      - [19, 0.5, 0.5, 1]
      - [19.6, 0.5, 0.5, 1]
      - [20.6, 0.5, 0.5, 0.93]   # back out while the board fades, so the loop picks up where it left off
---

Placeholder case study.
