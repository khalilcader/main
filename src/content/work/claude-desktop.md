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
  alt: Claude Desktop on a Mac, from its icon set to the sidebar, Artifacts and Projects, then asking for a summary of a survey and getting back a one-page document
  video:
    webm: images/work/claude-desktop-17.webm
    mp4: images/work/claude-desktop-17.mp4
    poster: images/work/claude-desktop-17.jpg
    dark:   # the same take recorded in dark mode, shown when the site is dark
      webm: images/work/claude-desktop-17-dark.webm
      mp4: images/work/claude-desktop-17-dark.mp4
      poster: images/work/claude-desktop-17-dark.jpg
    start: 12
    device: desktop-app   # trimmed to the app window (following the film's own pan at 12-14.5 s), room added on its right, smoothed corners
    rest: [0.18, 0.21, 1.5]    # thumbnail: the window's top-left corner, the sidebar, fog padding above and beside it (1.5x: crisp)
    # [seconds, x, y, zoom], never past 1.5 (past it the recording goes soft on
    # a Retina screen), each shot kept inside the window: the icon set, then
    # held shots on each step (the sidebar, Artifacts, typing the request, the
    # reply, Projects, the summary), pulling back to the whole window between
    # them and before the closing fade. One camera for both takes: they keep
    # time within 0.1 s to 72 s; the dark one opens the summary 0.7 s sooner.
    camera:
      - [0, 0.5, 0.5, 1.5]         # the icon set and the slide into the sidebar fill the cover
      - [8.9, 0.5, 0.5, 1.5]       # held while the film still shows desktop, so the frame's edges stay hidden
      - [10.2, 0.5, 0.5, 1]        # out to the window as the film's zoom-out lands (the last sliver of
                                   # desktop is trimmed off the video first, 8.95-9.3 s)
      - [12.4, 0.5, 0.5, 1]        # the whole window
      - [13.8, 0.388, 0.482, 1.5]  # the sidebar, hovered down
      - [19.8, 0.388, 0.482, 1.5]
      - [21.2, 0.5, 0.5, 1]        # out as Artifacts opens
      - [22.4, 0.56, 0.482, 1.5]   # Artifacts: its types and cards
      - [31.2, 0.56, 0.482, 1.5]
      - [32.2, 0.5, 0.5, 1]        # the sidebar folds away and the list scrolls
      - [36.4, 0.5, 0.5, 1]
      - [37.6, 0.56, 0.5, 1.5]     # back on Artifacts
      - [40.4, 0.56, 0.5, 1.5]
      - [41.4, 0.5, 0.5, 1]        # New
      - [43.4, 0.6, 0.5, 1.5]      # typing the request
      - [52.6, 0.6, 0.5, 1.5]
      - [53.8, 0.612, 0.482, 1.5]  # sent
      - [55.6, 0.612, 0.482, 1.5]
      - [56.8, 0.5, 0.482, 1.5]    # the answer and its table
      - [59.4, 0.5, 0.482, 1.5]
      - [60.4, 0.5, 0.5, 1]        # out as Projects opens
      - [61.6, 0.56, 0.482, 1.5]   # Projects
      - [71.4, 0.56, 0.482, 1.5]
      - [72.4, 0.5, 0.5, 1]        # out as the summary opens
      - [73.8, 0.612, 0.482, 1.5]  # the one-page summary
      - [77.4, 0.612, 0.482, 1.5]
      - [78.4, 0.5, 0.5, 1]        # the whole window as it fades
---

Placeholder case study.
