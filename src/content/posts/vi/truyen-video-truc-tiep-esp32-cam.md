---
title: "Truyền video trực tiếp qua trình duyệt với ESP32-CAM"
description: "Stream MJPEG trực tiếp từ ESP32-CAM tới bất kỳ trình duyệt nào trong mạng LAN, xem trên điện thoại hay laptop mà không cần cài app — kèm code xử lý streaming cốt lõi."
pubDate: 2026-09-29
lang: vi
category: article
translationId: esp32cam-live-stream
tags: ["esp32-cam", "streaming", "networking"]
heroEmoji: "📹"
author: "CoderDIY"
---

Một trong những thứ hay ho nhất của ESP32-CAM là bạn có thể biến nó thành một camera IP mini chỉ với vài chục dòng code — không cần app riêng, không cần tài khoản cloud, chỉ cần mở trình duyệt và gõ địa chỉ IP. Bài này tập trung vào cơ chế MJPEG streaming: cách nó hoạt động, và code tối thiểu để dựng một stream chạy mượt trong mạng WiFi nội bộ.

## ESP32-CAM và lưu ý nạp code

Nếu đây là dự án ESP32-CAM đầu tiên của bạn, có một điểm cần nhớ: board này không có cổng USB tích hợp, bạn phải dùng bộ chuyển FTDI (USB-to-serial) để nạp code — nối `U0R`/`U0T` với TX/RX của FTDI (chéo nhau), `5V`/`GND` tương ứng, và **nối chân `IO0` xuống `GND`** trước khi nhấn reset để vào chế độ nạp. Sau khi nạp xong, ngắt `IO0` khỏi GND và reset lại để board chạy chương trình bình thường. Quên bước `IO0` là lỗi phổ biến nhất khiến việc nạp code thất bại liên tục.

## MJPEG streaming hoạt động thế nào

MJPEG (Motion JPEG) không phải video nén thật sự — nó chỉ đơn giản là một chuỗi ảnh JPEG rời rạc gửi liên tục. Cái hay ở đây là giao thức HTTP có kiểu response gọi là `multipart/x-mixed-replace`: server giữ kết nối mở, và liên tục gửi từng phần (part) mới, mỗi phần là một ảnh JPEG kèm boundary phân tách. Trình duyệt nhận ra kiểu content-type này và tự động "thay ảnh mới nhất" — nghĩa là bạn chỉ cần một thẻ `<img src="http://<ip>/stream">` bình thường, không cần JavaScript, không cần WebRTC, không cần plugin.

