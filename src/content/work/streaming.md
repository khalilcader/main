---
title: Streaming
summary: Placeholder summary. Replace with a one-line description of the project.
role: Product designer
year: "2026"
order: 6
cover:
  aspect: 0.684   # 422 × 617, like the other phone covers
  shader: gradient
  angle: 140
  palette: lemon
  alt: An iPhone app streaming formatted text in word by word, with sliders that tune how the text reveals itself
  video:
    webm: images/work/streaming-1.webm
    mp4: images/work/streaming-1.mp4
    poster: images/work/streaming-1.jpg
    start: 4
    device: iphone
    rest: [0.38, 0.3, 1.6]   # thumbnail: mid-stream, the phone's top-left corner with the text arriving
    # [seconds, x, y, zoom]: the text streaming in, the sliders being tuned,
    # then streaming again, with the whole phone at the start and end so the
    # loop is seamless.
    camera:
      - [0, 0.5, 0.5, 1]
      - [1.0, 0.5, 0.5, 1]
      - [2.2, 0.5, 0.32, 1.3]      # the text streams in
      - [6.2, 0.5, 0.35, 1.3]
      - [7.8, 0.5, 0.76, 1.3]      # tuning the sliders
      - [14.2, 0.5, 0.76, 1.3]
      - [15.8, 0.5, 0.32, 1.3]     # streaming again
      - [18.6, 0.5, 0.35, 1.3]
      - [19.7, 0.5, 0.5, 1]
---

Placeholder case study.
