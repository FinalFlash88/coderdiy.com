---
title: "Máy đo mức ồn tương đối với ESP32 và dashboard web tích hợp sẵn"
description: "Lấy mẫu biên độ âm thanh bằng cảm biến mic, tính mức ồn tương đối theo thời gian thực, và xem biểu đồ trực tiếp ngay trên web server nhúng trong ESP32."
pubDate: 2026-09-20
lang: vi
category: article
translationId: noise-level-monitor
tags: ["esp32", "sensors", "dashboard"]
heroEmoji: "🔊"
author: "CoderDIY"
---

Muốn biết phòng làm việc hay phòng ngủ ồn cỡ nào theo thời gian trong ngày mà không cần mua máy đo decibel chuyên dụng? ESP32 kèm một cảm biến âm thanh rẻ tiền đủ để dựng một máy theo dõi mức ồn tương đối, tự vẽ biểu đồ trên một trang web nhỏ chạy ngay trên chip — không cần server ngoài, không cần app.

## Nguyên lý hoạt động

1. Cảm biến âm thanh (analog sound sensor hoặc mic MEMS I2S như INMP441) liên tục xuất tín hiệu biên độ tương ứng với âm lượng xung quanh.
2. ESP32 lấy mẫu tín hiệu này ở tần suất vài trăm lần/giây, tính giá trị RMS (root-mean-square) hoặc đỉnh (peak) trong mỗi cửa sổ thời gian ngắn (ví dụ 100ms) để ra một con số "mức ồn tương đối".
3. Các giá trị này được lưu vào một mảng trong RAM (ví dụ 60 điểm gần nhất, mỗi điểm đại diện một giây).
4. ESP32 chạy một web server nhúng, phục vụ một trang HTML/JS nhỏ; trang này gọi định kỳ một endpoint JSON để lấy dữ liệu mới nhất và vẽ biểu đồ đường cập nhật liên tục.

> Lưu ý quan trọng: đây là chỉ số **tương đối**, không phải mức decibel dB(A) đã hiệu chuẩn chuẩn xác như máy đo âm thanh chuyên dụng. Cảm biến analog rẻ tiền phản hồi không tuyến tính và không có trọng số tần số theo tai người — đủ dùng để so sánh "lúc nào ồn hơn lúc nào" trong cùng một cảm biến, nhưng đừng dùng con số này để so sánh tuyệt đối giữa các phòng khác nhau hoặc coi là số đo pháp lý.

## Linh kiện

- ESP32 DevKit
- Cảm biến âm thanh analog (module KY-038/máy dò âm lượng đơn giản) hoặc mic MEMS I2S INMP441 (chính xác và ít nhiễu hơn nhiều, khuyến nghị nếu có ngân sách)
- Dây jumper
- Vỏ nhỏ có lỗ thoáng cho mic (tránh bọc kín hoàn toàn làm suy giảm tín hiệu âm)

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối ESP32 với mic MEMS I2S INMP441">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="60" width="160" height="180" rx="10" class="box" />
    <text x="110" y="155" text-anchor="middle" class="label">ESP32 DevKit</text>

    <rect x="450" y="50" width="150" height="200" rx="10" class="box" />
    <text x="525" y="145" text-anchor="middle" class="label">INMP441</text>
    <text x="525" y="163" text-anchor="middle" class="sublabel">(mic I2S)</text>

    <line x1="190" y1="90" x2="450" y2="80" class="wire" />
    <text x="320" y="75" text-anchor="middle" class="sublabel">GPIO25 -> WS</text>
    <circle cx="190" cy="90" r="4" class="pin" />
    <circle cx="450" cy="80" r="4" class="pin" />

    <line x1="190" y1="130" x2="450" y2="120" class="wire" />
    <text x="320" y="115" text-anchor="middle" class="sublabel">GPIO26 -> SCK</text>
    <circle cx="190" cy="130" r="4" class="pin" />
    <circle cx="450" cy="120" r="4" class="pin" />

    <line x1="190" y1="170" x2="450" y2="160" class="wire" />
    <text x="320" y="155" text-anchor="middle" class="sublabel">GPIO22 -> SD</text>
    <circle cx="190" cy="170" r="4" class="pin" />
    <circle cx="450" cy="160" r="4" class="pin" />

    <line x1="190" y1="210" x2="450" y2="200" class="wire" />
    <text x="320" y="195" text-anchor="middle" class="sublabel">3V3 + GND chung</text>
    <circle cx="190" cy="210" r="4" class="pin" />
    <circle cx="450" cy="200" r="4" class="pin" />
  </svg>
  <figcaption>ESP32 đọc dữ liệu âm thanh số qua giao thức I2S từ mic MEMS INMP441, chính xác hơn nhiều so với cảm biến analog.</figcaption>
</figure>

## Code mẫu

