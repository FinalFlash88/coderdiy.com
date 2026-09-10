---
title: "Máy đo chất lượng không khí với ESP32 và cảm biến PMS5003"
description: "Đọc bụi mịn PM2.5/PM10 bằng cảm biến laser PMS5003, giải mã khung UART nhị phân, và cảnh báo khi không khí vượt ngưỡng an toàn — kèm code phân tích frame đầy đủ."
pubDate: 2026-09-26
lang: vi
category: article
translationId: air-quality-monitor
tags: ["esp32", "sensors", "air-quality"]
heroEmoji: "🌫️"
author: "CoderDIY"
---

Cảm biến nhiệt độ, độ ẩm thì ai cũng làm rồi — nhưng đo được bụi mịn PM2.5, thứ thực sự ảnh hưởng đến phổi, là một bước nâng cấp đáng giá. PMS5003 là cảm biến laser tán xạ quang học: nó thổi không khí qua một buồng nhỏ, chiếu laser vào dòng khí, và đếm số hạt bụi phản xạ ánh sáng theo từng kích thước. Kết quả trả về qua UART là những con số PM1.0, PM2.5, PM10 theo microgram/m³ — đủ chính xác để dùng trong dự án DIY nghiêm túc.

## Nguyên lý hoạt động

1. PMS5003 liên tục lấy mẫu không khí và tự động gửi một khung dữ liệu (frame) 32 byte qua UART mỗi giây, không cần ESP32 phải "hỏi".
2. ESP32 lắng nghe cổng UART, tìm hai byte tiêu đề `0x42 0x4D`, rồi đọc đủ 32 byte.
3. Tính checksum của 30 byte đầu và so với 2 byte checksum cuối frame để chắc chắn dữ liệu không bị lỗi đường truyền.
4. Trích các giá trị PM1.0, PM2.5, PM10 (theo chuẩn khí quyển "atmospheric") từ đúng vị trí byte trong frame.
5. Nếu PM2.5 vượt ngưỡng cảnh báo, bật LED/còi và gửi dữ liệu lên MQTT hoặc hiển thị trên trang web nội bộ của ESP32.

## Linh kiện

- ESP32 DevKit (bất kỳ board nào có ít nhất 2 UART khả dụng)
- Cảm biến PMS5003 (kèm cáp JST 8 chân đi kèm hộp)
- Nguồn 5V/1A trở lên — quạt hút khí bên trong PMS5003 kéo dòng đỉnh khoảng 100mA, cao hơn nhiều cảm biến thông thường, nên không nên cấp nguồn chung với các module khác qua cùng một regulator yếu
- LED hoặc còi buzzer nhỏ cho cảnh báo
- Breadboard, dây jumper

> Về mức logic: chân TX của PMS5003 xuất ở khoảng 3.3V nên có thể nối thẳng vào chân RX của ESP32 mà không cần chia áp hay level shifter. Chân RX của PMS5003 (ESP32 TX gửi vào) cũng chấp nhận 3.3V bình thường vì đây vốn là board thiết kế cho MCU 3.3V. Thứ cần để ý không phải là mức logic, mà là dòng điện của nguồn 5V nuôi quạt.

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối ESP32 với cảm biến PMS5003 qua UART">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="70" width="160" height="160" rx="10" class="box" />
    <text x="120" y="155" text-anchor="middle" class="label">ESP32</text>

    <rect x="440" y="70" width="160" height="160" rx="10" class="box" />
    <text x="520" y="155" text-anchor="middle" class="label">PMS5003</text>

    <line x1="200" y1="100" x2="440" y2="100" class="wire" />
    <text x="320" y="92" text-anchor="middle" class="sublabel">Nguon 5V -&gt; VCC</text>
    <circle cx="200" cy="100" r="4" class="pin" />
    <circle cx="440" cy="100" r="4" class="pin" />

    <line x1="200" y1="140" x2="440" y2="140" class="wire" />
    <text x="320" y="132" text-anchor="middle" class="sublabel">GND -&gt; GND</text>
    <circle cx="200" cy="140" r="4" class="pin" />
    <circle cx="440" cy="140" r="4" class="pin" />

    <line x1="200" y1="180" x2="440" y2="180" class="wire" />
    <text x="320" y="172" text-anchor="middle" class="sublabel">GPIO16 (RX2) &lt;- TX</text>
    <circle cx="200" cy="180" r="4" class="pin" />
    <circle cx="440" cy="180" r="4" class="pin" />

    <line x1="200" y1="210" x2="440" y2="210" class="wire" />
    <text x="320" y="202" text-anchor="middle" class="sublabel">GPIO17 (TX2) -&gt; RX</text>
    <circle cx="200" cy="210" r="4" class="pin" />
    <circle cx="440" cy="210" r="4" class="pin" />
  </svg>
  <figcaption>ESP32 dùng UART2 (RX2/TX2) để nói chuyện với PMS5003; nguồn 5V cấp riêng cho quạt hút khí.</figcaption>
