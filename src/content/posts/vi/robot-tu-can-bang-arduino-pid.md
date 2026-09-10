---
title: "Robot tự cân bằng hai bánh với Arduino và bộ điều khiển PID"
description: "Xây dựng robot con lắc ngược hai bánh dùng Arduino, MPU6050 và vòng lặp PID để tự đứng thẳng — giải thích P, I, D theo cách dễ hiểu kèm code và mẹo hiệu chỉnh thực tế."
pubDate: 2026-09-24
lang: vi
category: article
tags: ["arduino", "robotics", "pid-control"]
translationId: self-balancing-robot-pid
heroEmoji: "⚖️"
author: "CoderDIY"
---

Robot tự cân bằng (self-balancing robot) là bài toán "con lắc ngược" kinh điển trong điều khiển học, nhưng bạn hoàn toàn có thể tự làm bằng Arduino với vài chục nghìn phép tính mỗi giây thay vì phương trình vi phân phức tạp. Đây cũng là dự án tốt nhất để học PID — bộ điều khiển xuất hiện trong gần như mọi hệ thống tự động, từ máy in 3D đến máy bay không người lái.

## Nguyên lý hoạt động

Robot có hai bánh, trọng tâm nằm cao hơn trục bánh — về bản chất nó luôn muốn ngã. Nhiệm vụ của vi điều khiển là liên tục đọc góc nghiêng và điều chỉnh tốc độ động cơ để "đuổi theo" điểm cân bằng, giống hệt cách bạn giữ một cây gậy đứng thẳng trên lòng bàn tay.

1. Cảm biến **MPU6050** (gia tốc kế + con quay hồi chuyển) đo góc nghiêng thực tế của thân robot.
2. Bộ điều khiển **PID** so sánh góc đo được với góc mục tiêu (thường là 0°, tức thẳng đứng) để tính ra sai số, rồi tính ra một giá trị điều khiển:
   - **P (Proportional)** — phản ứng tỉ lệ thuận với sai số hiện tại: nghiêng càng nhiều, động cơ đẩy càng mạnh.
   - **I (Integral)** — cộng dồn sai số theo thời gian để triệt tiêu độ lệch ổn định (steady-state error) — ví dụ khi trọng tâm robot không hoàn toàn cân, chỉ riêng P sẽ không bao giờ đưa robot về đúng 0°.
   - **D (Derivative)** — phản ứng theo tốc độ thay đổi của sai số, đóng vai trò "phanh" để chặn dao động qua lại (overshoot) trước khi nó xảy ra.
3. Giá trị PID tính ra được chuyển thành tốc độ và chiều quay của hai động cơ, đẩy robot về phía đang ngã để giữ thăng bằng — lặp lại toàn bộ quy trình hàng trăm lần mỗi giây.

