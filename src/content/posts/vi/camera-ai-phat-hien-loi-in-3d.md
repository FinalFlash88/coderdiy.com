---
title: "Camera AI phát hiện lỗi khi in 3D bằng Raspberry Pi và OpenCV"
description: "Dùng webcam, Raspberry Pi và một chút xử lý ảnh để tự động phát hiện 'spaghetti' hoặc bong tróc khi in 3D, rồi tự động tạm dừng máy in qua OctoPrint."
pubDate: 2026-09-06
lang: vi
category: article
translationId: 3d-print-failure-detector
tags: ["raspberry-pi", "opencv", "in-3d"]
heroEmoji: "🖨️"
author: "CoderDIY"
---

Ai in 3D nhiều cũng từng gặp cảnh: đi ngủ với một bản in đang chạy ổn, sáng ra thấy cả cuộn nhựa đã bị kéo thành một mớ "spaghetti" quấn quanh đầu phun vì lớp đầu tiên bong khỏi bàn in từ lúc nào không hay. Một camera + chút code xử lý ảnh có thể phát hiện sự cố này và tự dừng máy in trước khi lãng phí thêm nhựa và điện.

## Ý tưởng cốt lõi

Không cần AI phức tạp để bắt đầu — cách đơn giản và đáng tin cậy nhất là **so sánh khung hình theo thời gian**: một bản in đang chạy tốt sẽ thay đổi *từ từ và có quy luật* giữa các khung hình liên tiếp. Nếu khung hình đột ngột thay đổi rất nhiều diện tích cùng lúc (dấu hiệu điển hình của spaghetti), đó là tín hiệu cảnh báo.

## Phần cứng

- Raspberry Pi (3B+ trở lên) chạy OctoPrint hoặc Klipper/Moonraker
- Webcam USB hướng vào bàn in
- (Tuỳ chọn) đèn LED cố định để ánh sáng ổn định, tránh false positive do bóng đổ thay đổi

## Xử lý ảnh cơ bản với OpenCV

```python
import cv2
import numpy as np
import requests

cap = cv2.VideoCapture(0)
prev_frame = None
OCTOPRINT_URL = "http://localhost/api/job"
API_KEY = "your_octoprint_api_key"

def pause_print():
    requests.post(
        OCTOPRINT_URL,
        headers={"X-Api-Key": API_KEY},
        json={"command": "pause", "action": "pause"},
    )

while True:
    ret, frame = cap.read()
    if not ret:
        continue

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (21, 21), 0)

    if prev_frame is not None:
        diff = cv2.absdiff(prev_frame, gray)
        _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
        changed_ratio = np.count_nonzero(thresh) / thresh.size

        if changed_ratio > 0.15:  # hiệu chỉnh theo camera/khoảng cách thực tế
            print("Phát hiện thay đổi bất thường — có thể là lỗi in!")
            pause_print()

    prev_frame = gray
    cv2.waitKey(2000)  # kiểm tra mỗi 2 giây
```

## Vì sao dùng frame-diff thay vì model AI ngay từ đầu

Frame-diff không cần huấn luyện, chạy nhẹ trên cả Pi Zero, và đủ tốt cho phần lớn trường hợp "spaghetti" rõ ràng. Nếu muốn chính xác hơn (phân biệt được lớp bong nhẹ, warping góc, dây nhựa thừa), bước tiếp theo là train một mô hình phân loại nhỏ (ví dụ MobileNet fine-tune) trên vài trăm ảnh in lỗi/thành công — nhưng với đa số máy in cá nhân, frame-diff đã đủ ngăn được thảm hoạ tốn nhựa nhất.

## Mẹo giảm báo động giả

- Cố định camera thật chắc — rung nhẹ cũng đủ gây ra diff lớn.
- Giữ ánh sáng ổn định, tránh cửa sổ có nắng chiếu trực tiếp thay đổi theo giờ.
- Tăng ngưỡng `changed_ratio` trong vài lớp in đầu và các lớp có nhiều chi tiết nhỏ (infill dày đặc dễ gây diff lớn dù không lỗi gì).

## Mở rộng

Ghép thêm Telegram hoặc webhook để nhận thông báo ngay khi máy tạm dừng, hoặc log lại các khung hình bất thường để sau này dùng làm dữ liệu huấn luyện cho một mô hình chính xác hơn.
