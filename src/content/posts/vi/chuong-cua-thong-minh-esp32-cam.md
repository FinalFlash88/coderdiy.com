---
title: "Chuông cửa thông minh với ESP32-CAM: chụp ảnh và gửi Telegram khi có người"
description: "Dùng cảm biến PIR và ESP32-CAM để phát hiện chuyển động trước cửa, tự động chụp ảnh và gửi ngay lên Telegram — kèm code mẫu và cách xử lý lỗi GPIO0 kinh điển."
pubDate: 2026-09-11
lang: vi
category: article
translationId: smart-doorbell-esp32cam
tags: ["esp32-cam", "telegram", "security"]
heroEmoji: "🔔"
author: "CoderDIY"
---

Chuông cửa "thông minh" bán sẵn thường khóa bạn vào app riêng và server của hãng. Với một board ESP32-CAM giá chưa tới 100 nghìn đồng, một cảm biến PIR, và một bot Telegram tự tạo (miễn phí, không giới hạn), bạn có thể tự làm hệ thống báo động kèm ảnh chụp gửi thẳng vào điện thoại — dữ liệu hoàn toàn do bạn kiểm soát.

## Nguyên lý hoạt động

1. Cảm biến PIR phát hiện chuyển động (nhiệt hồng ngoại thay đổi) trước cửa.
2. ESP32-CAM đọc chân PIR, nếu HIGH thì chụp một khung hình JPEG từ camera.
3. ESP32-CAM kết nối WiFi, gửi ảnh đó lên Telegram Bot API bằng HTTPS POST (multipart) tới chat của bạn.
4. Có cơ chế "cooldown" để không gửi ảnh liên tục khi người đứng lâu trước cửa.

## Linh kiện

- Board ESP32-CAM (module AI-Thinker phổ biến nhất)
- Bộ chuyển USB-to-Serial (FTDI hoặc CP2102) để nạp code — ESP32-CAM không có cổng USB
- Cảm biến chuyển động PIR (HC-SR501)
- Dây nối, breadboard, nguồn 5V ổn định (camera + WiFi khá tốn dòng, nên tránh cấp nguồn qua cổng 3.3V yếu của FTDI)
- Tài khoản Telegram + bot tạo qua @BotFather, và chat ID của bạn

<figure class="diagram">
  <svg viewBox="0 0 640 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối ESP32-CAM với mạch nạp FTDI và cảm biến PIR">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="230" y="120" width="180" height="120" rx="10" class="box" />
    <text x="320" y="175" text-anchor="middle" class="label">ESP32-CAM</text>
    <text x="320" y="195" text-anchor="middle" class="sublabel">(AI-Thinker)</text>

    <rect x="20" y="20" width="150" height="90" rx="10" class="box" />
    <text x="95" y="60" text-anchor="middle" class="label">FTDI USB-Serial</text>
    <text x="95" y="78" text-anchor="middle" class="sublabel">(chỉ khi nạp code)</text>

    <rect x="470" y="130" width="150" height="90" rx="10" class="box" />
    <text x="545" y="175" text-anchor="middle" class="label">Cảm biến PIR</text>

    <line x1="170" y1="45" x2="230" y2="140" class="wire" />
    <text x="180" y="90" text-anchor="middle" class="sublabel">TX -> U0R</text>
    <circle cx="170" cy="45" r="4" class="pin" />
    <circle cx="230" cy="140" r="4" class="pin" />

    <line x1="170" y1="65" x2="230" y2="165" class="wire" />
    <text x="180" y="115" text-anchor="middle" class="sublabel">RX -> U0T</text>
    <circle cx="170" cy="65" r="4" class="pin" />
    <circle cx="230" cy="165" r="4" class="pin" />

    <line x1="170" y1="85" x2="230" y2="200" class="wire" />
    <text x="175" y="140" text-anchor="middle" class="sublabel">GND -> GND</text>
    <circle cx="170" cy="85" r="4" class="pin" />
    <circle cx="230" cy="200" r="4" class="pin" />

    <line x1="410" y1="150" x2="470" y2="150" class="wire" />
    <text x="440" y="142" text-anchor="middle" class="sublabel">GPIO13 -> OUT</text>
    <circle cx="410" cy="150" r="4" class="pin" />
    <circle cx="470" cy="150" r="4" class="pin" />

    <line x1="410" y1="180" x2="470" y2="180" class="wire" />
    <text x="440" y="200" text-anchor="middle" class="sublabel">5V -> VCC, GND -> GND</text>
    <circle cx="410" cy="180" r="4" class="pin" />
    <circle cx="470" cy="180" r="4" class="pin" />
  </svg>
  <figcaption>Chỉ nối GPIO0 xuống GND trong lúc nạp code, sau đó tháo ra để board boot bình thường.</figcaption>
