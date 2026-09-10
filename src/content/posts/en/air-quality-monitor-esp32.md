---
title: "Air Quality Monitor with ESP32 and a PMS5003 Sensor"
description: "Read PM2.5/PM10 fine dust levels with the PMS5003 laser sensor, parse its binary UART frame, and alert when air quality crosses a safe threshold — with full frame-parsing code."
pubDate: 2026-09-26
lang: en
category: article
translationId: air-quality-monitor
tags: ["esp32", "sensors", "air-quality"]
heroEmoji: "🌫️"
author: "CoderDIY"
---

Temperature and humidity sensors are everywhere in DIY projects — measuring PM2.5, the fine particulate matter that actually affects your lungs, is a step up worth taking. The PMS5003 is an optical scattering laser sensor: it draws air through a small chamber, shines a laser into the airflow, and counts particles by size from how they scatter light. It reports PM1.0, PM2.5, and PM10 in micrograms per cubic meter over UART — accurate enough for a serious DIY build.

## How it works

1. The PMS5003 continuously samples air and automatically pushes a 32-byte frame over UART roughly once a second, with no need for the ESP32 to poll it.
2. The ESP32 listens on a UART port, looks for the two header bytes `0x42 0x4D`, then reads the remaining bytes to fill out the full 32-byte frame.
3. It sums the first 30 bytes and compares that against the 2-byte checksum at the end of the frame to make sure nothing got corrupted in transit.
4. It pulls the PM1.0, PM2.5, and PM10 "atmospheric" values out of their fixed byte offsets in the frame.
5. If PM2.5 crosses an alert threshold, it lights an LED/buzzer and pushes the reading to MQTT or a small built-in web page.

## Parts list

- ESP32 DevKit (any board with at least two usable UARTs)
- PMS5003 sensor (comes with an 8-pin JST cable in the box)
- A 5V/1A+ power supply — the internal fan in the PMS5003 draws up to roughly 100mA at peak, much more than a typical sensor, so don't share it off a weak regulator that's also feeding other modules
- An LED or small buzzer for the alert
- Breadboard, jumper wires

