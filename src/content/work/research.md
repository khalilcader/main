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
  palette: lemon
  alt: Claude on iPhone searching Slack, Calendar, Gmail and Google Drive, then summarising the week's most important items
  video:
    webm: images/work/research-2.webm
    mp4: images/work/research-2.mp4
    poster: images/work/research-2.jpg
    start: 9
    rest: [0.5, 0.57, 1.4]   # thumbnail: searching Slack (0:28 in the recording)
    # [seconds, x, y, zoom]: drifts in on each source as it's searched (Slack,
    # Calendar, Gmail, Drive), eases back for the summary, then in on the tap
    # that opens its steps. Never high enough to show the app's top bar.
    camera:
      - [0, 0.5, 0.57, 1.4]
      - [4.0, 0.5, 0.57, 1.4]
      - [5.5, 0.46, 0.5, 1.75]     # searching Slack
      - [12.0, 0.47, 0.5, 1.75]
      - [13.5, 0.54, 0.52, 1.6]    # Calendar
      - [19.5, 0.53, 0.52, 1.6]
      - [21.0, 0.46, 0.5, 1.75]    # Gmail
      - [27.5, 0.47, 0.5, 1.75]
      - [29.0, 0.54, 0.52, 1.6]    # Drive
      - [33.0, 0.53, 0.52, 1.6]
      - [34.5, 0.5, 0.57, 1.4]     # done; pull back
      - [36.0, 0.5, 0.6, 1.5]      # the summary streams in
      - [40.5, 0.5, 0.6, 1.5]
      - [41.3, 0.45, 0.55, 1.65]   # tap Worked for 10 minutes; the sheet opens
      - [43.4, 0.45, 0.55, 1.65]
---

Placeholder case study.
