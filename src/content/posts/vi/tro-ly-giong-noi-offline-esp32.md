---
title: "Tự làm trợ lý giọng nói offline với ESP32 và nhận diện từ khoá"
description: "Không cần gửi giọng nói lên cloud: dùng ESP32-S3 và mô hình nhận diện từ khoá nhỏ gọn để bật một thiết bị chỉ bằng giọng nói, chạy hoàn toàn cục bộ."
pubDate: 2026-09-03
lang: vi
category: article
translationId: offline-voice-assistant-esp32
tags: ["esp32", "voice", "edge-ai"]
heroEmoji: "🎙️"
author: "CoderDIY"
---

Các trợ lý giọng nói thương mại đều cần gửi âm thanh lên server để xử lý. Nhưng nếu bạn chỉ cần nhận diện một vài từ khoá cố định — "bật đèn", "tắt quạt" — thì hoàn toàn có thể chạy việc đó ngay trên một vi điều khiển giá rẻ, không cần internet, không cần gửi dữ liệu đi đâu cả.

## Vì sao chạy được trên vi điều khiển

Nhận diện *một từ khoá cụ thể* (wake word / keyword spotting) nhẹ hơn rất nhiều so với nhận diện giọng nói tự do. Mô hình chỉ cần phân biệt vài lớp âm thanh (ví dụ: "bật đèn" / "tắt đèn" / im lặng), nên có thể nén xuống vài trăm KB — vừa đủ chạy trên ESP32-S3 với bộ nhớ hạn chế.

## Phần cứng

- ESP32-S3 (có RAM lớn hơn giúp buffer âm thanh dễ hơn)
- Microphone I2S (ví dụ INMP441) — chất lượng tốt hơn hẳn micro analog
- Relay hoặc MOSFET để điều khiển thiết bị đích (đèn, quạt...)

## Luồng xử lý

1. Micro I2S liên tục ghi âm vào một buffer vòng (circular buffer).
2. Cứ mỗi ~1 giây, trích đặc trưng âm thanh (thường dùng MFCC — Mel-Frequency Cepstral Coefficients).
3. Đưa đặc trưng qua một mạng nơ-ron nhỏ (được huấn luyện sẵn, ví dụ bằng Edge Impulse hoặc TensorFlow Lite Micro).
4. Nếu độ tin cậy vượt ngưỡng, kích hoạt hành động tương ứng.

```cpp
#include "model.h" // model TFLite Micro đã export

void loop() {
  int16_t audio_buffer[SAMPLE_COUNT];
  read_i2s_samples(audio_buffer, SAMPLE_COUNT);

  float features[NUM_FEATURES];
  extract_mfcc(audio_buffer, features);

  float scores[NUM_CLASSES];
  run_inference(features, scores);

  if (scores[CLASS_TURN_ON] > 0.85) {
    digitalWrite(RELAY_PIN, HIGH);
  } else if (scores[CLASS_TURN_OFF] > 0.85) {
    digitalWrite(RELAY_PIN, LOW);
  }
}
```

## Huấn luyện mô hình của riêng bạn

Bạn không cần biết sâu về machine learning để bắt đầu — các công cụ như Edge Impulse cho phép bạn:

1. Thu âm vài chục mẫu cho mỗi từ khoá (chính giọng bạn, trong môi trường thực tế sẽ dùng).
2. Thu thêm mẫu "nhiễu nền" (tiếng quạt, tiếng TV...) để mô hình học cách bỏ qua.
3. Train trên cloud của họ, rồi export ra file `.h` nhúng thẳng vào code Arduino/ESP-IDF.

## Những giới hạn cần biết

- Độ chính xác giảm mạnh nếu môi trường quá ồn hoặc giọng nói không giống mẫu huấn luyện — nên thu mẫu trong đúng điều kiện sẽ dùng thực tế.
- Số từ khoá càng nhiều, mô hình càng lớn và càng dễ nhầm lẫn — với vi điều khiển, 3-5 từ khoá là con số hợp lý.
- Đây không phải trợ lý giọng nói "hiểu ngôn ngữ tự nhiên" — nó chỉ giỏi nhận ra vài mẫu âm thanh cố định, nhưng đổi lại: riêng tư tuyệt đối và phản hồi gần như tức thì.

## Mở rộng

Kết hợp với dự án [trạm thời tiết ESP32](/bai-viet/tram-thoi-tiet-esp32/) trước đó, bạn có thể xây một "trung tâm điều khiển" nhỏ vừa đọc cảm biến, vừa phản hồi giọng nói — tất cả chạy trên cùng một board, không phụ thuộc cloud.
