---
title: "Máy cho thú cưng ăn tự động với ESP32, servo và RTC"
description: "Cho ăn đúng giờ nhờ module RTC không phụ thuộc WiFi, kèm nút bấm từ xa qua trình duyệt điện thoại để cho ăn thêm bất cứ lúc nào."
pubDate: 2026-09-19
lang: vi
category: article
translationId: automated-pet-feeder
tags: ["esp32", "servo", "automation"]
heroEmoji: "🐾"
author: "CoderDIY"
---

Đi công tác vài ngày mà lo cho mèo/chó ăn đúng giờ là nỗi lo quen thuộc. Máy cho ăn tự động này dùng servo để xoay một bánh xe định lượng thức ăn, module RTC DS3231 để giữ giờ chính xác kể cả khi mất WiFi, và một web server nhỏ chạy ngay trên ESP32 để bạn có thể bấm "cho ăn ngay" từ điện thoại.

## Nguyên lý hoạt động

1. ESP32 kiểm tra giờ hiện tại từ module RTC DS3231 (không phụ thuộc kết nối Internet/NTP, vì RTC có pin lithium riêng để giữ giờ khi mất điện).
2. Đến đúng giờ đã lập lịch (ví dụ 7h sáng và 6h chiều), ESP32 điều khiển servo xoay một góc cố định để mở bánh xe định lượng, thả một phần thức ăn xuống bát.
3. Song song đó, ESP32 chạy một web server nhỏ với endpoint `/cho-an-ngay` — chỉ cần mở trình duyệt điện thoại truy cập địa chỉ IP của ESP32 và bấm nút là kích hoạt servo cho ăn thêm ngay lập tức.

## Linh kiện

- ESP32 DevKit
- Servo SG90 hoặc MG90S (MG90S bền hơn nếu bánh xe định lượng có tải nặng)
- Module RTC DS3231 (chính xác hơn nhiều so với DS1307, có bù nhiệt)
- Phễu chứa thức ăn (in 3D hoặc tận dụng chai nhựa/hộp nhựa cắt miệng phễu) gắn với bánh xe định lượng có khía để múc từng phần thức ăn khi xoay
- Nguồn 5V ổn định cho servo (không nên cấp chung với chân 5V của ESP32 nếu servo giật mạnh lúc khởi động, dùng tụ lớn 470-1000µF đệm nguồn nếu cần)

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối ESP32 với servo cho ăn và module RTC DS3231">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="90" width="160" height="120" rx="10" class="box" />
    <text x="120" y="155" text-anchor="middle" class="label">ESP32 DevKit</text>

    <rect x="440" y="30" width="160" height="90" rx="10" class="box" />
    <text x="520" y="80" text-anchor="middle" class="label">Servo (banh xe)</text>

    <rect x="440" y="150" width="160" height="90" rx="10" class="box" />
    <text x="520" y="200" text-anchor="middle" class="label">RTC DS3231</text>

    <line x1="200" y1="120" x2="440" y2="70" class="wire" />
    <text x="330" y="80" text-anchor="middle" class="sublabel">GPIO18 (PWM) -> tin hieu servo</text>
    <circle cx="200" cy="120" r="4" class="pin" />
    <circle cx="440" cy="70" r="4" class="pin" />

    <line x1="200" y1="150" x2="440" y2="180" class="wire" />
    <text x="330" y="195" text-anchor="middle" class="sublabel">GPIO21 (SDA) -> SDA</text>
    <circle cx="200" cy="150" r="4" class="pin" />
    <circle cx="440" cy="180" r="4" class="pin" />

    <line x1="200" y1="180" x2="440" y2="210" class="wire" />
    <text x="330" y="228" text-anchor="middle" class="sublabel">GPIO22 (SCL) -> SCL</text>
    <circle cx="200" cy="180" r="4" class="pin" />
    <circle cx="440" cy="210" r="4" class="pin" />
  </svg>
  <figcaption>ESP32 điều khiển servo mở bánh xe định lượng theo lịch đọc từ RTC DS3231 qua I2C.</figcaption>
</figure>

