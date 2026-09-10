---
title: "Tự chế máy chơi game retro với Raspberry Pi, RetroPie và tay cầm GPIO"
description: "Nối nút bấm và cần điều khiển kiểu arcade trực tiếp vào chân GPIO của Raspberry Pi, đọc bằng một daemon Python để RetroPie nhận như bàn phím."
pubDate: 2026-09-18
lang: vi
category: article
translationId: retro-game-console-pi
tags: ["raspberry-pi", "retropie", "electronics"]
heroEmoji: "🕹️"
author: "CoderDIY"
---

RetroPie chạy tốt với tay cầm USB có sẵn, nhưng cái thú vị nằm ở chỗ tự hàn một bộ nút bấm arcade thật, nối thẳng vào GPIO của Raspberry Pi, rồi viết phần mềm để hệ thống hiểu những cú bấm đó là phím mũi tên và nút A/B. Đây là bước khó nhằn nhất khi tự chế một thùng máy game (bartop/cabinet) từ đầu.

## Nguyên lý hoạt động

1. Mỗi nút bấm/vi công tắc trên cần điều khiển arcade là một công tắc đơn giản nối giữa một chân GPIO và GND.
2. Raspberry Pi bật điện trở kéo lên nội (`pull_up_down=GPIO.PUD_UP`) cho từng chân, nên khi không bấm, chân đọc mức HIGH; khi bấm, chân bị nối GND nên đọc mức LOW.
3. Một daemon Python chạy nền, liên tục quét các chân GPIO, phát hiện cạnh xuống (nhấn) sau khi đã khử rung, rồi mô phỏng sự kiện bàn phím tương ứng qua `uinput`.
4. RetroPie/EmulationStation nhận các sự kiện bàn phím giả lập này y hệt như gõ phím thật, không cần sửa gì trong cấu hình game.

## Linh kiện

- Raspberry Pi (3B+ trở lên khuyến nghị để giả lập mượt các hệ máy đời sau)
- Bộ nút bấm arcade + cần điều khiển (joystick) kiểu vi công tắc (microswitch), 8 hoặc hơn
- Dây jumper cái-cái hoặc dây bấm cos để nối nút với chân GPIO
- Thẻ SD 16GB trở lên cài RetroPie
- Vỏ thùng máy hoặc bảng gỗ/mica khoan lỗ gắn nút (tùy sáng tạo của bạn)

<figure class="diagram">
  <svg viewBox="0 0 640 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối các nút bấm arcade vào chân GPIO của Raspberry Pi">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="20" width="160" height="290" rx="10" class="box" />
    <text x="120" y="170" text-anchor="middle" class="label">Raspberry Pi</text>
    <text x="120" y="188" text-anchor="middle" class="sublabel">(header GPIO)</text>

    <rect x="440" y="30" width="160" height="60" rx="10" class="box" />
    <text x="520" y="65" text-anchor="middle" class="label">Nut LEN</text>

    <rect x="440" y="110" width="160" height="60" rx="10" class="box" />
    <text x="520" y="145" text-anchor="middle" class="label">Nut XUONG</text>

    <rect x="440" y="190" width="160" height="60" rx="10" class="box" />
    <text x="520" y="225" text-anchor="middle" class="label">Nut A</text>

    <rect x="440" y="270" width="160" height="60" rx="10" class="box" />
    <text x="520" y="305" text-anchor="middle" class="label">Nut B</text>

    <line x1="200" y1="60" x2="440" y2="60" class="wire" />
    <text x="320" y="52" text-anchor="middle" class="sublabel">GPIO17 -> chan 1 nut</text>
    <circle cx="200" cy="60" r="4" class="pin" />
    <circle cx="440" cy="60" r="4" class="pin" />

    <line x1="200" y1="140" x2="440" y2="140" class="wire" />
    <text x="320" y="132" text-anchor="middle" class="sublabel">GPIO27 -> chan 1 nut</text>
    <circle cx="200" cy="140" r="4" class="pin" />
    <circle cx="440" cy="140" r="4" class="pin" />

    <line x1="200" y1="220" x2="440" y2="220" class="wire" />
    <text x="320" y="212" text-anchor="middle" class="sublabel">GPIO22 -> chan 1 nut</text>
    <circle cx="200" cy="220" r="4" class="pin" />
    <circle cx="440" cy="220" r="4" class="pin" />

    <line x1="200" y1="300" x2="440" y2="300" class="wire" />
    <text x="320" y="292" text-anchor="middle" class="sublabel">GPIO23 -> chan 1 nut</text>
    <circle cx="200" cy="300" r="4" class="pin" />
    <circle cx="440" cy="300" r="4" class="pin" />

    <text x="320" y="330" text-anchor="middle" class="sublabel">Chan 2 tat ca nut noi chung ve GND tren Pi</text>
  </svg>
  <figcaption>Mỗi nút bấm arcade nối một chân GPIO với GND — Pi dùng điện trở kéo lên nội để đọc mức LOW khi nhấn.</figcaption>