> On logic levels: the PMS5003's TX pin outputs around 3.3V, so it can be wired directly into the ESP32's RX pin with no voltage divider or level shifter needed. Its RX pin (fed by the ESP32's TX) also accepts 3.3V fine, since the board is designed around 3.3V MCUs to begin with. The thing to actually watch isn't logic level — it's the current draw of the 5V rail feeding the fan.

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram for connecting an ESP32 to a PMS5003 sensor over UART">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="70" width="160" height="160" rx="10" class="box" />
    <text x="120" y="155" text-anchor="middle" class="label">ESP32</text>

    <rect x="440" y="70" width="160" height="160" rx="10" class="box" />
    <text x="520" y="155" text-anchor="middle" class="label">PMS5003</text>

    <line x1="200" y1="100" x2="440" y2="100" class="wire" />
    <text x="320" y="92" text-anchor="middle" class="sublabel">5V supply -&gt; VCC</text>
    <circle cx="200" cy="100" r="4" class="pin" />
    <circle cx="440" cy="100" r="4" class="pin" />

    <line x1="200" y1="140" x2="440" y2="140" class="wire" />
    <text x="320" y="132" text-anchor="middle" class="sublabel">GND -&gt; GND</text>
    <circle cx="200" cy="140" r="4" class="pin" />
    <circle cx="440" cy="140" r="4" class="pin" />

    <line x1="200" y1="180" x2="440" y2="180" class="wire" />
    <text x="320" y="172" text-anchor="middle" class="sublabel">GPIO16 (RX2) &lt;- TX</text>
    <circle cx="200" cy="180" r="4" class="pin" />
    <circle cx="440" cy="180" r="4" class="pin" />

    <line x1="200" y1="210" x2="440" y2="210" class="wire" />
    <text x="320" y="202" text-anchor="middle" class="sublabel">GPIO17 (TX2) -&gt; RX</text>
    <circle cx="200" cy="210" r="4" class="pin" />
    <circle cx="440" cy="210" r="4" class="pin" />
  </svg>
  <figcaption>The ESP32 talks to the PMS5003 over UART2 (RX2/TX2); the 5V rail powers the fan separately.</figcaption>
</figure>

## Reading and parsing the PMS5003 frame

```cpp
#include <HardwareSerial.h>

HardwareSerial pmsSerial(2); // UART2 on the ESP32

const int RX_PIN = 16;
const int TX_PIN = 17;
const int ALERT_PIN = 26;   // alert LED/buzzer
const int PM25_THRESHOLD = 55; // ug/m3, roughly "unhealthy for sensitive groups"

struct PMSData {
  uint16_t pm1_0;
  uint16_t pm2_5;
  uint16_t pm10;
};

bool readPMSFrame(PMSData &out) {
  // Look for the 0x42 0x4D header
  if (pmsSerial.available() < 32) return false;
  if (pmsSerial.peek() != 0x42) {
    pmsSerial.read(); // discard a stray byte, slide until we hit the header
    return false;
  }

  uint8_t buf[32];
  pmsSerial.readBytes(buf, 32);

  if (buf[0] != 0x42 || buf[1] != 0x4D) return false;

  // Checksum = sum of the first 30 bytes, compared against the last 2 bytes
  uint16_t sum = 0;
  for (int i = 0; i < 30; i++) sum += buf[i];
  uint16_t checksum = (buf[30] << 8) | buf[31];
  if (sum != checksum) return false; // corrupted frame, skip it

  // "Atmospheric environment" values live at offsets 10, 12, 14
  out.pm1_0 = (buf[10] << 8) | buf[11];
  out.pm2_5 = (buf[12] << 8) | buf[13];
  out.pm10  = (buf[14] << 8) | buf[15];
  return true;
}

void setup() {
  Serial.begin(115200);
  pmsSerial.begin(9600, SERIAL_8N1, RX_PIN, TX_PIN);
  pinMode(ALERT_PIN, OUTPUT);
}

void loop() {
  PMSData data;
  if (readPMSFrame(data)) {
    Serial.printf("PM1.0=%u PM2.5=%u PM10=%u ug/m3\n", data.pm1_0, data.pm2_5, data.pm10);
    digitalWrite(ALERT_PIN, data.pm2_5 > PM25_THRESHOLD ? HIGH : LOW);
    // TODO: publish over MQTT, or update a global so a /status web page can read it
  }
}
```

If you want to publish over MQTT, add the `PubSubClient` library, connect to WiFi in `setup()`, and call `client.publish("home/air/pm25", String(data.pm2_5).c_str())` right after a successful parse. For something simpler, spin up a small `WebServer` that returns JSON `{"pm25": ..., "pm10": ...}` at a `/status` endpoint you can hit from any browser.

## Common pitfalls

- **Not waiting for a full 32 bytes in the buffer** before reading — if `Serial.available()` isn't there yet, you'll end up reading across two frames and the checksum will always fail. Always check `available() >= 32` first.
- **Skipping the header search** — UART has no concept of "packets," it's just a continuous stream of bytes. If the ESP32 boots mid-frame, the first byte it reads won't be `0x42`, so you need to slide byte-by-byte until the header lines up.
- **Mounting the sensor right next to an AC vent or in a dead-air corner** — the airflow won't represent the room, and readings will swing wildly. Mount it at roughly head height, at least 10cm from any wall.
- **Not letting the sensor warm up** — after power-on, the fan needs about 30 seconds for airflow to stabilize; discard the first few frames if you need accurate numbers.

## Where to go from here

Pair it with a CO2 sensor (like the SCD40) for a fuller picture of indoor air quality, or log hourly PM2.5 history to an SD card to chart pollution trends over the course of a day.
