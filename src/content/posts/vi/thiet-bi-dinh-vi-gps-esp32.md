---
title: "Tự làm thiết bị định vị GPS với ESP32 và module NEO-6M"
description: "Đọc và giải mã dữ liệu NMEA từ module GPS NEO-6M bằng ESP32 và thư viện TinyGPS++, lưu vị trí theo thời gian và hiển thị lên bản đồ qua một trang web nhỏ tự host."
pubDate: 2026-09-25
lang: vi
category: article
tags: ["esp32", "gps", "iot"]
translationId: gps-tracker-esp32
heroEmoji: "🛰️"
author: "CoderDIY"
---

Một thiết bị định vị GPS tự chế rất hữu ích để theo dõi xe đạp, ba lô đi phượt, hay đơn giản là học cách một module GPS thực sự hoạt động ra sao đằng sau những chấm xanh trên bản đồ điện thoại. Với ESP32 và một module NEO-6M giá rẻ, bạn có đủ mọi thứ cần thiết: đọc tọa độ, lưu lại theo thời gian, và thậm chí phát một trang web nhỏ hiển thị vị trí mới nhất.

## Nguyên lý hoạt động

1. Module NEO-6M liên tục phát ra các câu lệnh NMEA (chuỗi text theo chuẩn) qua cổng UART, chứa thông tin vĩ độ, kinh độ, thời gian, số vệ tinh bắt được, v.v.
2. ESP32 có nhiều UART phần cứng, nên ta dùng một cổng UART phụ (`HardwareSerial`) riêng để đọc GPS, tách biệt hoàn toàn với `Serial` mặc định vốn đang dùng để debug qua USB.
3. Thư viện `TinyGPS++` nhận từng byte thô từ UART, tự động giải mã các câu NMEA và cung cấp sẵn các giá trị đã xử lý như `gps.location.lat()`, `gps.location.lng()`.
4. Tọa độ đọc được có thể gửi định kỳ qua MQTT lên một broker, hoặc đơn giản hơn là lưu vào biến và phát ra qua một web server nhỏ chạy ngay trên ESP32, kèm một liên kết mở bản đồ tại đúng tọa độ đó.

## Linh kiện

- ESP32 DevKit (bất kỳ board ESP32 nào có ít nhất 2 UART khả dụng)
- Module GPS NEO-6M (kèm ăng-ten gốm hoặc ăng-ten ngoài)
- Dây jumper
- Nguồn pin di động (power bank hoặc pin LiPo + mạch sạc) nếu dùng ngoài trời di động
- (Tùy chọn) Anten GPS ngoài nếu cần bắt tín hiệu tốt hơn trong khu vực nhiều vật cản

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối ESP32 với module GPS NEO-6M qua UART">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="60" width="170" height="180" rx="10" class="box" />
    <text x="115" y="155" text-anchor="middle" class="label">ESP32 DevKit</text>

    <rect x="440" y="70" width="170" height="160" rx="10" class="box" />
    <text x="525" y="155" text-anchor="middle" class="label">GPS NEO-6M</text>

    <line x1="200" y1="90" x2="440" y2="90" class="wire" />
    <text x="320" y="82" text-anchor="middle" class="sublabel">5V (hoặc 3.3V) → VCC</text>
    <circle cx="200" cy="90" r="4" class="pin" />
    <circle cx="440" cy="90" r="4" class="pin" />

    <line x1="200" y1="130" x2="440" y2="130" class="wire" />
    <text x="320" y="122" text-anchor="middle" class="sublabel">GND → GND</text>
    <circle cx="200" cy="130" r="4" class="pin" />
    <circle cx="440" cy="130" r="4" class="pin" />

    <line x1="200" y1="170" x2="440" y2="170" class="wire" />
    <text x="320" y="162" text-anchor="middle" class="sublabel">GPIO17 (TX2) → RX</text>
    <circle cx="200" cy="170" r="4" class="pin" />
    <circle cx="440" cy="170" r="4" class="pin" />

    <line x1="200" y1="210" x2="440" y2="210" class="wire" />
    <text x="320" y="202" text-anchor="middle" class="sublabel">GPIO16 (RX2) → TX</text>
    <circle cx="200" cy="210" r="4" class="pin" />
    <circle cx="440" cy="210" r="4" class="pin" />
  </svg>
  <figcaption>Module GPS nối vào một cổng UART phụ của ESP32 (UART1), tách biệt với cổng Serial debug mặc định — lưu ý TX của module nối vào RX của ESP32 và ngược lại.</figcaption>
