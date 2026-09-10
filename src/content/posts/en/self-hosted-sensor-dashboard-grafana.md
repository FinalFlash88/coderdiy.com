---
title: "A Self-Hosted Dashboard for DIY Sensor Data with Grafana and InfluxDB"
description: "Pull data from every ESP32/Arduino board you've ever built into one dashboard, self-hosted at home with InfluxDB and Grafana, with no dependency on any cloud service."
pubDate: 2026-09-10
lang: en
category: article
translationId: sensor-dashboard-grafana
tags: ["grafana", "influxdb", "self-hosted"]
heroEmoji: "📊"
author: "CoderDIY"
---

After a few DIY projects — a weather station, a soil moisture sensor, maybe a power-usage sensor — you end up with several different boards, each sending data its own way. Instead of opening several separate apps, pulling everything into one self-hosted dashboard is the next upgrade worth making.

## Why InfluxDB instead of a regular database

InfluxDB is a time-series database — built specifically for "one value measured at one point in time," which is exactly what sensor data is. Compared to rolling your own storage in PostgreSQL/MySQL, InfluxDB compresses data far better and time-range queries (like "hourly average over the last 7 days") are noticeably faster and simpler.

## Overall architecture

```
ESP32/Arduino (MQTT) → Telegraf → InfluxDB → Grafana
```

- Your boards keep publishing over MQTT exactly as before (see the earlier [ESP32 weather station](/en/posts/esp32-weather-station/) post).
- **Telegraf** subscribes to MQTT and writes straight into InfluxDB — no glue code needed.
- **Grafana** reads from InfluxDB and renders the dashboard.

## Configuring Telegraf to listen on MQTT

```toml
# telegraf.conf
[[inputs.mqtt_consumer]]
  servers = ["tcp://localhost:1883"]
  topics = [
    "home/weather/#",
    "home/soil/#",
  ]
  data_format = "value"
  data_type = "float"

[[outputs.influxdb_v2]]
  urls = ["http://localhost:8086"]
  token = "$INFLUX_TOKEN"
  organization = "home"
  bucket = "sensors"
```

With this config, every topic like `home/weather/temperature`, `home/soil/moisture` and so on is automatically written to InfluxDB, each topic becoming a field — no need to touch the firmware you already wrote.

## Querying data with Flux

InfluxDB uses the Flux query language. For example, hourly average temperature over the last 24 hours:

```flux
from(bucket: "sensors")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "home/weather/temperature")
  |> aggregateWindow(every: 1h, fn: mean)
```

Paste that straight into a Grafana Time series panel and you've got a chart.

## Standing it up with Docker Compose

```yaml
services:
  influxdb:
    image: influxdb:2
    ports: ["8086:8086"]
    volumes: ["influx-data:/var/lib/influxdb2"]

  telegraf:
    image: telegraf
    volumes: ["./telegraf.conf:/etc/telegraf/telegraf.conf:ro"]
    depends_on: [influxdb]

  grafana:
    image: grafana/grafana
    ports: ["3000:3000"]
    volumes: ["grafana-data:/var/lib/grafana"]
    depends_on: [influxdb]

volumes:
  influx-data:
  grafana-data:
```

Just run `docker compose up -d` and all three services come up together on a single Raspberry Pi or mini PC at home.

## Adding alerts

Grafana has built-in alerting — it can send notifications (Telegram, email, webhook) when a value crosses a threshold, for example soil moisture dropping too low or a server room's temperature exceeding a safe range, without writing a single extra line of code on the board itself.

## Why it's worth doing

This is the step that turns scattered sensor projects into an actual system — one where you can see trends over time (room temperature creeping up over the week, soil moisture dropping evenly after each watering), instead of only ever looking at one instantaneous reading at a time.
