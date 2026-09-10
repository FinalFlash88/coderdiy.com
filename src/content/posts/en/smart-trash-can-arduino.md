---
title: "Touch-Free Smart Trash Can with Arduino"
description: "Use an HC-SR04 ultrasonic sensor to detect an approaching hand and a servo to auto-open the lid — touch-free, with a state machine that keeps the servo from jittering."
pubDate: 2026-09-27
lang: en
category: article
translationId: smart-trash-can
tags: ["arduino", "sensors", "automation"]
heroEmoji: "🗑️"
author: "CoderDIY"
---

A self-opening trash can lid is a small project with a big "wow factor" — you wave your hand near it, the lid pops open, and you never touch anything. It's also a genuinely useful lesson in handling noisy distance readings and keeping a servo from jittering on flaky input — a pattern you'll run into again in plenty of other robotics projects.

## How it works

1. The HC-SR04 sends out an ultrasonic pulse and times how long it takes the echo to bounce back, which gives a distance reading.
2. If that distance drops below a threshold (say, 15cm), the Arduino treats it as "something's near."
3. A four-state state machine (`IDLE -> OPENING -> OPEN -> CLOSING`) drives the servo, so the lid doesn't flap open and shut every time the sensor hiccups on a noisy reading.
4. Once open, the lid holds for a few seconds; if nothing is detected continuously during that window, it moves on to closing.

## Parts list

- Arduino Uno or Nano
- HC-SR04 ultrasonic distance sensor
- SG90 servo (or a bigger servo if the lid is heavy, with an external supply)
- A trash can with a lid that can be lifted by a simple lever mechanism
- A separate 5V supply for the servo if you're using a beefier one (a servo's startup current draw can brown out and reset the Arduino if they share a USB power source)

<figure class="diagram">
  <svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram for an Arduino with an HC-SR04 sensor and a servo">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="20" width="150" height="260" rx="10" class="box" />
    <text x="105" y="155" text-anchor="middle" class="label">Arduino</text>

    <rect x="440" y="20" width="170" height="120" rx="10" class="box" />
    <text x="525" y="85" text-anchor="middle" class="label">HC-SR04</text>

    <rect x="440" y="180" width="170" height="100" rx="10" class="box" />
    <text x="525" y="235" text-anchor="middle" class="label">SG90 Servo</text>

    <line x1="180" y1="40" x2="440" y2="40" class="wire" />
    <text x="310" y="32" text-anchor="middle" class="sublabel">5V -&gt; VCC</text>
    <circle cx="180" cy="40" r="4" class="pin" />
    <circle cx="440" cy="40" r="4" class="pin" />

    <line x1="180" y1="65" x2="440" y2="65" class="wire" />
    <text x="310" y="57" text-anchor="middle" class="sublabel">GND -&gt; GND</text>
    <circle cx="180" cy="65" r="4" class="pin" />
    <circle cx="440" cy="65" r="4" class="pin" />

    <line x1="180" y1="90" x2="440" y2="90" class="wire" />
    <text x="310" y="82" text-anchor="middle" class="sublabel">D9 -&gt; Trig</text>
    <circle cx="180" cy="90" r="4" class="pin" />
    <circle cx="440" cy="90" r="4" class="pin" />

    <line x1="180" y1="115" x2="440" y2="115" class="wire" />
    <text x="310" y="107" text-anchor="middle" class="sublabel">D10 &lt;- Echo</text>
    <circle cx="180" cy="115" r="4" class="pin" />
    <circle cx="440" cy="115" r="4" class="pin" />

    <line x1="180" y1="200" x2="440" y2="200" class="wire" />
    <text x="310" y="192" text-anchor="middle" class="sublabel">D6 -&gt; Signal</text>
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
  <figcaption>The HC-SR04 detects distance, and the Arduino drives the servo open/closed through a state machine.</figcaption>
</figure>

## Sample code

```cpp
#include <Servo.h>

const int TRIG_PIN = 9;
const int ECHO_PIN = 10;
const int SERVO_PIN = 6;

const int OPEN_DISTANCE_CM = 15;   // below this distance, treat something as "near"
const int SERVO_CLOSED_ANGLE = 0;
const int SERVO_OPEN_ANGLE = 90;
const unsigned long OPEN_HOLD_MS = 3000; // hold open for at least 3 seconds
const unsigned long DEBOUNCE_MS = 300;   // must stay clear for 300ms before switching state

Servo lidServo;

enum State { IDLE, OPENING, OPEN, CLOSING };
State state = IDLE;
unsigned long stateEnteredAt = 0;
unsigned long lastDetectedAt = 0;

long readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout ~ 5m range
  if (duration == 0) return 999; // no echo, treat as "far away"
  return duration * 0.034 / 2;   // cm
}

void setState(State s) {
  state = s;
  stateEnteredAt = millis();
}

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  lidServo.attach(SERVO_PIN);
  lidServo.write(SERVO_CLOSED_ANGLE);
  Serial.begin(9600);
}

void loop() {
  long distance = readDistanceCm();
  bool objectNear = distance < OPEN_DISTANCE_CM;
  if (objectNear) lastDetectedAt = millis();

  switch (state) {
    case IDLE:
      if (objectNear) setState(OPENING);
      break;

    case OPENING:
      lidServo.write(SERVO_OPEN_ANGLE);
      setState(OPEN);
      break;

    case OPEN:
      // only move to closing once the minimum hold time has passed
      // AND nothing has been detected within the last DEBOUNCE_MS
      if (millis() - stateEnteredAt > OPEN_HOLD_MS &&
          millis() - lastDetectedAt > DEBOUNCE_MS) {
        setState(CLOSING);
      }
      break;

    case CLOSING:
      lidServo.write(SERVO_CLOSED_ANGLE);
      setState(IDLE);
      break;
  }

  delay(50); // ~20 samples/sec, smooth enough without making the servo twitchy
}
```

## Common pitfalls

- **Calling `pulseIn()` without a timeout** — if nothing is in range to reflect the pulse, the call can hang the whole sketch waiting indefinitely. Always pass the third timeout argument like the code above does.
- **No debounce for fast-moving objects** — if you decide to close the lid based on a single reading, a hand or bag brushing past momentarily will make the lid flap open and shut. The state machine above only closes after `DEBOUNCE_MS` of no detection.
- **Sharing one USB power source between the Arduino and a heavier-duty servo** — the servo's inrush current can brown out and reset the Arduino mid-motion. For anything bigger than an SG90, give the servo its own 5V supply and tie the grounds together.
- **Mounting the sensor too low**, at trash level instead of hand level — it'll end up triggering on the garbage already inside the can. Aim the HC-SR04 outward, at roughly the height a hand would reach.

## Where to go from here

Add a load cell under the base to warn when the can is nearly full, or wire in an ESP32 to send a Telegram notification when it's time to take the trash out.
