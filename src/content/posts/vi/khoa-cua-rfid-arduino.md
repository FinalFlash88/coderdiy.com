---
title: "Khóa cửa RFID với Arduino và RC522: chỉ mở khi đúng thẻ"
description: "Xây dựng khóa cửa dùng thẻ RFID với Arduino, module RC522 và servo — kèm cách đọc UID thẻ, danh sách thẻ được phép, và code mẫu đầy đủ."
pubDate: 2026-09-12
lang: vi
category: article
translationId: rfid-door-lock-arduino
tags: ["arduino", "rfid", "security"]
heroEmoji: "🔐"
author: "CoderDIY"
---

Khóa cửa bằng thẻ RFID là dự án nhập môn bảo mật phần cứng lý tưởng: rẻ, dễ hiểu nguyên lý, và tạo cảm giác "thành phẩm thật" rất nhanh — chỉ sau một buổi tối là bạn có thể quẹt thẻ để mở cửa tủ, hộp đồ, hoặc cửa phòng nhỏ.

## Nguyên lý hoạt động

1. Module RC522 phát sóng RFID tần số 13.56MHz, đọc UID (mã định danh duy nhất) của thẻ hoặc móc khóa đưa lại gần.
2. Arduino nhận UID qua giao tiếp SPI, so sánh với danh sách UID được phép lưu sẵn trong code.
3. Nếu khớp, Arduino quay servo để mở chốt khóa trong vài giây rồi tự đóng lại; đồng thời bật đèn xanh/còi báo "chấp nhận".
4. Nếu không khớp, đèn đỏ nhấp nháy báo "từ chối".

## Linh kiện

- Arduino Uno (hoặc Nano)
- Module đọc thẻ RFID RC522 (giao tiếp SPI)
- Thẻ/móc khóa RFID 13.56MHz (Mifare Classic là loại phổ biến nhất)
- Servo SG90 gắn với chốt khóa cơ khí (hoặc dùng khóa solenoid 12V + module relay nếu cần lực giữ lớn hơn)
- 2 LED (xanh, đỏ) + buzzer nhỏ báo hiệu
- Thư viện `MFRC522` (cài qua Library Manager trong Arduino IDE)

<figure class="diagram">
  <svg viewBox="0 0 640 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối Arduino Uno với module RC522 qua SPI">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="60" width="160" height="220" rx="10" class="box" />
    <text x="120" y="170" text-anchor="middle" class="label">Arduino Uno</text>

    <rect x="440" y="80" width="160" height="180" rx="10" class="box" />
    <text x="520" y="170" text-anchor="middle" class="label">RC522</text>

    <line x1="200" y1="90" x2="440" y2="100" class="wire" />
    <text x="320" y="82" text-anchor="middle" class="sublabel">Pin 10 -> SDA</text>
    <circle cx="200" cy="90" r="4" class="pin" /><circle cx="440" cy="100" r="4" class="pin" />

    <line x1="200" y1="120" x2="440" y2="125" class="wire" />
    <text x="320" y="112" text-anchor="middle" class="sublabel">Pin 13 -> SCK</text>
    <circle cx="200" cy="120" r="4" class="pin" /><circle cx="440" cy="125" r="4" class="pin" />

    <line x1="200" y1="150" x2="440" y2="150" class="wire" />
    <text x="320" y="142" text-anchor="middle" class="sublabel">Pin 11 -> MOSI</text>
    <circle cx="200" cy="150" r="4" class="pin" /><circle cx="440" cy="150" r="4" class="pin" />

    <line x1="200" y1="180" x2="440" y2="175" class="wire" />
    <text x="320" y="172" text-anchor="middle" class="sublabel">Pin 12 -> MISO</text>
    <circle cx="200" cy="180" r="4" class="pin" /><circle cx="440" cy="175" r="4" class="pin" />

    <line x1="200" y1="210" x2="440" y2="200" class="wire" />
    <text x="320" y="202" text-anchor="middle" class="sublabel">Pin 9 -> RST</text>
    <circle cx="200" cy="210" r="4" class="pin" /><circle cx="440" cy="200" r="4" class="pin" />

    <line x1="200" y1="240" x2="440" y2="225" class="wire" />
    <text x="320" y="232" text-anchor="middle" class="sublabel">3.3V -> VCC, GND -> GND</text>
    <circle cx="200" cy="240" r="4" class="pin" /><circle cx="440" cy="225" r="4" class="pin" />
  </svg>
  <figcaption>RC522 hoạt động ở mức 3.3V — tuyệt đối không cấp 5V vào chân VCC của module.</figcaption>
