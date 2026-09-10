---
title: "Thùng rác thông minh tự mở nắp với Arduino"
description: "Dùng cảm biến siêu âm HC-SR04 phát hiện tay đưa gần và servo tự động mở nắp thùng rác — không chạm, kèm state machine tránh servo giật liên tục."
pubDate: 2026-09-27
lang: vi
category: article
translationId: smart-trash-can
tags: ["arduino", "sensors", "automation"]
heroEmoji: "🗑️"
author: "CoderDIY"
---

Thùng rác tự mở nắp là dự án nhỏ nhưng "wow factor" cao — bạn đưa tay lại gần, nắp tự bật lên, không cần chạm vào bất cứ thứ gì. Về mặt kỹ thuật nó cũng là bài học tốt về cách xử lý cảm biến khoảng cách nhiễu và tránh cho servo bị giật (jitter) do đọc sai liên tục — thứ sẽ gặp lại ở rất nhiều dự án robot khác.

## Nguyên lý hoạt động

1. HC-SR04 phát một xung siêu âm, đo thời gian sóng phản xạ quay về để tính khoảng cách.
2. Nếu khoảng cách nhỏ hơn ngưỡng (ví dụ 15cm), Arduino coi như có vật/tay đang ở gần.
3. Một state machine 4 trạng thái (`IDLE -> OPENING -> OPEN -> CLOSING`) điều khiển servo, đảm bảo nắp không giật lên giật xuống khi cảm biến đọc nhiễu từng lúc.
4. Sau khi mở, nắp giữ mở trong vài giây; nếu không còn phát hiện vật thể liên tục trong khoảng thời gian đó, chuyển sang đóng.

## Linh kiện

- Arduino Uno hoặc Nano
- Cảm biến siêu âm HC-SR04
- Servo SG90 (hoặc servo lớn hơn nếu nắp thùng nặng, kèm nguồn ngoài cho servo)
- Thùng rác có nắp có thể lật bằng cơ cấu tay đòn đơn giản
- Nguồn 5V riêng cho servo nếu dùng servo công suất lớn (servo kéo dòng đỉnh khi khởi động có thể làm Arduino reset nếu dùng chung nguồn USB)

<figure class="diagram">
  <svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối Arduino với cảm biến HC-SR04 và servo">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="20" width="150" height="260" rx="10" class="box" />
    <text x="105" y="155" text-anchor="middle" class="label">Arduino</text>

    <rect x="440" y="20" width="170" height="120" rx="10" class="box" />
    <text x="525" y="85" text-anchor="middle" class="label">HC-SR04</text>

    <rect x="440" y="180" width="170" height="100" rx="10" class="box" />
    <text x="525" y="235" text-anchor="middle" class="label">Servo SG90</text>

    <line x1="180" y1="40" x2="440" y2="40" class="wire" />
    <text x="310" y="32" text-anchor="middle" class="sublabel">5V -&gt; VCC</text>
    <circle cx="180" cy="40" r="4" class="pin" />
    <circle cx="440" cy="40" r="4" class="pin" />

    <line x1="180" y1="65" x2="440" y2="65" class="wire" />
    <text x="310" y="57" text-anchor="middle" class="sublabel">GND -&gt; GND</text>
    <circle cx="180" cy="65" r="4" class="pin" />
    <circle cx="440" cy="65" r="4" class="pin" />

    <line x1="180" y1="90" x2="440" y2="90" class="wire" />
    <text x="310" y="82" text-anchor="middle" class="sublabel">D9 -&gt; Trig</text>
    <circle cx="180" cy="90" r="4" class="pin" />
    <circle cx="440" cy="90" r="4" class="pin" />

    <line x1="180" y1="115" x2="440" y2="115" class="wire" />
    <text x="310" y="107" text-anchor="middle" class="sublabel">D10 &lt;- Echo</text>
    <circle cx="180" cy="115" r="4" class="pin" />
    <circle cx="440" cy="115" r="4" class="pin" />

    <line x1="180" y1="200" x2="440" y2="200" class="wire" />
    <text x="310" y="192" text-anchor="middle" class="sublabel">D6 -&gt; Signal</text>
    <circle cx="180" cy="200" r="4" class="pin" />
    <circle cx="440" cy="200" r="4" class="pin" />

    <line x1="180" y1="225" x2="440" y2="225" class="wire" />
    <text x="310" y="217" text-anchor="middle" class="sublabel">5V -&gt; VCC</text>
    <circle cx="180" cy="225" r="4" class="pin" />
    <circle cx="440" cy="225" r="4" class="pin" />

    <line x1="180" y1="250" x2="440" y2="250" class="wire" />
    <text x="310" y="242" text-anchor="middle" class="sublabel">GND -&gt; GND</text>
    <circle cx="180" cy="250" r="4" class="pin" />
    <circle cx="440" cy="250" r="4" class="pin" />
  </svg>
  <figcaption>HC-SR04 phát hiện khoảng cách, Arduino điều khiển servo mở/đóng nắp qua state machine.</figcaption>