</figure>

## Code mẫu

Đọc và giải mã dữ liệu GPS, in tọa độ ra Serial mỗi 30 giây:

```cpp
#include <TinyGPS++.h>
#include <HardwareSerial.h>

HardwareSerial gpsSerial(1); // dung UART1 cua ESP32, tach voi Serial debug (UART0)
TinyGPSPlus gps;

const int RXD2 = 16; // noi voi chan TX cua module GPS
const int TXD2 = 17; // noi voi chan RX cua module GPS

unsigned long lastPublish = 0;
const unsigned long PUBLISH_INTERVAL = 30000; // 30 giay

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, RXD2, TXD2);
  Serial.println("Dang cho tin hieu GPS, can nhin thay bau troi thoang...");
}

void loop() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  if (gps.location.isUpdated() && gps.location.isValid()) {
    double lat = gps.location.lat();
    double lon = gps.location.lng();

    if (millis() - lastPublish > PUBLISH_INTERVAL) {
      Serial.printf("Vi tri: %.6f, %.6f | Ve tinh: %d | HDOP: %.1f\n",
                    lat, lon, gps.satellites.value(), gps.hdop.hdop());
      publishLocation(lat, lon);
      lastPublish = millis();
    }
  }

  // Neu khong co du lieu NMEA nao sau 10 giay, co the day cam sai TX/RX
  if (millis() > 10000 && gps.charsProcessed() < 10) {
    Serial.println("Khong thay du lieu GPS - kiem tra day TX/RX hoac cho them thoi gian bat lanh");
  }
}

void publishLocation(double lat, double lon) {
  // Vi du: gui qua MQTT (can khoi tao WiFiClient + PubSubClient truoc do)
  // String payload = String(lat, 6) + "," + String(lon, 6);
  // mqttClient.publish("tracker/location", payload.c_str());
}
```

Nếu muốn xem vị trí mới nhất qua trình duyệt thay vì MQTT, thêm một web server nhỏ trả về trang HTML có liên kết mở bản đồ tại đúng tọa độ (dùng dịch vụ bản đồ công khai bất kỳ, không phụ thuộc API trả phí):

```cpp
#include <WebServer.h>
WebServer server(80);
double lastLat = 0, lastLon = 0;

void handleRoot() {
  String html = "<html><body><h1>Vi tri hien tai</h1>";
  html += "<p>" + String(lastLat, 6) + ", " + String(lastLon, 6) + "</p>";
  html += "<a href='https://www.openstreetmap.org/?mlat=" + String(lastLat, 6) +
          "&mlon=" + String(lastLon, 6) + "#map=16/" + String(lastLat, 6) +
          "/" + String(lastLon, 6) + "' target='_blank'>Xem tren ban do</a></body></html>";
  server.send(200, "text/html", html);
}
```

## Những lỗi thường gặp

- **Lần bắt tín hiệu đầu tiên (cold start) có thể mất 1-5 phút** — module GPS cần tải dữ liệu lịch thiên văn (almanac) từ vệ tinh, và việc này chỉ diễn ra suôn sẻ khi có tầm nhìn thoáng lên bầu trời. Trong nhà, gần cửa sổ có thể bắt được, nhưng giữa tòa nhà bê tông thì gần như không.
- **Nối chéo TX/RX**: chân TX của module phải nối vào chân RX (nhận) của ESP32 và ngược lại — nối thẳng hàng là lỗi phổ biến nhất khiến không đọc được gì.
- **Baud rate mặc định của NEO-6M là 9600** — nếu đổi baud rate trên module (một số phiên bản hỗ trợ cấu hình lại), nhớ cập nhật `gpsSerial.begin()` cho khớp.
- **Nguồn không ổn định** gây treo hoặc reset module khi WiFi ESP32 hoạt động mạnh (dòng đỉnh cao) — nên dùng nguồn 5V có dòng đủ lớn (từ 500mA trở lên), tránh cấp từ cổng USB máy tính yếu dòng.

## Mở rộng

Ghi lại toàn bộ hành trình vào thẻ SD hoặc SPIFFS để xem lại đường đi sau chuyến, thêm cảnh báo geofencing khi thiết bị ra khỏi một vùng định trước, cho ESP32 vào deep sleep giữa các lần đọc để kéo dài thời lượng pin, hoặc kết hợp thêm module LoRa để truyền vị trí đi xa mà không cần WiFi.
