---
title: "Hộp thư thông minh: báo có thư ngay khi nắp hộp mở với ESP8266"
description: "Dùng công tắc reed và ESP8266 deep sleep để phát hiện thư đến và gửi thông báo tức thì, chạy được nhiều tháng chỉ với một cục pin."
pubDate: 2026-09-17
lang: vi
category: article
translationId: smart-mailbox-notifier
tags: ["esp8266", "notifications", "iot"]
heroEmoji: "📬"
author: "CoderDIY"
---

Hộp thư thường đặt xa nhà, không có ổ điện gần đó, và cả tuần có khi chỉ mở nắp một hai lần — đúng kiểu bài toán mà deep sleep của ESP8266 sinh ra để giải quyết. Dự án này gắn một công tắc reed vào nắp hộp thư, để ESP8266 ngủ gần như toàn bộ thời gian và chỉ thức dậy đúng lúc nắp mở để gửi thông báo.

## Nguyên lý hoạt động

1. Một nam châm nhỏ gắn trên nắp hộp thư, công tắc reed gắn trên thân hộp — khi nắp mở, nam châm rời xa, công tắc reed đổi trạng thái (đóng/hở mạch).
2. ESP8266 ở chế độ deep sleep gần như toàn thời gian để tiết kiệm pin.
3. Sự thay đổi trạng thái công tắc reed kéo chân RST xuống mức thấp, đánh thức ESP8266.
4. ESP8266 thức dậy, kết nối WiFi, gửi một request HTTP POST tới dịch vụ thông báo, rồi quay lại deep sleep.

## Linh kiện

- Module ESP8266 chạy pin được (ví dụ Wemos D1 Mini, ưu tiên bản có mạch nạp pin Li-ion tích hợp nếu có)
- Công tắc reed thường-mở (normally open) + nam châm nhỏ
- Pin Li-ion 18650 hoặc pin AA x2-3 qua mạch boost 3.3V, tùy thiết kế mạch nguồn
- Điện trở kéo lên 10kΩ cho chân reed switch
- Hộp kín chống ẩm cho mạch điện (hộp thư ngoài trời dễ bị mưa hắt)

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối ESP8266 với công tắc reed và mạch đánh thức qua RST">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="90" width="160" height="120" rx="10" class="box" />
    <text x="120" y="155" text-anchor="middle" class="label">ESP8266 (Wemos D1 Mini)</text>

    <rect x="440" y="100" width="160" height="100" rx="10" class="box" />
    <text x="520" y="150" text-anchor="middle" class="label">Cong tac reed</text>
    <text x="520" y="168" text-anchor="middle" class="sublabel">(gan nam cham tren nap)</text>

    <line x1="200" y1="120" x2="440" y2="120" class="wire" />
    <text x="320" y="112" text-anchor="middle" class="sublabel">GPIO16 -> RST (day cau)</text>
    <circle cx="200" cy="120" r="4" class="pin" />
    <circle cx="440" cy="120" r="4" class="pin" />

    <line x1="200" y1="150" x2="440" y2="150" class="wire" />
    <text x="320" y="142" text-anchor="middle" class="sublabel">RST -> chan 1 reed</text>
    <circle cx="200" cy="150" r="4" class="pin" />
    <circle cx="440" cy="150" r="4" class="pin" />

    <line x1="200" y1="180" x2="440" y2="180" class="wire" />
    <text x="320" y="172" text-anchor="middle" class="sublabel">GND -> chan 2 reed</text>
    <circle cx="200" cy="180" r="4" class="pin" />
    <circle cx="440" cy="180" r="4" class="pin" />
  </svg>
  <figcaption>ESP8266 dùng chân RST để đánh thức từ deep sleep khi công tắc reed đổi trạng thái do nắp hộp thư mở.</figcaption>
</figure>

## Code mẫu

```cpp
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>

const char* WIFI_SSID = "ten-wifi";
const char* WIFI_PASS = "mat-khau-wifi";
const char* NOTIFY_URL = "https://ntfy.sh/hop-thu-cua-toi"; // hoac endpoint webhook rieng

void guiThongBao() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long batDau = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - batDau < 15000) {
    delay(200);
  }

  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure(); // demo: bo qua xac thuc TLS, khong nen dung khi that su can bao mat
    HTTPClient http;

    if (http.begin(client, NOTIFY_URL)) {
      http.addHeader("Title", "Hop thu co thu moi!");
      int maPhanHoi = http.POST("Nap hop thu vua duoc mo luc " + String(millis()));
      Serial.printf("Da gui thong bao, ma phan hoi: %d\n", maPhanHoi);
      http.end();
    }
  } else {
    Serial.println("Khong ket noi duoc WiFi, bo qua lan nay");
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("Thuc day tu deep sleep - nap hop thu vua mo");

  guiThongBao();

  // Quay lai deep sleep vo han, cho toi khi RST duoc keo xuong lan nua
  ESP.deepSleep(0);
}

void loop() {
  // Khong dung toi vi setup() da xu ly xong va vao deep sleep
}
```

> Lưu ý phần cứng quan trọng nhất: trên ESP8266, để đánh thức từ deep sleep bằng tín hiệu ngoài, bắt buộc phải nối GPIO16 với chân RST bằng một dây cầu. Khi công tắc reed kéo RST xuống mức thấp, board sẽ reset và chạy lại `setup()` — đây thực chất là một kiểu "wake on reset" chứ không phải ngắt GPIO thông thường. Nếu dự án của bạn cần kiểu đánh thức linh hoạt hơn (nhiều chân, giữ được trạng thái RAM), ESP32 hỗ trợ `esp_sleep_enable_ext0_wakeup()`/`ext1_wakeup()` sạch sẽ hơn nhiều và đáng cân nhắc nếu bạn thấy mạch cầu RST trên ESP8266 quá vướng víu.

## Những lỗi thường gặp

- **Dùng `delay()` quá dài khi chờ WiFi** làm hao pin nhanh — nếu WiFi thường chậm kết nối ở vị trí hộp thư, cân nhắc lưu sẵn IP/kênh WiFi bằng `WiFi.begin(ssid, pass, channel, bssid, true)` để rút ngắn thời gian dò mạng.
- **Không chống rung cơ học cho công tắc reed** — gió hoặc rung nhẹ khi có xe chạy qua có thể khiến nắp hộp rung nhẹ và gây đánh thức giả; nên gắn chắc nam châm và công tắc, tránh để nắp hộp lỏng lẻo.
- **Quên chống ẩm cho mạch** — hộp thư ngoài trời hứng mưa hắt và độ ẩm thay đổi theo ngày, nên dùng hộp kín IP54 trở lên và keo silicon bịt các lỗ dây xuyên vỏ.
- Pin Li-ion xả sâu qua nhiều tháng deep sleep dễ bị chai — nên chọn module có mạch bảo vệ xả pin (protection circuit) đi kèm.

## Mở rộng

Thêm cảm biến trọng lượng nhỏ để phân biệt "nắp mở do lấy thư" và "nắp mở do có thư gửi đến", hoặc gắn thêm cảm biến ánh sáng để phát hiện hộp thư bị mở vào ban đêm — dấu hiệu đáng chú ý hơn bình thường.
