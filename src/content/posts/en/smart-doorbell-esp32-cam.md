---
title: "Smart doorbell with ESP32-CAM: snap a photo and send it to Telegram"
description: "Use a PIR sensor and an ESP32-CAM to detect motion at the door, snap a photo automatically, and push it straight to Telegram — with sample code and the classic GPIO0 gotcha."
pubDate: 2026-09-11
lang: en
category: article
translationId: smart-doorbell-esp32cam
tags: ["esp32-cam", "telegram", "security"]
heroEmoji: "🔔"
author: "CoderDIY"
---

Commercial "smart" doorbells usually lock you into a proprietary app and the vendor's cloud. With a sub-$5 ESP32-CAM board, a PIR motion sensor, and a free, unlimited Telegram bot, you can build your own alert system that snaps a photo and pushes it straight to your phone — with all the data under your own control.

## How it works

1. A PIR sensor detects motion (a change in infrared heat) near the door.
2. The ESP32-CAM polls the PIR pin, and when it goes HIGH, it captures a JPEG frame from the camera.
3. The ESP32-CAM connects to WiFi and pushes that frame to the Telegram Bot API via an HTTPS multipart POST to your chat.
4. A cooldown window prevents flooding you with photos while someone lingers at the door.

## Parts list

- ESP32-CAM board (the AI-Thinker module is the most common)
- A USB-to-serial adapter (FTDI or CP2102) for flashing — the ESP32-CAM has no onboard USB port
- PIR motion sensor (HC-SR501)
- Jumper wires, breadboard, a solid 5V supply (camera + WiFi draw enough current that the weak 3.3V rail on most FTDI adapters isn't enough)
- A Telegram account and a bot created via @BotFather, plus your chat ID

<figure class="diagram">
  <svg viewBox="0 0 640 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram for ESP32-CAM with FTDI programmer and PIR sensor">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="230" y="120" width="180" height="120" rx="10" class="box" />
    <text x="320" y="175" text-anchor="middle" class="label">ESP32-CAM</text>
    <text x="320" y="195" text-anchor="middle" class="sublabel">(AI-Thinker)</text>

    <rect x="20" y="20" width="150" height="90" rx="10" class="box" />
    <text x="95" y="60" text-anchor="middle" class="label">FTDI USB-Serial</text>
    <text x="95" y="78" text-anchor="middle" class="sublabel">(flashing only)</text>

    <rect x="470" y="130" width="150" height="90" rx="10" class="box" />
    <text x="545" y="175" text-anchor="middle" class="label">PIR sensor</text>

    <line x1="170" y1="45" x2="230" y2="140" class="wire" />
    <text x="180" y="90" text-anchor="middle" class="sublabel">TX -> U0R</text>
    <circle cx="170" cy="45" r="4" class="pin" />
    <circle cx="230" cy="140" r="4" class="pin" />

    <line x1="170" y1="65" x2="230" y2="165" class="wire" />
    <text x="180" y="115" text-anchor="middle" class="sublabel">RX -> U0T</text>
    <circle cx="170" cy="65" r="4" class="pin" />
    <circle cx="230" cy="165" r="4" class="pin" />

    <line x1="170" y1="85" x2="230" y2="200" class="wire" />
    <text x="175" y="140" text-anchor="middle" class="sublabel">GND -> GND</text>
    <circle cx="170" cy="85" r="4" class="pin" />
    <circle cx="230" cy="200" r="4" class="pin" />

    <line x1="410" y1="150" x2="470" y2="150" class="wire" />
    <text x="440" y="142" text-anchor="middle" class="sublabel">GPIO13 -> OUT</text>
    <circle cx="410" cy="150" r="4" class="pin" />
    <circle cx="470" cy="150" r="4" class="pin" />

    <line x1="410" y1="180" x2="470" y2="180" class="wire" />
    <text x="440" y="200" text-anchor="middle" class="sublabel">5V -> VCC, GND -> GND</text>
    <circle cx="410" cy="180" r="4" class="pin" />
    <circle cx="470" cy="180" r="4" class="pin" />
  </svg>
  <figcaption>Only bridge GPIO0 to GND while flashing, then remove that wire so the board boots normally.</figcaption>
</figure>

## Sample code

```cpp
#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include "camera_pins.h" // pin definitions for the AI-Thinker model

const char* WIFI_SSID = "your_wifi_name";
const char* WIFI_PASS = "your_wifi_password";
const String BOT_TOKEN = "123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxx";
const String CHAT_ID   = "987654321";

const int PIR_PIN = 13;
unsigned long lastSent = 0;
const unsigned long COOLDOWN = 60000UL; // 60 seconds between sends

WiFiClientSecure client;

void setupCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM; config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM; config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM; config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM; config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA; // 640x480, sharp enough without being too heavy
  config.jpeg_quality = 12;
  config.fb_count = 1;
  esp_camera_init(&config);
}

void sendPhotoToTelegram() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) { Serial.println("Capture failed"); return; }

  client.setInsecure(); // skip certificate validation to keep this simple
  if (!client.connect("api.telegram.org", 443)) {
    Serial.println("Could not connect to Telegram");
    esp_camera_fb_return(fb);
    return;
  }

  String boundary = "coderdiyBoundary";
  String head = "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"chat_id\"\r\n\r\n" + CHAT_ID + "\r\n"
    "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"photo\"; filename=\"door.jpg\"\r\n"
    "Content-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";

  uint32_t contentLength = head.length() + fb->len + tail.length();

  client.printf("POST /bot%s/sendPhoto HTTP/1.1\r\n", BOT_TOKEN.c_str());
  client.println("Host: api.telegram.org");
  client.println("Content-Type: multipart/form-data; boundary=" + boundary);
  client.printf("Content-Length: %u\r\n\r\n", contentLength);
  client.print(head);
  client.write(fb->buf, fb->len);
  client.print(tail);

  esp_camera_fb_return(fb);
  Serial.println("Photo sent to Telegram");
}

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  setupCamera();

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void loop() {
  if (digitalRead(PIR_PIN) == HIGH && millis() - lastSent > COOLDOWN) {
    Serial.println("Motion detected!");
    sendPhotoToTelegram();
    lastSent = millis();
  }
}
```

> Get `BOT_TOKEN` from @BotFather after creating a new bot, and find `CHAT_ID` by messaging your bot once and then opening `https://api.telegram.org/bot<TOKEN>/getUpdates` to read the `chat.id` field.

## Common pitfalls

- **Forgetting to remove the GPIO0-to-GND wire after flashing**: the ESP32-CAM enters flashing mode when GPIO0 is tied to GND. Leave that wire in place and the board will always boot into the bootloader instead of running your program — this is the most common reason beginners think their board is dead.
- **Underpowered supply**: camera + WiFi can spike past 300mA, and the weak 3.3V rail on most FTDI adapters can't keep up, causing repeated brown-out resets. Use a separate, solid 5V supply into the board's 5V pin instead.
- **False PIR triggers** from wind, sunlight changes, or insects flying past — tune the sensitivity trimmer on the PIR module and add a 30-60 second warm-up delay after power-up before reading the pin, since the sensor needs time to stabilize.
- **Oversized `FRAMESIZE`** slows down capture and upload, which can cause connection timeouts — VGA (640x480) is a good balance of quality and speed.

## Where to go from here

Add a physical push button so visitors can "ring" on purpose instead of relying only on PIR, or save photos to the board's onboard SD card so you have a history to review even without network access. For a bigger upgrade, run lightweight face detection through Edge Impulse so you only get notified when an unfamiliar face shows up.
