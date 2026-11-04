---
title: Claude Desktop
summary: Placeholder summary. Replace with a one-line description of the project.
role: Product designer
year: "2026"
order: 6
cover:
  aspect: 1.25   # 771 × 617: wide, for landscape footage
  shader: gradient
  angle: 200
  palette: fog
  alt: Claude Desktop on a Mac, from its icon set to the sidebar and its artifacts, pinning one, then asking for a summary of a survey and getting back a one-page document
  video:
    webm: images/work/claude-desktop-14.webm
    mp4: images/work/claude-desktop-14.mp4
    poster: images/work/claude-desktop-14.jpg
    start: 12
    device: desktop-app   # trimmed to the app window, room added on its right, smoothed corners
    rest: [0.18, 0.21, 1.5]    # thumbnail: the window's top-left corner where it was, the sidebar, fog padding above and beside it (1.5x: crisp)
    # [seconds, x, y, zoom], never past 1.5 (past it the 1280 px recording goes
    # soft on a Retina screen), each shot kept inside the window: the icon set,
    # then held shots on each step: the
    # sidebar, Artifacts and its new types, pinning the October newsletter
    # (and where it lands: the page's Pinned row and the sidebar), typing the
    # request, the reply, the answer and the summary, pulling back to the
    # whole window between them and before the closing fade.
    camera:
      - [0, 0.5, 0.5, 1.5]         # the icon set and the slide into the sidebar fill the cover
      - [8.9, 0.5, 0.5, 1.5]       # held while the film still shows desktop, so the frame's edges stay hidden
      - [10.2, 0.5, 0.5, 1]        # out to the window as the film's own zoom-out lands (the last sliver of
                                   # desktop is trimmed off the video first, 8.95-9.3 s)
      - [11.5, 0.5, 0.5, 1]        # the whole window
      - [12.8, 0.388, 0.482, 1.5]    # the sidebar, down to the pinned items
      - [15.8, 0.388, 0.482, 1.5]
      - [17.3, 0.42, 0.482, 1.5]   # Artifacts and its new types
      - [19, 0.42, 0.482, 1.5]
      - [20, 0.388, 0.518, 1.5]      # pinning the October newsletter
      - [21.4, 0.388, 0.518, 1.5]
      - [22.6, 0.3, 0.52, 1.5]     # pinned: the page's Pinned row and the sidebar
      - [24.6, 0.3, 0.52, 1.5]
      - [25.8, 0.5, 0.5, 1]        # back to New
      - [28, 0.5, 0.5, 1]
      - [29.3, 0.6, 0.482, 1.5]     # typing the request
      - [36.6, 0.6, 0.5, 1.5]
      - [38.2, 0.612, 0.482, 1.5]     # sent
      - [40, 0.612, 0.482, 1.5]
      - [41.2, 0.48, 0.482, 1.5]   # the answer and its table
      - [43.2, 0.48, 0.482, 1.5]
      - [44.6, 0.612, 0.482, 1.5]     # the one-page summary
      - [48.3, 0.612, 0.482, 1.5]
      - [49.4, 0.5, 0.5, 1]        # the whole window as it fades
---

Placeholder case study.
