---
title: "Relative Noise Level Monitor with ESP32 and a Built-In Web Dashboard"
description: "Sample sound amplitude with a mic sensor, compute a relative noise level in real time, and watch a live chart served directly from the ESP32 itself."
pubDate: 2026-09-20
lang: en
category: article
translationId: noise-level-monitor
tags: ["esp32", "sensors", "dashboard"]
heroEmoji: "🔊"
author: "CoderDIY"
---

Want to know how noisy your office or bedroom gets throughout the day without buying a dedicated decibel meter? An ESP32 with a cheap sound sensor is enough to build a relative noise-level monitor that draws its own chart on a tiny web page served right from the chip — no external server, no app required.

## How it works

1. A sound sensor (an analog sound sensor, or an I2S MEMS mic like the INMP441) continuously outputs a signal whose amplitude tracks the surrounding volume.
2. The ESP32 samples this signal a few hundred times a second and computes an RMS (root-mean-square) or peak value over each short time window (say, 100ms), producing a "relative noise level" number.
3. These values are stored in an in-memory array (for example, the last 60 points, one per second).
4. The ESP32 runs an embedded web server that serves a small HTML/JS page; that page periodically polls a JSON endpoint for the latest data and draws a continuously updating line chart.

> Important caveat: this is a **relative** indicator, not a properly calibrated dB(A) reading like a dedicated sound level meter provides. Cheap analog sensors respond non-linearly and carry no frequency weighting matched to human hearing — good enough to compare "noisier now vs. earlier" on the same sensor, but don't use the raw number for absolute comparisons between different rooms or as a legal measurement.

## Parts list

- ESP32 DevKit
- Analog sound sensor module (a simple KY-038-style sound detector) or an INMP441 I2S MEMS microphone (noticeably more accurate and less noisy, recommended if budget allows)
- Jumper wires
- A small enclosure with ventilation holes for the mic (avoid fully sealing it, which attenuates the sound signal)

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram of an ESP32 with an INMP441 I2S MEMS microphone">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="60" width="160" height="180" rx="10" class="box" />
    <text x="110" y="155" text-anchor="middle" class="label">ESP32 DevKit</text>

    <rect x="450" y="50" width="150" height="200" rx="10" class="box" />
    <text x="525" y="145" text-anchor="middle" class="label">INMP441</text>
    <text x="525" y="163" text-anchor="middle" class="sublabel">(I2S mic)</text>

    <line x1="190" y1="90" x2="450" y2="80" class="wire" />
    <text x="320" y="75" text-anchor="middle" class="sublabel">GPIO25 -> WS</text>
    <circle cx="190" cy="90" r="4" class="pin" />
    <circle cx="450" cy="80" r="4" class="pin" />

    <line x1="190" y1="130" x2="450" y2="120" class="wire" />
    <text x="320" y="115" text-anchor="middle" class="sublabel">GPIO26 -> SCK</text>
    <circle cx="190" cy="130" r="4" class="pin" />
    <circle cx="450" cy="120" r="4" class="pin" />

    <line x1="190" y1="170" x2="450" y2="160" class="wire" />
    <text x="320" y="155" text-anchor="middle" class="sublabel">GPIO22 -> SD</text>
    <circle cx="190" cy="170" r="4" class="pin" />
    <circle cx="450" cy="160" r="4" class="pin" />

    <line x1="190" y1="210" x2="450" y2="200" class="wire" />
    <text x="320" y="195" text-anchor="middle" class="sublabel">3V3 + shared GND</text>
    <circle cx="190" cy="210" r="4" class="pin" />
    <circle cx="450" cy="200" r="4" class="pin" />
  </svg>
  <figcaption>The ESP32 reads digital audio over the I2S protocol from the INMP441 MEMS mic, far more accurate than an analog sensor.</figcaption>
</figure>

## Sample code

