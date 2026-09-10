---
title: "Home energy monitoring with ESP32 and a non-invasive current sensor"
description: "Measure an appliance's power draw with a non-invasive SCT-013 current clamp and an ESP32, publishing readings over MQTT — with an important safety note about working near mains wiring."
pubDate: 2026-09-14
lang: en
category: article
translationId: energy-monitor-esp32
tags: ["esp32", "mqtt", "energy"]
heroEmoji: "⚡"
author: "CoderDIY"
---

Want to know how much power your fridge or AC unit is actually drawing in real time, without hiring an electrician to install a sub-meter? A non-invasive current clamp sensor paired with an ESP32 lets you measure power draw and push it to MQTT for display in Home Assistant or Grafana — without ever cutting a wire or touching a live conductor.

> **Safety warning**: the SCT-013 sensor doesn't make direct contact with the wire (it only clips around it), but you're still working near 220-240V AC mains wiring. Always switch off power at the breaker before opening an electrical panel to install anything, never touch bare wire ends, and if you're not confident about electrical safety, have a qualified electrician handle the connection to the main line.

## How it works

1. The SCT-013 is a clip-on current transformer: it clamps around a single live wire of the circuit or appliance you want to measure, and induces a small AC current proportional to the current flowing through that wire — no cutting or direct connection required.
2. The sensor's output current is converted into a small AC voltage through a "burden resistor", then shifted with a voltage divider so it sits within the 0-3.3V range the ESP32's ADC can read.
3. The ESP32 takes hundreds of analog samples across an AC cycle, computes the RMS (root-mean-square) value of the current, and multiplies it by an assumed mains voltage (e.g. 220V or 120V depending on your region) to get apparent power in watts.
4. The power reading is published periodically to an MQTT broker so other systems (Home Assistant, Node-RED, Grafana) can subscribe and display it.

## Parts list

- ESP32 DevKit (plenty of ADC pins, runs at 3.3V)
- SCT-013 non-invasive current clamp sensor (the 100A/50mA current-output type, or a variant with a built-in burden resistor — check the datasheet before buying)
- A burden resistor (typically 22-33 ohms for the current-output SCT-013, skip it if you're using the voltage-output variant)
- Two 10k ohm resistors to create a 1.65V midpoint as the DC offset reference
- A 10-100uF filter capacitor
- The `EmonLib` library (install via the Library Manager) to simplify RMS calculation
- An MQTT broker (a local Mosquitto instance, or a free cloud broker for testing)

<figure class="diagram">
  <svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram for ESP32 with an SCT-013 current clamp through a burden resistor">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="90" width="160" height="120" rx="10" class="box" />
    <text x="120" y="155" text-anchor="middle" class="label">ESP32 DevKit</text>

    <rect x="300" y="90" width="140" height="120" rx="10" class="box" />
    <text x="370" y="145" text-anchor="middle" class="label">Voltage divider</text>
    <text x="370" y="163" text-anchor="middle" class="sublabel">2x 10k ohm + burden R</text>

    <rect x="480" y="100" width="140" height="100" rx="10" class="box" />
    <text x="550" y="155" text-anchor="middle" class="label">SCT-013</text>
    <text x="550" y="173" text-anchor="middle" class="sublabel">clamped around live wire</text>

    <line x1="200" y1="130" x2="300" y2="120" class="wire" />
    <text x="250" y="110" text-anchor="middle" class="sublabel">GPIO34 (ADC) -> divider midpoint</text>
    <circle cx="200" cy="130" r="4" class="pin" /><circle cx="300" cy="120" r="4" class="pin" />

    <line x1="200" y1="170" x2="300" y2="170" class="wire" />
    <text x="250" y="190" text-anchor="middle" class="sublabel">3.3V -> reference point</text>
    <circle cx="200" cy="170" r="4" class="pin" /><circle cx="300" cy="170" r="4" class="pin" />

    <line x1="440" y1="150" x2="480" y2="150" class="wire" />
    <text x="460" y="140" text-anchor="middle" class="sublabel">2 output leads</text>
    <circle cx="440" cy="150" r="4" class="pin" /><circle cx="480" cy="150" r="4" class="pin" />
  </svg>
  <figcaption>The burden resistor and voltage divider turn the sensed current into a 0-3.3V signal safe for the ESP32's ADC pin.</figcaption>
</figure>

## Sample code

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include "EmonLib.h"

const char* WIFI_SSID = "your_wifi_name";
const char* WIFI_PASS = "your_wifi_password";
const char* MQTT_SERVER = "192.168.1.100";
const char* MQTT_TOPIC = "home/energy/power";

const int CURRENT_PIN = 34;      // ADC pin wired to the voltage divider
const double MAINS_VOLTAGE = 220.0; // use 120.0 if that's your local mains voltage
const double CALIBRATION = 30.0;    // tune based on the SCT-013's turns ratio

EnergyMonitor energyMonitor;
WiFiClient espClient;
PubSubClient mqtt(espClient);

void connectWifiAndMqtt() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(300);

  mqtt.setServer(MQTT_SERVER, 1883);
  while (!mqtt.connected()) {
    mqtt.connect("esp32-energy-monitor");
    delay(500);
  }
}

void setup() {
  Serial.begin(115200);
  energyMonitor.current(CURRENT_PIN, CALIBRATION);
  connectWifiAndMqtt();
}

void loop() {
  if (!mqtt.connected()) connectWifiAndMqtt();
  mqtt.loop();

  double currentRms = energyMonitor.calcIrms(1480); // 1480 samples per reading
  double power = currentRms * MAINS_VOLTAGE;

  Serial.print("Current: "); Serial.print(currentRms); Serial.println(" A");
  Serial.print("Power: "); Serial.print(power); Serial.println(" W");

  char payload[16];
  dtostrf(power, 4, 1, payload);
  mqtt.publish(MQTT_TOPIC, payload);

  delay(5000); // publish every 5 seconds
}
```

> `CALIBRATION` needs to be tuned empirically: plug in an appliance with a known wattage (like a 100W bulb), compare the reading against the known value, and adjust the constant until they match.

## Common pitfalls

- **Confusing the current-output and burden-resistor-included SCT-013 variants**: some SCT-013 versions already have a burden resistor built into the jack, and adding an external one on top will give completely wrong readings — check the datasheet before wiring it up.
- **Skipping the DC offset reference**: an AC signal that swings around 0V gets clipped on the negative half if the ESP32 can only read 0-3.3V — the voltage divider that shifts the signal up to a 1.65V midpoint is not optional.
- **Measuring apparent power instead of real power**: the `current x voltage` calculation above ignores power factor, so for motor-driven loads (AC units, fridges) the reading will drift somewhat from what your utility meter reports — fine for relative monitoring, not for reconciling your electric bill.
- **Clamping loosely, or clamping both wires (live + neutral) at once**: clamping both cancels out the magnetic field and gives a reading near zero — clamp exactly one live conductor.

## Where to go from here

Add a real AC voltage sensor (ZMPT101B) instead of assuming a fixed mains voltage, which gets you more accurate power readings and lets you measure power factor too — or mount multiple SCT-013 sensors on individual breaker branches in the panel so you know exactly which appliance is drawing the most power.
