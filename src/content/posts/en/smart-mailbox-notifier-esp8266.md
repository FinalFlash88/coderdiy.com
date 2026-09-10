---
title: "Smart Mailbox Notifier: Get Alerted the Moment Mail Arrives with an ESP8266"
description: "A reed switch and ESP8266 deep sleep detect when mail arrives and push an instant notification, running for months on a single battery."
pubDate: 2026-09-17
lang: en
category: article
translationId: smart-mailbox-notifier
tags: ["esp8266", "notifications", "iot"]
heroEmoji: "📬"
author: "CoderDIY"
---

Mailboxes tend to sit far from any outlet, and the flap might only open once or twice a day — exactly the kind of problem ESP8266 deep sleep exists for. This project mounts a reed switch on the mailbox flap, keeps the ESP8266 asleep almost all the time, and wakes it only the instant the flap opens to fire off a notification.

## How it works

1. A small magnet sits on the mailbox flap and a reed switch sits on the box body — when the flap opens, the magnet moves away and the reed switch changes state (open/closed circuit).
2. The ESP8266 spends nearly all its time in deep sleep to conserve battery.
3. The reed switch's state change pulls the RST pin low, waking the ESP8266.
4. The ESP8266 wakes, connects to WiFi, sends an HTTP POST request to a notification service, then goes right back to deep sleep.

## Parts list

- A battery-capable ESP8266 module (e.g. Wemos D1 Mini — ideally a variant with an onboard Li-ion charging circuit)
- Normally-open reed switch + small magnet
- 18650 Li-ion cell, or 2-3 AA cells through a 3.3V boost converter, depending on your power design
- 10kΩ pull-up resistor for the reed switch pin
- A sealed, weatherproof enclosure for the electronics (outdoor mailboxes catch rain splash)

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram of an ESP8266 with a reed switch and RST wake-up circuit">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="90" width="160" height="120" rx="10" class="box" />
    <text x="120" y="155" text-anchor="middle" class="label">ESP8266 (Wemos D1 Mini)</text>

    <rect x="440" y="100" width="160" height="100" rx="10" class="box" />
    <text x="520" y="150" text-anchor="middle" class="label">Reed switch</text>
    <text x="520" y="168" text-anchor="middle" class="sublabel">(magnet mounted on flap)</text>

    <line x1="200" y1="120" x2="440" y2="120" class="wire" />
    <text x="320" y="112" text-anchor="middle" class="sublabel">GPIO16 -> RST (jumper wire)</text>
    <circle cx="200" cy="120" r="4" class="pin" />
    <circle cx="440" cy="120" r="4" class="pin" />

    <line x1="200" y1="150" x2="440" y2="150" class="wire" />
    <text x="320" y="142" text-anchor="middle" class="sublabel">RST -> reed switch pin 1</text>
    <circle cx="200" cy="150" r="4" class="pin" />
    <circle cx="440" cy="150" r="4" class="pin" />

    <line x1="200" y1="180" x2="440" y2="180" class="wire" />
    <text x="320" y="172" text-anchor="middle" class="sublabel">GND -> reed switch pin 2</text>
    <circle cx="200" cy="180" r="4" class="pin" />
    <circle cx="440" cy="180" r="4" class="pin" />
  </svg>
  <figcaption>The ESP8266 uses its RST pin to wake from deep sleep when the reed switch changes state as the mailbox flap opens.</figcaption>
</figure>

## Sample code

```cpp
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>

const char* WIFI_SSID = "your-wifi-name";
const char* WIFI_PASS = "your-wifi-password";
const char* NOTIFY_URL = "https://ntfy.sh/my-mailbox"; // or your own webhook endpoint

void sendNotification() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startTime < 15000) {
    delay(200);
  }

  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure(); // demo only: skips TLS verification, don't use where security matters
    HTTPClient http;

    if (http.begin(client, NOTIFY_URL)) {
      http.addHeader("Title", "New mail has arrived!");
      int responseCode = http.POST("Mailbox flap opened at " + String(millis()));
      Serial.printf("Notification sent, response code: %d\n", responseCode);
      http.end();
    }
  } else {
    Serial.println("Could not connect to WiFi, skipping this cycle");
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("Woke from deep sleep - mailbox flap just opened");

  sendNotification();

  // Go back into indefinite deep sleep until RST is pulled low again
  ESP.deepSleep(0);
}

void loop() {
  // Never reached - setup() already handled everything and entered deep sleep
}
```

> The most important hardware quirk here: on the ESP8266, waking from deep sleep via an external signal requires a jumper wire between GPIO16 and RST. When the reed switch pulls RST low, the board actually resets and re-runs `setup()` — this is effectively "wake on reset," not a conventional GPIO interrupt. If your project needs more flexible wake behavior (multiple pins, RAM state preserved across wake), the ESP32 supports `esp_sleep_enable_ext0_wakeup()`/`ext1_wakeup()` far more cleanly and is worth considering if the RST jumper trick on the ESP8266 feels too fragile.

## Common pitfalls

- **Long `delay()` calls while waiting on WiFi** drain the battery fast — if the mailbox location has slow WiFi association, consider caching the IP/channel with `WiFi.begin(ssid, pass, channel, bssid, true)` to shorten the scan time.
- **No mechanical debouncing on the reed switch** — wind or vibration from passing traffic can jostle the flap and trigger a false wake; mount the magnet and switch firmly and make sure the flap isn't loose.
- **Skipping weatherproofing** — an outdoor mailbox takes rain splash and daily humidity swings, so use at least an IP54-rated enclosure and seal cable entry points with silicone.
- Li-ion cells deep-discharged over months of sleep cycles degrade faster — pick a module with a built-in battery protection circuit.

## Where to go from here

Add a small weight sensor to tell apart "flap opened to take mail out" from "flap opened because mail arrived," or add a light sensor to flag when the mailbox is opened at night — a signal worth extra attention.
