---
title: Tool Use
summary: Placeholder summary. Replace with a one-line description of the project.
role: Product designer
year: "2025"
order: 3
cover:
  aspect: 0.684   # 422 × 617, like the other phone covers
  shader: gradient
  angle: 250
  palette: teal
  alt: Claude on iPhone searching Slack, Calendar, Gmail and Google Drive, then summarising the week's most important items
  video:
    webm: images/work/research-4.webm
    mp4: images/work/research-4.mp4
    poster: images/work/research-4.jpg
    start: 9
    rest: [0.5, 0.612, 1.25]   # thumbnail (framing A): searching Slack at 0:28, backdrop below the phone
    # [seconds, x, y, zoom]: always the lower phone with teal around and below
    # it (no edge-to-edge screen: the tool cards span the screen, so a closer
    # shot cuts them at the cover's edges). Motion comes from gentle drifts
    # between two safe framings; each zoom's height keeps the app's top bar
    # out of frame.
    camera:
      - [0, 0.5, 0.612, 1.25]
      - [3.5, 0.5, 0.612, 1.25]
      - [6.0, 0.49, 0.6, 1.29]     # Slack
      - [12.0, 0.49, 0.6, 1.29]
      - [14.5, 0.51, 0.622, 1.22]  # Calendar
      - [19.5, 0.51, 0.622, 1.22]
      - [22.0, 0.49, 0.6, 1.29]    # Gmail
      - [27.5, 0.49, 0.6, 1.29]
      - [30.0, 0.51, 0.622, 1.22]  # Drive
      - [34.0, 0.51, 0.622, 1.22]
      - [36.5, 0.5, 0.612, 1.25]   # the summary, and the tap that opens its steps
      - [43.4, 0.5, 0.612, 1.25]
---

Placeholder case study.
