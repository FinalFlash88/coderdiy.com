---
title: "Build a DIY Smart Mirror with a Raspberry Pi"
description: "Combine a Raspberry Pi, an old monitor panel, and two-way acrylic mirror film into a smart mirror that shows the time and weather right on its surface — with kiosk-mode setup and a weather widget."
pubDate: 2026-09-23
lang: en
category: article
tags: ["raspberry-pi", "python", "home-automation"]
translationId: smart-mirror-raspberry-pi
heroEmoji: "🪞"
author: "CoderDIY"
---

A smart mirror is one of those projects that's both good-looking and genuinely useful: every morning while brushing your teeth, you get a glance at the time and the weather without picking up your phone. The hardest part isn't actually the electronics — it's the physical build of mounting the acrylic and frame. The software side is just a full-screen web page running in the background.

## How it works

1. **The physical build**: apply a sheet of two-way acrylic mirror film to a piece of glass or clear acrylic. Behind that panel sits an ordinary LCD/LED display (pulled from an old TV or monitor works fine), with a Raspberry Pi hidden behind everything, all housed in a picture frame.
2. Two-way film acts as a mirror on the side with more light (the room) but lets light from the darker side (the screen behind it) shine through. That's why **the web page background must be pure black** — a black pixel effectively disappears, while only bright pixels (white text, icons) punch through the acrylic and appear to float on the mirror's surface.
3. The Raspberry Pi runs Chromium in kiosk mode (full screen, no address bar, no window chrome), auto-launching as soon as it boots, showing a simple HTML page with a clock and a weather widget.

## Parts list

- A Raspberry Pi (Pi 4 recommended for smooth rendering; a Pi 3 still works)
- An old LCD monitor (strip the plastic housing, keep just the panel and its controller board)
- Two-way mirror acrylic film, sized to match the screen
- A picture frame or a custom-built wooden frame to house the whole assembly
- A microSD card, a 5V supply for the Pi, and a separate power source for the monitor

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram for a Raspberry Pi driving a monitor hidden behind two-way mirror film">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="70" width="170" height="160" rx="10" class="box" />
    <text x="115" y="155" text-anchor="middle" class="label">Raspberry Pi</text>

    <rect x="440" y="60" width="170" height="180" rx="10" class="box" />
    <text x="525" y="130" text-anchor="middle" class="label">Monitor panel</text>
    <text x="525" y="150" text-anchor="middle" class="sublabel">(behind mirror film)</text>

    <line x1="200" y1="100" x2="440" y2="100" class="wire" />
    <text x="320" y="92" text-anchor="middle" class="sublabel">HDMI → monitor video input</text>
    <circle cx="200" cy="100" r="4" class="pin" />
    <circle cx="440" cy="100" r="4" class="pin" />

    <line x1="200" y1="150" x2="440" y2="150" class="wire" />
    <text x="320" y="142" text-anchor="middle" class="sublabel">Dedicated 5V supply → Raspberry Pi</text>
    <circle cx="200" cy="150" r="4" class="pin" />
    <circle cx="440" cy="150" r="4" class="pin" />

    <line x1="200" y1="200" x2="440" y2="200" class="wire" />
    <text x="320" y="192" text-anchor="middle" class="sublabel">Separate supply → monitor controller board</text>
    <circle cx="200" cy="200" r="4" class="pin" />
    <circle cx="440" cy="200" r="4" class="pin" />
  </svg>
  <figcaption>The Pi and the monitor run on separate power supplies, linked by HDMI for video, all hidden behind the two-way mirror film.</figcaption>
</figure>

## Sample code

A full-screen HTML/CSS/JS page with a black background, showing a clock and temperature from a public weather API:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Smart Mirror</title>
<style>
  body { background: #000; color: #fff; font-family: 'Helvetica Neue', sans-serif; margin: 0; overflow: hidden; }
  #clock { font-size: 6rem; text-align: center; margin-top: 10vh; font-weight: 200; }
  #weather { text-align: center; font-size: 2rem; opacity: 0.85; }
</style>
</head>
<body>
  <div id="clock"></div>
  <div id="weather">Loading weather...</div>

<script>
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

async function updateWeather() {
  try {
    // Replace LAT/LON with the actual coordinates of the mirror's location
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&current=temperature_2m');
    const data = await res.json();
    const temp = data.current.temperature_2m;
    document.getElementById('weather').textContent = `${temp}°C`;
  } catch (err) {
    document.getElementById('weather').textContent = 'Could not load weather data';
  }
}
updateWeather();
setInterval(updateWeather, 10 * 60 * 1000); // refresh every 10 minutes
</script>
</body>
</html>
```

Auto-launch Chromium in kiosk mode on boot by creating `~/.config/autostart/mirror.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=SmartMirror
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito file:///home/pi/mirror/index.html
```

Add this to `~/.config/lxsession/LXDE-pi/autostart` to disable screen blanking and hide the mouse cursor (requires installing `unclutter`):

```
@xset s off
@xset -dpms
@xset s noblank
@unclutter -idle 0.5
```

## Common pitfalls

- **A background that isn't pure black** (a background image, or dark gray instead of true black) shows up as a faint glow on the mirror instead of disappearing — always use solid `#000` on `body`.
- **Forgetting to disable screen power management (DPMS)** lets the display turn itself off after a few minutes of no mouse/keyboard input — a smart mirror has no input device, so it will go dark if you skip this step.
- **Two-way film cuts brightness significantly** (typically 60-70%), so the panel's brightness needs to be maxed out for text to read clearly through the mirror.
- **Free weather APIs often rate-limit requests** — don't fetch too aggressively; every 10-15 minutes is a reasonable interval.

## Where to go from here

Add a PIR motion sensor so the display only lights up when someone stands in front of the mirror (saves power and extends panel life), pipe in notifications from MQTT or a home automation hub, or add a calendar/to-do widget backed by a simple JSON feed.