</figure>

## Code đọc và giải mã frame PMS5003

```cpp
#include <HardwareSerial.h>

HardwareSerial pmsSerial(2); // UART2 tren ESP32

const int RX_PIN = 16;
const int TX_PIN = 17;
const int ALERT_PIN = 26;   // LED/buzzer canh bao
const int PM25_THRESHOLD = 55; // microgram/m3, tuong duong muc "khong tot cho nhom nhay cam"

struct PMSData {
  uint16_t pm1_0;
  uint16_t pm2_5;
  uint16_t pm10;
};

bool readPMSFrame(PMSData &out) {
  // Tim byte header 0x42 0x4D
  if (pmsSerial.available() < 32) return false;
  if (pmsSerial.peek() != 0x42) {
    pmsSerial.read(); // bo byte rac, truot dan ve dung header
    return false;
  }

  uint8_t buf[32];
  pmsSerial.readBytes(buf, 32);

  if (buf[0] != 0x42 || buf[1] != 0x4D) return false;

  // Checksum = tong 30 byte dau, so voi 2 byte cuoi
  uint16_t sum = 0;
  for (int i = 0; i < 30; i++) sum += buf[i];
  uint16_t checksum = (buf[30] << 8) | buf[31];
  if (sum != checksum) return false; // frame loi, bo qua

  // Cac gia tri "atmospheric environment" nam o offset 10, 12, 14
  out.pm1_0 = (buf[10] << 8) | buf[11];
  out.pm2_5 = (buf[12] << 8) | buf[13];
  out.pm10  = (buf[14] << 8) | buf[15];
  return true;
}

void setup() {
  Serial.begin(115200);
  pmsSerial.begin(9600, SERIAL_8N1, RX_PIN, TX_PIN);
  pinMode(ALERT_PIN, OUTPUT);
}

void loop() {
  PMSData data;
  if (readPMSFrame(data)) {
    Serial.printf("PM1.0=%u PM2.5=%u PM10=%u ug/m3\n", data.pm1_0, data.pm2_5, data.pm10);
    digitalWrite(ALERT_PIN, data.pm2_5 > PM25_THRESHOLD ? HIGH : LOW);
    // TODO: publish MQTT hoac cap nhat bien toan cuc de trang web /status doc duoc
  }
}
```

Nếu muốn public dữ liệu qua MQTT, chỉ cần thêm thư viện `PubSubClient`, kết nối WiFi trong `setup()`, và gọi `client.publish("home/air/pm25", String(data.pm2_5).c_str())` ngay sau khi parse thành công. Muốn đơn giản hơn thì dựng một `WebServer` nhỏ trả về JSON `{"pm25": ..., "pm10": ...}` ở endpoint `/status` để xem bằng trình duyệt.

## Những lỗi thường gặp

- **Không chờ đủ 32 byte trong buffer** trước khi đọc — nếu `Serial.available()` chưa đủ, bạn sẽ đọc lẫn giữa hai frame và checksum luôn sai. Luôn kiểm tra `available() >= 32` trước.
- **Bỏ qua bước tìm header** — UART không có khái niệm "gói tin", dữ liệu là một dòng byte liên tục. Nếu ESP32 khởi động giữa chừng một frame, byte đầu đọc được sẽ không phải `0x42`, cần "trượt" từng byte cho tới khi khớp header.
- **Đặt cảm biến ngay sát cửa gió điều hòa hoặc góc kín gió** — luồng khí không đại diện cho không gian, số liệu sẽ nhảy vô lý. Đặt ở độ cao ngang đầu người, cách tường ít nhất 10cm.
- **Không cho cảm biến "warm-up"** — sau khi bật nguồn, quạt cần khoảng 30 giây để dòng khí ổn định; bỏ qua các frame đầu tiên nếu cần độ chính xác cao.

## Mở rộng

Ghép thêm cảm biến CO2 (như SCD40) để có bức tranh chất lượng không khí đầy đủ hơn, hoặc lưu lịch sử PM2.5 theo giờ vào thẻ SD để vẽ biểu đồ xu hướng ô nhiễm trong ngày.
