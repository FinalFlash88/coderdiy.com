---
title: "Build a Mini Weather Station with ESP32 and Home Assistant"
description: "A walkthrough for building a compact weather station using an ESP32 and a BME280 sensor, streaming live data into Home Assistant over MQTT."
pubDate: 2026-08-12
lang: en
category: article
translationId: weather-station-esp32
tags: ["esp32", "home-assistant", "mqtt", "sensors"]
heroEmoji: "🌡️"
author: "CoderDIY"
---

One of the best "starter" DIY projects for a coder is a mini weather station: cheap parts, simple code, and a huge payoff the moment real data — temperature, humidity, pressure in your own room — shows up on a dashboard.

## Parts list

- An ESP32 board (any Wi-Fi capable variant, e.g. ESP32 DevKit V1)
- A BME280 sensor (temperature, humidity, pressure) — I2C
- Jumper wires, breadboard
- A Raspberry Pi or any machine running Home Assistant (optional, for a dashboard)

## Wiring

The BME280 uses I2C, so only 4 wires are needed:

```
BME280 VCC  -> ESP32 3V3
BME280 GND  -> ESP32 GND
BME280 SCL  -> ESP32 GPIO22
BME280 SDA  -> ESP32 GPIO21
```

## Reading the sensor and publishing over MQTT

Using the Arduino IDE or PlatformIO with the `Adafruit_BME280` and `PubSubClient` libraries:

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <Adafruit_BME280.h>

Adafruit_BME280 bme;
WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  bme.begin(0x76);
  WiFi.begin("YOUR_WIFI", "YOUR_PASSWORD");
  while (WiFi.status() != WL_CONNECTED) delay(500);
  client.setServer("192.168.1.10", 1883);
}

void loop() {
  if (!client.connected()) client.connect("esp32-weather");
  client.loop();

  float temp = bme.readTemperature();
  float hum = bme.readHumidity();
  float pres = bme.readPressure() / 100.0F;

  client.publish("home/weather/temperature", String(temp).c_str());
  client.publish("home/weather/humidity", String(hum).c_str());
  client.publish("home/weather/pressure", String(pres).c_str());

  delay(30000);
}
```

## Wiring it into Home Assistant

If you already run Home Assistant with the MQTT integration enabled, declare the sensors in `configuration.yaml`:

```yaml
mqtt:
  sensor:
    - name: "Room Temperature"
      state_topic: "home/weather/temperature"
      unit_of_measurement: "°C"
    - name: "Room Humidity"
      state_topic: "home/weather/humidity"
      unit_of_measurement: "%"
```

Restart Home Assistant and two new entities will show up, ready to drop straight onto a dashboard as a chart.

## Where to go from here

Once it's running reliably, extend it: add an air quality sensor, 3D print an enclosure, or switch to battery power with deep sleep for outdoor use. This is exactly the kind of project where knowing how to code lets you build a real product instead of just reading IoT theory.

Questions, or want to show off your own build? Scroll down to the comments below.
