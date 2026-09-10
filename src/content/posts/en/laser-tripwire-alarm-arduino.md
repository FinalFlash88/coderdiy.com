---
title: "Laser Tripwire Security Alarm with Arduino"
description: "Build a movie-style laser tripwire with a laser module and an LDR light sensor — with automatic baseline calibration on boot and debouncing to kill false alarms."
pubDate: 2026-09-28
lang: en
category: article
translationId: laser-tripwire-alarm
tags: ["arduino", "security", "sensors"]
heroEmoji: "🔺"
author: "CoderDIY"
---

A heist-movie laser tripwire is one of the most fun Arduino projects you can build: a laser beam shines continuously onto a light sensor a few meters away, and the instant someone breaks the beam, an alarm goes off. Underneath it all it's just a simple photoresistor voltage divider — but avoiding false alarms means understanding why you need baseline calibration and signal debouncing.

## How it works

1. A laser diode module is powered continuously, aiming a fixed point of light at an LDR sensor mounted across the room.
2. The LDR sits in a voltage divider; when laser light hits it, its resistance drops and the voltage read on the analog pin rises.
3. On boot, the Arduino measures and stores a "baseline" reading — the normal light level while the beam is actually hitting the sensor — over about 2 seconds.
4. In the main loop, if the reading drops well below that baseline — meaning something is blocking the beam — and stays that way continuously for at least a few hundred milliseconds, the system treats it as a real intrusion and triggers the alarm.
5. The buzzer sounds continuously until a manual reset button is pressed.

## Parts list

- Arduino Uno or Nano
- A 5V laser diode module (an always-on type, no modulation needed)
- An LDR photoresistor + a 10kΩ resistor to form a voltage divider
- An active buzzer (the kind that just needs power to sound, no frequency signal required)
- A reset push button
- A mount to keep the laser and LDR aligned — this is the hard part mechanically, not electrically

<figure class="diagram">
  <svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram for an Arduino with an LDR sensor and an alarm buzzer">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="20" width="150" height="260" rx="10" class="box" />
    <text x="105" y="155" text-anchor="middle" class="label">Arduino</text>

    <rect x="440" y="20" width="170" height="110" rx="10" class="box" />
    <text x="525" y="65" text-anchor="middle" class="label">LDR</text>
    <text x="525" y="85" text-anchor="middle" class="sublabel">(voltage divider w/ 10k)</text>

    <rect x="440" y="180" width="170" height="100" rx="10" class="box" />
    <text x="525" y="235" text-anchor="middle" class="label">Buzzer</text>

    <line x1="180" y1="40" x2="440" y2="40" class="wire" />
    <text x="310" y="32" text-anchor="middle" class="sublabel">5V -&gt; VCC</text>
    <circle cx="180" cy="40" r="4" class="pin" />
    <circle cx="440" cy="40" r="4" class="pin" />

    <line x1="180" y1="70" x2="440" y2="70" class="wire" />
    <text x="310" y="62" text-anchor="middle" class="sublabel">GND -&gt; GND</text>
    <circle cx="180" cy="70" r="4" class="pin" />
    <circle cx="440" cy="70" r="4" class="pin" />

    <line x1="180" y1="100" x2="440" y2="100" class="wire" />
    <text x="310" y="92" text-anchor="middle" class="sublabel">A0 &lt;- divider signal</text>
    <circle cx="180" cy="100" r="4" class="pin" />
    <circle cx="440" cy="100" r="4" class="pin" />

    <line x1="180" y1="200" x2="440" y2="200" class="wire" />
    <text x="310" y="192" text-anchor="middle" class="sublabel">D8 -&gt; signal</text>
    <circle cx="180" cy="200" r="4" class="pin" />
    <circle cx="440" cy="200" r="4" class="pin" />

    <line x1="180" y1="225" x2="440" y2="225" class="wire" />
    <text x="310" y="217" text-anchor="middle" class="sublabel">5V -&gt; VCC</text>
    <circle cx="180" cy="225" r="4" class="pin" />
    <circle cx="440" cy="225" r="4" class="pin" />

    <line x1="180" y1="250" x2="440" y2="250" class="wire" />
    <text x="310" y="242" text-anchor="middle" class="sublabel">GND -&gt; GND</text>
    <circle cx="180" cy="250" r="4" class="pin" />
    <circle cx="440" cy="250" r="4" class="pin" />
  </svg>
  <figcaption>The laser aims straight at a distant LDR; the Arduino watches the divider voltage and sounds the buzzer when the beam is blocked.</figcaption>
</figure>

## Sample code

```cpp
const int LDR_PIN = A0;
const int BUZZER_PIN = 8;
const int RESET_BUTTON_PIN = 2;

int baseline = 0;
const int TRIP_MARGIN = 150;        // how far the reading must drop to count as "blocked"
const unsigned long TRIP_HOLD_MS = 200; // must stay low for 200ms before it's a real alarm

unsigned long belowSince = 0;
bool alarmTriggered = false;

void calibrateBaseline() {
  long sum = 0;
  const int samples = 40;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(LDR_PIN);
    delay(50); // ~2 seconds of calibration total
  }
  baseline = sum / samples;
  Serial.print("Baseline (beam hitting sensor): ");
  Serial.println(baseline);
}

void setup() {
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, LOW);
  Serial.begin(9600);

  Serial.println("Calibrating, make sure the laser is hitting the LDR...");
  calibrateBaseline();
  Serial.println("Ready!");
}

void loop() {
  if (alarmTriggered) {
    digitalWrite(BUZZER_PIN, HIGH);
    if (digitalRead(RESET_BUTTON_PIN) == LOW) {
      alarmTriggered = false;
      digitalWrite(BUZZER_PIN, LOW);
      belowSince = 0;
    }
    return;
  }

  int reading = analogRead(LDR_PIN);
  bool beamBlocked = reading < (baseline - TRIP_MARGIN);

  if (beamBlocked) {
    if (belowSince == 0) belowSince = millis();
    if (millis() - belowSince > TRIP_HOLD_MS) {
      alarmTriggered = true;
    }
  } else {
    belowSince = 0; // beam is back to normal, reset the timer
  }

  delay(20);
}
```

## Common pitfalls

- **Using a fixed threshold instead of a dynamic baseline** — ambient light changes throughout the day, and room lights switching on or off will throw off a hardcoded threshold completely. Always calibrate the baseline right at boot, while you know for certain the laser is aimed correctly.
- **No debouncing** — a bug flying through the beam for a few dozen milliseconds is enough to dip the reading below threshold. Requiring the signal to stay low continuously for `TRIP_HOLD_MS` before counting it as a real intrusion filters out most of these false alarms.
- **Misaligned or wobbly laser/LDR mounts** — the farther the beam travels, the more a tiny vibration throws it off target. Use a sturdy mount, and for distances beyond 3-4 meters, consider a mirror to fold the beam path across multiple points.
- **Direct sunlight hitting the LDR** destabilizes the baseline — avoid placing the setup anywhere direct sunlight shifts throughout the day.

## Where to go from here

Chain multiple laser-LDR pairs at different angles to build a multi-beam trip grid, or add a SIM800L module to send a text alert the moment the alarm triggers instead of just sounding a local buzzer.
