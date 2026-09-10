---
title: "Build a Plant Growth Time-Lapse Camera with a Raspberry Pi"
description: "Use a Raspberry Pi and a Pi Camera to photograph a plant every 10 minutes for weeks, then stitch the frames into a time-lapse video with ffmpeg — with a working capture script and the exact ffmpeg command."
pubDate: 2026-09-22
lang: en
category: article
tags: ["raspberry-pi", "python", "camera"]
translationId: plant-timelapse-camera
heroEmoji: "🌿"
author: "CoderDIY"
---

Watching a seed push up and unfurl its first leaves in a few seconds of video never gets old, and it happens to be one of the easiest Raspberry Pi projects to start: no complicated sensors, no circuitry — just a camera, a steady capture schedule, and one ffmpeg command at the end to stitch it all together.

## How it works

1. The Pi Camera is mounted in a fixed position, pointed straight at the pot, and doesn't move for the entire duration of the shoot.
2. A Python script using the `picamera2` library captures one photo, names it with a timestamp, and exits — it runs standalone each time it's invoked.
3. `cron` (or a systemd timer) calls that script on a fixed interval, say every 10 minutes, around the clock for weeks.
4. Once enough frames exist, `ffmpeg` stitches the whole chronologically-ordered image sequence into a single MP4 video.

The one thing that makes or breaks a smooth, flicker-free video: **lock exposure and white balance** for every single capture. If the camera is left to auto-adjust to whatever light is available at each moment of the day, the final video will flicker between bright and dark from frame to frame.

## Parts list

- A Raspberry Pi (Pi 3, 4, or Zero 2 W all work)
- A Pi Camera Module (v2 or v3, connected via the CSI ribbon cable)
- A microSD card with enough headroom (32GB or more recommended, or add a USB drive for long shoots)
- A mount or clamp to hold the camera perfectly still between shots
- A stable 5V power supply, since the Pi needs to run continuously for weeks

<figure class="diagram">
  <svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram connecting a Raspberry Pi to a Pi Camera via the CSI cable">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="80" width="170" height="100" rx="10" class="box" />
    <text x="125" y="135" text-anchor="middle" class="label">Raspberry Pi</text>

    <rect x="430" y="80" width="170" height="100" rx="10" class="box" />
    <text x="515" y="135" text-anchor="middle" class="label">Pi Camera</text>

    <line x1="210" y1="120" x2="430" y2="120" class="wire" />
    <text x="320" y="112" text-anchor="middle" class="sublabel">CSI port → camera ribbon cable</text>
    <circle cx="210" cy="120" r="4" class="pin" />
    <circle cx="430" cy="120" r="4" class="pin" />

    <line x1="210" y1="150" x2="430" y2="150" class="wire" />
    <text x="320" y="142" text-anchor="middle" class="sublabel">Fixed mount, aimed straight at the pot</text>
    <circle cx="210" cy="150" r="4" class="pin" />
    <circle cx="430" cy="150" r="4" class="pin" />
  </svg>
  <figcaption>The camera plugs into the CSI port via its ribbon cable and stays firmly mounted so every frame shares the same framing.</figcaption>
</figure>

## Sample code

The capture script takes one photo with locked exposure settings to avoid flicker:

```python
#!/usr/bin/env python3
import time
from datetime import datetime
from picamera2 import Picamera2

OUTPUT_DIR = "/home/pi/timelapse"

picam2 = Picamera2()
config = picam2.create_still_configuration(main={"size": (1920, 1080)})
picam2.configure(config)

# Lock exposure and white balance so every frame matches in brightness and color
picam2.set_controls({
    "AeEnable": False,
    "AwbEnable": False,
    "ExposureTime": 20000,      # microseconds, tune for the light where the plant sits
    "AnalogueGain": 1.5,
    "ColourGains": (1.4, 1.6),  # (red, blue) - measure first to find stable values
})

picam2.start()
time.sleep(2)  # let the sensor settle before capturing

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
filename = f"{OUTPUT_DIR}/frame_{timestamp}.jpg"
picam2.capture_file(filename)
picam2.close()
```

Add this line to `crontab -e` to capture every 10 minutes:

```
*/10 * * * * /usr/bin/python3 /home/pi/capture_frame.py >> /home/pi/timelapse.log 2>&1
```

After a few weeks, stitch all the frames into a video with ffmpeg:

```bash
ffmpeg -framerate 24 -pattern_type glob -i '/home/pi/timelapse/frame_*.jpg' \
  -vf "scale=1920:-2" -c:v libx264 -pix_fmt yuv420p /home/pi/timelapse_output.mp4
```

`-framerate 24` means 24 frames become 1 second of video — at a 10-minute capture interval, 1 second of video covers roughly 4 hours of real time.

## Common pitfalls

- **Leaving auto-exposure/auto-white-balance on** is the single most common cause of flicker — always lock `AeEnable` and `AwbEnable` as shown above.
- **Cron runs in a different environment than your terminal** — it doesn't inherit your full `PATH`, so always use absolute paths (`/usr/bin/python3`, the full script path) in the crontab line.
- **The SD card fills up after a few weeks**: each full-HD frame is roughly 1-2MB, and shooting every 10 minutes for a month can add up to several GB — consider a USB drive, or automatically delete frames once the video has been rendered.
- **Filenames must sort in chronological order** for `ffmpeg -pattern_type glob` to stitch them in the right sequence — the `YYYYMMDD_HHMMSS` timestamp format guarantees alphabetical order matches time order.

## Where to go from here

Add a light sensor to automatically skip nighttime frames (saving storage that adds nothing to the video), overlay a date/time stamp on the video with ffmpeg's `drawtext` filter, or automatically sync frames to cloud storage or a NAS each night so a failed SD card mid-shoot doesn't cost you weeks of footage.