<figure class="diagram">
  <svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ luồng xử lý vòng lặp PID giữ thăng bằng robot">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 12px; fill: var(--color-ink); }
      .arrow { stroke: var(--color-accent); stroke-width: 2; marker-end: url(#arrowhead); fill: none; }
      .sublabel { font-family: var(--font-mono); font-size: 10px; fill: var(--color-ink-soft); }
    </style>
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--color-accent)" />
      </marker>
    </defs>

    <rect x="10" y="20" width="140" height="60" rx="10" class="box" />
    <text x="80" y="45" text-anchor="middle" class="label">Đọc góc nghiêng</text>
    <text x="80" y="62" text-anchor="middle" class="label">(MPU6050)</text>

    <rect x="170" y="20" width="140" height="60" rx="10" class="box" />
    <text x="240" y="45" text-anchor="middle" class="label">Tính sai số</text>
    <text x="240" y="62" text-anchor="middle" class="label">(setpoint − góc)</text>

    <rect x="330" y="20" width="140" height="60" rx="10" class="box" />
    <text x="400" y="45" text-anchor="middle" class="label">Tính PID</text>
    <text x="400" y="62" text-anchor="middle" class="label">(Kp, Ki, Kd)</text>

    <rect x="490" y="20" width="140" height="60" rx="10" class="box" />
    <text x="560" y="45" text-anchor="middle" class="label">Điều khiển động cơ</text>
    <text x="560" y="62" text-anchor="middle" class="label">(PWM + chiều quay)</text>

    <line x1="150" y1="50" x2="170" y2="50" class="arrow" />
    <line x1="310" y1="50" x2="330" y2="50" class="arrow" />
    <line x1="470" y1="50" x2="490" y2="50" class="arrow" />

    <path d="M 560 80 L 560 190 L 80 190 L 80 80" class="arrow" fill="none" />
    <text x="320" y="210" text-anchor="middle" class="sublabel">Lặp lại ~100-200 lần mỗi giây</text>
  </svg>
  <figcaption>Vòng lặp PID: đọc góc, tính sai số, tính đầu ra PID, điều khiển động cơ, rồi lặp lại liên tục.</figcaption>
</figure>

## Linh kiện

- Arduino Uno hoặc Nano (đủ nhanh cho vòng lặp PID ở tần số vài trăm Hz)
- Cảm biến MPU6050 (gia tốc kế + con quay 6 trục), giao tiếp I2C
- Driver động cơ 2 kênh (TB6612FNG hoặc L298N)
- 2 động cơ DC giảm tốc kèm bánh xe
- Khung robot hai bánh (chassis) tự cắt hoặc in 3D, đặt trọng tâm cao vừa phải
- Pin 7.4V-11V (2S hoặc 3S Li-ion/LiPo) cấp nguồn cho driver và động cơ

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối Arduino với cảm biến MPU6050 qua giao tiếp I2C">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="60" width="170" height="180" rx="10" class="box" />
    <text x="115" y="155" text-anchor="middle" class="label">Arduino Uno</text>

    <rect x="440" y="70" width="170" height="160" rx="10" class="box" />
    <text x="525" y="155" text-anchor="middle" class="label">MPU6050</text>

    <line x1="200" y1="90" x2="440" y2="90" class="wire" />
    <text x="320" y="82" text-anchor="middle" class="sublabel">5V → VCC</text>
    <circle cx="200" cy="90" r="4" class="pin" />
    <circle cx="440" cy="90" r="4" class="pin" />

    <line x1="200" y1="130" x2="440" y2="130" class="wire" />
    <text x="320" y="122" text-anchor="middle" class="sublabel">GND → GND</text>
    <circle cx="200" cy="130" r="4" class="pin" />
    <circle cx="440" cy="130" r="4" class="pin" />

    <line x1="200" y1="170" x2="440" y2="170" class="wire" />
    <text x="320" y="162" text-anchor="middle" class="sublabel">A5 (SCL) → SCL</text>
    <circle cx="200" cy="170" r="4" class="pin" />
    <circle cx="440" cy="170" r="4" class="pin" />

    <line x1="200" y1="210" x2="440" y2="210" class="wire" />
    <text x="320" y="202" text-anchor="middle" class="sublabel">A4 (SDA) → SDA</text>
    <circle cx="200" cy="210" r="4" class="pin" />
    <circle cx="440" cy="210" r="4" class="pin" />
  </svg>
  <figcaption>MPU6050 giao tiếp I2C qua 2 dây SCL/SDA, cấp nguồn 5V — driver động cơ đấu song song, dùng các chân digital còn lại (PWM + chiều quay).</figcaption>
</figure>

## Code mẫu

```cpp
#include <Wire.h>
#include <MPU6050_light.h>

MPU6050 mpu(Wire);

// Chan dieu khien driver dong co (vi du TB6612FNG)
const int AIN1 = 7, AIN2 = 8, PWMA = 5; // Dong co trai
const int BIN1 = 9, BIN2 = 10, PWMB = 6; // Dong co phai
const int STBY = 4;

// Hang so PID - can hieu chinh thuc te cho tung robot, day chi la diem xuat phat
double Kp = 25.0;
double Ki = 140.0;
double Kd = 0.8;

double setpoint = 0.0; // goc can bang ly tuong, tinh chinh sau khi lap rap xong
double integral = 0.0;
double lastError = 0.0;
unsigned long lastTime = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  byte status = mpu.begin();
  while (status != 0) { } // dung lai neu MPU6050 loi ket noi

  Serial.println("Dang can chinh MPU6050, giu robot dung yen...");
  delay(1000);
  mpu.calcOffsets(); // tu dong bu offset gyro/accel
  Serial.println("Xong!");

  pinMode(AIN1, OUTPUT); pinMode(AIN2, OUTPUT); pinMode(PWMA, OUTPUT);
  pinMode(BIN1, OUTPUT); pinMode(BIN2, OUTPUT); pinMode(PWMB, OUTPUT);
  pinMode(STBY, OUTPUT);
  digitalWrite(STBY, HIGH);

  lastTime = millis();
}

void loop() {
  mpu.update();
  double angle = mpu.getAngleX(); // doi truc X/Y/Z tuy huong lap MPU6050 thuc te

  unsigned long now = millis();
  double dt = (now - lastTime) / 1000.0;
  if (dt <= 0) dt = 0.001;

  double error = setpoint - angle;
  integral += error * dt;
  integral = constrain(integral, -255, 255); // chong tich luy qua da (anti-windup)
  double derivative = (error - lastError) / dt;

  double output = Kp * error + Ki * integral + Kd * derivative;
  output = constrain(output, -255, 255);

  driveMotors(output);

  lastError = error;
  lastTime = now;

  // Nga qua 45 do coi nhu that bai, dung dong co tranh chay lung tung vo ich
  if (abs(angle) > 45) {
    driveMotors(0);
    integral = 0;
  }
}

void driveMotors(double speed) {
  bool forward = speed >= 0;
  int pwm = constrain(abs((int)speed), 0, 255);

  digitalWrite(AIN1, forward ? HIGH : LOW);
  digitalWrite(AIN2, forward ? LOW : HIGH);
  analogWrite(PWMA, pwm);

  digitalWrite(BIN1, forward ? HIGH : LOW);
  digitalWrite(BIN2, forward ? LOW : HIGH);
  analogWrite(PWMB, pwm);
}
```

Thư viện `MPU6050_light` tự tính một góc nghiêng ổn định bằng bộ lọc bù (complementary filter) kết hợp dữ liệu gia tốc kế và con quay hồi chuyển — đủ tốt cho bài toán này mà không cần tự viết bộ lọc Kalman phức tạp. Nếu muốn độ chính xác cao hơn, MPU6050 còn có DMP (Digital Motion Processor) tích hợp sẵn có thể tính quaternion ngay trên chip.

## Những lỗi thường gặp

- **Hướng lắp MPU6050 quyết định trục nào là "góc nghiêng"** — nếu robot ngã theo hướng ngược với dấu của `angle`, hãy đảo dấu output hoặc đổi trục đọc (`getAngleX`/`getAngleY`) cho khớp thực tế.
- **Vùng chết của động cơ (motor deadband)**: PWM quá nhỏ (dưới ~30-40) không đủ để thắng ma sát tĩnh, động cơ đứng yên dù có tín hiệu — có thể cần cộng thêm một mức PWM tối thiểu khi output khác 0.
- **Tích lũy I không giới hạn (integral windup)** khiến robot lắc mạnh sau khi bị giữ nghiêng lâu rồi thả ra — luôn giới hạn (`constrain`) biến `integral`.
- **In ra Serial mỗi vòng lặp** làm chậm tần số vòng lặp PID đáng kể — chỉ nên in để debug, và tắt hẳn khi đã hiệu chỉnh xong.

**Mẹo hiệu chỉnh PID theo kinh nghiệm thực tế**: bắt đầu với `Ki = Kd = 0`, tăng dần `Kp` cho đến khi robot bắt đầu dao động rung nhẹ quanh vị trí thẳng đứng, rồi giảm `Kp` xuống khoảng 70-80% giá trị đó. Tiếp theo thêm `Kd` để dập dao động cho mượt hơn. Cuối cùng thêm một chút `Ki` nhỏ để triệt tiêu độ lệch còn sót lại — nếu `Ki` quá lớn, robot sẽ lắc qua lại chậm và rộng.

## Mở rộng

Thêm module Bluetooth hoặc ESP32 để điều khiển từ xa (đổi `setpoint` một chút để robot tiến/lùi theo lệnh), thử auto-tuning PID bằng thuật toán Ziegler-Nichols, hoặc nâng cấp lên ESP32 để gửi log góc nghiêng theo thời gian thực qua WiFi cho dễ debug.
