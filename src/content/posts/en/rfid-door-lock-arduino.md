---
title: "RFID door lock with Arduino and RC522: unlock only for the right card"
description: "Build a card-based door lock with Arduino, an RC522 reader, and a servo — including how to read a card's UID, maintain an allow-list, and full working code."
pubDate: 2026-09-12
lang: en
category: article
translationId: rfid-door-lock-arduino
tags: ["arduino", "rfid", "security"]
heroEmoji: "🔐"
author: "CoderDIY"
---

An RFID door lock is a great entry point into hardware security projects: cheap, easy to understand, and satisfying fast — one evening in, you'll be tapping a card to open a cabinet, a storage box, or a small room door.

## How it works

1. The RC522 module broadcasts a 13.56MHz RFID field and reads the UID (a unique identifier) of any card or keyfob held near it.
2. The Arduino receives the UID over SPI and compares it against an allow-list stored in code.
3. On a match, the Arduino turns a servo to release the lock for a few seconds and then re-locks, while lighting a green LED / buzzer for "accepted".
4. On a mismatch, a red LED flashes for "denied".

## Parts list

- Arduino Uno (or Nano)
- RC522 RFID reader module (SPI interface)
- 13.56MHz RFID card/keyfob (Mifare Classic is the most common type)
- SG90 servo attached to a mechanical latch (or a 12V solenoid lock driven through a relay if you need more holding force)
- 2 LEDs (green, red) + a small buzzer for feedback
- The `MFRC522` library (install via the Arduino IDE Library Manager)

<figure class="diagram">
  <svg viewBox="0 0 640 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram for Arduino Uno with an RC522 module over SPI">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="40" y="60" width="160" height="220" rx="10" class="box" />
    <text x="120" y="170" text-anchor="middle" class="label">Arduino Uno</text>

    <rect x="440" y="80" width="160" height="180" rx="10" class="box" />
    <text x="520" y="170" text-anchor="middle" class="label">RC522</text>

    <line x1="200" y1="90" x2="440" y2="100" class="wire" />
    <text x="320" y="82" text-anchor="middle" class="sublabel">Pin 10 -> SDA</text>
    <circle cx="200" cy="90" r="4" class="pin" /><circle cx="440" cy="100" r="4" class="pin" />

    <line x1="200" y1="120" x2="440" y2="125" class="wire" />
    <text x="320" y="112" text-anchor="middle" class="sublabel">Pin 13 -> SCK</text>
    <circle cx="200" cy="120" r="4" class="pin" /><circle cx="440" cy="125" r="4" class="pin" />

    <line x1="200" y1="150" x2="440" y2="150" class="wire" />
    <text x="320" y="142" text-anchor="middle" class="sublabel">Pin 11 -> MOSI</text>
    <circle cx="200" cy="150" r="4" class="pin" /><circle cx="440" cy="150" r="4" class="pin" />

    <line x1="200" y1="180" x2="440" y2="175" class="wire" />
    <text x="320" y="172" text-anchor="middle" class="sublabel">Pin 12 -> MISO</text>
    <circle cx="200" cy="180" r="4" class="pin" /><circle cx="440" cy="175" r="4" class="pin" />

    <line x1="200" y1="210" x2="440" y2="200" class="wire" />
    <text x="320" y="202" text-anchor="middle" class="sublabel">Pin 9 -> RST</text>
    <circle cx="200" cy="210" r="4" class="pin" /><circle cx="440" cy="200" r="4" class="pin" />

    <line x1="200" y1="240" x2="440" y2="225" class="wire" />
    <text x="320" y="232" text-anchor="middle" class="sublabel">3.3V -> VCC, GND -> GND</text>
    <circle cx="200" cy="240" r="4" class="pin" /><circle cx="440" cy="225" r="4" class="pin" />
  </svg>
  <figcaption>The RC522 runs at 3.3V logic — never feed 5V into the module's VCC pin.</figcaption>
</figure>

## Sample code

Step 1: read a card's UID so you know what value to add to the allow-list.

```cpp
#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 10
#define RST_PIN 9
MFRC522 rfid(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("Hold a card near the reader to read its UID...");
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  Serial.print("UID: ");
  for (byte i = 0; i < rfid.uid.size; i++) {
    Serial.print(rfid.uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(rfid.uid.uidByte[i], HEX);
  }
  Serial.println();
  rfid.PICC_HaltA();
}
```

Step 2: the actual door lock with an allow-list of UIDs.

```cpp
#include <SPI.h>
#include <MFRC522.h>
#include <Servo.h>

#define SS_PIN 10
#define RST_PIN 9
#define GREEN_LED 6
#define RED_LED 5
#define BUZZER 4
#define SERVO_PIN 3

MFRC522 rfid(SS_PIN, RST_PIN);
Servo lockServo;

// Allow-list of UIDs (uppercase, no spaces)
String allowedUids[] = {
  "A1B2C3D4",
  "1A2B3C4D"
};
const int NUM_CARDS = 2;

void unlockDoor() {
  digitalWrite(GREEN_LED, HIGH);
  tone(BUZZER, 1000, 200);
  lockServo.write(90); // unlocked position
  delay(4000);
  lockServo.write(0);  // locked position
  digitalWrite(GREEN_LED, LOW);
}

void denyAccess() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(RED_LED, HIGH);
    tone(BUZZER, 300, 100);
    delay(150);
    digitalWrite(RED_LED, LOW);
    delay(150);
  }
}

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  lockServo.attach(SERVO_PIN);
  lockServo.write(0);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  bool allowed = false;
  for (int i = 0; i < NUM_CARDS; i++) {
    if (uid == allowedUids[i]) { allowed = true; break; }
  }

  if (allowed) {
    Serial.println("Valid card -> unlocking");
    unlockDoor();
  } else {
    Serial.println("Invalid card -> denied");
    denyAccess();
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}
```

## Common pitfalls

- **Feeding 5V into the RC522**: the module only tolerates 3.3V logic, and connecting VCC to 5V can fry the chip within seconds.
- **Servo too weak to hold the latch**: the SG90 is fairly weak — if your latch is heavy, switch to a 12V solenoid lock driven through a relay instead of pulling it directly with a servo.
- **Mismatched UID formatting**: a UID byte can print with or without a leading zero — normalize it consistently (e.g. always pad with "0" when the byte is below 0x10) both when recording the allow-list and when comparing, or valid cards will get rejected.
- **No protection against UID cloning**: acceptable for a small DIY project, but don't rely on this for anything that actually matters — RFID UIDs can be copied with dedicated hardware.

## Where to go from here

Store the UID allow-list in EEPROM so you can add or remove cards without reflashing, or log unlock events with timestamps to an SD card or Google Sheets via an ESP8266 so you know who opened the door and when.
