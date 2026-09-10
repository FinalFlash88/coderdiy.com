---
title: "Camera time-lapse theo dõi cây trồng với Raspberry Pi"
description: "Dùng Raspberry Pi và Pi Camera chụp ảnh cây trồng mỗi 10 phút suốt vài tuần, rồi ghép thành video time-lapse bằng ffmpeg — kèm script chụp và lệnh dựng video cụ thể."
pubDate: 2026-09-22
lang: vi
category: article
tags: ["raspberry-pi", "python", "camera"]
translationId: plant-timelapse-camera
heroEmoji: "🌿"
author: "CoderDIY"
---

Xem một hạt mầm nảy lên rồi vươn lá trong vài giây video luôn là thứ gây nghiện, mà lại là một trong những dự án Raspberry Pi dễ bắt đầu nhất: không cần cảm biến phức tạp, không cần mạch điện — chỉ cần một camera, một lịch chụp đều đặn, và một lệnh ffmpeg ở cuối để ghép mọi thứ lại.

## Nguyên lý hoạt động

1. Pi Camera được gắn cố định, hướng thẳng vào chậu cây, không xê dịch trong suốt quá trình theo dõi.
2. Một script Python dùng thư viện `picamera2` chụp một ảnh, đặt tên theo timestamp, rồi thoát — chạy độc lập mỗi lần được gọi.
3. `cron` (hoặc systemd timer) gọi script này theo chu kỳ cố định, ví dụ mỗi 10 phút, suốt ngày đêm trong vài tuần.
4. Khi đã có đủ ảnh, dùng `ffmpeg` ghép toàn bộ chuỗi ảnh theo thứ tự thời gian thành một file video MP4.

Điểm mấu chốt để video mượt, không giật hình: **khóa cứng phơi sáng và cân bằng trắng** cho mọi lần chụp. Nếu để camera tự động điều chỉnh theo ánh sáng từng thời điểm trong ngày, video cuối cùng sẽ bị nhấp nháy sáng-tối liên tục giữa các khung hình.

## Linh kiện

- Raspberry Pi (Pi 3/4/Zero 2 W đều dùng được)
- Pi Camera Module (v2 hoặc v3, kết nối qua cáp dẹt CSI)
- Thẻ microSD dung lượng đủ lớn (khuyến nghị 32GB trở lên, hoặc gắn thêm ổ USB nếu chụp dài ngày)
- Giá đỡ hoặc kẹp cố định camera, tránh rung lắc giữa các lần chụp
- Nguồn 5V ổn định cho Pi chạy liên tục nhiều tuần

<figure class="diagram">
  <svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ kết nối Raspberry Pi với Pi Camera qua cáp CSI">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="80" width="170" height="100" rx="10" class="box" />
    <text x="125" y="135" text-anchor="middle" class="label">Raspberry Pi</text>

    <rect x="430" y="80" width="170" height="100" rx="10" class="box" />
    <text x="515" y="135" text-anchor="middle" class="label">Pi Camera</text>

    <line x1="210" y1="120" x2="430" y2="120" class="wire" />
    <text x="320" y="112" text-anchor="middle" class="sublabel">Cổng CSI → cáp dẹt camera</text>
    <circle cx="210" cy="120" r="4" class="pin" />
    <circle cx="430" cy="120" r="4" class="pin" />

    <line x1="210" y1="150" x2="430" y2="150" class="wire" />
    <text x="320" y="142" text-anchor="middle" class="sublabel">Giá đỡ cố định, hướng thẳng chậu cây</text>
    <circle cx="210" cy="150" r="4" class="pin" />
    <circle cx="430" cy="150" r="4" class="pin" />
  </svg>
  <figcaption>Camera cắm vào cổng CSI qua cáp dẹt và được cố định chắc chắn để mọi khung hình cùng một góc nhìn.</figcaption>
</figure>

## Code mẫu

Script chụp một ảnh, dùng thông số phơi sáng cố định để tránh nhấp nháy:

```python
#!/usr/bin/env python3
import time
from datetime import datetime
from picamera2 import Picamera2

OUTPUT_DIR = "/home/pi/timelapse"

picam2 = Picamera2()
config = picam2.create_still_configuration(main={"size": (1920, 1080)})
picam2.configure(config)

# Khoa phoi sang va can bang trang de tat ca khung hinh giong het nhau ve do sang
picam2.set_controls({
    "AeEnable": False,
    "AwbEnable": False,
    "ExposureTime": 20000,      # micro giay, chinh theo anh sang thuc te noi dat cay
    "AnalogueGain": 1.5,
    "ColourGains": (1.4, 1.6),  # (do, xanh duong) - do truoc de tim gia tri on dinh
})

picam2.start()
time.sleep(2)  # cho cam bien on dinh truoc khi chup

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
filename = f"{OUTPUT_DIR}/frame_{timestamp}.jpg"
picam2.capture_file(filename)
picam2.close()
```

Thêm dòng sau vào `crontab -e` để chụp mỗi 10 phút:

```
*/10 * * * * /usr/bin/python3 /home/pi/capture_frame.py >> /home/pi/timelapse.log 2>&1
```

Sau vài tuần, ghép toàn bộ ảnh thành video bằng ffmpeg:

```bash
ffmpeg -framerate 24 -pattern_type glob -i '/home/pi/timelapse/frame_*.jpg' \
  -vf "scale=1920:-2" -c:v libx264 -pix_fmt yuv420p /home/pi/timelapse_output.mp4
```

`-framerate 24` nghĩa là cứ 24 ảnh gộp thành 1 giây video — với ảnh chụp mỗi 10 phút, 1 giây video tương ứng khoảng 4 giờ thực tế.

## Những lỗi thường gặp

- **Để camera tự động phơi sáng/cân bằng trắng** là nguyên nhân phổ biến nhất gây nhấp nháy video — luôn khóa `AeEnable` và `AwbEnable` như trong script trên.
- **Cron chạy với môi trường khác terminal** — không có sẵn `PATH` đầy đủ, nên luôn dùng đường dẫn tuyệt đối (`/usr/bin/python3`, đường dẫn file script đầy đủ) trong dòng crontab.
- **Thẻ nhớ đầy sau vài tuần** vì mỗi ảnh full-HD tốn khoảng 1-2MB, chụp mỗi 10 phút suốt một tháng có thể lên tới hàng GB — cân nhắc gắn thêm ổ USB hoặc tự động xóa ảnh cũ sau khi đã render video.
- **Tên file phải sắp xếp đúng thứ tự thời gian** để `ffmpeg -pattern_type glob` ghép đúng trình tự — định dạng timestamp `YYYYMMDD_HHMMSS` đảm bảo sắp xếp theo bảng chữ cái trùng với sắp xếp theo thời gian.

## Mở rộng

Thêm cảm biến ánh sáng để tự bỏ qua khung hình ban đêm (đỡ tốn dung lượng vô ích), chèn watermark ngày-giờ lên video bằng bộ lọc `drawtext` của ffmpeg, hoặc tự động đồng bộ ảnh lên lưu trữ đám mây/NAS mỗi đêm để không lo mất dữ liệu nếu thẻ nhớ hỏng giữa chừng.