```cpp
#include <WiFi.h>
#include <WebServer.h>
#include <driver/i2s.h>

const char* WIFI_SSID = "your-wifi-name";
const char* WIFI_PASS = "your-wifi-password";

WebServer server(80);

#define I2S_WS 25
#define I2S_SCK 26
#define I2S_SD 22
#define SAMPLE_COUNT 256

const int HISTORY_POINTS = 60;
float noiseHistory[HISTORY_POINTS];
int currentIndex = 0;

void setupI2S() {
  i2s_config_t config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = 16000,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = 0,
    .dma_buf_count = 4,
    .dma_buf_len = SAMPLE_COUNT,
  };
  i2s_pin_config_t pinConfig = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD,
  };
  i2s_driver_install(I2S_NUM_0, &config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pinConfig);
}

float readCurrentNoiseLevel() {
  int32_t sampleBuffer[SAMPLE_COUNT];
  size_t bytesRead = 0;
  i2s_read(I2S_NUM_0, sampleBuffer, sizeof(sampleBuffer), &bytesRead, portMAX_DELAY);

  int samplesRead = bytesRead / sizeof(int32_t);
  double sumOfSquares = 0;
  for (int i = 0; i < samplesRead; i++) {
    double sample = sampleBuffer[i] >> 14; // scale down to a more sane range
    sumOfSquares += sample * sample;
  }
  double rms = sqrt(sumOfSquares / samplesRead);
  return (float)rms;
}

void handleDataJSON() {
  String json = "[";
  for (int i = 0; i < HISTORY_POINTS; i++) {
    int idx = (currentIndex + i) % HISTORY_POINTS;
    json += String(noiseHistory[idx], 1);
    if (i < HISTORY_POINTS - 1) json += ",";
  }
  json += "]";
  server.send(200, "application/json", json);
}

void handleRoot() {
  String html = R"(
  <html><body style="font-family:sans-serif">
  <h2>Relative Noise Level</h2>
  <canvas id="chart" width="600" height="200" style="border:1px solid #888"></canvas>
  <script>
    async function refresh() {
      const res = await fetch('/data');
      const data = await res.json();
      const canvas = document.getElementById('chart');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const maxVal = Math.max(...data, 1);
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = (i / data.length) * canvas.width;
        const y = canvas.height - (v / maxVal) * canvas.height;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    setInterval(refresh, 1000);
    refresh();
  </script>
  </body></html>
  )";
  server.send(200, "text/html", html);
}

void setup() {
  Serial.begin(115200);
  setupI2S();

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
  }
  Serial.println("IP address: " + WiFi.localIP().toString());

  server.on("/", handleRoot);
  server.on("/data", handleDataJSON);
  server.begin();
}

void loop() {
  server.handleClient();

  static unsigned long lastReading = 0;
  if (millis() - lastReading >= 1000) {
    noiseHistory[currentIndex] = readCurrentNoiseLevel();
    currentIndex = (currentIndex + 1) % HISTORY_POINTS;
    lastReading = millis();
  }
}
```

## Common pitfalls

- **Treating the RMS reading as a real dB(A) value** — as noted above, this is only a relative indicator; a properly calibrated measurement requires a reference sound level meter and A-weighting applied to the frequency response, well beyond the scope of this project.
- **Expecting high accuracy from a cheap analog sensor (KY-038)** — these mostly provide a digital on/off threshold plus a fairly coarse analog pin, better suited to detecting "is there noise or not" than fine-grained levels; if you need more trustworthy data, the INMP441 I2S mic is worth the extra cost.
- **Placing the mic near a cooling fan or switching power noise** injects constant background interference — keep the mic away from switching supplies and fans.
- **The in-memory array is lost on power loss or reboot** — if you need long-term history, log to an SD card or push readings periodically to an external storage service.

## Where to go from here

Publish readings over MQTT for long-term storage in InfluxDB/Grafana instead of only keeping the last 60 points in RAM, or add an automatic alert (an LED or buzzer) when the noise level stays above a threshold for a sustained period — useful for monitoring a home office or a child's bedroom.
