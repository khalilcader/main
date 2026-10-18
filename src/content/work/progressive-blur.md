---
title: Progressive Blur
summary: Placeholder summary. Replace with a one-line description of the project.
role: Product designer
year: "2026"
order: 4
cover:
  aspect: 1.25   # 771 × 617: wide, for desktop
  shader: gradient
  palette: blue
  alt: Figma on desktop, adding a progressive blur to an image and dragging its direction
  video:
    webm: images/work/progressive-blur.webm
    mp4: images/work/progressive-blur.mp4
    poster: images/work/progressive-blur.jpg
    start: 21.2
    device: desktop
    rest: [0.64, 0.55, 1.5]   # thumbnail: in close on the blurred image, its handle and the popover
    # [seconds, x, y, zoom]: gentle held shots (1.3-1.45x) on each step,
    # with the full view at the start and end so the loop is seamless.
    camera:
      - [0, 0.5, 0.5, 1]
      - [1.6, 0.5, 0.5, 1]
      - [2.6, 0.643, 0.62, 1.4]      # Effects: add a Progressive blur
      - [5.0, 0.643, 0.62, 1.4]
      - [5.9, 0.64, 0.52, 1.45]      # the blur lands on the image; drag its handles
      - [16.8, 0.64, 0.52, 1.45]
      - [17.6, 0.643, 0.643, 1.4]      # tune End blur in the popover
      - [21.2, 0.643, 0.643, 1.4]
      - [22.0, 0.615, 0.5, 1.3]      # the result
      - [27.2, 0.615, 0.5, 1.3]
      - [28.4, 0.5, 0.5, 1]
      - [29.5, 0.5, 0.5, 1]
---

Placeholder case study.
