---
title: "Bàn phím macro tự chế với Arduino Pro Micro"
description: "Biến vài nút bấm và một board Pro Micro thành bàn phím macro USB thật, gửi tổ hợp phím tùy chỉnh chỉ với một cú nhấn — kèm code đầy đủ và mẹo debounce."
pubDate: 2026-09-21
lang: vi
category: article
tags: ["arduino", "firmware", "productivity"]
translationId: macro-pad-arduino
heroEmoji: "🎛️"
author: "CoderDIY"
---

Nếu bạn gõ cùng một tổ hợp phím hàng chục lần mỗi ngày — copy, paste, undo, hay một shortcut mở app quen thuộc — một bàn phím macro nhỏ đặt cạnh tay sẽ tiết kiệm rất nhiều thao tác. Điểm hay của dự án này là không cần bo mạch chuyên dụng nào cả: một board Arduino Pro Micro (chip ATmega32U4) và vài cái nút bấm là đủ để tạo ra một thiết bị USB HID thật, được hệ điều hành nhận diện y hệt một bàn phím bình thường.

## Nguyên lý hoạt động

1. ATmega32U4 trên Pro Micro có bộ điều khiển USB gắn liền ngay trên chip, nên nó có thể giả lập một thiết bị HID (Human Interface Device) thật sự — khác với Arduino Uno, nơi cổng USB chỉ là cầu nối serial qua một chip phụ (ATmega16U2) và không gửi được sự kiện bàn phím trực tiếp.
2. Mỗi nút bấm được nối vào một chân digital, dùng `INPUT_PULLUP` nên không cần điện trở ngoài — chân đọc mức `HIGH` khi thả, `LOW` khi nhấn.
3. Firmware liên tục quét trạng thái các chân, khử dội (debounce) bằng thời gian, rồi khi phát hiện một lần nhấn hợp lệ, gọi thư viện `Keyboard.h` để gửi tổ hợp phím tương ứng lên máy tính.

## Linh kiện

- Arduino Pro Micro (ATmega32U4, 5V/16MHz bản phổ biến nhất)
- 4 nút bấm cơ khí (switch loại tact hoặc mechanical switch đều được)
- Dây jumper, breadboard hoặc board đục lỗ để hàn cố định
- Vỏ hộp in 3D hoặc hộp nhựa nhỏ (tùy chọn, để hoàn thiện sản phẩm)
- Cáp Micro-USB để nạp code và kết nối vĩnh viễn

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối Arduino Pro Micro với 4 nút bấm macro">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="50" width="170" height="200" rx="10" class="box" />
    <text x="115" y="155" text-anchor="middle" class="label">Pro Micro</text>

    <rect x="440" y="50" width="170" height="200" rx="10" class="box" />
    <text x="525" y="155" text-anchor="middle" class="label">4 nút bấm</text>

    <line x1="200" y1="80" x2="440" y2="80" class="wire" />
    <text x="320" y="72" text-anchor="middle" class="sublabel">D2 → Nút 1 (Copy)</text>
    <circle cx="200" cy="80" r="4" class="pin" />
    <circle cx="440" cy="80" r="4" class="pin" />

    <line x1="200" y1="120" x2="440" y2="120" class="wire" />
    <text x="320" y="112" text-anchor="middle" class="sublabel">D3 → Nút 2 (Paste)</text>
    <circle cx="200" cy="120" r="4" class="pin" />
    <circle cx="440" cy="120" r="4" class="pin" />

    <line x1="200" y1="160" x2="440" y2="160" class="wire" />
    <text x="320" y="152" text-anchor="middle" class="sublabel">D4 → Nút 3 (Undo)</text>
    <circle cx="200" cy="160" r="4" class="pin" />
    <circle cx="440" cy="160" r="4" class="pin" />

    <line x1="200" y1="200" x2="440" y2="200" class="wire" />
    <text x="320" y="192" text-anchor="middle" class="sublabel">D5 → Nút 4 (Custom)</text>
    <circle cx="200" cy="200" r="4" class="pin" />
    <circle cx="440" cy="200" r="4" class="pin" />

    <line x1="200" y1="230" x2="440" y2="230" class="wire" />
    <text x="320" y="222" text-anchor="middle" class="sublabel">GND → chân chung của cả 4 nút</text>
    <circle cx="200" cy="230" r="4" class="pin" />
    <circle cx="440" cy="230" r="4" class="pin" />
  </svg>
  <figcaption>Mỗi nút nối một chân digital và dùng chung một chân GND — không cần điện trở nhờ INPUT_PULLUP.</figcaption>
