---
title: "Hệ thống báo động tia laser với Arduino"
description: "Dùng module laser và cảm biến quang trở LDR làm bẫy tia hồng ngoại kiểu phim hành động — kèm bước hiệu chỉnh baseline tự động và chống báo động giả."
pubDate: 2026-09-28
lang: vi
category: article
translationId: laser-tripwire-alarm
tags: ["arduino", "security", "sensors"]
heroEmoji: "🔺"
author: "CoderDIY"
---

Bẫy tia laser kiểu "phim trộm cắp" là một trong những dự án Arduino vui nhất để làm: một chùm tia laser chiếu liên tục vào cảm biến ánh sáng đặt cách đó vài mét, và ngay khi có ai đó cắt ngang chùm tia, còi báo động hú lên. Về công nghệ, nó chỉ là một mạch chia áp quang trở đơn giản — nhưng để tránh báo động giả, bạn cần hiểu vì sao phải hiệu chỉnh baseline và debounce tín hiệu.

## Nguyên lý hoạt động

1. Module laser diode được cấp nguồn liên tục, chiếu một điểm sáng cố định vào cảm biến LDR đặt đối diện.
2. LDR nằm trong mạch chia áp; khi có ánh sáng laser chiếu vào, điện trở LDR giảm, điện áp đọc được ở chân analog tăng lên.
3. Khi khởi động, Arduino đo và lưu lại giá trị "baseline" (mức sáng bình thường khi tia laser đang chiếu tới) trong khoảng 2 giây.
4. Trong vòng lặp chính, nếu giá trị đọc được tụt xuống dưới baseline một khoảng đáng kể — nghĩa là có vật cản chùm tia — và tình trạng đó duy trì liên tục trong ít nhất vài trăm mili giây, hệ thống coi là có xâm nhập thật và kích còi.
5. Còi kêu liên tục cho tới khi nhấn nút reset thủ công.

## Linh kiện

- Arduino Uno hoặc Nano
- Module laser diode 5V (loại luôn sáng, không cần điều biến)
- Quang trở LDR + điện trở 10kΩ để tạo mạch chia áp
- Còi buzzer active (loại chỉ cần cấp nguồn là kêu, không cần tín hiệu tần số)
- Nút bấm reset
- Giá đỡ để cố định laser và LDR thẳng hàng — đây là phần khó nhất về mặt cơ khí, không phải điện tử

<figure class="diagram">
  <svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ đấu nối Arduino với cảm biến LDR và còi báo động">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="20" width="150" height="260" rx="10" class="box" />
    <text x="105" y="155" text-anchor="middle" class="label">Arduino</text>

    <rect x="440" y="20" width="170" height="110" rx="10" class="box" />
    <text x="525" y="65" text-anchor="middle" class="label">LDR</text>
    <text x="525" y="85" text-anchor="middle" class="sublabel">(chia ap voi 10k)</text>

    <rect x="440" y="180" width="170" height="100" rx="10" class="box" />
    <text x="525" y="235" text-anchor="middle" class="label">Coi buzzer</text>

    <line x1="180" y1="40" x2="440" y2="40" class="wire" />
    <text x="310" y="32" text-anchor="middle" class="sublabel">5V -&gt; VCC</text>
    <circle cx="180" cy="40" r="4" class="pin" />
    <circle cx="440" cy="40" r="4" class="pin" />

    <line x1="180" y1="70" x2="440" y2="70" class="wire" />
    <text x="310" y="62" text-anchor="middle" class="sublabel">GND -&gt; GND</text>
    <circle cx="180" cy="70" r="4" class="pin" />
    <circle cx="440" cy="70" r="4" class="pin" />

    <line x1="180" y1="100" x2="440" y2="100" class="wire" />
    <text x="310" y="92" text-anchor="middle" class="sublabel">A0 &lt;- tin hieu chia ap</text>
    <circle cx="180" cy="100" r="4" class="pin" />
    <circle cx="440" cy="100" r="4" class="pin" />

    <line x1="180" y1="200" x2="440" y2="200" class="wire" />
    <text x="310" y="192" text-anchor="middle" class="sublabel">D8 -&gt; tin hieu</text>
    <circle cx="180" cy="200" r="4" class="pin" />
    <circle cx="440" cy="200" r="4" class="pin" />

    <line x1="180" y1="225" x2="440" y2="225" class="wire" />
    <text x="310" y="217" text-anchor="middle" class="sublabel">5V -&gt; VCC</text>
    <circle cx="180" cy="225" r="4" class="pin" />
    <circle cx="440" cy="225" r="4" class="pin" />

    <line x1="180" y1="250" x2="440" y2="250" class="wire" />
    <text x="310" y="242" text-anchor="middle" class="sublabel">GND -&gt; GND</text>
    <circle cx="180" cy="250" r="4" class="pin" />
    <circle cx="440" cy="250" r="4" class="pin" />
  </svg>
  <figcaption>Laser chiếu thẳng vào LDR đặt cách xa; Arduino theo dõi điện áp chia áp và kích còi khi tia bị chắn.</figcaption>
