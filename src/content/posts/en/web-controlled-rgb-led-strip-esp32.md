---
title: "Web-Controlled RGB LED Strip with ESP32"
description: "Have an ESP32 host its own color-picker web page for a WS2812/NeoPixel strip — no app, no cloud account, just open a browser on the local network."
pubDate: 2026-09-30
lang: en
category: article
translationId: web-controlled-led-strip
tags: ["esp32", "led", "web"]
heroEmoji: "🌈"
author: "CoderDIY"
---

Phone-app-controlled RGB LEDs are everywhere in stores, but most of them force you to create an account, install a bloated app, and sometimes depend on the vendor's servers being up somewhere far away. This project does the same thing entirely locally: the ESP32 runs its own small web server, serves an HTML color-picker page, and you control a WS2812 LED strip straight from your phone or laptop's browser — nothing to install, no internet required, just the same WiFi network.

## How it works

1. The ESP32 connects to WiFi and runs a `WebServer` listening on port 80.
2. When you visit the ESP32's IP address, the server returns an HTML page with a built-in color picker and a couple of effect buttons.
3. The page calls an endpoint like `/set?r=255&g=0&b=0` (or posts JSON) every time the user picks a new color.
4. The ESP32 receives the request, parses the parameters, and updates the color across the entire LED strip using the `FastLED` library.
5. For animated effects (like a rainbow cycle), a state flag is set so `loop()` keeps updating the color continuously over time instead of setting one static color.

## Parts list

- ESP32 DevKit
- WS2812B / NeoPixel LED strip (start with 30-60 LEDs to keep power requirements manageable)
- A separate 5V power supply with enough current for the strip — each LED can draw up to 60mA at full white brightness, so a 60-LED strip needs close to 3.5A at full white
- A 1000µF capacitor across 5V and GND right at the start of the strip to smooth out sudden voltage dips
- A 300-500Ω resistor in series on the data line (optional but recommended — it protects the first LED)

> On logic levels: WS2812 is designed around a 5V data signal, while the ESP32's GPIO only outputs 3.3V. For short strips (roughly under 1-2 meters, few LEDs), a 3.3V signal is usually still recognized correctly, especially with a short data wire and a healthy 5V supply. But to be safe — especially on longer strips or if you see the first LED flickering or showing the wrong color — use a level shifter like a 74HCT245, or the simpler trick of putting a regular diode (1N4148) in series on the 5V line feeding the strip, which pulls the "high" threshold the LEDs expect down closer to 3.3V.

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram for an ESP32 with a WS2812 LED strip">
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
    <text x="520" y="155" text-anchor="middle" class="label">WS2812 strip</text>

    <line x1="200" y1="100" x2="440" y2="100" class="wire" />
    <text x="320" y="92" text-anchor="middle" class="sublabel">Separate 5V -&gt; VCC</text>
    <circle cx="200" cy="100" r="4" class="pin" />
    <circle cx="440" cy="100" r="4" class="pin" />

    <line x1="200" y1="150" x2="440" y2="150" class="wire" />
    <text x="320" y="142" text-anchor="middle" class="sublabel">GND (shared) -&gt; GND</text>
    <circle cx="200" cy="150" r="4" class="pin" />
    <circle cx="440" cy="150" r="4" class="pin" />

    <line x1="200" y1="200" x2="440" y2="200" class="wire" />
    <text x="320" y="192" text-anchor="middle" class="sublabel">GPIO5 -&gt; DIN (via 330 ohm)</text>
    <circle cx="200" cy="200" r="4" class="pin" />
    <circle cx="440" cy="200" r="4" class="pin" />
  </svg>
  <figcaption>The ESP32 only drives the data line; the strip needs its own 5V supply, with GND tied common to the ESP32.</figcaption>
</figure>

## Sample code

```cpp
#include <WiFi.h>
#include <WebServer.h>
#include <FastLED.h>

#define LED_PIN     5
#define NUM_LEDS    60
CRGB leds[NUM_LEDS];

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

WebServer server(80);

enum Mode { SOLID, RAINBOW };
Mode currentMode = SOLID;
uint8_t rainbowHue = 0;

const char PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:2em;">
<h2>LED Strip Control</h2>
<input type="color" id="picker" value="#ff0000" style="width:100px;height:60px;">
<br><br>
<button onclick="setSolid()">Apply color</button>
<button onclick="setRainbow()">Rainbow effect</button>
<script>
function setSolid() {
  const hex = document.getElementById('picker').value;
  const r = parseInt(hex.substr(1,2), 16);
  const g = parseInt(hex.substr(3,2), 16);
  const b = parseInt(hex.substr(5,2), 16);
  fetch(`/set?r=${r}&g=${g}&b=${b}`);
}
function setRainbow() { fetch('/rainbow'); }
</script>
</body></html>
)rawliteral";

void handleRoot() {
  server.send(200, "text/html", PAGE);
}

void handleSet() {
  if (server.hasArg("r") && server.hasArg("g") && server.hasArg("b")) {
    int r = server.arg("r").toInt();
    int g = server.arg("g").toInt();
    int b = server.arg("b").toInt();
    currentMode = SOLID;
    fill_solid(leds, NUM_LEDS, CRGB(r, g, b));
    FastLED.show();
  }
  server.send(200, "text/plain", "OK");
}

void handleRainbow() {
  currentMode = RAINBOW;
  server.send(200, "text/plain", "OK");
}

void setup() {
  Serial.begin(115200);
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(120); // cap brightness to keep power draw in check

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println(WiFi.localIP());

  server.on("/", handleRoot);
  server.on("/set", handleSet);
  server.on("/rainbow", handleRainbow);
  server.begin();
}

void loop() {
  server.handleClient();

  if (currentMode == RAINBOW) {
    fill_rainbow(leds, NUM_LEDS, rainbowHue, 255 / NUM_LEDS);
    FastLED.show();
    rainbowHue++;
    delay(20); // controls how fast the effect animates
  }
}
```

## Common pitfalls

- **Not giving the LED strip its own power supply** — pulling 5V from the ESP32's programming USB port is only enough for a handful of dim LEDs; anything past 10-15 LEDs at higher brightness will sag the voltage, causing flicker or wrong colors.
- **Forgetting to tie GND together** between the ESP32 and the strip's power supply — this is an extremely common mistake, and the data signal is meaningless if both sides don't share a common 0V reference.
- **Calling `FastLED.show()` too aggressively inside the main loop** while the server is also handling requests — throttle animated effect updates with `delay()` or a `millis()` check instead of updating every single loop iteration.
- **Not capping `setBrightness()`** — running a long strip at 100% brightness easily exceeds what the power supply can deliver; an unusually hot strip is a sign to either dim it or upgrade the supply.

## Where to go from here

Add a "breathing" effect by modulating brightness with a sine function, or save the last-used color to the ESP32's `Preferences` storage so the strip automatically restores it after a power loss.
