---
title: FigJam AI
summary: Placeholder summary. Replace with a one-line description of the project.
role: Product designer
year: "2023"
order: 12
cover:
  aspect: 1.25   # 771 × 617: wide, for desktop
  shader: gradient
  angle: 30
  palette: clay
  alt: FigJam on desktop, asking AI from the toolbar to make a mind map for brainstorming product features, which then fills the board
  video:
    webm: images/work/figjam-ai.webm
    mp4: images/work/figjam-ai.mp4
    poster: images/work/figjam-ai.jpg
    start: 22
    device: desktop
    rest: [0.5, 0.74, 2.2]   # thumbnail: the AI panel's mind-map suggestions over the toolbar, backdrop below the window
    # [seconds, x, y, zoom]: in on the toolbar and the AI panel above it (the
    # prompt, Brainstorm, Make a mind map), drifting gently as each step
    # changes, then out to the whole board as the mind map fills it.
    camera:
      - [0, 0.5, 0.5, 1]
      - [3.5, 0.5, 0.5, 1]
      - [5.0, 0.5, 0.76, 2.3]      # the prompt opens over the toolbar
      - [8.5, 0.5, 0.76, 2.3]
      - [10.0, 0.5, 0.73, 2.15]    # Brainstorm suggestions
      - [16.5, 0.5, 0.73, 2.15]
      - [18.0, 0.49, 0.74, 2.3]    # Make a mind map
      - [23.5, 0.49, 0.74, 2.3]
      - [25.0, 0.5, 0.73, 2.15]    # Generate; working
      - [27.0, 0.5, 0.73, 2.15]
      - [28.5, 0.5, 0.52, 1.08]    # the mind map fills the board
      - [31.3, 0.5, 0.52, 1.08]
---

Placeholder case study.
