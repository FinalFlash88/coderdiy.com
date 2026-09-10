---
title: "Điều khiển dải đèn LED RGB qua trang web với ESP32"
description: "Dùng ESP32 tự host một trang web chọn màu cho dải WS2812/NeoPixel — không cần app, không cần tài khoản cloud, chỉ cần mở trình duyệt trong mạng LAN."
pubDate: 2026-09-30
lang: vi
category: article
translationId: web-controlled-led-strip
tags: ["esp32", "led", "web"]
heroEmoji: "🌈"
author: "CoderDIY"
---

Đèn LED RGB điều khiển qua app điện thoại thì đầy ngoài chợ, nhưng phần lớn bắt bạn tạo tài khoản, cài app nặng nề, và đôi khi phụ thuộc vào server của hãng ở xa. Dự án này làm điều tương tự nhưng hoàn toàn cục bộ: ESP32 tự chạy một web server nhỏ, trả về một trang HTML chọn màu, và bạn điều khiển dải LED WS2812 ngay từ trình duyệt điện thoại hay laptop — không cần cài gì, không cần internet, chỉ cần cùng mạng WiFi.

## Nguyên lý hoạt động

1. ESP32 kết nối WiFi và chạy một `WebServer` lắng nghe cổng 80.
2. Khi truy cập địa chỉ IP của ESP32, server trả về một trang HTML nhúng sẵn bảng chọn màu và vài nút chọn hiệu ứng.
3. Trang web gọi một endpoint dạng `/set?r=255&g=0&b=0` (hoặc gửi JSON) mỗi khi người dùng chọn màu mới.
4. ESP32 nhận request, parse tham số, và cập nhật màu cho toàn bộ dải LED qua thư viện `FastLED`.
5. Với hiệu ứng động (như hiệu ứng cầu vồng), một cờ trạng thái được bật trong `loop()` để liên tục cập nhật màu theo thời gian thay vì set một màu tĩnh.

## Linh kiện

- ESP32 DevKit
- Dải LED WS2812B / NeoPixel (bắt đầu với 30-60 LED để dễ cấp nguồn)
- Nguồn 5V riêng đủ dòng cho dải LED — mỗi LED có thể kéo tới 60mA ở độ sáng trắng tối đa, dải 60 LED cần nguồn gần 3.5A nếu bật full trắng
- Tụ 1000µF nối giữa 5V và GND ngay gần đầu dải LED để chống sụt áp đột ngột
- Điện trở 300-500Ω nối tiếp trên dây tín hiệu data (tùy chọn nhưng nên có, giúp bảo vệ LED đầu tiên)

> Về mức logic: WS2812 chuẩn thiết kế cho tín hiệu data 5V, trong khi GPIO của ESP32 chỉ ra 3.3V. Với dải ngắn (dưới khoảng 1-2 mét, ít LED), tín hiệu 3.3V thường vẫn đủ để LED nhận diện đúng, đặc biệt nếu dây tín hiệu ngắn và nguồn 5V khỏe. Nhưng để chắc chắn, đặc biệt với dải dài hoặc khi gặp hiện tượng LED đầu nhấp nháy sai màu, nên dùng IC chuyển mức như 74HCT245, hoặc mẹo đơn giản hơn là mắc một con diode thường (1N4148) nối tiếp trên đường 5V cấp cho LED để kéo mức "high" mà ESP32 coi là hợp lệ xuống gần 3.3V hơn.

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối ESP32 với dải LED WS2812">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="70" width="160" height="160" rx="10" class="box" />
    <text x="120" y="155" text-anchor="middle" class="label">ESP32</text>

    <rect x="440" y="70" width="160" height="160" rx="10" class="box" />
    <text x="520" y="155" text-anchor="middle" class="label">Dai WS2812</text>

    <line x1="200" y1="100" x2="440" y2="100" class="wire" />
    <text x="320" y="92" text-anchor="middle" class="sublabel">Nguon 5V rieng -&gt; VCC</text>
    <circle cx="200" cy="100" r="4" class="pin" />
    <circle cx="440" cy="100" r="4" class="pin" />

    <line x1="200" y1="150" x2="440" y2="150" class="wire" />
    <text x="320" y="142" text-anchor="middle" class="sublabel">GND (chung) -&gt; GND</text>
    <circle cx="200" cy="150" r="4" class="pin" />
    <circle cx="440" cy="150" r="4" class="pin" />

    <line x1="200" y1="200" x2="440" y2="200" class="wire" />
    <text x="320" y="192" text-anchor="middle" class="sublabel">GPIO5 -&gt; DIN (qua tro 330 ohm)</text>
    <circle cx="200" cy="200" r="4" class="pin" />
    <circle cx="440" cy="200" r="4" class="pin" />
  </svg>
  <figcaption>ESP32 chỉ điều khiển chân data; dải LED cần nguồn 5V riêng, GND phải nối chung với ESP32.</figcaption>
