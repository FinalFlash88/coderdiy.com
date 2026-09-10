---
title: "Đèn điều khiển bằng cử chỉ tay với Arduino và APDS-9960"
description: "Vẫy tay lên/xuống/trái/phải để bật tắt và chỉnh độ sáng đèn — không cần chạm, dùng cảm biến cử chỉ APDS-9960 và MOSFET điều khiển PWM."
pubDate: 2026-09-16
lang: vi
category: article
translationId: gesture-controlled-lamp
tags: ["arduino", "sensors", "home-automation"]
heroEmoji: "👋"
author: "CoderDIY"
---

Công tắc đèn vốn đã tiện, nhưng vẫy tay tắt đèn khi tay đang bận bê đồ hay dính nước thì vẫn "ngầu" hơn nhiều. Dự án này dùng cảm biến cử chỉ APDS-9960 — cùng loại chip có trong một số điện thoại đời cũ để phát hiện thao tác "vẫy qua màn hình" — để nhận diện bốn hướng vẫy tay và điều khiển độ sáng đèn LED qua PWM.

## Nguyên lý hoạt động

1. APDS-9960 có 4 diode hồng ngoại thu ở bốn góc, phát hiện thứ tự ánh sáng phản xạ thay đổi khi tay bạn vẫy qua để suy ra hướng: UP, DOWN, LEFT, RIGHT.
2. Arduino đọc sự kiện cử chỉ qua I2C bằng thư viện `SparkFun_APDS9960`.
3. UP/DOWN tăng/giảm độ sáng đèn theo bước cố định (PWM trên chân điều khiển MOSFET).
4. LEFT hoặc RIGHT dùng để bật/tắt đèn hoàn toàn (bật lại ở độ sáng đã lưu trước đó).

## Linh kiện

- Arduino Uno/Nano (hoặc board 5V/3.3V bất kỳ có I2C)
- Module cảm biến cử chỉ APDS-9960 (thường breakout 3.3V, có sẵn regulator và level shifter trên board rẻ)
- MOSFET kênh N (ví dụ IRLZ44N — ngưỡng dẫn thấp, phù hợp điều khiển trực tiếp từ Arduino)
- Dải LED 12V (hoặc bóng LED 12V) + nguồn 12V riêng
- Điện trở kéo xuống 10kΩ cho chân gate MOSFET
- Diode chỉnh lưu (tùy chọn, bảo vệ nếu tải có tính cảm ứng)

<figure class="diagram">
  <svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối Arduino với cảm biến APDS-9960 và MOSFET điều khiển đèn LED">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="100" width="150" height="120" rx="10" class="box" />
    <text x="105" y="165" text-anchor="middle" class="label">Arduino Uno</text>

    <rect x="260" y="60" width="150" height="100" rx="10" class="box" />
    <text x="335" y="115" text-anchor="middle" class="label">APDS-9960</text>

    <rect x="460" y="150" width="150" height="110" rx="10" class="box" />
    <text x="535" y="210" text-anchor="middle" class="label">MOSFET + đèn LED</text>

    <line x1="180" y1="120" x2="260" y2="90" class="wire" />
    <text x="220" y="95" text-anchor="middle" class="sublabel">A4 (SDA)</text>
    <circle cx="180" cy="120" r="4" class="pin" />
    <circle cx="260" cy="90" r="4" class="pin" />

    <line x1="180" y1="150" x2="260" y2="120" class="wire" />
    <text x="220" y="150" text-anchor="middle" class="sublabel">A5 (SCL)</text>
    <circle cx="180" cy="150" r="4" class="pin" />
    <circle cx="260" cy="120" r="4" class="pin" />

    <line x1="180" y1="180" x2="260" y2="150" class="wire" />
    <text x="220" y="200" text-anchor="middle" class="sublabel">3V3 + GND chung</text>
    <circle cx="180" cy="180" r="4" class="pin" />
    <circle cx="260" cy="150" r="4" class="pin" />

    <line x1="180" y1="210" x2="460" y2="180" class="wire" />
    <text x="330" y="255" text-anchor="middle" class="sublabel">D9 (PWM) -> Gate MOSFET</text>
    <circle cx="180" cy="210" r="4" class="pin" />
    <circle cx="460" cy="180" r="4" class="pin" />
  </svg>
  <figcaption>Arduino đọc cử chỉ từ APDS-9960 qua I2C, sau đó xuất PWM điều khiển MOSFET cấp nguồn cho dải LED 12V.</figcaption>