## Code mẫu

```cpp
#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <RTClib.h>

const char* WIFI_SSID = "ten-wifi";
const char* WIFI_PASS = "mat-khau-wifi";

Servo servoChoAn;
RTC_DS3231 rtc;
WebServer server(80);

const int SERVO_PIN = 18;
const int GIO_CHO_AN[] = {7, 18};   // 7h sang va 18h (6h chieu)
const int PHUT_CHO_AN = 0;
int ngayDaChoAn[2] = {-1, -1};      // luu ngay da cho an de tranh cho lap trong cung 1 phut

void xoayServoChoAn() {
  servoChoAn.write(90);   // vi tri mo bang cach xoay 90 do
  delay(700);             // du thoi gian de banh xe xoay va tha thuc an
  servoChoAn.write(0);    // quay ve vi tri dong
  Serial.println("Da cho an!");
}

void xuLyChoAnNgay() {
  xoayServoChoAn();
  server.send(200, "text/plain", "Da cho an ngay!");
}

void xuLyTrangChu() {
  DateTime now = rtc.now();
  String html = "<html><body style='font-family:sans-serif'>";
  html += "<h2>May cho thu cung an tu dong</h2>";
  html += "<p>Gio hien tai: " + String(now.hour()) + ":" + String(now.minute()) + "</p>";
  html += "<button onclick=\"fetch('/cho-an-ngay')\">Cho an ngay</button>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void setup() {
  Serial.begin(115200);
  servoChoAn.attach(SERVO_PIN);
  servoChoAn.write(0);

  Wire.begin();
  if (!rtc.begin()) {
    Serial.println("Khong tim thay module RTC!");
  }

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nDia chi IP: " + WiFi.localIP().toString());

  server.on("/", xuLyTrangChu);
  server.on("/cho-an-ngay", xuLyChoAnNgay);
  server.begin();
}

void loop() {
  server.handleClient();

  DateTime now = rtc.now();
  for (int i = 0; i < 2; i++) {
    if (now.hour() == GIO_CHO_AN[i] && now.minute() == PHUT_CHO_AN && ngayDaChoAn[i] != now.day()) {
      xoayServoChoAn();
      ngayDaChoAn[i] = now.day(); // danh dau da cho an trong ngay nay, tranh lap lai
    }
  }

  delay(1000); // kiem tra moi giay la du, khong can quet lien tuc
}
```

> Góc quay servo (90 độ trong ví dụ) và thời gian giữ (700ms) phải hiệu chỉnh theo thiết kế bánh xe định lượng cụ thể của bạn — in thử vài phiên bản bánh xe với khía to nhỏ khác nhau để tìm ra lượng thức ăn phù hợp cho mỗi lần xoay.

## Những lỗi thường gặp

- **Dùng NTP/WiFi để lấy giờ thay vì RTC** nghe có vẻ đơn giản hơn nhưng sẽ khiến máy cho ăn "quên giờ" hoàn toàn nếu WiFi router khởi động lại đúng lúc — RTC DS3231 với pin CR2032 riêng giữ giờ chính xác dù mất điện hay rớt mạng.
- **Cấp nguồn servo chung với ESP32** dễ gây sụt áp lúc servo khởi động, làm ESP32 tự reset — nên dùng nguồn 5V riêng, nối GND chung giữa hai nguồn.
- **Quên chống trùng lịch cho ăn**: nếu không lưu `ngayDaChoAn`, servo có thể bị gọi lặp lại nhiều lần trong cùng một phút do vòng lặp chạy nhanh hơn 60 giây.
- Phễu thức ăn hở dễ hút ẩm khiến thức ăn vón cục làm kẹt bánh xe — nên có nắp đậy kín và để nơi khô ráo.

## Mở rộng

Gắn thêm cảm biến trọng lượng dưới bát ăn để biết chắc thú cưng đã thực sự ăn (không chỉ là thức ăn đã rơi xuống), hoặc thêm camera ESP32-CAM để chụp ảnh xác nhận mỗi lần cho ăn và gửi qua ứng dụng nhắn tin.
