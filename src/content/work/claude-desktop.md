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
    webm: images/work/claude-desktop-12.webm
    mp4: images/work/claude-desktop-12.mp4
    poster: images/work/claude-desktop-12.jpg
    start: 12
    device: desktop-app   # only the app window, from the icons' fade on (its edges tracked from the film's zoom), smoothed corners
    rest: [0.12, 0.14, 2.25]   # thumbnail: the window's top-left corner, the sidebar from New down to the first two pinned items, fog padding above and beside it
    # [seconds, x, y, zoom], never past 1.5 (past it the 1280 px recording goes
    # soft on a Retina screen), each shot kept inside the window: the icon set,
    # then held shots on each step: the sidebar, Artifacts and its new types,
    # pinning the October newsletter (and where it lands: the page's Pinned row
    # and the sidebar), typing the request, the reply, the answer and the
    # summary, pulling back to the whole window between them and before the
    # closing fade.
    camera:
      # Only the window is shown from the icons' fade on (the crop pushes in to
      # it, 1.4x), and as it does the camera eases out by as much (timed to it),
      # so the picture keeps its size while the frame closes in to the window's
      # edges. Then one move out, the film's own zoom-out, to the whole window.
      - [0, 0.5, 0.5, 1.45]        # the icon set fills the cover
      - [7.2, 0.5, 0.5, 1.45]
      - [7.5, 0.5, 0.5, 1.025]     # the frame closes in to the window
      - [8.45, 0.5, 0.5, 1.025]
      - [9.9, 0.5, 0.5, 1]         # the whole window, as the film's zoom-out lands
      - [11.5, 0.5, 0.5, 1]
      - [12.8, 0.388, 0.482, 1.5]    # the sidebar, down to the pinned items
      - [15.8, 0.388, 0.482, 1.5]
      - [17.3, 0.42, 0.482, 1.5]   # Artifacts and its new types
      - [19, 0.42, 0.482, 1.5]
      - [20, 0.388, 0.518, 1.5]      # pinning the October newsletter
      - [21.4, 0.388, 0.518, 1.5]
      - [22.6, 0.388, 0.518, 1.5]     # pinned: the page's Pinned row and the sidebar
      - [24.6, 0.388, 0.518, 1.5]
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