</figure>

## Code mẫu

```cpp
#include <Wire.h>
#include <SparkFun_APDS9960.h>

SparkFun_APDS9960 apds = SparkFun_APDS9960();

const int LED_PIN = 9;       // chân PWM nối gate MOSFET
const int BRIGHTNESS_STEP = 25;
const int MAX_BRIGHTNESS = 255;

int brightness = 0;
int lastBrightness = 150;    // độ sáng nhớ lại khi bật đèn
bool lampOn = false;

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);

  if (apds.init()) {
    Serial.println("APDS-9960 khoi tao thanh cong");
  } else {
    Serial.println("Loi khoi tao APDS-9960");
  }

  if (apds.enableGestureSensor(true)) {
    Serial.println("Cam bien cu chi da bat");
  }
}

void applyBrightness() {
  analogWrite(LED_PIN, lampOn ? brightness : 0);
}

void loop() {
  if (apds.isGestureAvailable()) {
    int gesture = apds.readGesture();

    switch (gesture) {
      case DIR_UP:
        if (!lampOn) lampOn = true;
        brightness = min(brightness + BRIGHTNESS_STEP, MAX_BRIGHTNESS);
        lastBrightness = brightness;
        Serial.println("Tang do sang");
        break;

      case DIR_DOWN:
        brightness = max(brightness - BRIGHTNESS_STEP, 0);
        lastBrightness = brightness;
        Serial.println("Giam do sang");
        break;

      case DIR_LEFT:
      case DIR_RIGHT:
        lampOn = !lampOn;
        if (lampOn && brightness == 0) {
          brightness = lastBrightness > 0 ? lastBrightness : 150;
        }
        Serial.println(lampOn ? "Bat den" : "Tat den");
        break;

      default:
        break;
    }

    applyBrightness();
  }
}
```

> Ngưỡng phát hiện cử chỉ mặc định của thư viện đôi khi quá nhạy hoặc quá "lì" tùy khoảng cách lắp đặt — gọi `apds.setGestureGain(...)` hoặc điều chỉnh `GGAIN`/`GPTHR` trong file cấu hình thư viện nếu cử chỉ bị bỏ sót hoặc bắt nhầm liên tục.

## Những lỗi thường gặp

- **Đặt cảm biến quá gần nguồn sáng mạnh** (đèn trần, cửa sổ) khiến APDS-9960 bị nhiễu hồng ngoại nền — nên lắp trong khoang hơi khuất sáng trực tiếp hoặc dùng vỏ che chắn nhẹ.
- **MOSFET không đủ dòng hoặc thiếu tản nhiệt** khi điều khiển dải LED dài — kiểm tra thông số `Id` (dòng liên tục) của MOSFET so với dòng thực tế của dải LED, và gắn heatsink nhỏ nếu dòng trên 2A.
- **Quên điện trở kéo xuống ở chân gate**: nếu Arduino reset hoặc mất tín hiệu, gate có thể "lơ lửng" khiến đèn nhấp nháy hoặc sáng full không kiểm soát.
- Khoảng cách vẫy tay hiệu quả của APDS-9960 chỉ khoảng 10-15cm — đặt cảm biến ở vị trí người dùng dễ đưa tay tới, ví dụ mép bàn hoặc dưới kệ đầu giường.

## Mở rộng

Thêm ESP32 thay Arduino để gửi trạng thái đèn lên MQTT, tích hợp với Home Assistant, hoặc dùng cử chỉ NEAR/FAR (khoảng cách) của cùng chip APDS-9960 để tự động bật đèn khi có người lại gần mà không cần vẫy tay.
