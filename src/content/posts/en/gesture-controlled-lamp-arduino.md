---
title: "Gesture-Controlled Lamp with Arduino and the APDS-9960"
description: "Wave your hand up, down, left, or right to toggle and dim a lamp — no touching required, using an APDS-9960 gesture sensor and a PWM-driven MOSFET."
pubDate: 2026-09-16
lang: en
category: article
translationId: gesture-controlled-lamp
tags: ["arduino", "sensors", "home-automation"]
heroEmoji: "👋"
author: "CoderDIY"
---

A light switch is already convenient, but waving a lamp off while your hands are full is a genuinely nicer trick. This project uses the APDS-9960 gesture sensor — the same family of chip found in older phones' "swipe over the screen" detection — to recognize four wave directions and control an LED lamp's brightness over PWM.

## How it works

1. The APDS-9960 has four infrared photodiodes in its corners and detects the order in which reflected light changes as your hand passes over it, inferring a direction: UP, DOWN, LEFT, or RIGHT.
2. The Arduino reads gesture events over I2C using the `SparkFun_APDS9960` library.
3. UP/DOWN raises or lowers the lamp's brightness by a fixed step (PWM on the pin driving a MOSFET).
4. LEFT or RIGHT toggles the lamp fully on or off (turning back on restores the last saved brightness).

## Parts list

- Arduino Uno/Nano (or any 5V/3.3V board with I2C)
- APDS-9960 gesture sensor breakout (most cheap breakouts already include a 3.3V regulator and level shifting)
- N-channel MOSFET (e.g. IRLZ44N — a low gate threshold that switches reliably straight from an Arduino pin)
- 12V LED strip (or a 12V LED bulb) + a separate 12V supply
- 10kΩ pull-down resistor on the MOSFET gate
- Flyback diode (optional, protects against any inductive load)

<figure class="diagram">
  <svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram of Arduino with an APDS-9960 sensor and a MOSFET driving an LED lamp">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="100" width="150" height="120" rx="10" class="box" />
    <text x="105" y="165" text-anchor="middle" class="label">Arduino Uno</text>

    <rect x="260" y="60" width="150" height="100" rx="10" class="box" />
    <text x="335" y="115" text-anchor="middle" class="label">APDS-9960</text>

    <rect x="460" y="150" width="150" height="110" rx="10" class="box" />
    <text x="535" y="210" text-anchor="middle" class="label">MOSFET + LED lamp</text>

    <line x1="180" y1="120" x2="260" y2="90" class="wire" />
    <text x="220" y="95" text-anchor="middle" class="sublabel">A4 (SDA)</text>
    <circle cx="180" cy="120" r="4" class="pin" />
    <circle cx="260" cy="90" r="4" class="pin" />

    <line x1="180" y1="150" x2="260" y2="120" class="wire" />
    <text x="220" y="150" text-anchor="middle" class="sublabel">A5 (SCL)</text>
    <circle cx="180" cy="150" r="4" class="pin" />
    <circle cx="260" cy="120" r="4" class="pin" />

    <line x1="180" y1="180" x2="260" y2="150" class="wire" />
    <text x="220" y="200" text-anchor="middle" class="sublabel">3V3 + shared GND</text>
    <circle cx="180" cy="180" r="4" class="pin" />
    <circle cx="260" cy="150" r="4" class="pin" />

    <line x1="180" y1="210" x2="460" y2="180" class="wire" />
    <text x="330" y="255" text-anchor="middle" class="sublabel">D9 (PWM) -> MOSFET gate</text>
    <circle cx="180" cy="210" r="4" class="pin" />
    <circle cx="460" cy="180" r="4" class="pin" />
  </svg>
  <figcaption>Arduino reads gestures from the APDS-9960 over I2C, then outputs PWM to a MOSFET powering a 12V LED strip.</figcaption>
</figure>

## Sample code

```cpp
#include <Wire.h>
#include <SparkFun_APDS9960.h>

SparkFun_APDS9960 apds = SparkFun_APDS9960();

const int LED_PIN = 9;       // PWM pin wired to the MOSFET gate
const int BRIGHTNESS_STEP = 25;
const int MAX_BRIGHTNESS = 255;

int brightness = 0;
int lastBrightness = 150;    // brightness remembered when turning back on
bool lampOn = false;

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);

  if (apds.init()) {
    Serial.println("APDS-9960 initialized");
  } else {
    Serial.println("Failed to initialize APDS-9960");
  }

  if (apds.enableGestureSensor(true)) {
    Serial.println("Gesture sensor enabled");
  }
}

void applyBrightness() {
  analogWrite(LED_PIN, lampOn ? brightness : 0);
}

void loop() {
  if (apds.isGestureAvailable()) {
    int gesture = apds.readGesture();

    switch (gesture) {
      case DIR_UP:
        if (!lampOn) lampOn = true;
        brightness = min(brightness + BRIGHTNESS_STEP, MAX_BRIGHTNESS);
        lastBrightness = brightness;
        Serial.println("Brightness up");
        break;

      case DIR_DOWN:
        brightness = max(brightness - BRIGHTNESS_STEP, 0);
        lastBrightness = brightness;
        Serial.println("Brightness down");
        break;

      case DIR_LEFT:
      case DIR_RIGHT:
        lampOn = !lampOn;
        if (lampOn && brightness == 0) {
          brightness = lastBrightness > 0 ? lastBrightness : 150;
        }
        Serial.println(lampOn ? "Lamp on" : "Lamp off");
        break;

      default:
        break;
    }

    applyBrightness();
  }
}
```

> The library's default gesture thresholds can be too twitchy or too sluggish depending on your mounting distance — call `apds.setGestureGain(...)` or tune `GGAIN`/`GPTHR` in the library's config header if gestures are being missed or misfired repeatedly.

## Common pitfalls

- **Mounting the sensor near a strong light source** (ceiling light, window) floods the APDS-9960 with infrared background noise — mount it somewhere shielded from direct light, or add a small enclosure.
- **Undersized or unheatsinked MOSFET** when driving a long LED strip — check the MOSFET's continuous `Id` rating against the strip's actual current draw, and add a small heatsink above roughly 2A.
- **Skipping the gate pull-down resistor**: if the Arduino resets or loses signal, a floating gate can leave the lamp flickering or stuck full-on.
- The APDS-9960's effective wave range is only about 10-15cm — place it somewhere a hand can reach naturally, like a desk edge or under a nightstand shelf.

## Where to go from here

Swap in an ESP32 to publish lamp state over MQTT and integrate with Home Assistant, or use the same chip's NEAR/FAR proximity gesture to turn the lamp on automatically when someone approaches, without needing a wave at all.