</figure>

## Code mẫu

```cpp
#include <Keyboard.h>

const int NUM_KEYS = 4;
const int keyPins[NUM_KEYS] = {2, 3, 4, 5};
bool lastState[NUM_KEYS] = {HIGH, HIGH, HIGH, HIGH};
unsigned long lastDebounceTime[NUM_KEYS] = {0, 0, 0, 0};
const unsigned long DEBOUNCE_DELAY = 25; // ms

void setup() {
  for (int i = 0; i < NUM_KEYS; i++) {
    pinMode(keyPins[i], INPUT_PULLUP);
  }
  Keyboard.begin();
}

void loop() {
  for (int i = 0; i < NUM_KEYS; i++) {
    bool reading = digitalRead(keyPins[i]);

    if (reading != lastState[i]) {
      lastDebounceTime[i] = millis();
    }

    // Chi coi la nhan hop le khi trang thai on dinh qua DEBOUNCE_DELAY
    if ((millis() - lastDebounceTime[i]) > DEBOUNCE_DELAY) {
      if (reading == LOW && lastState[i] == HIGH) {
        sendShortcut(i);
      }
    }

    lastState[i] = reading;
  }
}

void sendShortcut(int index) {
  switch (index) {
    case 0: // Nut 1: Copy
      Keyboard.press(KEY_LEFT_CTRL);
      Keyboard.press('c');
      break;
    case 1: // Nut 2: Paste
      Keyboard.press(KEY_LEFT_CTRL);
      Keyboard.press('v');
      break;
    case 2: // Nut 3: Undo
      Keyboard.press(KEY_LEFT_CTRL);
      Keyboard.press('z');
      break;
    case 3: // Nut 4: to hop phim tuy chinh, vi du mo ung dung yeu thich
      Keyboard.press(KEY_LEFT_CTRL);
      Keyboard.press(KEY_LEFT_SHIFT);
      Keyboard.press('m');
      break;
  }
  delay(10);
  Keyboard.releaseAll();
}
```

Với 4 nút, đấu dây trực tiếp (straight-wired) như trên là đủ đơn giản và không cần quét ma trận. Nếu muốn mở rộng lên 9 nút trở lên, hãy chuyển sang sơ đồ ma trận hàng-cột để không tốn quá nhiều chân digital — mỗi hàng nối một chân output, mỗi cột nối một chân input, và firmware quét lần lượt từng hàng để xác định nút nào đang được nhấn.

## Những lỗi thường gặp

- **Nạp code bị lỗi "board not found"**: vì `Keyboard.begin()` chiếm luôn cổng USB làm bàn phím, nếu sketch có lỗi khiến board "treo" ngay khi khởi động, bạn sẽ không nạp lại được bình thường. Cách khắc phục: nhấn nút reset hai lần liên tiếp thật nhanh để vào chế độ bootloader, rồi nạp code sửa lỗi trong vòng vài giây.
- **Không debounce sẽ gửi nhiều ký tự trùng lặp** chỉ từ một lần nhấn — do tiếp điểm cơ khí rung nhẹ trong vài mili-giây khi đóng/mở mạch.
- **Quên `Keyboard.releaseAll()`** khiến phím bị giữ ở trạng thái "đang nhấn" mãi mãi trên hệ điều hành, làm phím đó lặp lại liên tục hoặc chặn các phím khác.
- Một số hệ điều hành yêu cầu xác nhận thiết bị HID mới lần đầu cắm vào — đừng hoảng nếu macro không hoạt động ngay giây đầu tiên.

## Mở rộng

Thêm một chân dùng làm "phím layer" (giữ để chuyển sang bộ shortcut thứ hai), gắn thêm núm xoay encoder để điều khiển âm lượng, hoặc chuyển hẳn sang firmware QMK/VIA nếu muốn cấu hình lại phím mà không cần nạp lại code mỗi lần.
