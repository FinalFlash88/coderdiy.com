---
title: "Hệ thống tưới cây tự động thông minh với Arduino"
description: "Dùng cảm biến độ ẩm đất, Arduino và relay để tưới cây đúng lúc cây cần — kèm code mẫu và mẹo tránh cháy relay hay chết cảm biến."
pubDate: 2026-06-05
lang: vi
category: article
translationId: smart-watering-arduino
tags: ["arduino", "cam-bien", "tu-dong-hoa"]
heroEmoji: "🌱"
author: "CoderDIY"
---

Tưới cây tự động là dự án DIY "must-try" thứ hai sau trạm thời tiết: rẻ, dễ đấu nối, và giải quyết đúng một vấn đề thật — quên tưới cây khi đi công tác.

## Nguyên lý hoạt động

1. Cảm biến độ ẩm đất đo giá trị analog.
2. Arduino so sánh với ngưỡng đặt trước.
3. Nếu đất khô, Arduino bật relay để kích hoạt máy bơm mini trong vài giây, rồi tắt.

## Linh kiện

- Arduino Uno (hoặc bất kỳ board nào có chân analog)
- Cảm biến độ ẩm đất (loại capacitive, bền hơn loại resistive)
- Module relay 1 kênh
- Máy bơm mini 5V hoặc 12V + ống dẫn nước nhỏ
- Nguồn riêng cho máy bơm (không lấy chung nguồn USB với Arduino)

## Code mẫu

```cpp
const int SOIL_PIN = A0;
const int RELAY_PIN = 7;
const int DRY_THRESHOLD = 500; // hiệu chỉnh theo cảm biến thực tế
const unsigned long WATER_DURATION = 4000; // 4 giây mỗi lần tưới
const unsigned long CHECK_INTERVAL = 3600000UL; // kiểm tra mỗi giờ

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); // relay thường active LOW
  Serial.begin(9600);
}

void loop() {
  int moisture = analogRead(SOIL_PIN);
  Serial.println(moisture);

  if (moisture > DRY_THRESHOLD) {
    digitalWrite(RELAY_PIN, LOW);
    delay(WATER_DURATION);
    digitalWrite(RELAY_PIN, HIGH);
  }

  delay(CHECK_INTERVAL);
}
```

> Lưu ý: giá trị `DRY_THRESHOLD` phụ thuộc hoàn toàn vào cảm biến và loại đất của bạn — hãy in giá trị ra Serial Monitor khi đất khô hẳn và khi vừa tưới để tự xác định ngưỡng phù hợp.

## Những lỗi thường gặp

- **Cảm biến resistive bị ăn mòn** sau vài tuần cắm đất ẩm liên tục — nên chọn loại capacitive hoặc chỉ cấp điện cho cảm biến trong lúc đo.
- **Không cách ly nguồn bơm và nguồn Arduino** dễ gây nhiễu hoặc reset board khi bơm khởi động.
- Dùng `delay()` dài (như `CHECK_INTERVAL`) sẽ chặn toàn bộ chương trình — nếu sau này muốn thêm màn hình LCD hay nút bấm, nên chuyển sang dùng `millis()` để không chặn vòng lặp.

## Mở rộng

Ghép thêm ESP32 và gửi dữ liệu độ ẩm lên Home Assistant (xem bài về [trạm thời tiết ESP32](/bai-viet/tram-thoi-tiet-esp32/)) để theo dõi từ xa, hoặc thêm pin mặt trời nhỏ để chạy độc lập ngoài ban công.