</figure>

## Code mẫu

```cpp
const int LDR_PIN = A0;
const int BUZZER_PIN = 8;
const int RESET_BUTTON_PIN = 2;

int baseline = 0;
const int TRIP_MARGIN = 150;        // do sut gia tri de coi la "bi chan"
const unsigned long TRIP_HOLD_MS = 200; // phai duy tri sut sang trong 200ms moi bao dong that

unsigned long belowSince = 0;
bool alarmTriggered = false;

void calibrateBaseline() {
  long sum = 0;
  const int samples = 40;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(LDR_PIN);
    delay(50); // tong cong ~2 giay hieu chinh
  }
  baseline = sum / samples;
  Serial.print("Baseline (co laser chieu toi): ");
  Serial.println(baseline);
}

void setup() {
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, LOW);
  Serial.begin(9600);

  Serial.println("Dang hieu chinh, dam bao laser da chieu vao LDR...");
  calibrateBaseline();
  Serial.println("San sang!");
}

void loop() {
  if (alarmTriggered) {
    digitalWrite(BUZZER_PIN, HIGH);
    if (digitalRead(RESET_BUTTON_PIN) == LOW) {
      alarmTriggered = false;
      digitalWrite(BUZZER_PIN, LOW);
      belowSince = 0;
    }
    return;
  }

  int reading = analogRead(LDR_PIN);
  bool beamBlocked = reading < (baseline - TRIP_MARGIN);

  if (beamBlocked) {
    if (belowSince == 0) belowSince = millis();
    if (millis() - belowSince > TRIP_HOLD_MS) {
      alarmTriggered = true;
    }
  } else {
    belowSince = 0; // tia binh thuong tro lai, reset bo dem
  }

  delay(20);
}
```

## Những lỗi thường gặp

- **Dùng một ngưỡng cố định thay vì baseline động** — ánh sáng phòng thay đổi theo ngày đêm, đèn bật/tắt sẽ làm ngưỡng cứng sai lệch hoàn toàn. Luôn hiệu chỉnh baseline ngay lúc khởi động, khi bạn chắc chắn tia laser đang chiếu đúng.
- **Không debounce** — một con côn trùng bay ngang qua tia trong vài chục mili giây cũng đủ làm giá trị tụt xuống dưới ngưỡng. Yêu cầu tín hiệu duy trì thấp liên tục `TRIP_HOLD_MS` mới coi là xâm nhập thật giúp loại bỏ hầu hết báo động giả kiểu này.
- **Lắp laser và LDR không thẳng hàng hoặc rung lắc** — chùm laser càng đi xa càng dễ lệch khỏi cảm biến chỉ với một rung động nhỏ. Dùng giá đỡ chắc chắn, và với khoảng cách trên 3-4 mét nên cân nhắc gương phản xạ để gấp đường đi tia sáng qua nhiều điểm.
- **Ánh sáng mặt trời trực tiếp chiếu vào LDR** làm baseline không ổn định — tránh đặt hệ thống ở nơi có ánh nắng trực tiếp thay đổi theo giờ.

## Mở rộng

Ghép nhiều cặp laser-LDR ở các góc khác nhau để tạo lưới bẫy nhiều tia, hoặc thêm module SIM800L để gửi tin nhắn cảnh báo ngay khi báo động kích hoạt thay vì chỉ kêu còi tại chỗ.