```cpp
#include <WiFi.h>
#include <WebServer.h>
#include <driver/i2s.h>

const char* WIFI_SSID = "ten-wifi";
const char* WIFI_PASS = "mat-khau-wifi";

WebServer server(80);

#define I2S_WS 25
#define I2S_SCK 26
#define I2S_SD 22
#define SO_MAU 256

const int SO_DIEM_LUU = 60;
float lichSuMucOn[SO_DIEM_LUU];
int chiSoHienTai = 0;

void thietLapI2S() {
  i2s_config_t cauHinh = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = 16000,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = 0,
    .dma_buf_count = 4,
    .dma_buf_len = SO_MAU,
  };
  i2s_pin_config_t chanI2S = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD,
  };
  i2s_driver_install(I2S_NUM_0, &cauHinh, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &chanI2S);
}

float doMucOnHienTai() {
  int32_t bufferMau[SO_MAU];
  size_t soByteDoc = 0;
  i2s_read(I2S_NUM_0, bufferMau, sizeof(bufferMau), &soByteDoc, portMAX_DELAY);

  int soMauDoc = soByteDoc / sizeof(int32_t);
  double tongBinhPhuong = 0;
  for (int i = 0; i < soMauDoc; i++) {
    double mau = bufferMau[i] >> 14; // dua ve thang gia tri hop ly hon
    tongBinhPhuong += mau * mau;
  }
  double rms = sqrt(tongBinhPhuong / soMauDoc);
  return (float)rms;
}

void xuLyDuLieuJSON() {
  String json = "[";
  for (int i = 0; i < SO_DIEM_LUU; i++) {
    int idx = (chiSoHienTai + i) % SO_DIEM_LUU;
    json += String(lichSuMucOn[idx], 1);
    if (i < SO_DIEM_LUU - 1) json += ",";
  }
  json += "]";
  server.send(200, "application/json", json);
}

void xuLyTrangChu() {
  String html = R"(
  <html><body style="font-family:sans-serif">
  <h2>Muc on tuong doi</h2>
  <canvas id="bieuDo" width="600" height="200" style="border:1px solid #888"></canvas>
  <script>
    async function capNhat() {
      const res = await fetch('/du-lieu');
      const data = await res.json();
      const canvas = document.getElementById('bieuDo');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const maxVal = Math.max(...data, 1);
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = (i / data.length) * canvas.width;
        const y = canvas.height - (v / maxVal) * canvas.height;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    setInterval(capNhat, 1000);
    capNhat();
  </script>
  </body></html>
  )";
  server.send(200, "text/html", html);
}

void setup() {
  Serial.begin(115200);
  thietLapI2S();

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
  }
  Serial.println("Dia chi IP: " + WiFi.localIP().toString());

  server.on("/", xuLyTrangChu);
  server.on("/du-lieu", xuLyDuLieuJSON);
  server.begin();
}

void loop() {
  server.handleClient();

  static unsigned long lanDoTruoc = 0;
  if (millis() - lanDoTruoc >= 1000) {
    lichSuMucOn[chiSoHienTai] = doMucOnHienTai();
    chiSoHienTai = (chiSoHienTai + 1) % SO_DIEM_LUU;
    lanDoTruoc = millis();
  }
}
```

## Những lỗi thường gặp

- **Coi con số RMS đọc được là dB(A) thật sự** — như đã nói ở trên, đây chỉ là chỉ số tương đối; nếu cần số đo chuẩn hóa, phải hiệu chuẩn bằng máy đo âm thanh tham chiếu và áp dụng trọng số tần số A-weighting, phức tạp hơn nhiều so với phạm vi bài này.
- **Dùng cảm biến analog rẻ tiền (KY-038) mà kỳ vọng độ chính xác cao** — loại này chỉ có ngưỡng bật/tắt digital và một chân analog phản hồi khá thô, phù hợp phát hiện "có tiếng động hay không" hơn là đo mức độ chi tiết; nếu cần dữ liệu tin cậy hơn, đầu tư mic I2S INMP441 là đáng giá.
- **Đặt mic gần quạt tản nhiệt hoặc nguồn nhiễu điện** khiến dữ liệu bị nhiễu nền liên tục — nên tách mic ra xa mạch nguồn switching và quạt.
- **Mảng lưu trong RAM sẽ mất khi mất điện/khởi động lại** — nếu cần lưu lịch sử dài hạn, phải ghi ra thẻ SD hoặc gửi định kỳ lên một dịch vụ lưu trữ ngoài.

## Mở rộng

Gửi dữ liệu qua MQTT để lưu trữ dài hạn trong InfluxDB/Grafana thay vì chỉ giữ 60 điểm gần nhất trong RAM, hoặc thêm cảnh báo tự động (đèn LED hoặc buzzer) khi mức ồn vượt ngưỡng đặt trước trong một khoảng thời gian liên tục — hữu ích để theo dõi phòng làm việc hoặc phòng ngủ trẻ nhỏ.