</figure>

## Code mẫu

```cpp
#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include "camera_pins.h" // định nghĩa chân camera cho model AI-Thinker

const char* WIFI_SSID = "ten_wifi_cua_ban";
const char* WIFI_PASS = "mat_khau_wifi";
const String BOT_TOKEN = "123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxx";
const String CHAT_ID   = "987654321";

const int PIR_PIN = 13;
unsigned long lastSent = 0;
const unsigned long COOLDOWN = 60000UL; // 60 giây giữa 2 lần gửi

WiFiClientSecure client;

void setupCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM; config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM; config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM; config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM; config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA; // 640x480, đủ nét mà không quá nặng
  config.jpeg_quality = 12;
  config.fb_count = 1;
  esp_camera_init(&config);
}

void sendPhotoToTelegram() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) { Serial.println("Chup anh that bai"); return; }

  client.setInsecure(); // bỏ qua kiểm tra chứng chỉ cho đơn giản
  if (!client.connect("api.telegram.org", 443)) {
    Serial.println("Khong ket noi duoc Telegram");
    esp_camera_fb_return(fb);
    return;
  }

  String boundary = "coderdiyBoundary";
  String head = "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"chat_id\"\r\n\r\n" + CHAT_ID + "\r\n"
    "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"photo\"; filename=\"cua.jpg\"\r\n"
    "Content-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";

  uint32_t contentLength = head.length() + fb->len + tail.length();

  client.printf("POST /bot%s/sendPhoto HTTP/1.1\r\n", BOT_TOKEN.c_str());
  client.println("Host: api.telegram.org");
  client.println("Content-Type: multipart/form-data; boundary=" + boundary);
  client.printf("Content-Length: %u\r\n\r\n", contentLength);
  client.print(head);
  client.write(fb->buf, fb->len);
  client.print(tail);

  esp_camera_fb_return(fb);
  Serial.println("Da gui anh len Telegram");
}

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  setupCamera();

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nDa ket noi WiFi");
}

void loop() {
  if (digitalRead(PIR_PIN) == HIGH && millis() - lastSent > COOLDOWN) {
    Serial.println("Phat hien chuyen dong!");
    sendPhotoToTelegram();
    lastSent = millis();
  }
}
```

> Lấy `BOT_TOKEN` từ @BotFather sau khi tạo bot mới, và lấy `CHAT_ID` bằng cách nhắn tin cho bot rồi mở `https://api.telegram.org/bot<TOKEN>/getUpdates` để đọc trường `chat.id`.

## Những lỗi thường gặp

- **Quên tháo dây GPIO0-GND sau khi nạp code**: ESP32-CAM dùng GPIO0 nối GND để vào chế độ nạp firmware. Nếu để nguyên dây này, board sẽ luôn khởi động vào bootloader và không bao giờ chạy chương trình chính — đây là lỗi phổ biến nhất khiến người mới tưởng board bị hỏng.
- **Nguồn yếu**: camera + WiFi có lúc kéo dòng đỉnh hơn 300mA, cấp qua cổng 3.3V của FTDI dễ gây brown-out reset liên tục. Nên dùng nguồn 5V riêng ổn định cắm vào chân 5V của board.
- **PIR báo động giả** do gió, ánh nắng thay đổi hoặc côn trùng bay qua — nên chỉnh biến trở độ nhạy trên module PIR và đặt thời gian trễ (delay) sau khi cấp nguồn khoảng 30-60 giây để cảm biến ổn định trước khi đọc.
- **`FRAMESIZE` quá lớn** làm chậm quá trình chụp và gửi, có thể gây timeout kết nối — VGA (640x480) là điểm cân bằng tốt giữa chất lượng và tốc độ.

## Mở rộng

Thêm nút bấm vật lý để khách có thể "bấm chuông" chủ động thay vì chỉ dựa vào PIR, hoặc lưu ảnh vào thẻ SD tích hợp trên board để xem lại lịch sử khi không có mạng. Nâng cấp xa hơn nữa: chạy nhận diện khuôn mặt đơn giản trên Edge Impulse để chỉ gửi thông báo khi phát hiện người lạ.
