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
    webm: images/work/research-7.webm
    mp4: images/work/research-7.mp4
    poster: images/work/research-7.jpg
    start: 29
    rest: [0.5, 0.3, 1.4]   # thumbnail: searching Slack at 0:29, the phone low with teal above it
    # [seconds, x, y, zoom]: held shots on each step (typing the request, the
    # reply, each tool call, the summary), with the whole phone at the start
    # and end so the loop is seamless.
    camera:
      - [0, 0.5, 0.5, 1]
      - [1.5, 0.5, 0.5, 1]
      - [3.0, 0.5, 0.62, 1.3]      # typing the request
      - [15.0, 0.5, 0.62, 1.3]
      - [17.0, 0.5, 0.3, 1.3]      # sent, and the reply
      - [23.0, 0.5, 0.3, 1.3]
      - [25.0, 0.5, 0.42, 1.25]    # Slack, Calendar, Gmail, Drive
      - [51.5, 0.5, 0.42, 1.25]
      - [53.5, 0.5, 0.6, 1.25]     # the summary
      - [55.5, 0.5, 0.6, 1.25]
      - [57.0, 0.5, 0.5, 1]
---

Placeholder case study.