</figure>

## Code mẫu

```python
#!/usr/bin/env python3
import RPi.GPIO as GPIO
import time
from uinput import Device
import uinput

# Anh xa: chan GPIO -> phim ban phim gia lap
BAN_PHIM = {
    17: uinput.KEY_UP,
    27: uinput.KEY_DOWN,
    22: uinput.KEY_Z,     # Nut A -> phim Z (EmulationStation mac dinh)
    23: uinput.KEY_X,     # Nut B -> phim X
}

THOI_GIAN_KHU_RUNG = 0.03  # 30ms

GPIO.setmode(GPIO.BCM)
for chan in BAN_PHIM:
    GPIO.setup(chan, GPIO.IN, pull_up_down=GPIO.PUD_UP)

device = Device(list(BAN_PHIM.values()))

trang_thai_truoc = {chan: GPIO.HIGH for chan in BAN_PHIM}

print("Dang lang nghe nut bam... Nhan Ctrl+C de thoat")

try:
    while True:
        for chan, phim in BAN_PHIM.items():
            trang_thai_hien_tai = GPIO.input(chan)

            # Phat hien canh xuong: truoc la HIGH, gio la LOW => vua bam
            if trang_thai_truoc[chan] == GPIO.HIGH and trang_thai_hien_tai == GPIO.LOW:
                time.sleep(THOI_GIAN_KHU_RUNG)
                if GPIO.input(chan) == GPIO.LOW:  # xac nhan lai sau khu rung
                    device.emit(phim, 1)  # nhan phim
                    print(f"Nut GPIO{chan} duoc nhan")

            # Phat hien canh len: vua nha nut
            if trang_thai_truoc[chan] == GPIO.LOW and trang_thai_hien_tai == GPIO.HIGH:
                device.emit(phim, 0)  # nha phim

            trang_thai_truoc[chan] = trang_thai_hien_tai

        time.sleep(0.005)  # quet moi 5ms, du nhanh cho cam giac "tuc thi"

except KeyboardInterrupt:
    GPIO.cleanup()
```

> Cài `python3-uinput` (`sudo apt install python3-uinput`) và nạp module kernel `uinput` (`sudo modprobe uinput`, thêm vào `/etc/modules` để tự nạp khi khởi động). Nếu muốn cách làm sẵn có thay vì viết tay, dự án `Adafruit-Retrogame` hoặc `mk_arcade_joystick_rpi` cũng làm chính xác việc này qua kernel driver, không cần chạy daemon Python riêng.

## Những lỗi thường gặp

- **Không khử rung (debounce) cho vi công tắc** khiến một lần bấm bị hiểu thành nhiều lần nhấn liên tiếp — đoạn `time.sleep(THOI_GIAN_KHU_RUNG)` kèm xác nhận lại trạng thái ở trên là cách khử rung đơn giản bằng phần mềm, đủ dùng cho hầu hết vi công tắc arcade.
- **Chạy daemon Python bằng `python3 script.py` thủ công** rồi tắt terminal là mất — nên tạo service `systemd` để daemon tự chạy khi Pi khởi động.
- **Đấu nhầm chân 3.3V thay vì GND** vào một chân nút bấm sẽ khiến chân GPIO đó luôn đọc HIGH giả hoặc trong trường hợp xấu gây hỏng chân GPIO — luôn kiểm tra lại bằng đồng hồ đo trước khi cấp điện.
- EmulationStation cần được cấu hình nhận các phím ảo này trong `es_input.cfg` — vào menu cấu hình input ngay trong giao diện RetroPie và "bấm" từng nút thật để nó tự ghi lại.

## Mở rộng

Thêm một chiết áp xoay hoặc encoder để làm nút chỉnh âm lượng vật lý, hoặc gắn thêm màn hình nhỏ SPI hiển thị thông tin game đang chạy ngoài màn hình TV chính — cả hai đều dùng chung nguyên lý đọc GPIO như bài này.
