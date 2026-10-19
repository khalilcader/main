---
title: Dictation
summary: Placeholder summary. Replace with a one-line description of the project.
role: Product designer
year: "2026"
order: 6
cover:
  aspect: 0.684   # 422 × 617, like the other phone covers
  shader: gradient
  palette: stone
  alt: Dictating a message in the Claude app, from the mic button to the transcribed text in the composer
  video:
    webm: images/work/dictation-6.webm
    mp4: images/work/dictation-6.mp4
    poster: images/work/dictation-6.jpg
    start: 9
    rest: [0.5, 0.635, 1.2]   # thumbnail: the lower half of the phone with the dictation bar, its waveform live
    # [seconds, x, y, zoom]: stays on the lower half of the phone (nothing
    # happens up top): in on the mic, the recording bar and transcribing, back
    # out for the text and keyboard, and back to the resting framing for a
    # seamless loop.
    camera:
      - [0, 0.5, 0.63, 1.35]
      - [0.2, 0.5, 0.63, 1.35]
      - [1.0, 0.5, 0.675, 1.55]     # tap the mic; recording
      - [12.6, 0.5, 0.675, 1.55]
      - [13.2, 0.5, 0.684, 1.6]     # stop; transcribing
      - [17.8, 0.5, 0.684, 1.6]
      - [18.6, 0.5, 0.63, 1.35]     # the text lands in the composer
      - [21.6, 0.5, 0.63, 1.35]
---

Placeholder case study.
