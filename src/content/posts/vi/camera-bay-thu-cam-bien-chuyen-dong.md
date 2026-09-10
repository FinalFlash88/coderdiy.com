---
title: "Camera bẫy thú với Raspberry Pi và cảm biến chuyển động PIR"
description: "Dùng Raspberry Pi, Pi Camera và cảm biến PIR để tự động chụp ảnh/quay clip mỗi khi có chim hay động vật ghé vườn — kèm code Python với picamera2 và cơ chế chống spam file."
pubDate: 2026-09-15
lang: vi
category: article
translationId: wildlife-camera-raspberry-pi
tags: ["raspberry-pi", "python", "camera"]
heroEmoji: "🐦"
author: "CoderDIY"
---

Muốn biết con gì hay ghé qua sân vườn hay máng ăn chim nhà bạn vào ban đêm hoặc lúc bạn vắng nhà? Một camera bẫy thú tự chế bằng Raspberry Pi rẻ hơn nhiều so với camera thương mại chuyên dụng, và bạn hoàn toàn kiểm soát được nơi lưu ảnh — không cần tài khoản cloud, không cần trả phí thuê bao.

## Nguyên lý hoạt động

1. Cảm biến PIR liên tục theo dõi thay đổi bức xạ hồng ngoại trong vùng quan sát; khi có vật thể ấm (chim, sóc, mèo...) di chuyển qua, chân output của PIR chuyển từ LOW lên HIGH.
2. Script Python trên Raspberry Pi liên tục kiểm tra trạng thái chân GPIO nối với PIR.
3. Khi phát hiện HIGH, script dùng `picamera2` để chụp một ảnh tĩnh (hoặc quay clip vài giây), lưu file với tên có timestamp.
4. Sau mỗi lần chụp, script chờ một khoảng "cooldown" trước khi tiếp tục theo dõi, để một con vật đứng lại ăn không tạo ra hàng trăm file trùng lặp.

## Linh kiện

- Raspberry Pi (Zero 2 W là lựa chọn tiết kiệm và đủ dùng, Pi 4/5 nếu muốn quay video độ phân giải cao)
- Pi Camera Module (v2 hoặc v3, gắn qua cổng CSI)
- Cảm biến chuyển động PIR (HC-SR501)
- Thẻ microSD đủ dung lượng lưu ảnh/video (khuyến nghị 32GB trở lên nếu để chạy nhiều ngày)
- Hộp đựng chống nước nếu đặt ngoài trời (xem phần lưu ý bên dưới)
- Pin sạc dự phòng hoặc nguồn 5V ổn định nếu đặt xa ổ điện

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối Raspberry Pi với cảm biến PIR và Pi Camera">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="230" y="100" width="180" height="140" rx="10" class="box" />
    <text x="320" y="165" text-anchor="middle" class="label">Raspberry Pi</text>
    <text x="320" y="185" text-anchor="middle" class="sublabel">(Zero 2 W / Pi 4)</text>

    <rect x="20" y="110" width="150" height="100" rx="10" class="box" />
    <text x="95" y="165" text-anchor="middle" class="label">Cảm biến PIR</text>

    <rect x="460" y="120" width="150" height="80" rx="10" class="box" />
    <text x="535" y="165" text-anchor="middle" class="label">Pi Camera (CSI)</text>

    <line x1="170" y1="140" x2="230" y2="130" class="wire" />
    <text x="200" y="122" text-anchor="middle" class="sublabel">OUT -> GPIO4</text>
    <circle cx="170" cy="140" r="4" class="pin" /><circle cx="230" cy="130" r="4" class="pin" />

    <line x1="170" y1="170" x2="230" y2="160" class="wire" />
    <text x="200" y="182" text-anchor="middle" class="sublabel">VCC -> 5V, GND -> GND</text>
    <circle cx="170" cy="170" r="4" class="pin" /><circle cx="230" cy="160" r="4" class="pin" />

    <line x1="410" y1="150" x2="460" y2="150" class="wire" />
    <text x="435" y="140" text-anchor="middle" class="sublabel">cáp ribbon CSI</text>
    <circle cx="410" cy="150" r="4" class="pin" /><circle cx="460" cy="150" r="4" class="pin" />
  </svg>
  <figcaption>Cảm biến PIR dùng nguồn 5V nhưng chân OUT phát tín hiệu 3.3V an toàn cho GPIO của Pi.</figcaption>
