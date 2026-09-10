---
title: "Giám sát điện năng tiêu thụ với ESP32 và cảm biến dòng không tiếp xúc"
description: "Đo công suất tiêu thụ của thiết bị điện bằng cảm biến dòng kẹp SCT-013 và ESP32, gửi dữ liệu qua MQTT — kèm cảnh báo an toàn quan trọng khi làm việc gần điện lưới."
pubDate: 2026-09-14
lang: vi
category: article
translationId: energy-monitor-esp32
tags: ["esp32", "mqtt", "energy"]
heroEmoji: "⚡"
author: "CoderDIY"
---

Muốn biết chiếc tủ lạnh hay máy lạnh nhà bạn đang "ăn" bao nhiêu điện theo thời gian thực mà không cần thuê thợ điện đấu công tơ phụ? Cảm biến dòng kẹp không tiếp xúc (current clamp) kết hợp ESP32 cho phép bạn đo và đẩy dữ liệu công suất lên MQTT để hiển thị trên Home Assistant hay Grafana — hoàn toàn không cần cắt dây hay chạm vào dây dẫn đang có điện.

> **Cảnh báo an toàn**: cảm biến SCT-013 không tiếp xúc trực tiếp với dây điện (chỉ kẹp quanh dây), nhưng bạn vẫn đang làm việc gần hệ thống điện lưới 220V AC. Luôn tắt nguồn/CB trước khi mở tủ điện để lắp đặt, không bao giờ chạm vào đầu dây trần, và nếu không chắc chắn về an toàn điện, hãy nhờ thợ điện có chuyên môn hỗ trợ phần đấu nối với đường dây chính.

## Nguyên lý hoạt động

1. SCT-013 là một biến dòng (current transformer) dạng kẹp: kẹp quanh một dây pha (dây lửa) của thiết bị/đường dây cần đo, nó cảm ứng ra một dòng điện AC nhỏ tỉ lệ với dòng điện chạy qua dây đó — không cần cắt hay đấu nối trực tiếp vào dây.
2. Dòng ra của cảm biến được chuyển thành điện áp AC nhỏ qua một "burden resistor" (điện trở gánh tải), sau đó được dịch mức DC bằng cầu phân áp để nằm trong khoảng 0-3.3V mà ESP32 đọc được.
3. ESP32 lấy hàng trăm mẫu analog liên tục trong một chu kỳ AC, tính giá trị RMS (root-mean-square) của dòng điện, rồi nhân với điện áp lưới (ước lượng 220V) để ra công suất biểu kiến (W).
4. Giá trị công suất được publish định kỳ lên một MQTT broker để các hệ thống khác (Home Assistant, Node-RED, Grafana) subscribe và hiển thị.

## Linh kiện

- ESP32 DevKit (có nhiều chân ADC, chạy được ở 3.3V)
- Cảm biến dòng kẹp không tiếp xúc SCT-013 (loại 100A output 50mA hoặc loại có sẵn burden resistor tích hợp — kiểm tra thông số trước khi mua)
- Điện trở burden resistor (thường 22-33Ω nếu dùng loại SCT-013 output dòng, bỏ qua nếu dùng loại có sẵn output điện áp)
- 2 điện trở 10kΩ để tạo điểm giữa 1.65V làm mức tham chiếu DC offset
- Tụ điện lọc nhiễu 10-100µF
- Thư viện `EmonLib` (cài qua Library Manager) để đơn giản hóa việc tính RMS
- Một MQTT broker (Mosquitto chạy local, hoặc broker cloud miễn phí để test)

<figure class="diagram">
  <svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối ESP32 với cảm biến dòng kẹp SCT-013 qua burden resistor">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="90" width="160" height="120" rx="10" class="box" />
    <text x="120" y="155" text-anchor="middle" class="label">ESP32 DevKit</text>

    <rect x="300" y="90" width="140" height="120" rx="10" class="box" />
    <text x="370" y="145" text-anchor="middle" class="label">Cầu phân áp</text>
    <text x="370" y="163" text-anchor="middle" class="sublabel">2x 10kΩ + burden R</text>

    <rect x="480" y="100" width="140" height="100" rx="10" class="box" />
    <text x="550" y="155" text-anchor="middle" class="label">SCT-013</text>
    <text x="550" y="173" text-anchor="middle" class="sublabel">kẹp quanh dây pha</text>

    <line x1="200" y1="130" x2="300" y2="120" class="wire" />
    <text x="250" y="110" text-anchor="middle" class="sublabel">GPIO34 (ADC) -> giữa cầu phân áp</text>
    <circle cx="200" cy="130" r="4" class="pin" /><circle cx="300" cy="120" r="4" class="pin" />

    <line x1="200" y1="170" x2="300" y2="170" class="wire" />
    <text x="250" y="190" text-anchor="middle" class="sublabel">3.3V -> điểm tham chiếu</text>
    <circle cx="200" cy="170" r="4" class="pin" /><circle cx="300" cy="170" r="4" class="pin" />

    <line x1="440" y1="150" x2="480" y2="150" class="wire" />
    <text x="460" y="140" text-anchor="middle" class="sublabel">2 dây output</text>
    <circle cx="440" cy="150" r="4" class="pin" /><circle cx="480" cy="150" r="4" class="pin" />
  </svg>
  <figcaption>Burden resistor và cầu phân áp chuyển dòng đo được thành điện áp 0-3.3V an toàn cho chân ADC của ESP32.</figcaption>
