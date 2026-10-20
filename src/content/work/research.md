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
    rest: [0.5, 0.6, 1.3]   # thumbnail (framing A): searching Slack at 0:28, backdrop below the phone
    # [seconds, x, y, zoom]: starts on the thumbnail framing, then pushes in on
    # the tool calls (Slack, Calendar, Gmail, Drive) with the bottom bar out of
    # frame, eases back for the summary and the tap, and returns to the
    # thumbnail framing for the loop. Centred; never high enough to show the
    # app's top bar.
    camera:
      - [0, 0.5, 0.6, 1.3]
      - [3.5, 0.5, 0.6, 1.3]
      - [5.5, 0.5, 0.5, 1.75]      # searching Slack
      - [12.0, 0.5, 0.5, 1.75]
      - [13.5, 0.5, 0.52, 1.65]    # Calendar
      - [19.5, 0.5, 0.52, 1.65]
      - [21.0, 0.5, 0.5, 1.75]     # Gmail
      - [27.5, 0.5, 0.5, 1.75]
      - [29.0, 0.5, 0.52, 1.65]    # Drive
      - [33.0, 0.5, 0.52, 1.65]
      - [34.5, 0.5, 0.58, 1.4]     # done; the summary streams in
      - [40.5, 0.5, 0.58, 1.4]
      - [41.3, 0.5, 0.55, 1.6]     # tap Worked for 10 minutes; the sheet opens
      - [42.6, 0.5, 0.55, 1.6]
      - [43.4, 0.5, 0.6, 1.3]
---

Placeholder case study.