</figure>

## Code mẫu

```python
#!/usr/bin/env python3
import time
from datetime import datetime
from pathlib import Path
from gpiozero import MotionSensor
from picamera2 import Picamera2

CHAN_PIR = 4
THU_MUC_LUU = Path("/home/pi/anh_thu")
THOI_GIAN_NGHI = 30  # giay - tranh chup lien tuc khi con vat con o gan

THU_MUC_LUU.mkdir(exist_ok=True)

pir = MotionSensor(CHAN_PIR)
camera = Picamera2()
cau_hinh = camera.create_still_configuration()
camera.configure(cau_hinh)
camera.start()
time.sleep(2)  # cho cam bien anh sang on dinh

print("San sang. Dang cho chuyen dong...")

try:
    while True:
        pir.wait_for_motion()
        thoi_diem = datetime.now().strftime("%Y%m%d_%H%M%S")
        duong_dan = THU_MUC_LUU / f"con_vat_{thoi_diem}.jpg"

        camera.capture_file(str(duong_dan))
        print(f"Da chup: {duong_dan}")

        # cho het thoi gian nghi truoc khi theo doi tiep,
        # tranh spam anh khi con vat dung lai an lau
        time.sleep(THOI_GIAN_NGHI)

except KeyboardInterrupt:
    print("Dung chuong trinh.")
finally:
    camera.stop()
```

Chạy nền liên tục bằng systemd hoặc đơn giản hơn với `nohup`:

```bash
nohup python3 camera_bay_thu.py > log.txt 2>&1 &
```

> Muốn quay clip video ngắn thay vì ảnh tĩnh, thay `camera.capture_file()` bằng `camera.start_and_record_video(str(duong_dan_mp4), duration=8)` từ thư viện `picamera2.encoders`.

## Những lỗi thường gặp

- **Không đặt thời gian "nghi" của cảm biến PIR ổn định**: nhiều module HC-SR501 có biến trở chỉnh thời gian giữ tín hiệu HIGH (time delay) và độ nhạy — chỉnh quá nhạy sẽ chụp cả khi lá cây rung theo gió.
- **Thiếu cooldown ở tầng code**: chỉ dựa vào độ trễ phần cứng của PIR là chưa đủ; nên luôn thêm `time.sleep()` sau mỗi lần chụp trong code để kiểm soát chủ động, tránh một con vật đứng ăn 5 phút tạo ra hàng chục file trùng.
- **Camera chưa "warm up"**: gọi `capture_file()` ngay sau `camera.start()` có thể cho ảnh bị tối hoặc lệch màu vì cảm biến ánh sáng chưa kịp tự cân chỉnh — luôn chờ 1-2 giây trước khi chụp lần đầu.
- **Đầy thẻ SD**: chạy vài tuần liên tục với độ phân giải cao có thể lấp đầy thẻ nhanh hơn dự kiến — nên thêm script dọn ảnh cũ tự động hoặc đồng bộ định kỳ lên máy tính/NAS.

## Lưu ý khi đặt ngoài trời

Nếu gắn camera ngoài vườn, hãy dùng hộp nhựa chống nước (IP65 trở lên) có lỗ khoét vừa ống kính camera, và để hở một khe thông hơi nhỏ để tránh đọng hơi nước bên trong hộp khi nhiệt độ thay đổi giữa ngày và đêm — hơi ẩm đọng lại là nguyên nhân phổ biến khiến board bị oxy hóa sau vài tháng.

## Mở rộng

Thêm đèn hồng ngoại (IR illuminator) để chụp được ảnh rõ vào ban đêm mà không làm động vật giật mình bởi ánh sáng thường, hoặc chạy một mô hình nhận diện loài động vật đơn giản (TensorFlow Lite) trên Pi để tự động phân loại ảnh theo loài thay vì phải xem thủ công.
