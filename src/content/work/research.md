---
title: Untitled
summary: Placeholder summary. Replace with a one-line description of the project.
role: Product designer
year: "2025"
order: 10
cover:
  aspect: 0.684   # 422 × 617, like the other phone covers
  shader: gradient
  angle: 250
  palette: blue
  alt: Claude on iPhone searching Slack, Calendar, Gmail and Google Drive, then summarising the week's most important items
  video:
    webm: images/work/research.webm
    mp4: images/work/research.mp4
    poster: images/work/research.jpg
    start: 40
    rest: [0.5, 0.5, 1.7]   # thumbnail: the summary, in close on the middle of the phone
    # [seconds, x, y, zoom]: stays in close on the middle of the phone (no top
    # bar or composer): the request and each source being searched, then down
    # to the summary as it streams in, and the tap that opens its steps.
    camera:
      - [0, 0.5, 0.42, 1.7]
      - [33.5, 0.5, 0.42, 1.7]
      - [35.5, 0.5, 0.5, 1.7]      # the summary streams in
      - [43.4, 0.5, 0.5, 1.7]      # tap Worked for 10 minutes; the sheet opens
---

Placeholder case study.