<figure class="diagram">
  <svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ luồng xử lý streaming MJPEG từ ESP32-CAM tới trình duyệt">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 12px; fill: var(--color-ink); }
      .arrow { stroke: var(--color-accent); stroke-width: 2; marker-end: url(#arrowhead-stream); fill: none; }
    </style>
    <defs>
      <marker id="arrowhead-stream" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--color-accent)" />
      </marker>
    </defs>

    <rect x="10" y="90" width="140" height="70" rx="10" class="box" />
    <text x="80" y="120" text-anchor="middle" class="label">Camera OV2640</text>
    <text x="80" y="138" text-anchor="middle" class="label">chup khung hinh</text>

    <rect x="180" y="90" width="140" height="70" rx="10" class="box" />
    <text x="250" y="120" text-anchor="middle" class="label">Nen anh</text>
    <text x="250" y="138" text-anchor="middle" class="label">thanh JPEG</text>

    <rect x="350" y="90" width="140" height="70" rx="10" class="box" />
    <text x="420" y="120" text-anchor="middle" class="label">Gui qua HTTP</text>
    <text x="420" y="138" text-anchor="middle" class="label">multipart</text>

    <rect x="520" y="90" width="110" height="70" rx="10" class="box" />
    <text x="575" y="120" text-anchor="middle" class="label">Trinh duyet</text>
    <text x="575" y="138" text-anchor="middle" class="label">the &lt;img&gt;</text>

    <line x1="150" y1="125" x2="180" y2="125" class="arrow" />
    <line x1="320" y1="125" x2="350" y2="125" class="arrow" />
    <line x1="490" y1="125" x2="520" y2="125" class="arrow" />
  </svg>
  <figcaption>Mỗi khung hình đi qua 4 bước, lặp lại liên tục nhiều lần mỗi giây để tạo cảm giác video trực tiếp.</figcaption>
</figure>

## Code streaming cốt lõi

```cpp
#include "esp_camera.h"
#include <WiFi.h>

// Cau hinh chan camera cho board AI-Thinker ESP32-CAM
#define PWDN_GPIO_NUM  32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM   0
#define SIOD_GPIO_NUM  26
#define SIOC_GPIO_NUM  27
#define Y9_GPIO_NUM    35
#define Y8_GPIO_NUM    34
#define Y7_GPIO_NUM    39
#define Y6_GPIO_NUM    36
#define Y5_GPIO_NUM    21
#define Y4_GPIO_NUM    19
#define Y3_GPIO_NUM    18
#define Y2_GPIO_NUM     5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM  23
#define PCLK_GPIO_NUM  22

#include <WebServer.h>
WebServer server(80);

const char* ssid = "TEN_WIFI";
const char* password = "MAT_KHAU_WIFI";

void handleStream() {
  WiFiClient client = server.client();
  String boundary = "frame";
  String header = "HTTP/1.1 200 OK\r\n";
  header += "Content-Type: multipart/x-mixed-replace; boundary=" + boundary + "\r\n\r\n";
  client.print(header);

  while (client.connected()) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) continue;

    client.printf("--%s\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n",
                  boundary.c_str(), fb->len);
    client.write(fb->buf, fb->len);
    client.print("\r\n");

    esp_camera_fb_return(fb);

    if (!client.connected()) break;
  }
}

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
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Do phan giai va chat luong anh huong truc tiep den toc do khung hinh qua WiFi.
  // FRAMESIZE_VGA (640x480) + quality 12 la mot lua chon can bang tot cho LAN noi bo.
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 12; // so cang nho, chat luong cang cao, khung hinh cang nang
  config.fb_count = 2;      // double buffer giup stream muot hon

  esp_camera_init(&config);
}

void setup() {
  Serial.begin(115200);
  setupCamera();

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println(WiFi.localIP());

  server.on("/stream", HTTP_GET, handleStream);
  server.begin();
}

void loop() {
  server.handleClient();
}
```

Trang HTML để xem stream chỉ cần đơn giản thế này, lưu thành file và mở trên bất kỳ trình duyệt nào cùng mạng:

```html
<!DOCTYPE html>
<html>
  <body style="margin:0;background:#111;">
    <img src="http://192.168.1.50/stream" style="width:100%;display:block;" />
  </body>
</html>
```

## Những lỗi thường gặp

- **Chọn độ phân giải quá cao** (ví dụ UXGA 1600x1200) khiến khung hình quá nặng, WiFi không tải kịp và stream giật lag nghiêm trọng. Bắt đầu với VGA hoặc thấp hơn, chỉ tăng khi thực sự cần chi tiết.
- **`jpeg_quality` đặt quá thấp số** (nghĩa là chất lượng quá cao) làm file JPEG nặng hơn không cần thiết — giá trị 10-15 thường đủ dùng cho giám sát thông thường.
- **Không set `fb_count = 2`** khi board có đủ PSRAM — chỉ dùng 1 buffer khiến việc chụp khung mới phải chờ khung cũ được gửi xong hoàn toàn, làm giảm tốc độ khung hình.
- **Cấp nguồn qua cổng USB yếu của laptop** — ESP32-CAM cần dòng đỉnh khá cao khi camera và WiFi hoạt động cùng lúc, nguồn yếu gây reset liên tục hoặc ảnh bị nhiễu ngang (dải sọc ngang là dấu hiệu kinh điển của thiếu dòng).

## Mở rộng

Thêm nhận diện chuyển động đơn giản bằng cách so sánh kích thước file JPEG giữa các khung liên tiếp, hoặc ghép stream này vào Home Assistant như một camera nguồn MJPEG để xem chung với các camera khác trong nhà.