</figure>

## Code mẫu

```cpp
#include <Servo.h>

const int TRIG_PIN = 9;
const int ECHO_PIN = 10;
const int SERVO_PIN = 6;

const int OPEN_DISTANCE_CM = 15;   // duoi khoang cach nay coi la co vat gan
const int SERVO_CLOSED_ANGLE = 0;
const int SERVO_OPEN_ANGLE = 90;
const unsigned long OPEN_HOLD_MS = 3000; // giu mo toi thieu 3 giay
const unsigned long DEBOUNCE_MS = 300;   // phai on dinh 300ms moi doi trang thai

Servo lidServo;

enum State { IDLE, OPENING, OPEN, CLOSING };
State state = IDLE;
unsigned long stateEnteredAt = 0;
unsigned long lastDetectedAt = 0;

long readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // timeout 30ms ~ 5m
  if (duration == 0) return 999; // khong doc duoc, coi nhu qua xa
  return duration * 0.034 / 2;   // cm
}

void setState(State s) {
  state = s;
  stateEnteredAt = millis();
}

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  lidServo.attach(SERVO_PIN);
  lidServo.write(SERVO_CLOSED_ANGLE);
  Serial.begin(9600);
}

void loop() {
  long distance = readDistanceCm();
  bool objectNear = distance < OPEN_DISTANCE_CM;
  if (objectNear) lastDetectedAt = millis();

  switch (state) {
    case IDLE:
      if (objectNear) setState(OPENING);
      break;

    case OPENING:
      lidServo.write(SERVO_OPEN_ANGLE);
      setState(OPEN);
      break;

    case OPEN:
      // chi chuyen sang dong khi da het thoi gian giu toi thieu
      // VA khong con phat hien vat trong khoang DEBOUNCE_MS gan nhat
      if (millis() - stateEnteredAt > OPEN_HOLD_MS &&
          millis() - lastDetectedAt > DEBOUNCE_MS) {
        setState(CLOSING);
      }
      break;

    case CLOSING:
      lidServo.write(SERVO_CLOSED_ANGLE);
      setState(IDLE);
      break;
  }

  delay(50); // toc do lay mau khoang 20 lan/giay, du muot ma khong lam servo giat
}
```

## Những lỗi thường gặp

- **Đọc `pulseIn()` không có timeout** — nếu không có vật gì phản xạ (ví dụ nắp mở hướng lên trời trống), hàm sẽ treo cả chương trình chờ vô hạn. Luôn truyền tham số timeout thứ ba như trong code trên.
- **Không có debounce khi vật thể lướt qua nhanh** — nếu chỉ dựa vào một lần đọc để quyết định đóng nắp, một cái bóng thoáng qua cũng đủ làm nắp giật liên tục. State machine ở trên chỉ đóng khi khoảng `DEBOUNCE_MS` không phát hiện gì.
- **Dùng chung nguồn USB cho cả Arduino và servo tải nặng** — dòng khởi động của servo có thể làm Arduino tự reset giữa chừng. Với servo lớn hơn SG90, cấp nguồn 5V riêng và nối chung GND.
- **Đặt cảm biến quá thấp**, ngang tầm rác thay vì tầm tay — sẽ bị kích hoạt bởi chính rác bên trong thùng. Gắn HC-SR04 hướng ra ngoài, ngang tầm bàn tay đưa tới.

## Mở rộng

Thêm cảm biến trọng lượng (load cell) dưới đáy thùng để cảnh báo khi rác gần đầy, hoặc gắn ESP32 để gửi thông báo qua Telegram khi cần đổ rác.
