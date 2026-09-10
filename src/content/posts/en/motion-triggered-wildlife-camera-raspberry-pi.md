---
title: "Motion-triggered wildlife camera with Raspberry Pi and a PIR sensor"
description: "Use a Raspberry Pi, Pi Camera, and PIR sensor to automatically snap photos or clips whenever a bird or animal visits your garden — with Python code using picamera2 and cooldown logic to avoid a flood of files."
pubDate: 2026-09-15
lang: en
category: article
translationId: wildlife-camera-raspberry-pi
tags: ["raspberry-pi", "python", "camera"]
heroEmoji: "🐦"
author: "CoderDIY"
---

Curious what's visiting your garden or bird feeder at night or while you're away? A DIY wildlife camera built on a Raspberry Pi costs a fraction of a dedicated commercial trail camera, and you fully control where the footage is stored — no cloud account, no subscription fee.

## How it works

1. A PIR sensor continuously watches for changes in infrared radiation in its field of view; when a warm-bodied object (a bird, squirrel, cat...) moves through, its output pin switches from LOW to HIGH.
2. A Python script on the Raspberry Pi continuously polls the GPIO pin wired to the PIR.
3. When it reads HIGH, the script uses `picamera2` to capture a still photo (or record a few seconds of video) and saves it with a timestamped filename.
4. After each capture, the script waits out a cooldown period before resuming monitoring, so one animal lingering to feed doesn't produce hundreds of near-duplicate files.

## Parts list

- Raspberry Pi (a Zero 2 W is a cheap and capable choice; a Pi 4/5 if you want higher-resolution video)
- Pi Camera Module (v2 or v3, connected via the CSI port)
- PIR motion sensor (HC-SR501)
- A microSD card with enough capacity for photos/video (32GB or more recommended for multi-day runs)
- A weatherproof enclosure if mounting outdoors (see the note below)
- A power bank or a stable 5V supply if placed away from an outlet

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram for Raspberry Pi with a PIR sensor and Pi Camera">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="230" y="100" width="180" height="140" rx="10" class="box" />
    <text x="320" y="165" text-anchor="middle" class="label">Raspberry Pi</text>
    <text x="320" y="185" text-anchor="middle" class="sublabel">(Zero 2 W / Pi 4)</text>

    <rect x="20" y="110" width="150" height="100" rx="10" class="box" />
    <text x="95" y="165" text-anchor="middle" class="label">PIR sensor</text>

    <rect x="460" y="120" width="150" height="80" rx="10" class="box" />
    <text x="535" y="165" text-anchor="middle" class="label">Pi Camera (CSI)</text>

    <line x1="170" y1="140" x2="230" y2="130" class="wire" />
    <text x="200" y="122" text-anchor="middle" class="sublabel">OUT -> GPIO4</text>
    <circle cx="170" cy="140" r="4" class="pin" /><circle cx="230" cy="130" r="4" class="pin" />

    <line x1="170" y1="170" x2="230" y2="160" class="wire" />
    <text x="200" y="182" text-anchor="middle" class="sublabel">VCC -> 5V, GND -> GND</text>
    <circle cx="170" cy="170" r="4" class="pin" /><circle cx="230" cy="160" r="4" class="pin" />

    <line x1="410" y1="150" x2="460" y2="150" class="wire" />
    <text x="435" y="140" text-anchor="middle" class="sublabel">CSI ribbon cable</text>
    <circle cx="410" cy="150" r="4" class="pin" /><circle cx="460" cy="150" r="4" class="pin" />
  </svg>
  <figcaption>The PIR sensor runs on 5V power, but its OUT pin drives a 3.3V signal that's safe for the Pi's GPIO.</figcaption>
</figure>

## Sample code

```python
#!/usr/bin/env python3
import time
from datetime import datetime
from pathlib import Path
from gpiozero import MotionSensor
from picamera2 import Picamera2

PIR_PIN = 4
OUTPUT_DIR = Path("/home/pi/wildlife_photos")
COOLDOWN_SECONDS = 30  # avoid rapid-fire captures while an animal lingers

OUTPUT_DIR.mkdir(exist_ok=True)

pir = MotionSensor(PIR_PIN)
camera = Picamera2()
config = camera.create_still_configuration()
camera.configure(config)
camera.start()
time.sleep(2)  # let the light sensor settle

print("Ready. Waiting for motion...")

try:
    while True:
        pir.wait_for_motion()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filepath = OUTPUT_DIR / f"animal_{timestamp}.jpg"

        camera.capture_file(str(filepath))
        print(f"Captured: {filepath}")

        # wait out the cooldown before resuming monitoring,
        # so an animal that lingers doesn't spam duplicate files
        time.sleep(COOLDOWN_SECONDS)

except KeyboardInterrupt:
    print("Stopping.")
finally:
    camera.stop()
```

Run it persistently with systemd, or more simply with `nohup`:

```bash
nohup python3 wildlife_camera.py > log.txt 2>&1 &
```

> To record a short video clip instead of a still photo, replace `camera.capture_file()` with `camera.start_and_record_video(str(video_path), duration=8)` from the `picamera2.encoders` module.

## Common pitfalls

- **Not tuning the PIR's stability settings**: many HC-SR501 modules have trimmers for the HIGH hold time (delay) and sensitivity — set the sensitivity too high and it will trigger on leaves rustling in the wind.
- **Skipping a software cooldown**: relying only on the PIR's hardware delay isn't enough — always add a `time.sleep()` after each capture in your code so you're in control, or an animal feeding for five minutes can generate dozens of near-identical files.
- **Capturing before the camera warms up**: calling `capture_file()` immediately after `camera.start()` can produce a dark or color-shifted image because the light sensor hasn't auto-adjusted yet — always wait 1-2 seconds before the first capture.
- **Filling up the SD card**: running for weeks at high resolution can fill a card faster than expected — add a script to prune old files automatically, or sync periodically to a computer or NAS.

## A note on outdoor placement

If you're mounting the camera outside, use a weatherproof enclosure (IP65 or better) with an opening sized to the camera lens, and leave a small vent gap to prevent condensation from building up inside the box as temperatures swing between day and night — trapped moisture is a common cause of corroded boards after a few months outdoors.

## Where to go from here

Add an IR illuminator so you get clear photos at night without startling animals with visible light, or run a lightweight species-detection model (TensorFlow Lite) on the Pi to automatically sort captures by species instead of reviewing them by hand.