</figure>

## Code mẫu

Bước 1: đọc UID của thẻ để biết cần thêm giá trị gì vào danh sách cho phép.

```cpp
#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 10
#define RST_PIN 9
MFRC522 rfid(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("Dua the lai gan de doc UID...");
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  Serial.print("UID: ");
  for (byte i = 0; i < rfid.uid.size; i++) {
    Serial.print(rfid.uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(rfid.uid.uidByte[i], HEX);
  }
  Serial.println();
  rfid.PICC_HaltA();
}
```

Bước 2: khóa cửa thực tế với danh sách UID được phép.

```cpp
#include <SPI.h>
#include <MFRC522.h>
#include <Servo.h>

#define SS_PIN 10
#define RST_PIN 9
#define LED_XANH 6
#define LED_DO 5
#define BUZZER 4
#define SERVO_PIN 3

MFRC522 rfid(SS_PIN, RST_PIN);
Servo lockServo;

// Danh sách UID được phép (viết hoa, không dấu cách)
String danhSachChoPhep[] = {
  "A1B2C3D4",
  "1A2B3C4D"
};
const int SO_LUONG_THE = 2;

void moKhoa() {
  digitalWrite(LED_XANH, HIGH);
  tone(BUZZER, 1000, 200);
  lockServo.write(90); // vi tri mo
  delay(4000);
  lockServo.write(0);  // vi tri khoa
  digitalWrite(LED_XANH, LOW);
}

void tuChoi() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_DO, HIGH);
    tone(BUZZER, 300, 100);
    delay(150);
    digitalWrite(LED_DO, LOW);
    delay(150);
  }
}

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  lockServo.attach(SERVO_PIN);
  lockServo.write(0);
  pinMode(LED_XANH, OUTPUT);
  pinMode(LED_DO, OUTPUT);
  pinMode(BUZZER, OUTPUT);
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  bool duocPhep = false;
  for (int i = 0; i < SO_LUONG_THE; i++) {
    if (uid == danhSachChoPhep[i]) { duocPhep = true; break; }
  }

  if (duocPhep) {
    Serial.println("The hop le -> Mo khoa");
    moKhoa();
  } else {
    Serial.println("The khong hop le -> Tu choi");
    tuChoi();
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}
```

## Những lỗi thường gặp

- **Cấp nhầm 5V cho RC522**: module chỉ chịu được mức logic 3.3V, cấp 5V vào VCC có thể làm cháy chip trong vài giây.
- **Servo giật/không đủ lực giữ chốt**: SG90 khá yếu, nếu chốt cửa nặng nên đổi sang khóa solenoid 12V điều khiển qua relay thay vì kéo trực tiếp bằng servo.
- **So sánh UID sai định dạng**: UID đọc ra có thể có hoặc không có số 0 ở đầu byte — cần chuẩn hóa nhất quán (ví dụ luôn thêm "0" khi byte < 0x10) giữa lúc ghi danh sách và lúc so sánh, nếu không thẻ hợp lệ vẫn bị từ chối.
- **Không có cơ chế chống dò UID bằng brute-force**: vì đây là dự án DIY quy mô nhỏ nên chấp nhận được, nhưng đừng dùng cách này cho cửa thực sự quan trọng — RFID UID có thể bị sao chép bằng thiết bị chuyên dụng.

## Mở rộng

Lưu danh sách UID vào EEPROM để thêm/xóa thẻ mà không cần nạp lại code, hoặc ghi log thời gian mở khóa lên thẻ SD/Google Sheets qua ESP8266 để biết ai mở cửa lúc nào.
