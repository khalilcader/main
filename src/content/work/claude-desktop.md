---
title: Claude Desktop
summary: Placeholder summary. Replace with a one-line description of the project.
role: Product designer
year: "2026"
order: 1
cover:
  aspect: 1.25   # 771 × 617: wide, for landscape footage
  shader: gradient
  angle: 200
  palette: fog
  alt: Claude Desktop on a Mac, from its icon set to the sidebar's projects and artifacts, then asking for a summary of a survey and getting back a one-page document
  video:
    webm: images/work/claude-desktop-4.webm
    mp4: images/work/claude-desktop-4.mp4
    poster: images/work/claude-desktop-4.jpg
    start: 12
    device: desktop-app   # trimmed to the app window (still from 0:10.5), smoothed corners
    rest: [0.12, 0.08, 2.8]   # thumbnail: the window's top-left corner, the sidebar's top tabs (New to Customize, before Pinned), fog padding above and beside it
    # [seconds, x, y, zoom]: the icon set, then held shots on each step: the
    # sidebar, the artifacts, typing the request, the reply, the answer and
    # the summary, pulling back to the whole window between them and at the
    # loop.
    camera:
      - [0, 0.5, 0.5, 1]
      - [6.5, 0.5, 0.5, 1.15]      # the icon set, slowly closer
      - [8, 0.5, 0.5, 1]
      - [11.5, 0.5, 0.5, 1]        # the whole window
      - [12.8, 0.16, 0.2, 2]       # the sidebar's top tabs
      - [15.5, 0.16, 0.22, 2]
      - [17, 0.42, 0.38, 1.55]     # Artifacts
      - [22, 0.4, 0.36, 1.55]
      - [23.5, 0.5, 0.5, 1]        # back to New
      - [25.5, 0.5, 0.5, 1]
      - [27, 0.6, 0.48, 1.8]       # typing the request
      - [33, 0.6, 0.5, 1.8]
      - [34.5, 0.68, 0.2, 1.6]     # sent
      - [36.5, 0.66, 0.24, 1.6]
      - [37.8, 0.48, 0.42, 1.55]   # the answer and its table
      - [39.8, 0.48, 0.44, 1.55]
      - [41, 0.8, 0.36, 1.6]       # the one-page summary
      - [44, 0.8, 0.4, 1.6]
      - [45.4, 0.5, 0.5, 1]
---

Placeholder case study.
