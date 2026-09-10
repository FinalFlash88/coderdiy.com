---
title: "Building an AI Camera That Catches 3D Print Failures with Raspberry Pi and OpenCV"
description: "Use a webcam, a Raspberry Pi and a bit of image processing to automatically detect 'spaghetti' or warping mid-print, then auto-pause the printer through OctoPrint."
pubDate: 2026-09-06
lang: en
category: article
translationId: 3d-print-failure-detector
tags: ["raspberry-pi", "opencv", "3d-printing"]
heroEmoji: "🖨️"
author: "CoderDIY"
---

Anyone who prints a lot in 3D has lived this: you go to sleep with a print running fine, and wake up to an entire spool turned into a "spaghetti" mess wrapped around the hotend, because the first layer lifted off the bed hours earlier without anyone noticing. A camera plus a bit of image-processing code can catch this and auto-pause the printer before it wastes more filament and power.

## The core idea

You don't need complex AI to get started — the simplest, most reliable approach is **comparing frames over time**: a print that's going well changes *gradually and predictably* between consecutive frames. If a frame suddenly changes a large area all at once (the classic signature of spaghetti), that's a warning signal.

## Hardware

- A Raspberry Pi (3B+ or newer) running OctoPrint or Klipper/Moonraker
- A USB webcam pointed at the print bed
- (Optional) a fixed LED light for stable lighting, to avoid false positives from shifting shadows

## Basic image processing with OpenCV

```python
import cv2
import numpy as np
import requests

cap = cv2.VideoCapture(0)
prev_frame = None
OCTOPRINT_URL = "http://localhost/api/job"
API_KEY = "your_octoprint_api_key"

def pause_print():
    requests.post(
        OCTOPRINT_URL,
        headers={"X-Api-Key": API_KEY},
        json={"command": "pause", "action": "pause"},
    )

while True:
    ret, frame = cap.read()
    if not ret:
        continue

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (21, 21), 0)

    if prev_frame is not None:
        diff = cv2.absdiff(prev_frame, gray)
        _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
        changed_ratio = np.count_nonzero(thresh) / thresh.size

        if changed_ratio > 0.15:  # tune for your actual camera/distance
            print("Unusual change detected — possible print failure!")
            pause_print()

    prev_frame = gray
    cv2.waitKey(2000)  # check every 2 seconds
```

## Why frame-diff instead of an AI model from day one

Frame-diff needs no training, runs light enough for even a Pi Zero, and is good enough for most obvious "spaghetti" cases. If you want more precision (distinguishing subtle lifting, corner warping, or stray strings), the next step is training a small classifier (e.g. a fine-tuned MobileNet) on a few hundred images of good/failed prints — but for most home printers, frame-diff alone is enough to prevent the worst filament-wasting disasters.

## Tips for fewer false alarms

- Mount the camera solidly — even slight vibration is enough to cause a large diff.
- Keep lighting stable; avoid a nearby window whose sunlight shifts through the day.
- Raise the `changed_ratio` threshold during the first few layers and any layer with lots of fine detail (dense infill can cause a large diff even when nothing's wrong).

## Where to go from here

Add a Telegram bot or webhook to get notified the moment the printer pauses, or log the flagged frames to build a dataset for a more accurate model later on.
