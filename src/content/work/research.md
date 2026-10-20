---
title: Tool Use
summary: Placeholder summary. Replace with a one-line description of the project.
role: Product designer
year: "2025"
order: 10
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
    # [seconds, x, y, zoom]: only two shots, so the frame never sits halfway:
    # the whole lower phone with teal below it (the thumbnail), or pushed in
    # until the screen fills the cover (no bezel along its edges). Never high
    # enough to show the app's top bar.
    camera:
      - [0, 0.5, 0.612, 1.25]
      - [3.5, 0.5, 0.612, 1.25]
      - [5.0, 0.5, 0.5, 1.9]       # in on the tool calls: Slack, Calendar, Gmail, Drive
      - [33.0, 0.5, 0.5, 1.9]
      - [34.5, 0.5, 0.612, 1.25]      # out for the summary
      - [43.4, 0.5, 0.612, 1.25]      # and the tap that opens its steps
---

Placeholder case study.
