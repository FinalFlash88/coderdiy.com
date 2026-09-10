---
title: "Automated Pet Feeder with ESP32, a Servo, and an RTC Module"
description: "Feed on schedule using an RTC module that doesn't depend on WiFi, plus a browser button on your phone for an extra feeding anytime."
pubDate: 2026-09-19
lang: en
category: article
translationId: automated-pet-feeder
tags: ["esp32", "servo", "automation"]
heroEmoji: "🐾"
author: "CoderDIY"
---

Traveling for a few days while worrying whether your cat or dog is getting fed on time is a familiar kind of anxiety. This automated feeder uses a servo to rotate a food-dispensing wheel, a DS3231 RTC module to keep accurate time even without WiFi, and a small web server running right on the ESP32 so you can tap "feed now" from your phone.

## How it works

1. The ESP32 checks the current time from a DS3231 RTC module (independent of any Internet/NTP connection, since the RTC has its own coin-cell battery to keep time through power loss).
2. At each scheduled time (say, 7am and 6pm), the ESP32 drives the servo through a fixed angle to open the dispensing wheel, dropping one portion of food into the bowl.
3. Alongside that, the ESP32 runs a small web server with a `/feed-now` endpoint — just open a phone browser to the ESP32's IP address and tap the button to trigger an extra feeding immediately.

## Parts list

- ESP32 DevKit
- SG90 or MG90S servo (MG90S holds up better if the dispensing wheel carries a heavier load)
- DS3231 RTC module (far more accurate than a DS1307, with built-in temperature compensation)
- A food hopper (3D-printed, or repurposed from a cut plastic bottle/container) connected to a notched dispensing wheel that scoops a portion of food per rotation
- A stable 5V supply for the servo (avoid sharing the ESP32's 5V pin if the servo causes a startup surge; a 470-1000µF buffer capacitor can help if needed)

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram of an ESP32 with a feeding servo and a DS3231 RTC module">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="90" width="160" height="120" rx="10" class="box" />
    <text x="120" y="155" text-anchor="middle" class="label">ESP32 DevKit</text>

    <rect x="440" y="30" width="160" height="90" rx="10" class="box" />
    <text x="520" y="80" text-anchor="middle" class="label">Servo (dispenser wheel)</text>

    <rect x="440" y="150" width="160" height="90" rx="10" class="box" />
    <text x="520" y="200" text-anchor="middle" class="label">DS3231 RTC</text>

    <line x1="200" y1="120" x2="440" y2="70" class="wire" />
    <text x="330" y="80" text-anchor="middle" class="sublabel">GPIO18 (PWM) -> servo signal</text>
    <circle cx="200" cy="120" r="4" class="pin" />
    <circle cx="440" cy="70" r="4" class="pin" />

    <line x1="200" y1="150" x2="440" y2="180" class="wire" />
    <text x="330" y="195" text-anchor="middle" class="sublabel">GPIO21 (SDA) -> SDA</text>
    <circle cx="200" cy="150" r="4" class="pin" />
    <circle cx="440" cy="180" r="4" class="pin" />

    <line x1="200" y1="180" x2="440" y2="210" class="wire" />
    <text x="330" y="228" text-anchor="middle" class="sublabel">GPIO22 (SCL) -> SCL</text>
    <circle cx="200" cy="180" r="4" class="pin" />
    <circle cx="440" cy="210" r="4" class="pin" />
  </svg>
  <figcaption>The ESP32 drives the servo to open the dispensing wheel on a schedule read from the DS3231 RTC over I2C.</figcaption>
</figure>

## Sample code

```cpp
#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <RTClib.h>

const char* WIFI_SSID = "your-wifi-name";
const char* WIFI_PASS = "your-wifi-password";

Servo feederServo;
RTC_DS3231 rtc;
WebServer server(80);

const int SERVO_PIN = 18;
const int FEED_HOURS[] = {7, 18};   // 7am and 6pm
const int FEED_MINUTE = 0;
int lastFedDay[2] = {-1, -1};       // tracks the day already fed to avoid double-triggering within the same minute

void rotateFeederServo() {
  feederServo.write(90);   // open position, rotating 90 degrees
  delay(700);              // enough time for the wheel to rotate and drop food
  feederServo.write(0);    // back to closed position
  Serial.println("Fed!");
}

void handleFeedNow() {
  rotateFeederServo();
  server.send(200, "text/plain", "Fed on demand!");
}

void handleRoot() {
  DateTime now = rtc.now();
  String html = "<html><body style='font-family:sans-serif'>";
  html += "<h2>Automated Pet Feeder</h2>";
  html += "<p>Current time: " + String(now.hour()) + ":" + String(now.minute()) + "</p>";
  html += "<button onclick=\"fetch('/feed-now')\">Feed now</button>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void setup() {
  Serial.begin(115200);
  feederServo.attach(SERVO_PIN);
  feederServo.write(0);

  Wire.begin();
  if (!rtc.begin()) {
    Serial.println("Could not find RTC module!");
  }

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nIP address: " + WiFi.localIP().toString());

  server.on("/", handleRoot);
  server.on("/feed-now", handleFeedNow);
  server.begin();
}

void loop() {
  server.handleClient();

  DateTime now = rtc.now();
  for (int i = 0; i < 2; i++) {
    if (now.hour() == FEED_HOURS[i] && now.minute() == FEED_MINUTE && lastFedDay[i] != now.day()) {
      rotateFeederServo();
      lastFedDay[i] = now.day(); // mark today as fed for this slot, prevents repeating
    }
  }

  delay(1000); // checking once a second is plenty, no need to poll continuously
}
```

> The servo angle (90 degrees in the example) and hold time (700ms) both need tuning to your specific dispensing wheel design — 3D-print a few wheel variants with different notch sizes to find the portion size you actually want per rotation.

## Common pitfalls

- **Using NTP/WiFi for timekeeping instead of the RTC** sounds simpler but leaves the feeder completely lost on time if the router happens to reboot at the wrong moment — a DS3231 with its own CR2032 battery keeps accurate time through power loss or dropped WiFi.
- **Sharing servo power with the ESP32** can cause a voltage sag when the servo starts moving, resetting the board — use a separate 5V supply with a shared ground between the two.
- **Skipping duplicate-feed protection**: without tracking `lastFedDay`, the servo can trigger repeatedly within the same minute since the loop runs far faster than 60 seconds.
- An open hopper absorbs moisture, clumping the food and jamming the wheel — use a sealed lid and store it somewhere dry.

## Where to go from here

Add a weight sensor under the food bowl to confirm the pet actually ate (not just that food landed in the bowl), or attach an ESP32-CAM to snap a confirmation photo of every feeding and push it through a messaging app.
