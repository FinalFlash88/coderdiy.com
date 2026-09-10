---
title: "Build a DIY GPS Tracker with an ESP32 and a NEO-6M Module"
description: "Read and parse NMEA data from a NEO-6M GPS module using an ESP32 and the TinyGPS++ library, log coordinates over time, and serve the last known position from a small self-hosted web page."
pubDate: 2026-09-25
lang: en
category: article
tags: ["esp32", "gps", "iot"]
translationId: gps-tracker-esp32
heroEmoji: "🛰️"
author: "CoderDIY"
---

A DIY GPS tracker is handy for keeping tabs on a bike, a backpack on a trip, or just for learning how a GPS module actually works underneath the blue dot on your phone's map. With an ESP32 and a cheap NEO-6M module, you have everything needed: read coordinates, log them over time, and even serve a small web page showing the latest position.

## How it works

1. The NEO-6M module continuously streams NMEA sentences (a standardized text format) over UART, carrying latitude, longitude, time, number of satellites locked, and more.
2. The ESP32 has multiple hardware UARTs, so we use a secondary UART port (`HardwareSerial`) dedicated to the GPS, completely separate from the default `Serial` used for debugging over USB.
3. The `TinyGPS++` library consumes raw bytes off the UART, automatically parses the NMEA sentences, and exposes ready-to-use values like `gps.location.lat()` and `gps.location.lng()`.
4. The coordinates can be published periodically over MQTT to a broker, or more simply stored in a variable and served from a small web server running right on the ESP32, along with a link that opens a map at that exact position.

## Parts list

- An ESP32 DevKit (any ESP32 board with at least 2 usable UARTs)
- A NEO-6M GPS module (with a ceramic or external antenna)
- Jumper wires
- A portable power source (power bank, or a LiPo battery plus charging circuit) for mobile outdoor use
- (Optional) An external GPS antenna for better reception in areas with obstructions

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram connecting an ESP32 to a NEO-6M GPS module over UART">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="60" width="170" height="180" rx="10" class="box" />
    <text x="115" y="155" text-anchor="middle" class="label">ESP32 DevKit</text>

    <rect x="440" y="70" width="170" height="160" rx="10" class="box" />
    <text x="525" y="155" text-anchor="middle" class="label">GPS NEO-6M</text>

    <line x1="200" y1="90" x2="440" y2="90" class="wire" />
    <text x="320" y="82" text-anchor="middle" class="sublabel">5V (or 3.3V) → VCC</text>
    <circle cx="200" cy="90" r="4" class="pin" />
    <circle cx="440" cy="90" r="4" class="pin" />

    <line x1="200" y1="130" x2="440" y2="130" class="wire" />
    <text x="320" y="122" text-anchor="middle" class="sublabel">GND → GND</text>
    <circle cx="200" cy="130" r="4" class="pin" />
    <circle cx="440" cy="130" r="4" class="pin" />

    <line x1="200" y1="170" x2="440" y2="170" class="wire" />
    <text x="320" y="162" text-anchor="middle" class="sublabel">GPIO17 (TX2) → RX</text>
    <circle cx="200" cy="170" r="4" class="pin" />
    <circle cx="440" cy="170" r="4" class="pin" />

    <line x1="200" y1="210" x2="440" y2="210" class="wire" />
    <text x="320" y="202" text-anchor="middle" class="sublabel">GPIO16 (RX2) → TX</text>
    <circle cx="200" cy="210" r="4" class="pin" />
    <circle cx="440" cy="210" r="4" class="pin" />
  </svg>
  <figcaption>The GPS module connects to a secondary UART on the ESP32 (UART1), kept separate from the default debug Serial port — note that the module's TX wires to the ESP32's RX, and vice versa.</figcaption>
</figure>

## Sample code

Read and parse GPS data, printing coordinates to Serial every 30 seconds:

```cpp
#include <TinyGPS++.h>
#include <HardwareSerial.h>

HardwareSerial gpsSerial(1); // use ESP32's UART1, separate from debug Serial (UART0)
TinyGPSPlus gps;

const int RXD2 = 16; // wired to the GPS module's TX pin
const int TXD2 = 17; // wired to the GPS module's RX pin

unsigned long lastPublish = 0;
const unsigned long PUBLISH_INTERVAL = 30000; // 30 seconds

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, RXD2, TXD2);
  Serial.println("Waiting for GPS signal, needs a clear view of the sky...");
}

void loop() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  if (gps.location.isUpdated() && gps.location.isValid()) {
    double lat = gps.location.lat();
    double lon = gps.location.lng();

    if (millis() - lastPublish > PUBLISH_INTERVAL) {
      Serial.printf("Location: %.6f, %.6f | Satellites: %d | HDOP: %.1f\n",
                    lat, lon, gps.satellites.value(), gps.hdop.hdop());
      publishLocation(lat, lon);
      lastPublish = millis();
    }
  }

  // If no NMEA data has arrived after 10 seconds, TX/RX are probably swapped
  if (millis() > 10000 && gps.charsProcessed() < 10) {
    Serial.println("No GPS data seen - check the TX/RX wiring or allow more time for a cold start");
  }
}

void publishLocation(double lat, double lon) {
  // Example: publish over MQTT (requires setting up a WiFiClient + PubSubClient beforehand)
  // String payload = String(lat, 6) + "," + String(lon, 6);
  // mqttClient.publish("tracker/location", payload.c_str());
}
```

If you'd rather check the latest position from a browser instead of MQTT, add a small web server that returns an HTML page with a link that opens a map at the coordinates (using any generic public map service, no paid API required):

```cpp
#include <WebServer.h>
WebServer server(80);
double lastLat = 0, lastLon = 0;

void handleRoot() {
  String html = "<html><body><h1>Current location</h1>";
  html += "<p>" + String(lastLat, 6) + ", " + String(lastLon, 6) + "</p>";
  html += "<a href='https://www.openstreetmap.org/?mlat=" + String(lastLat, 6) +
          "&mlon=" + String(lastLon, 6) + "#map=16/" + String(lastLat, 6) +
          "/" + String(lastLon, 6) + "' target='_blank'>View on map</a></body></html>";
  server.send(200, "text/html", html);
}
```

## Common pitfalls

- **The first fix (cold start) can take 1-5 minutes** — the GPS module needs to download almanac data from the satellites, which only happens reliably with a clear view of the sky. Near a window indoors might work; deep inside a concrete building almost never will.
- **Crossed TX/RX wiring**: the module's TX pin must connect to the ESP32's RX (receive) pin and vice versa — wiring them straight-through is the most common reason nothing gets read.
- **The NEO-6M's default baud rate is 9600** — if you reconfigure the module to a different baud rate (some versions support this), remember to update `gpsSerial.begin()` to match.
- **An unstable power supply** can cause the module to hang or reset when the ESP32's WiFi radio draws a current spike — use a 5V supply rated for at least 500mA, and avoid underpowered computer USB ports.

## Where to go from here

Log the full track to an SD card or SPIFFS so the route can be reviewed after a trip, add geofencing alerts for when the device leaves a defined area, put the ESP32 into deep sleep between readings to stretch battery life, or pair it with a LoRa module to transmit location over long range without WiFi.
