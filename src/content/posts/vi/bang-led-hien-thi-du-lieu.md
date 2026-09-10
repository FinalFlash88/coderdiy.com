---
title: "Bảng LED hiển thị dữ liệu thời gian thực với ESP32 và WS2812"
description: "Biến một tấm ma trận LED WS2812 thành màn hình mini hiển thị thời tiết, giá coin hoặc số thông báo chưa đọc — cập nhật liên tục qua API, không cần màn hình LCD."
pubDate: 2026-09-08
lang: vi
category: article
translationId: led-matrix-dashboard
tags: ["esp32", "led", "ws2812"]
heroEmoji: "💡"
author: "CoderDIY"
---

Màn hình LCD thì rõ chữ, nhưng một tấm ma trận LED WS2812 lại có thứ LCD không có: màu sắc rực rỡ, góc nhìn rộng, và cảm giác "món đồ chơi điện tử" rất đặc trưng. Với một chút code, bạn có thể biến nó thành một dashboard mini luôn hiển thị dữ liệu bạn quan tâm.

## Phần cứng

- ESP32 (đủ mạnh để vừa gọi API vừa render ma trận mượt)
- Tấm ma trận WS2812B, phổ biến nhất là 8x32 hoặc 16x16
- Nguồn 5V riêng đủ dòng (một tấm 8x32 có thể kéo tới 2-3A khi sáng hết cỡ — **không cấp nguồn LED qua chân 5V của board ESP32**)
- Tụ lớn (~1000µF) giữa nguồn và LED để chống sụt áp khi bật/tắt đột ngột

## Vẽ pixel cơ bản

Dùng thư viện `FastLED` hoặc `Adafruit_NeoMatrix`. Ví dụ vẽ một icon nhiệt độ đơn giản:

```cpp
#include <FastLED.h>

#define LED_PIN 5
#define WIDTH 32
#define HEIGHT 8
#define NUM_LEDS (WIDTH * HEIGHT)

CRGB leds[NUM_LEDS];

int xy(int x, int y) {
  // ma trận đấu kiểu zig-zag (serpentine)
  if (y % 2 == 0) return y * WIDTH + x;
  return y * WIDTH + (WIDTH - 1 - x);
}

void setup() {
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(60); // đừng để 255 — vừa chói vừa tốn dòng
}
```

## Lấy dữ liệu qua API và hiển thị số

```cpp
#include <HTTPClient.h>
#include <ArduinoJson.h>

float fetchTemperature() {
  HTTPClient http;
  http.begin("https://api.example.com/weather?city=here");
  int code = http.GET();

  float temp = -99;
  if (code == 200) {
    StaticJsonDocument<256> doc;
    deserializeJson(doc, http.getString());
    temp = doc["temp_c"];
  }
  http.end();
  return temp;
}

void loop() {
  float temp = fetchTemperature();
  drawNumber(temp, CRGB::Orange); // hàm tự viết: vẽ font số 3x5 hoặc 5x7 lên leds[]
  FastLED.show();
  delay(60000); // cập nhật mỗi phút, tránh gọi API quá dày
}
```

## Vẽ font chữ số nhỏ

Với ma trận nhỏ, bạn thường tự định nghĩa font bitmap 3x5 hoặc 5x7 dưới dạng mảng bit, thay vì dùng font hệ thống:

```cpp
const uint8_t FONT_3X5[10][5] = {
  {0b111, 0b101, 0b101, 0b101, 0b111}, // 0
  {0b010, 0b110, 0b010, 0b010, 0b111}, // 1
  // ... các chữ số còn lại
};

void drawDigit(int digit, int offsetX, CRGB color) {
  for (int row = 0; row < 5; row++) {
    for (int col = 0; col < 3; col++) {
      if (FONT_3X5[digit][row] & (1 << (2 - col))) {
        leds[xy(offsetX + col, row)] = color;
      }
    }
  }
}
```

## Ý tưởng dữ liệu để hiển thị

- Thời tiết hiện tại (như ví dụ trên)
- Số thông báo/email chưa đọc, đổi màu nền theo mức độ "khẩn cấp"
- Giá coin hoặc chỉ số chứng khoán, nhấp nháy đỏ/xanh theo chiều tăng giảm
- Trạng thái CI/CD — xanh khi build pass, đỏ khi fail (gắn ngay trên bàn làm việc)

## Lưu ý về dòng điện

Đây là phần dễ bị bỏ qua nhất: một LED WS2812 ở màu trắng full sáng có thể kéo tới ~60mA. Với ma trận 8x32 = 256 LED, dòng tối đa lý thuyết lên tới hơn 15A. Trong thực tế bạn hiếm khi bật hết tất cả LED cùng màu trắng, nhưng luôn tính toán nguồn dư ra ít nhất 50% so với ước lượng, và giữ `setBrightness()` ở mức vừa phải thay vì tối đa.
