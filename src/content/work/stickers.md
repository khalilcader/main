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
    poster: images/work/stickers-2.jpg
    dark:   # the same take recorded in dark mode, shown when the site is dark
      webm: images/work/stickers-dark.webm
      mp4: images/work/stickers-dark.mp4
      poster: images/work/stickers-2-dark.jpg
    start: 2.4
    device: desktop   # the recording trimmed 2 px top and bottom to the frame's 1600 × 1000
    rest: [0.24, 0.36, 1.7]   # thumbnail: in close on the heart mid-drag over the yellow note, its WebGL peel
                              # and shine, with the window's top-left corner and the aqua backdrop above and
                              # beside it; the picker's "heart" search to the right
    # [seconds, x, y, zoom]. Pushed-in shots at 1.5 (the sharpness limit; below
    # ~1.45 the board no longer fills the cover's height), x between 0.388 and 0.612,
    # y at 0.518 (the lowest it goes) to keep the board's toolbar clear of the bottom edge,
    # so the board's edges never come inside the cover: the shot slides to the note
    # being stickered, then pulls back to the whole board as the last one lands,
    # matching the opening so the loop is seamless.
    camera:
      - [0, 0.5, 0.5, 1]           # the whole board
      - [1, 0.5, 0.5, 1]
      - [2.2, 0.388, 0.518, 1.5]     # the yellow note and the picker: a heart, a thumbs up
      - [6, 0.388, 0.518, 1.5]
      - [7.2, 0.612, 0.518, 1.5]     # over to the green note: a star, coffee
      - [13, 0.612, 0.518, 1.5]
      - [14.2, 0.5, 0.518, 1.5]      # the star moves to the blue note; a party popper
      - [18.6, 0.5, 0.518, 1.5]
      - [19.6, 0.5, 0.5, 1]        # back to the whole board
      - [20.85, 0.5, 0.5, 1]
---

Placeholder case study.
