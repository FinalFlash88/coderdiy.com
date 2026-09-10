---
title: "Tự làm trạm thời tiết mini với ESP32 và Home Assistant"
description: "Hướng dẫn build một trạm thời tiết nhỏ gọn dùng ESP32, cảm biến BME280, hiển thị dữ liệu real-time lên Home Assistant qua MQTT."
pubDate: 2026-08-12
lang: vi
category: article
translationId: weather-station-esp32
tags: ["esp32", "home-assistant", "mqtt", "cam-bien"]
heroEmoji: "🌡️"
author: "CoderDIY"
---

Một trong những dự án "nhập môn" DIY hay nhất cho coder là trạm thời tiết mini: chỉ vài chục nghìn tiền linh kiện, code không quá phức tạp, nhưng cho cảm giác thoả mãn cực lớn khi thấy dữ liệu thật — nhiệt độ, độ ẩm, áp suất trong phòng mình — chạy trên dashboard.

## Linh kiện cần chuẩn bị

- Board ESP32 (bất kỳ loại nào có Wi-Fi, ví dụ ESP32 DevKit V1)
- Cảm biến BME280 (nhiệt độ, độ ẩm, áp suất) — giao tiếp I2C
- Dây jumper, breadboard
- Một Raspberry Pi hoặc máy tính đang chạy Home Assistant (tuỳ chọn, nếu muốn có dashboard)

## Sơ đồ đấu nối

BME280 dùng I2C nên chỉ cần 4 dây:

```
BME280 VCC  -> ESP32 3V3
BME280 GND  -> ESP32 GND
BME280 SCL  -> ESP32 GPIO22
BME280 SDA  -> ESP32 GPIO21
```

## Code đọc cảm biến và gửi qua MQTT

Dùng Arduino IDE hoặc PlatformIO với thư viện `Adafruit_BME280` và `PubSubClient`:

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
  WiFi.begin("TEN_WIFI", "MAT_KHAU");
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

## Kết nối vào Home Assistant

Nếu bạn đã có Home Assistant chạy tích hợp MQTT, chỉ cần khai báo sensor trong `configuration.yaml`:

```yaml
mqtt:
  sensor:
    - name: "Nhiệt độ phòng"
      state_topic: "home/weather/temperature"
      unit_of_measurement: "°C"
    - name: "Độ ẩm phòng"
      state_topic: "home/weather/humidity"
      unit_of_measurement: "%"
```

Restart Home Assistant và bạn sẽ thấy hai entity mới xuất hiện, có thể thêm ngay vào dashboard dạng biểu đồ.

## Bước tiếp theo

Khi đã chạy ổn, bạn có thể mở rộng: thêm cảm biến chất lượng không khí, in vỏ hộp 3D, hoặc chuyển sang chạy pin + deep sleep để dùng ngoài trời. Đây chính là kiểu dự án mà việc biết code giúp bạn "chế" ra được sản phẩm thật thay vì chỉ đọc lý thuyết IoT.

Có câu hỏi hay muốn khoe bản build của bạn? Kéo xuống phần bình luận bên dưới nhé.
