---
title: "A Real-Time LED Matrix Data Dashboard with ESP32 and WS2812"
description: "Turn a WS2812 LED matrix into a tiny display for weather, coin prices, or unread notification counts — updated continuously over an API, no LCD required."
pubDate: 2026-09-08
lang: en
category: article
translationId: led-matrix-dashboard
tags: ["esp32", "led", "ws2812"]
heroEmoji: "💡"
author: "CoderDIY"
---

An LCD screen gives you crisp text, but a WS2812 LED matrix has something an LCD doesn't: vivid color, a wide viewing angle, and that distinctly "electronics project" look. With a bit of code, you can turn one into a mini dashboard that always shows the data you actually care about.

## Hardware

- An ESP32 (strong enough to call an API and render the matrix smoothly)
- A WS2812B matrix panel, most commonly 8x32 or 16x16
- A dedicated 5V supply with enough current (a full 8x32 panel can draw 2-3A at full brightness — **never power the LEDs from the ESP32 board's 5V pin**)
- A large capacitor (~1000µF) between the supply and the LEDs to smooth out sudden power draw

## Basic pixel drawing

Use the `FastLED` or `Adafruit_NeoMatrix` library. Here's a simple setup:

```cpp
#include <FastLED.h>

#define LED_PIN 5
#define WIDTH 32
#define HEIGHT 8
#define NUM_LEDS (WIDTH * HEIGHT)

CRGB leds[NUM_LEDS];

int xy(int x, int y) {
  // serpentine (zig-zag) wired matrix
  if (y % 2 == 0) return y * WIDTH + x;
  return y * WIDTH + (WIDTH - 1 - x);
}

void setup() {
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(60); // don't set 255 — both blinding and current-hungry
}
```

## Fetching data over an API and displaying a number

```cpp
#include <HTTPClient.h>
#include <ArduinoJson.h>

float fetchTemperature() {
  HTTPClient http;
  http.begin("https://api.example.com/weather?city=here");
  int code = http.GET();

  float temp = -99;
  if (code == 200) {
    StaticJsonDocument<256> doc;
    deserializeJson(doc, http.getString());
    temp = doc["temp_c"];
  }
  http.end();
  return temp;
}

void loop() {
  float temp = fetchTemperature();
  drawNumber(temp, CRGB::Orange); // your own function: renders a 3x5 or 5x7 digit font into leds[]
  FastLED.show();
  delay(60000); // update once a minute, don't hammer the API
}
```

## Drawing a small digit font

On a small matrix you usually define your own bitmap font (3x5 or 5x7) as bit arrays, instead of relying on a system font:

```cpp
const uint8_t FONT_3X5[10][5] = {
  {0b111, 0b101, 0b101, 0b101, 0b111}, // 0
  {0b010, 0b110, 0b010, 0b010, 0b111}, // 1
  // ... remaining digits
};

void drawDigit(int digit, int offsetX, CRGB color) {
  for (int row = 0; row < 5; row++) {
    for (int col = 0; col < 3; col++) {
      if (FONT_3X5[digit][row] & (1 << (2 - col))) {
        leds[xy(offsetX + col, row)] = color;
      }
    }
  }
}
```

## Data ideas worth displaying

- Current weather (as in the example above)
- Unread email/notification count, with the background color shifting by "urgency"
- Coin prices or a stock index, flashing red/green depending on direction
- CI/CD status — green on a passing build, red on failure (mounted right on your desk)

## A note on current draw

This is the part most people skip: a single WS2812 LED at full white brightness can pull around 60mA. With an 8x32 matrix — 256 LEDs — the theoretical peak current is well over 15A. In practice you'll rarely light every LED white at once, but always size your power supply with at least 50% headroom over your estimate, and keep `setBrightness()` at a moderate value instead of maxing it out.
