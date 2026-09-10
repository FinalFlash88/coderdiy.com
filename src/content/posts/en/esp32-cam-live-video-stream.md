---
title: "Live Video Streaming to a Browser with ESP32-CAM"
description: "Stream live MJPEG video straight from an ESP32-CAM to any browser on the local network, viewable from a phone or laptop with zero apps — with the core streaming handler code."
pubDate: 2026-09-29
lang: en
category: article
translationId: esp32cam-live-stream
tags: ["esp32-cam", "streaming", "networking"]
heroEmoji: "📹"
author: "CoderDIY"
---

One of the neatest things about the ESP32-CAM is that you can turn it into a mini IP camera with just a few dozen lines of code — no dedicated app, no cloud account, just open a browser and type in an IP address. This article focuses on the MJPEG streaming mechanism: how it works, and the minimal code needed to get a smooth stream running over your local WiFi.

## ESP32-CAM and a flashing note

If this is your first ESP32-CAM project, there's one thing worth repeating: the board has no built-in USB port, so you need an FTDI USB-to-serial adapter to flash it — wire `U0R`/`U0T` to the FTDI's TX/RX (crossed), match up `5V`/`GND`, and **pull `IO0` to `GND`** before pressing reset to enter flashing mode. After flashing, disconnect `IO0` from GND and reset again so the board runs your sketch normally. Forgetting the `IO0` step is the single most common reason flashing keeps failing.

## How MJPEG streaming works

MJPEG (Motion JPEG) isn't real compressed video — it's just a continuous sequence of separate JPEG images sent one after another. The trick is an HTTP response type called `multipart/x-mixed-replace`: the server keeps the connection open and keeps pushing new parts, each one a JPEG image separated by a boundary marker. The browser recognizes this content type and automatically swaps in the latest image — meaning all you need on the client side is a plain `<img src="http://<ip>/stream">` tag, no JavaScript, no WebRTC, no plugins.

<figure class="diagram">
  <svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flow diagram of MJPEG streaming from an ESP32-CAM to a browser">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 12px; fill: var(--color-ink); }
      .arrow { stroke: var(--color-accent); stroke-width: 2; marker-end: url(#arrowhead-stream); fill: none; }
    </style>
    <defs>
      <marker id="arrowhead-stream" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--color-accent)" />
      </marker>
    </defs>

    <rect x="10" y="90" width="140" height="70" rx="10" class="box" />
    <text x="80" y="120" text-anchor="middle" class="label">OV2640 camera</text>
    <text x="80" y="138" text-anchor="middle" class="label">captures frame</text>

    <rect x="180" y="90" width="140" height="70" rx="10" class="box" />
    <text x="250" y="120" text-anchor="middle" class="label">Encode as</text>
    <text x="250" y="138" text-anchor="middle" class="label">JPEG</text>

    <rect x="350" y="90" width="140" height="70" rx="10" class="box" />
    <text x="420" y="120" text-anchor="middle" class="label">Send over</text>
    <text x="420" y="138" text-anchor="middle" class="label">HTTP multipart</text>

    <rect x="520" y="90" width="110" height="70" rx="10" class="box" />
    <text x="575" y="120" text-anchor="middle" class="label">Browser</text>
    <text x="575" y="138" text-anchor="middle" class="label">&lt;img&gt; tag</text>

    <line x1="150" y1="125" x2="180" y2="125" class="arrow" />
    <line x1="320" y1="125" x2="350" y2="125" class="arrow" />
    <line x1="490" y1="125" x2="520" y2="125" class="arrow" />
  </svg>
  <figcaption>Each frame goes through 4 steps, repeated continuously many times a second to create the feel of live video.</figcaption>
</figure>

## Core streaming code

```cpp
#include "esp_camera.h"
#include <WiFi.h>

// Camera pin configuration for the AI-Thinker ESP32-CAM board
#define PWDN_GPIO_NUM  32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM   0
#define SIOD_GPIO_NUM  26
#define SIOC_GPIO_NUM  27
#define Y9_GPIO_NUM    35
#define Y8_GPIO_NUM    34
#define Y7_GPIO_NUM    39
#define Y6_GPIO_NUM    36
#define Y5_GPIO_NUM    21
#define Y4_GPIO_NUM    19
#define Y3_GPIO_NUM    18
#define Y2_GPIO_NUM     5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM  23
#define PCLK_GPIO_NUM  22

#include <WebServer.h>
WebServer server(80);

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

void handleStream() {
  WiFiClient client = server.client();
  String boundary = "frame";
  String header = "HTTP/1.1 200 OK\r\n";
  header += "Content-Type: multipart/x-mixed-replace; boundary=" + boundary + "\r\n\r\n";
  client.print(header);

  while (client.connected()) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) continue;

    client.printf("--%s\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n",
                  boundary.c_str(), fb->len);
    client.write(fb->buf, fb->len);
    client.print("\r\n");

    esp_camera_fb_return(fb);

    if (!client.connected()) break;
  }
}

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
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Resolution and quality directly determine frame rate over WiFi.
  // FRAMESIZE_VGA (640x480) with quality 12 is a solid balance for a local network.
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 12; // lower number = higher quality = bigger frames
  config.fb_count = 2;      // double buffering makes the stream smoother

  esp_camera_init(&config);
}

void setup() {
  Serial.begin(115200);
  setupCamera();

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println(WiFi.localIP());

  server.on("/stream", HTTP_GET, handleStream);
  server.begin();
}

void loop() {
  server.handleClient();
}
```

The viewer page can be this simple — save it as a file and open it in any browser on the same network:

```html
<!DOCTYPE html>
<html>
  <body style="margin:0;background:#111;">
    <img src="http://192.168.1.50/stream" style="width:100%;display:block;" />
  </body>
</html>
```

## Common pitfalls

- **Choosing too high a resolution** (like UXGA at 1600x1200) makes each frame too heavy for WiFi to keep up with, causing serious lag and stutter. Start with VGA or lower and only go higher when you genuinely need the detail.
- **Setting `jpeg_quality` too low** (meaning higher visual quality) makes the JPEG files bigger than they need to be — a value of 10-15 is usually plenty for casual monitoring.
- **Skipping `fb_count = 2`** on a board with enough PSRAM — with a single buffer, capturing the next frame has to wait for the previous one to finish sending completely, which tanks the frame rate.
- **Powering it from a weak laptop USB port** — the ESP32-CAM draws a fairly high peak current when the camera and WiFi radio are both active, and a weak supply causes repeated resets or horizontal noise bands in the image (a classic symptom of insufficient current).

## Where to go from here

Add basic motion detection by comparing JPEG file sizes between consecutive frames, or plug this stream into Home Assistant as an MJPEG camera source to view it alongside the rest of your home cameras.