</figure>

## Code mẫu

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include "EmonLib.h"

const char* WIFI_SSID = "ten_wifi_cua_ban";
const char* WIFI_PASS = "mat_khau_wifi";
const char* MQTT_SERVER = "192.168.1.100";
const char* MQTT_TOPIC = "nha/dien/cong_suat";

const int PIN_DONG = 34;      // chan ADC noi cau phan ap
const double DIEN_AP_LUOI = 220.0;
const double HE_SO_HIEU_CHINH = 30.0; // hieu chinh theo ty so bien dong SCT-013

EnergyMonitor dongDien;
WiFiClient espClient;
PubSubClient mqtt(espClient);

void ketNoiWifiVaMqtt() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(300);

  mqtt.setServer(MQTT_SERVER, 1883);
  while (!mqtt.connected()) {
    mqtt.connect("esp32-giam-sat-dien");
    delay(500);
  }
}

void setup() {
  Serial.begin(115200);
  dongDien.current(PIN_DONG, HE_SO_HIEU_CHINH);
  ketNoiWifiVaMqtt();
}

void loop() {
  if (!mqtt.connected()) ketNoiWifiVaMqtt();
  mqtt.loop();

  double dongRMS = dongDien.calcIrms(1480); // lay 1480 mau moi lan tinh
  double congSuat = dongRMS * DIEN_AP_LUOI;

  Serial.print("Dong dien: "); Serial.print(dongRMS); Serial.println(" A");
  Serial.print("Cong suat: "); Serial.print(congSuat); Serial.println(" W");

  char payload[16];
  dtostrf(congSuat, 4, 1, payload);
  mqtt.publish(MQTT_TOPIC, payload);

  delay(5000); // publish moi 5 giay
}
```

> `HE_SO_HIEU_CHINH` cần hiệu chỉnh bằng thực nghiệm: cắm một thiết bị có công suất đã biết (ví dụ bóng đèn 100W), so sánh giá trị đọc được với giá trị thực tế rồi điều chỉnh hệ số cho khớp.

## Những lỗi thường gặp

- **Nhầm SCT-013 loại output dòng và loại có sẵn burden resistor**: một số phiên bản SCT-013 đã tích hợp sẵn điện trở burden bên trong đầu jack, cắm thêm burden resistor ngoài sẽ cho kết quả sai hoàn toàn — kiểm tra datasheet trước khi lắp.
- **Không tạo điểm tham chiếu DC offset**: tín hiệu AC dao động quanh 0V sẽ bị cắt mất phần âm nếu ESP32 chỉ đọc được 0-3.3V — bắt buộc phải dùng cầu phân áp để dịch tín hiệu lên giữa khoảng 1.65V.
- **Đo công suất "biểu kiến" thay vì công suất thực**: cách tính `dòng x điện áp` ở trên bỏ qua hệ số công suất (power factor), nên với tải có động cơ (máy lạnh, tủ lạnh) kết quả sẽ hơi lệch so với công tơ điện thực tế — chấp nhận được cho mục đích giám sát tương đối, không dùng để đối chiếu hóa đơn.
- **Kẹp cảm biến lỏng hoặc kẹp cả 2 dây (lửa + trung tính)**: kẹp cả hai dây sẽ triệt tiêu từ trường và cho kết quả gần bằng 0 — chỉ kẹp đúng một dây pha.

## Mở rộng

Thêm cảm biến điện áp AC thực (ZMPT101B) thay vì dùng hằng số 220V cố định để tính công suất chính xác hơn và đo được cả hệ số công suất, hoặc gắn nhiều cảm biến SCT-013 trên từng nhánh CB trong tủ điện để biết chính xác thiết bị nào đang tiêu thụ nhiều điện nhất.
