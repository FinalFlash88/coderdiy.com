---
title: "Build a Retro Game Console with Raspberry Pi, RetroPie, and a GPIO Controller"
description: "Wire real arcade-style buttons and a joystick directly to Raspberry Pi GPIO pins and read them with a Python daemon so RetroPie sees them as keyboard input."
pubDate: 2026-09-18
lang: en
category: article
translationId: retro-game-console-pi
tags: ["raspberry-pi", "retropie", "electronics"]
heroEmoji: "🕹️"
author: "CoderDIY"
---

RetroPie works fine with an off-the-shelf USB gamepad, but the fun part is wiring a real set of arcade buttons straight into a Raspberry Pi's GPIO pins, then writing the software layer that makes the system see those presses as arrow keys and A/B buttons. This is the trickiest step in building a DIY arcade bartop or cabinet from scratch.

## How it works

1. Each button or microswitch on an arcade joystick is a simple switch wired between a GPIO pin and ground.
2. The Raspberry Pi enables an internal pull-up resistor (`pull_up_down=GPIO.PUD_UP`) on each pin, so it reads HIGH when idle and LOW when a press grounds that pin.
3. A background Python daemon continuously polls the GPIO pins, detects a falling edge (a press) after debouncing, and emits the matching keyboard event through `uinput`.
4. RetroPie/EmulationStation receives these emulated keyboard events exactly as if a real key was pressed, with no changes needed to any game configuration.

## Parts list

- A Raspberry Pi (3B+ or newer recommended for smooth emulation of later-generation systems)
- Arcade-style microswitch buttons and a joystick, 8 or more
- Female-female jumper wires or crimped spade connectors to wire buttons to GPIO
- A 16GB+ SD card flashed with RetroPie
- A cabinet enclosure or a drilled wood/acrylic panel to mount the buttons (however elaborate you want to get)

<figure class="diagram">
  <svg viewBox="0 0 640 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram of arcade buttons connected to Raspberry Pi GPIO pins">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="20" width="160" height="290" rx="10" class="box" />
    <text x="120" y="170" text-anchor="middle" class="label">Raspberry Pi</text>
    <text x="120" y="188" text-anchor="middle" class="sublabel">(GPIO header)</text>

    <rect x="440" y="30" width="160" height="60" rx="10" class="box" />
    <text x="520" y="65" text-anchor="middle" class="label">UP button</text>

    <rect x="440" y="110" width="160" height="60" rx="10" class="box" />
    <text x="520" y="145" text-anchor="middle" class="label">DOWN button</text>

    <rect x="440" y="190" width="160" height="60" rx="10" class="box" />
    <text x="520" y="225" text-anchor="middle" class="label">A button</text>

    <rect x="440" y="270" width="160" height="60" rx="10" class="box" />
    <text x="520" y="305" text-anchor="middle" class="label">B button</text>

    <line x1="200" y1="60" x2="440" y2="60" class="wire" />
    <text x="320" y="52" text-anchor="middle" class="sublabel">GPIO17 -> button pin 1</text>
    <circle cx="200" cy="60" r="4" class="pin" />
    <circle cx="440" cy="60" r="4" class="pin" />

    <line x1="200" y1="140" x2="440" y2="140" class="wire" />
    <text x="320" y="132" text-anchor="middle" class="sublabel">GPIO27 -> button pin 1</text>
    <circle cx="200" cy="140" r="4" class="pin" />
    <circle cx="440" cy="140" r="4" class="pin" />

    <line x1="200" y1="220" x2="440" y2="220" class="wire" />
    <text x="320" y="212" text-anchor="middle" class="sublabel">GPIO22 -> button pin 1</text>
    <circle cx="200" cy="220" r="4" class="pin" />
    <circle cx="440" cy="220" r="4" class="pin" />

    <line x1="200" y1="300" x2="440" y2="300" class="wire" />
    <text x="320" y="292" text-anchor="middle" class="sublabel">GPIO23 -> button pin 1</text>
    <circle cx="200" cy="300" r="4" class="pin" />
    <circle cx="440" cy="300" r="4" class="pin" />

    <text x="320" y="330" text-anchor="middle" class="sublabel">All buttons' pin 2 share a common GND on the Pi</text>
  </svg>
  <figcaption>Each arcade button wires one GPIO pin to ground — the Pi's internal pull-up makes a press read as LOW.</figcaption>
</figure>

## Sample code

```python
#!/usr/bin/env python3
import RPi.GPIO as GPIO
import time
from uinput import Device
import uinput

# Mapping: GPIO pin -> emulated keyboard key
BUTTON_MAP = {
    17: uinput.KEY_UP,
    27: uinput.KEY_DOWN,
    22: uinput.KEY_Z,     # A button -> Z key (EmulationStation's default)
    23: uinput.KEY_X,     # B button -> X key
}

DEBOUNCE_TIME = 0.03  # 30ms

GPIO.setmode(GPIO.BCM)
for pin in BUTTON_MAP:
    GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)

device = Device(list(BUTTON_MAP.values()))

previous_state = {pin: GPIO.HIGH for pin in BUTTON_MAP}

print("Listening for button presses... Press Ctrl+C to quit")

try:
    while True:
        for pin, key in BUTTON_MAP.items():
            current_state = GPIO.input(pin)

            # Falling edge: was HIGH, now LOW => button was just pressed
            if previous_state[pin] == GPIO.HIGH and current_state == GPIO.LOW:
                time.sleep(DEBOUNCE_TIME)
                if GPIO.input(pin) == GPIO.LOW:  # re-confirm after debounce
                    device.emit(key, 1)  # key down
                    print(f"GPIO{pin} button pressed")

            # Rising edge: button was just released
            if previous_state[pin] == GPIO.LOW and current_state == GPIO.HIGH:
                device.emit(key, 0)  # key up

            previous_state[pin] = current_state

        time.sleep(0.005)  # poll every 5ms, fast enough to feel instant

except KeyboardInterrupt:
    GPIO.cleanup()
```

> Install `python3-uinput` (`sudo apt install python3-uinput`) and load the `uinput` kernel module (`sudo modprobe uinput`, adding it to `/etc/modules` so it loads on boot). If you'd rather not roll your own daemon, `Adafruit-Retrogame` or `mk_arcade_joystick_rpi` do exactly this through a kernel driver instead, with no separate Python process to run.

## Common pitfalls

- **Skipping debounce on the microswitches** turns a single press into several rapid-fire presses — the `time.sleep(DEBOUNCE_TIME)` plus re-confirmation above is a simple software debounce that's plenty for typical arcade microswitches.
- **Running the Python daemon manually with `python3 script.py`** and then closing the terminal kills it — set it up as a `systemd` service so it starts automatically on boot.
- **Wiring 3.3V instead of GND** to a button pin leaves that GPIO reading a false HIGH, or in the worst case can damage the pin — always double-check with a multimeter before powering up.
- EmulationStation needs these virtual keys registered in `es_input.cfg` — use the input configuration screen in the RetroPie interface and press each real button to have it record itself automatically.

## Where to go from here

Add a rotary potentiometer or encoder as a physical volume knob, or wire up a small SPI display to show info about the running game separately from the main TV output — both build on the same GPIO-reading approach used here.
