---
title: "Lập trình firmware cho bàn phím cơ tự chế với QMK"
description: "Từ một khung bàn phím tự hàn đến một thiết bị input có logic riêng: dùng QMK để lập trình layer, macro và phím tắt cho bàn phím cơ DIY của bạn."
pubDate: 2026-08-30
lang: vi
category: article
translationId: keyboard-firmware-qmk
tags: ["qmk", "ban-phim-co", "firmware"]
heroEmoji: "⌨️"
author: "CoderDIY"
---

Bàn phím cơ tự chế (custom mechanical keyboard) là một trong số ít dự án DIY mà "sản phẩm cuối" là thứ bạn gõ lên nó mỗi ngày. Phần thú vị nhất với một coder không nằm ở việc hàn switch, mà ở firmware — nơi bạn biến một mớ phím vật lý thành một thiết bị input có logic riêng.

## QMK là gì

[QMK](https://qmk.fm) (Quantum Mechanical Keyboard) là firmware mã nguồn mở chạy trên hầu hết vi điều khiển dùng cho bàn phím DIY (AVR, ARM). Thay vì mỗi phím chỉ gửi đúng một ký tự, QMK cho phép bạn định nghĩa **layer** (lớp phím), **macro** (một phím gửi ra cả chuỗi thao tác), và logic tuỳ biến bằng C.

## Cấu trúc một keymap

Một file `keymap.c` tối thiểu trông như sau, định nghĩa 2 layer — layer mặc định và layer chức năng (Fn):

```c
#include QMK_KEYBOARD_H

enum layers { _BASE, _FN };

const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
  [_BASE] = LAYOUT(
    KC_ESC,  KC_Q, KC_W, KC_E, KC_R, KC_T,
    KC_TAB,  KC_A, KC_S, KC_D, KC_F, KC_G,
    KC_LSFT, KC_Z, KC_X, KC_C, KC_V, KC_B,
    KC_LCTL, KC_LGUI, KC_LALT, MO(_FN), KC_SPC
  ),
  [_FN] = LAYOUT(
    KC_GRV,  KC_1, KC_2, KC_3, KC_4, KC_5,
    KC_F1,   KC_F2, KC_F3, KC_F4, KC_F5, KC_F6,
    _______, KC_MPRV, KC_MPLY, KC_MNXT, _______, _______,
    _______, _______, _______, _______, _______
  ),
};
```

`MO(_FN)` nghĩa là "giữ phím này để chuyển sang layer Fn" — đây chính là cách các bàn phím 40-60% vẫn gõ được số và F-key dù thiếu hẳn một hàng phím vật lý.

## Macro: một phím, nhiều thao tác

Muốn một phím gõ ra cả một đoạn text hoặc tổ hợp phím phức tạp? Định nghĩa macro trong `process_record_user`:

```c
enum custom_keycodes { MY_EMAIL = SAFE_RANGE };

bool process_record_user(uint16_t keycode, keyrecord_t *record) {
  if (keycode == MY_EMAIL && record->event.pressed) {
    SEND_STRING("hello@coderdiy.com");
    return false;
  }
  return true;
}
```

## Logic tuỳ biến: phím thông minh theo ngữ cảnh

Đây là phần thực sự biến bàn phím thành "phần mềm chạy trên phần cứng". Ví dụ: một phím tự động gửi Cmd+Tab trên macOS nhưng Alt+Tab trên các hệ điều hành khác, dựa vào cờ bạn set sẵn khi build:

```c
bool process_record_user(uint16_t keycode, keyrecord_t *record) {
  switch (keycode) {
    case KC_APP_SWITCH:
      if (record->event.pressed) {
#ifdef OS_MACOS
        register_code(KC_LGUI);
        tap_code(KC_TAB);
        unregister_code(KC_LGUI);
#else
        register_code(KC_LALT);
        tap_code(KC_TAB);
        unregister_code(KC_LALT);
#endif
      }
      return false;
  }
  return true;
}
```

## Build và nạp firmware

```bash
qmk compile -kb your_keyboard -km your_keymap
qmk flash -kb your_keyboard -km your_keymap
```

## Vì sao đáng thử

Khác với hầu hết dự án DIY khác, bàn phím custom là thứ bạn tương tác hàng nghìn lần mỗi ngày — mỗi macro, mỗi layer bạn viết đều trực tiếp thay đổi trải nghiệm gõ phím của chính mình. Đây cũng là một cách nhẹ nhàng để làm quen với lập trình nhúng bằng C, không cần cảm biến hay mạch phức tạp như các dự án IoT.