</figure>

## Code mẫu

```cpp
#include <WiFi.h>
#include <WebServer.h>
#include <FastLED.h>

#define LED_PIN     5
#define NUM_LEDS    60
CRGB leds[NUM_LEDS];

const char* ssid = "TEN_WIFI";
const char* password = "MAT_KHAU_WIFI";

WebServer server(80);

enum Mode { SOLID, RAINBOW };
Mode currentMode = SOLID;
uint8_t rainbowHue = 0;

const char PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:2em;">
<h2>Dieu khien den LED</h2>
<input type="color" id="picker" value="#ff0000" style="width:100px;height:60px;">
<br><br>
<button onclick="setSolid()">Ap dung mau</button>
<button onclick="setRainbow()">Hieu ung cau vong</button>
<script>
function setSolid() {
  const hex = document.getElementById('picker').value;
  const r = parseInt(hex.substr(1,2), 16);
  const g = parseInt(hex.substr(3,2), 16);
  const b = parseInt(hex.substr(5,2), 16);
  fetch(`/set?r=${r}&g=${g}&b=${b}`);
}
function setRainbow() { fetch('/rainbow'); }
</script>
</body></html>
)rawliteral";

void handleRoot() {
  server.send(200, "text/html", PAGE);
}

void handleSet() {
  if (server.hasArg("r") && server.hasArg("g") && server.hasArg("b")) {
    int r = server.arg("r").toInt();
    int g = server.arg("g").toInt();
    int b = server.arg("b").toInt();
    currentMode = SOLID;
    fill_solid(leds, NUM_LEDS, CRGB(r, g, b));
    FastLED.show();
  }
  server.send(200, "text/plain", "OK");
}

void handleRainbow() {
  currentMode = RAINBOW;
  server.send(200, "text/plain", "OK");
}

void setup() {
  Serial.begin(115200);
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(120); // gioi han do sang de giam tai nguon

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println(WiFi.localIP());

  server.on("/", handleRoot);
  server.on("/set", handleSet);
  server.on("/rainbow", handleRainbow);
  server.begin();
}

void loop() {
  server.handleClient();

  if (currentMode == RAINBOW) {
    fill_rainbow(leds, NUM_LEDS, rainbowHue, 255 / NUM_LEDS);
    FastLED.show();
    rainbowHue++;
    delay(20); // toc do chay cua hieu ung
  }
}
```

## Những lỗi thường gặp

- **Không cấp nguồn riêng cho dải LED** — lấy 5V từ cổng USB nạp code của ESP32 chỉ đủ cho vài LED sáng yếu; dải dài hơn 10-15 LED ở độ sáng cao sẽ làm sụt áp, LED nhấp nháy hoặc đổi màu sai.
- **Quên nối chung GND** giữa ESP32 và nguồn cấp cho dải LED — đây là lỗi cực kỳ phổ biến, tín hiệu data sẽ vô nghĩa nếu hai bên không chung điểm 0V tham chiếu.
- **Gọi `FastLED.show()` quá dày trong vòng lặp chính** khi server đang xử lý nhiều request cùng lúc — nên giới hạn tốc độ cập nhật hiệu ứng động bằng `delay()` hoặc kiểm tra `millis()` thay vì update mỗi vòng lặp.
- **Không giới hạn `setBrightness()`** — chạy 100% độ sáng trên dải dài dễ vượt quá khả năng cấp dòng của nguồn, dải LED nóng bất thường là dấu hiệu cần giảm độ sáng hoặc nâng cấp nguồn.

## Mở rộng

Thêm hiệu ứng "thở" (breathing) bằng cách điều biến độ sáng theo hàm sin, hoặc lưu màu yêu thích vào bộ nhớ `Preferences` của ESP32 để dải LED tự khôi phục đúng màu sau khi mất điện.
