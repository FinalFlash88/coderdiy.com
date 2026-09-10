---
title: "Bluetooth-controlled RC car with Arduino and L298N"
description: "Build a phone-controlled RC car using an HC-05 Bluetooth module, Arduino, and an L298N H-bridge — with a simple command protocol and PWM speed control code."
pubDate: 2026-09-13
lang: en
category: article
translationId: bluetooth-rc-car-arduino
tags: ["arduino", "bluetooth", "robotics"]
heroEmoji: "🚗"
author: "CoderDIY"
---

A Bluetooth-controlled RC car is a classic robotics project for getting comfortable with DC motors, H-bridges, and wireless communication — no custom app needed, just any off-the-shelf Bluetooth serial controller app and a few lines of Arduino code.

## How it works

1. Your phone pairs over Bluetooth with the HC-05 module (acting as a wireless serial port).
2. The controller app sends a single command character each time a button is pressed: `F` (forward), `B` (backward), `L` (left), `R` (right), `S` (stop).
3. The Arduino reads that character from `Serial` (wired to the HC-05) and maps it to a combination of signals driving two DC motors through an L298N H-bridge.
4. Motor speed is set with a PWM signal on the L298N's ENA/ENB pins.

<figure class="diagram">
  <svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flow diagram of Bluetooth command processing for the RC car">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .arrow { stroke: var(--color-accent); stroke-width: 2; marker-end: url(#arrowhead); fill: none; }
    </style>
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--color-accent)" />
      </marker>
    </defs>

    <rect x="10" y="100" width="150" height="60" rx="10" class="box" />
    <text x="85" y="135" text-anchor="middle" class="label">Phone app</text>

    <rect x="210" y="100" width="150" height="60" rx="10" class="box" />
    <text x="285" y="135" text-anchor="middle" class="label">HC-05 -> Arduino</text>

    <rect x="410" y="30" width="200" height="60" rx="10" class="box" />
    <text x="510" y="65" text-anchor="middle" class="label">Read command, pick direction</text>

    <rect x="410" y="170" width="200" height="60" rx="10" class="box" />
    <text x="510" y="205" text-anchor="middle" class="label">L298N drives both motors</text>

    <line x1="160" y1="130" x2="210" y2="130" class="arrow" />
    <line x1="360" y1="120" x2="410" y2="70" class="arrow" />
    <line x1="510" y1="90" x2="510" y2="170" class="arrow" />
  </svg>
  <figcaption>Bluetooth command characters pass through the Arduino and get translated into H-bridge control signals.</figcaption>
</figure>

## Parts list

- Arduino Uno
- HC-05 Bluetooth module
- L298N H-bridge motor driver (drives 2 DC motors)
- 2 DC motors + wheels, a 2- or 4-wheel robot chassis
- A separate battery for the motors (18650 cell or a 9V-12V pack, not shared with the Arduino's supply)
- Two resistors (1k ohm and 2k ohm) for a voltage divider on the HC-05's RX pin
- Any Bluetooth serial controller app on your phone (e.g. "Arduino Bluetooth Controller" or "Serial Bluetooth Terminal")

## An important wiring detail

The HC-05 runs at 3.3V logic, but the Arduino Uno's TX pin outputs 5V. Wiring Arduino's TX directly into HC-05's RX without stepping the voltage down can degrade or damage the module over time — use a voltage divider:

```
Arduino TX (5V) --[1k ohm]--+--[2k ohm]--- GND
                             |
                          HC-05 RX (~3.3V)
```

## Sample code

```cpp
#include <SoftwareSerial.h>

SoftwareSerial bluetooth(10, 11); // RX, TX wired to the HC-05

// L298N direction control pins
const int IN1 = 2, IN2 = 3; // left motor
const int IN3 = 4, IN4 = 5; // right motor
const int ENA = 9;  // PWM speed for the left motor
const int ENB = 6;  // PWM speed for the right motor
const int SPEED = 200; // 0-255

void goForward() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
}
void goBackward() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
}
void turnLeft() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
}
void turnRight() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
}
void stopCar() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
}

void setup() {
  bluetooth.begin(9600);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);
  analogWrite(ENA, SPEED);
  analogWrite(ENB, SPEED);
  stopCar();
}

void loop() {
  if (bluetooth.available()) {
    char command = bluetooth.read();
    switch (command) {
      case 'F': goForward(); break;
      case 'B': goBackward(); break;
      case 'L': turnLeft(); break;
      case 'R': turnRight(); break;
      case 'S': stopCar(); break;
    }
  }
}
```

> Pair the HC-05 with your phone first through Bluetooth settings (the default PIN is usually `1234` or `0000`), then open your controller app and map its buttons to send the `F/B/L/R/S` characters.

## Common pitfalls

- **Skipping the voltage divider on RX**: running the HC-05's RX at 5V long-term can shorten its lifespan or damage it outright — always step it down as shown above.
- **Sharing power between the Arduino and the motors**: DC motors generate back-EMF spikes when starting or reversing suddenly, which can cause noise or reset the Arduino — power the motors from a separate battery and only share ground.
- **Forgetting a common ground** between the Arduino, HC-05, and L298N — this is the most common reason commands "send fine" but the car never moves.
- **`SoftwareSerial` pin conflicts**: if you're on a Mega or Leonardo instead of an Uno, consider using a hardware `Serial1` port instead of `SoftwareSerial` for more reliable behavior at higher baud rates.

## Where to go from here

Add an HC-SR04 ultrasonic sensor up front so the car automatically stops near obstacles, or swap the HC-05 for an ESP32 to control it over WiFi with a custom mobile app that has a virtual joystick instead of just five buttons.
