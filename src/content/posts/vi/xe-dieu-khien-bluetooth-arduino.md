---
title: "Xe điều khiển từ xa qua Bluetooth với Arduino và L298N"
description: "Chế tạo xe RC điều khiển bằng điện thoại qua module HC-05, Arduino và mạch cầu H L298N — kèm giao thức lệnh đơn giản và code điều khiển tốc độ bằng PWM."
pubDate: 2026-09-13
lang: vi
category: article
translationId: bluetooth-rc-car-arduino
tags: ["arduino", "bluetooth", "robotics"]
heroEmoji: "🚗"
author: "CoderDIY"
---

Xe điều khiển Bluetooth là dự án robotics kinh điển để làm quen với động cơ DC, mạch cầu H và giao tiếp không dây — không cần app riêng, chỉ cần một app điều khiển Bluetooth serial có sẵn trên store và vài dòng code Arduino.

## Nguyên lý hoạt động

1. Điện thoại kết nối Bluetooth tới module HC-05 (đóng vai trò cổng serial không dây).
2. App gửi một ký tự lệnh mỗi khi người dùng bấm nút điều khiển: `F` (tiến), `B` (lùi), `L` (trái), `R` (phải), `S` (dừng).
3. Arduino đọc ký tự từ `Serial` (nối với HC-05), ánh xạ sang tổ hợp tín hiệu điều khiển hai động cơ DC qua mạch cầu H L298N.
4. Tốc độ động cơ được điều chỉnh bằng tín hiệu PWM trên chân ENA/ENB của L298N.

<figure class="diagram">
  <svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ luồng xử lý lệnh Bluetooth điều khiển xe">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .arrow { stroke: var(--color-accent); stroke-width: 2; marker-end: url(#arrowhead); fill: none; }
    </style>
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--color-accent)" />
      </marker>
    </defs>

    <rect x="10" y="100" width="150" height="60" rx="10" class="box" />
    <text x="85" y="135" text-anchor="middle" class="label">App điện thoại</text>

    <rect x="210" y="100" width="150" height="60" rx="10" class="box" />
    <text x="285" y="135" text-anchor="middle" class="label">HC-05 -> Arduino</text>

    <rect x="410" y="30" width="200" height="60" rx="10" class="box" />
    <text x="510" y="65" text-anchor="middle" class="label">Đọc lệnh, chọn hướng</text>

    <rect x="410" y="170" width="200" height="60" rx="10" class="box" />
    <text x="510" y="205" text-anchor="middle" class="label">L298N điều khiển 2 động cơ</text>

    <line x1="160" y1="130" x2="210" y2="130" class="arrow" />
    <line x1="360" y1="120" x2="410" y2="70" class="arrow" />
    <line x1="510" y1="90" x2="510" y2="170" class="arrow" />
  </svg>
  <figcaption>Ký tự lệnh Bluetooth đi qua Arduino, được dịch thành tín hiệu điều khiển mạch cầu H.</figcaption>
</figure>

## Linh kiện

- Arduino Uno
- Module Bluetooth HC-05
- Mạch cầu H L298N (điều khiển 2 động cơ DC)
- 2 động cơ DC + bánh xe, khung xe robot 2 hoặc 4 bánh
- Pin/nguồn riêng cho động cơ (pin 18650 hoặc pin 9V-12V, không dùng chung nguồn với Arduino)
- 2 điện trở (1kΩ và 2kΩ) để làm cầu phân áp cho chân RX của HC-05
- App điều khiển Bluetooth serial bất kỳ trên điện thoại (ví dụ "Arduino Bluetooth Controller" hoặc "Serial Bluetooth Terminal")

## Đấu nối quan trọng

HC-05 hoạt động ở mức logic 3.3V nhưng Arduino Uno xuất tín hiệu 5V trên chân TX. Cắm thẳng TX của Arduino vào RX của HC-05 mà không hạ áp có thể làm hỏng module theo thời gian — cần dùng cầu phân áp:

```
Arduino TX (5V) --[1kΩ]--+--[2kΩ]--- GND
                          |
                       HC-05 RX (~3.3V)
```

## Code mẫu

```cpp
#include <SoftwareSerial.h>

SoftwareSerial bluetooth(10, 11); // RX, TX noi voi HC-05

// Chan dieu khien huong tren L298N
const int IN1 = 2, IN2 = 3; // dong co trai
const int IN3 = 4, IN4 = 5; // dong co phai
const int ENA = 9;  // PWM toc do dong co trai
const int ENB = 6;  // PWM toc do dong co phai
const int TOC_DO = 200; // 0-255

void tien() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
}
void lui() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
}
void reTrai() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
}
void rePhai() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
}
void dung() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
}

void setup() {
  bluetooth.begin(9600);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);
  analogWrite(ENA, TOC_DO);
  analogWrite(ENB, TOC_DO);
  dung();
}

void loop() {
  if (bluetooth.available()) {
    char lenh = bluetooth.read();
    switch (lenh) {
      case 'F': tien(); break;
      case 'B': lui(); break;
      case 'L': reTrai(); break;
      case 'R': rePhai(); break;
      case 'S': dung(); break;
    }
  }
}
```

> Ghép nối HC-05 với điện thoại trước qua Bluetooth settings (mã PIN mặc định thường là `1234` hoặc `0000`), sau đó mở app điều khiển và gõ cấu hình nút bấm gửi đúng các ký tự `F/B/L/R/S`.

## Những lỗi thường gặp

- **Không hạ áp chân RX của HC-05**: dùng lâu dài ở 5V có thể làm giảm tuổi thọ hoặc hỏng module — luôn dùng cầu phân áp như trên.
- **Dùng chung nguồn Arduino và động cơ**: động cơ DC khi khởi động hoặc đổi chiều đột ngột tạo dòng ngược (back-EMF) gây nhiễu, dễ làm Arduino tự reset — nên tách nguồn động cơ ra pin riêng, chỉ nối chung GND.
- **Quên nối chung GND** giữa Arduino, HC-05 và L298N — đây là lỗi phổ biến khiến lệnh Bluetooth "gửi được nhưng xe không phản ứng".
- **`SoftwareSerial` xung đột chân**: nếu board của bạn không phải Uno mà là Mega/Leonardo, cân nhắc dùng cổng `Serial1` phần cứng thay vì `SoftwareSerial` để ổn định hơn ở tốc độ baud cao.

## Mở rộng

Thêm cảm biến siêu âm HC-SR04 phía trước để tự động dừng khi gần chướng ngại vật, hoặc thay HC-05 bằng ESP32 để điều khiển qua WiFi/app di động tự viết với giao diện joystick ảo thay vì chỉ 5 nút bấm.
