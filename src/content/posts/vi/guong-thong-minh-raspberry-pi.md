---
title: "Tự làm gương thông minh với Raspberry Pi"
description: "Ghép Raspberry Pi, một màn hình cũ và tấm mica hai chiều thành gương thông minh hiển thị giờ, thời tiết ngay trên bề mặt gương — kèm code kiosk mode và widget thời tiết."
pubDate: 2026-09-23
lang: vi
category: article
tags: ["raspberry-pi", "python", "home-automation"]
translationId: smart-mirror-raspberry-pi
heroEmoji: "🪞"
author: "CoderDIY"
---

Gương thông minh là dự án vừa đẹp vừa thực dụng: mỗi sáng soi gương đánh răng, bạn tiện thể liếc qua giờ giấc và thời tiết mà không cần cầm điện thoại lên. Phần khó nhất thực ra không phải là điện tử — mà là phần cơ khí ghép mica và khung. Còn phần mềm thì chỉ là một trang web full-screen chạy nền trên trình duyệt.

## Nguyên lý hoạt động

1. **Phần vật lý**: dán một lớp phim mica hai chiều (two-way acrylic mirror film) lên một tấm kính hoặc mica trong suốt. Phía sau tấm này đặt một màn hình LCD/LED thường (tháo từ TV cũ hoặc màn máy tính cũ đều được), và Raspberry Pi giấu phía sau cùng, tất cả gói trong một khung ảnh.
2. Lớp phim hai chiều hoạt động như gương ở phía có ánh sáng mạnh hơn (phòng), nhưng để ánh sáng từ vùng tối hơn (màn hình phía sau) xuyên qua được. Vì vậy, **nền trang web phải là màu đen tuyệt đối** — pixel đen coi như "tắt", chỉ pixel sáng (chữ trắng, icon) mới xuyên qua lớp mica và hiện thành chữ nổi trên mặt gương.
3. Raspberry Pi chạy Chromium ở chế độ kiosk (full màn hình, không thanh địa chỉ, không viền), tự khởi động ngay khi cắm điện, hiển thị một trang HTML đơn giản có đồng hồ và widget thời tiết.

## Linh kiện

- Raspberry Pi (Pi 4 khuyến nghị để render mượt, Pi 3 vẫn chạy được)
- Màn hình LCD cũ (tháo phần vỏ nhựa, chỉ giữ lại tấm panel + mạch điều khiển)
- Phim mica gương hai chiều (two-way mirror acrylic film), kích thước bằng màn hình
- Khung ảnh hoặc khung gỗ tự đóng để chứa toàn bộ cụm
- Thẻ microSD, nguồn 5V cho Pi, và nguồn riêng cho màn hình

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ kết nối Raspberry Pi với màn hình ẩn sau lớp mica gương">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="70" width="170" height="160" rx="10" class="box" />
    <text x="115" y="155" text-anchor="middle" class="label">Raspberry Pi</text>

    <rect x="440" y="60" width="170" height="180" rx="10" class="box" />
    <text x="525" y="130" text-anchor="middle" class="label">Màn hình</text>
    <text x="525" y="150" text-anchor="middle" class="sublabel">(sau lớp mica gương)</text>

    <line x1="200" y1="100" x2="440" y2="100" class="wire" />
    <text x="320" y="92" text-anchor="middle" class="sublabel">HDMI → cổng video màn hình</text>
    <circle cx="200" cy="100" r="4" class="pin" />
    <circle cx="440" cy="100" r="4" class="pin" />

    <line x1="200" y1="150" x2="440" y2="150" class="wire" />
    <text x="320" y="142" text-anchor="middle" class="sublabel">Nguồn 5V riêng → Raspberry Pi</text>
    <circle cx="200" cy="150" r="4" class="pin" />
    <circle cx="440" cy="150" r="4" class="pin" />

    <line x1="200" y1="200" x2="440" y2="200" class="wire" />
    <text x="320" y="192" text-anchor="middle" class="sublabel">Nguồn riêng → mạch điều khiển màn hình</text>
    <circle cx="200" cy="200" r="4" class="pin" />
    <circle cx="440" cy="200" r="4" class="pin" />
  </svg>
  <figcaption>Pi và màn hình dùng hai nguồn điện riêng biệt, nối video qua HDMI, toàn bộ giấu phía sau lớp mica gương hai chiều.</figcaption>
</figure>

## Code mẫu

Trang HTML/CSS/JS full-screen, nền đen, hiển thị đồng hồ và nhiệt độ lấy từ API thời tiết công khai:

```html
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Gương thông minh</title>
<style>
  body { background: #000; color: #fff; font-family: 'Helvetica Neue', sans-serif; margin: 0; overflow: hidden; }
  #clock { font-size: 6rem; text-align: center; margin-top: 10vh; font-weight: 200; }
  #weather { text-align: center; font-size: 2rem; opacity: 0.85; }
</style>
</head>
<body>
  <div id="clock"></div>
  <div id="weather">Đang tải thời tiết...</div>

<script>
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

async function updateWeather() {
  try {
    // Thay LAT/LON bang toa do thuc te noi dat guong
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&current=temperature_2m');
    const data = await res.json();
    const temp = data.current.temperature_2m;
    document.getElementById('weather').textContent = `${temp}°C`;
  } catch (err) {
    document.getElementById('weather').textContent = 'Khong lay duoc du lieu thoi tiet';
  }
}
updateWeather();
setInterval(updateWeather, 10 * 60 * 1000); // cap nhat moi 10 phut
</script>
</body>
</html>
```

Tự động mở Chromium ở chế độ kiosk khi Pi khởi động — tạo file `~/.config/autostart/mirror.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=SmartMirror
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito file:///home/pi/mirror/index.html
```

Thêm vào `~/.config/lxsession/LXDE-pi/autostart` để tắt chế độ tiết kiệm màn hình và ẩn con trỏ chuột (cần cài `unclutter`):

```
@xset s off
@xset -dpms
@xset s noblank
@unclutter -idle 0.5
```

## Những lỗi thường gặp

- **Nền không phải màu đen tuyệt đối** (ví dụ dùng ảnh nền hoặc xám đậm) làm cả vùng đó hiện lờ mờ trên mặt gương thay vì "biến mất" — luôn dùng `#000` thuần cho `body`.
- **Không tắt chế độ tiết kiệm màn hình (DPMS)** khiến màn hình tự tắt sau vài phút không có thao tác chuột/bàn phím — gương thông minh không có input nên chắc chắn sẽ bị tắt nếu quên bước này.
- **Lớp mica hai chiều làm giảm độ sáng đáng kể** (thường 60-70%), nên cần chỉnh độ sáng màn hình lên tối đa mới đủ rõ chữ xuyên qua gương.
- **API thời tiết miễn phí có thể giới hạn số lần gọi** — không nên fetch quá thường xuyên, 10-15 phút một lần là hợp lý.

## Mở rộng

Thêm cảm biến PIR để màn hình chỉ sáng khi có người đứng trước gương (tiết kiệm điện và tăng tuổi thọ panel), tích hợp thông báo từ MQTT/nhà thông minh, hoặc thêm widget lịch/to-do từ một feed JSON riêng.
