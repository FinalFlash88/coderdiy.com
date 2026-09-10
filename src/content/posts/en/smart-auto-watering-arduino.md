---
title: "A Smart Auto-Watering System with Arduino"
description: "Use a soil moisture sensor, an Arduino and a relay to water your plants exactly when they need it — sample code and tips for avoiding fried relays and dead sensors."
pubDate: 2026-06-05
lang: en
category: article
translationId: smart-watering-arduino
tags: ["arduino", "sensors", "automation"]
heroEmoji: "🌱"
author: "CoderDIY"
---

Auto-watering is the second "must-try" DIY project after the weather station: cheap, easy to wire, and it solves a real problem — forgetting to water your plants while you're away.

## How it works

1. A soil moisture sensor reads an analog value.
2. The Arduino compares it against a preset threshold.
3. If the soil is dry, the Arduino switches a relay to run a mini pump for a few seconds, then turns it off.

## Parts

- Arduino Uno (or any board with an analog pin)
- A soil moisture sensor (capacitive type — more durable than resistive)
- A 1-channel relay module
- A 5V or 12V mini water pump + small tubing
- A separate power supply for the pump (don't share the Arduino's USB power)

## Sample code

```cpp
const int SOIL_PIN = A0;
const int RELAY_PIN = 7;
const int DRY_THRESHOLD = 500; // calibrate for your own sensor
const unsigned long WATER_DURATION = 4000; // 4 seconds per watering
const unsigned long CHECK_INTERVAL = 3600000UL; // check every hour

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); // most relay modules are active LOW
  Serial.begin(9600);
}

void loop() {
  int moisture = analogRead(SOIL_PIN);
  Serial.println(moisture);

  if (moisture > DRY_THRESHOLD) {
    digitalWrite(RELAY_PIN, LOW);
    delay(WATER_DURATION);
    digitalWrite(RELAY_PIN, HIGH);
  }

  delay(CHECK_INTERVAL);
}
```

> Note: `DRY_THRESHOLD` depends entirely on your specific sensor and soil — print the raw value to the Serial Monitor both when the soil is bone dry and right after watering to find the right threshold.

## Common pitfalls

- **Resistive sensors corrode** after a few weeks sitting in damp soil — prefer capacitive sensors, or only power the sensor while taking a reading.
- **Not isolating pump power from the Arduino's power** can cause noise or reset the board when the pump kicks on.
- Long `delay()` calls (like `CHECK_INTERVAL`) block the whole program — if you later add an LCD or a button, switch to a `millis()`-based timer instead.

## Where to go from here

Pair it with an ESP32 and push moisture data into Home Assistant (see the [ESP32 weather station post](/en/posts/esp32-weather-station/)) for remote monitoring, or add a small solar panel to run it independently on a balcony.
