---
title: "Chế robot hút bụi mini điều khiển bằng Raspberry Pi và Python"
description: "Nhật ký dự án: dùng Raspberry Pi, cảm biến siêu âm và Python để biến một khung xe robot thành máy dò vật cản né chướng ngại tự động."
pubDate: 2026-07-20
lang: vi
category: article
translationId: robot-vacuum-pi
tags: ["raspberry-pi", "python", "robotics", "gpio"]
heroEmoji: "🤖"
author: "CoderDIY"
---

Không cần chờ mua robot hút bụi xịn, bạn hoàn toàn có thể tự chế một con robot 2 bánh biết né vật cản bằng Raspberry Pi — vừa rẻ, vừa học được cả phần cứng lẫn phần mềm.

## Khung phần cứng

- Raspberry Pi (3B+ trở lên là thoải mái)
- Khung xe robot 2 bánh + động cơ DC + driver động cơ (L298N)
- Cảm biến siêu âm HC-SR04 để đo khoảng cách
- Pin sạc dự phòng cấp nguồn cho Pi, pack pin riêng cho động cơ

## Ý tưởng điều khiển

Vòng lặp chính rất đơn giản: đo khoảng cách phía trước → nếu gần vật cản thì dừng, xoay sang hướng khác → nếu không thì tiếp tục đi thẳng.

```python
import RPi.GPIO as GPIO
import time

TRIG, ECHO = 23, 24
MOTOR_LEFT_FWD, MOTOR_RIGHT_FWD = 17, 27

GPIO.setmode(GPIO.BCM)
GPIO.setup(TRIG, GPIO.OUT)
GPIO.setup(ECHO, GPIO.IN)
GPIO.setup([MOTOR_LEFT_FWD, MOTOR_RIGHT_FWD], GPIO.OUT)

def read_distance_cm():
    GPIO.output(TRIG, True)
    time.sleep(0.00001)
    GPIO.output(TRIG, False)

    start = time.time()
    while GPIO.input(ECHO) == 0:
        start = time.time()
    while GPIO.input(ECHO) == 1:
        stop = time.time()

    return (stop - start) * 34300 / 2

def drive_forward():
    GPIO.output(MOTOR_LEFT_FWD, True)
    GPIO.output(MOTOR_RIGHT_FWD, True)

def stop():
    GPIO.output(MOTOR_LEFT_FWD, False)
    GPIO.output(MOTOR_RIGHT_FWD, False)

try:
    while True:
        distance = read_distance_cm()
        if distance < 20:
            stop()
            time.sleep(0.3)
            # xoay sang phải để tránh vật cản, code điều khiển bánh trái/phải riêng
        else:
            drive_forward()
        time.sleep(0.1)
finally:
    GPIO.cleanup()
```

## Những vấn đề thực tế sẽ gặp

- **Nguồn cho động cơ và Pi nên tách riêng** — chung một nguồn dễ gây reset Pi khi động cơ khởi động.
- Cảm biến siêu âm phản xạ kém với bề mặt góc cạnh hoặc vải mềm, nên tính thêm timeout cho `read_distance_cm`.
- Bánh xe rẻ tiền thường lệch tốc độ trái/phải, cần hiệu chỉnh (calibrate) bằng PWM riêng cho từng bên thay vì bật/tắt đơn giản như ví dụ trên.

## Mở rộng

Sau khi né vật cản ổn, bạn có thể thêm: bản đồ hoá đơn giản bằng cách ghi lại quãng đường đã đi, gắn camera Pi để nhận diện vật thể, hoặc điều khiển từ xa qua web app nhỏ chạy Flask. Đây là một dự án tốt để thấy rõ ranh giới giữa "viết code" và "code điều khiển vật thật" — sai số phần cứng sẽ dạy bạn nhiều thứ mà lập trình thuần tuý không có.
