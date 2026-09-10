---
title: "Tự host dashboard cho dữ liệu cảm biến DIY với Grafana và InfluxDB"
description: "Gom dữ liệu từ mọi board ESP32/Arduino bạn từng làm vào một dashboard chung, tự host tại nhà bằng InfluxDB và Grafana, không phụ thuộc dịch vụ đám mây nào."
pubDate: 2026-09-10
lang: vi
category: article
translationId: sensor-dashboard-grafana
tags: ["grafana", "influxdb", "self-hosted"]
heroEmoji: "📊"
author: "CoderDIY"
---

Sau vài dự án DIY — trạm thời tiết, cảm biến độ ẩm đất, có thể cả cảm biến điện năng tiêu thụ — bạn sẽ có nhiều board khác nhau, mỗi board gửi dữ liệu một kiểu. Thay vì mở nhiều app riêng lẻ, gom tất cả vào một dashboard tự host là bước nâng cấp đáng làm tiếp theo.

## Vì sao chọn InfluxDB thay vì database thông thường

InfluxDB là time-series database — được thiết kế riêng cho kiểu dữ liệu "một giá trị đo tại một thời điểm", đúng bản chất dữ liệu cảm biến. So với việc tự lưu vào PostgreSQL/MySQL, InfluxDB nén dữ liệu tốt hơn nhiều và truy vấn theo khoảng thời gian (ví dụ "trung bình mỗi giờ trong 7 ngày qua") nhanh và gọn hơn hẳn.

## Kiến trúc tổng quan

```
ESP32/Arduino (MQTT) → Telegraf → InfluxDB → Grafana
```

- Các board tiếp tục publish dữ liệu qua MQTT như trước (xem lại bài [trạm thời tiết ESP32](/bai-viet/tram-thoi-tiet-esp32/)).
- **Telegraf** subscribe MQTT và ghi thẳng vào InfluxDB — không cần viết code trung gian.
- **Grafana** đọc từ InfluxDB và vẽ dashboard.

## Cấu hình Telegraf lắng nghe MQTT

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

Với cấu hình này, mọi topic dạng `home/weather/temperature`, `home/soil/moisture`... tự động được ghi vào InfluxDB, mỗi topic trở thành một field, không cần đụng vào code firmware đã viết trước đó.

## Truy vấn dữ liệu bằng Flux

InfluxDB dùng ngôn ngữ truy vấn Flux. Ví dụ lấy nhiệt độ trung bình mỗi giờ trong 24h qua:

```flux
from(bucket: "sensors")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "home/weather/temperature")
  |> aggregateWindow(every: 1h, fn: mean)
```

Dán query này thẳng vào một panel Grafana kiểu Time series là có ngay biểu đồ.

## Dựng bằng Docker Compose

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

Chỉ cần `docker compose up -d` là có đủ cả 3 dịch vụ chạy trên cùng một Raspberry Pi hoặc mini PC ở nhà.

## Thêm cảnh báo

Grafana có sẵn Alerting — có thể gửi thông báo (Telegram, email, webhook) khi giá trị vượt ngưỡng, ví dụ độ ẩm đất xuống quá thấp hoặc nhiệt độ phòng server vượt mức an toàn, mà không cần viết thêm dòng code nào trên board.

## Vì sao đáng làm

Đây là bước biến các dự án cảm biến rời rạc thành một hệ thống thật sự — nơi bạn thấy được xu hướng theo thời gian (nhiệt độ tăng dần trong tuần, độ ẩm đất giảm đều sau mỗi lần tưới), thay vì chỉ xem số tức thời từng lần một.
