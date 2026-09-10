---
title: "Build a Self-Balancing Two-Wheel Robot with Arduino and PID Control"
description: "Build an inverted-pendulum two-wheel robot using Arduino, an MPU6050, and a PID control loop to keep itself upright — P, I, D explained plainly, with working code and real tuning advice."
pubDate: 2026-09-24
lang: en
category: article
tags: ["arduino", "robotics", "pid-control"]
translationId: self-balancing-robot-pid
heroEmoji: "⚖️"
author: "CoderDIY"
---

A self-balancing robot is the classic "inverted pendulum" problem from control theory, and you can build one on an Arduino running a few thousand calculations a second instead of solving differential equations by hand. It's also one of the best ways to actually learn PID — the controller that shows up in nearly every automated system, from 3D printers to drones.

## How it works

The robot has two wheels with its center of mass sitting above the axle — by design, it always wants to fall over. The microcontroller's job is to continuously read the tilt angle and adjust motor speed to "chase" the balance point, the same way you'd keep a broomstick upright on your palm.

1. The **MPU6050** sensor (accelerometer + gyroscope) measures the robot's actual tilt angle.
2. A **PID** controller compares the measured angle against a target angle (usually 0°, meaning upright) to compute an error, then turns that into a control value:
   - **P (Proportional)** — responds in direct proportion to the current error: the more it's tilted, the harder the motors push.
   - **I (Integral)** — accumulates error over time to eliminate steady-state drift — for example, if the robot's weight isn't perfectly balanced, P alone will never quite settle it at exactly 0°.
   - **D (Derivative)** — reacts to how fast the error is changing, acting as a "brake" that damps oscillation before it gets out of hand.
3. The resulting PID value gets converted into a speed and direction for both motors, pushing the robot toward whichever way it's falling to keep it balanced — the whole cycle repeats hundreds of times per second.

<figure class="diagram">
  <svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flow diagram of the PID loop that keeps the robot balanced">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 12px; fill: var(--color-ink); }
      .arrow { stroke: var(--color-accent); stroke-width: 2; marker-end: url(#arrowhead); fill: none; }
      .sublabel { font-family: var(--font-mono); font-size: 10px; fill: var(--color-ink-soft); }
    </style>
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--color-accent)" />
      </marker>
    </defs>

    <rect x="10" y="20" width="140" height="60" rx="10" class="box" />
    <text x="80" y="45" text-anchor="middle" class="label">Read tilt angle</text>
    <text x="80" y="62" text-anchor="middle" class="label">(MPU6050)</text>

    <rect x="170" y="20" width="140" height="60" rx="10" class="box" />
    <text x="240" y="45" text-anchor="middle" class="label">Compute error</text>
    <text x="240" y="62" text-anchor="middle" class="label">(setpoint − angle)</text>

    <rect x="330" y="20" width="140" height="60" rx="10" class="box" />
    <text x="400" y="45" text-anchor="middle" class="label">Compute PID</text>
    <text x="400" y="62" text-anchor="middle" class="label">(Kp, Ki, Kd)</text>

    <rect x="490" y="20" width="140" height="60" rx="10" class="box" />
    <text x="560" y="45" text-anchor="middle" class="label">Drive motors</text>
    <text x="560" y="62" text-anchor="middle" class="label">(PWM + direction)</text>

    <line x1="150" y1="50" x2="170" y2="50" class="arrow" />
    <line x1="310" y1="50" x2="330" y2="50" class="arrow" />
    <line x1="470" y1="50" x2="490" y2="50" class="arrow" />

    <path d="M 560 80 L 560 190 L 80 190 L 80 80" class="arrow" fill="none" />
    <text x="320" y="210" text-anchor="middle" class="sublabel">Repeats ~100-200 times per second</text>
  </svg>
  <figcaption>The PID loop: read the angle, compute the error, compute the PID output, drive the motors, then repeat continuously.</figcaption>
</figure>

## Parts list

- An Arduino Uno or Nano (fast enough for a PID loop running at a few hundred Hz)
- An MPU6050 sensor (6-axis accelerometer + gyroscope), connected over I2C
- A 2-channel motor driver (TB6612FNG or L298N)
- 2 geared DC motors with wheels
- A two-wheel chassis, cut or 3D-printed, with the center of mass set moderately high
- A 7.4V-11V battery (2S or 3S Li-ion/LiPo) to power the driver and motors

<figure class="diagram">
  <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wiring diagram connecting an Arduino to an MPU6050 sensor over I2C">
    <style>
      .box { fill: none; stroke: var(--color-ink); stroke-width: 2; }
      .label { font-family: var(--font-mono); font-size: 13px; fill: var(--color-ink); }
      .sublabel { font-family: var(--font-mono); font-size: 11px; fill: var(--color-ink-soft); }
      .wire { stroke: var(--color-accent); stroke-width: 2; fill: none; }
      .pin { fill: var(--color-accent); }
    </style>

    <rect x="30" y="60" width="170" height="180" rx="10" class="box" />
    <text x="115" y="155" text-anchor="middle" class="label">Arduino Uno</text>

    <rect x="440" y="70" width="170" height="160" rx="10" class="box" />
    <text x="525" y="155" text-anchor="middle" class="label">MPU6050</text>

    <line x1="200" y1="90" x2="440" y2="90" class="wire" />
    <text x="320" y="82" text-anchor="middle" class="sublabel">5V → VCC</text>
    <circle cx="200" cy="90" r="4" class="pin" />
    <circle cx="440" cy="90" r="4" class="pin" />

    <line x1="200" y1="130" x2="440" y2="130" class="wire" />
    <text x="320" y="122" text-anchor="middle" class="sublabel">GND → GND</text>
    <circle cx="200" cy="130" r="4" class="pin" />
    <circle cx="440" cy="130" r="4" class="pin" />

    <line x1="200" y1="170" x2="440" y2="170" class="wire" />
    <text x="320" y="162" text-anchor="middle" class="sublabel">A5 (SCL) → SCL</text>
    <circle cx="200" cy="170" r="4" class="pin" />
    <circle cx="440" cy="170" r="4" class="pin" />

    <line x1="200" y1="210" x2="440" y2="210" class="wire" />
    <text x="320" y="202" text-anchor="middle" class="sublabel">A4 (SDA) → SDA</text>
    <circle cx="200" cy="210" r="4" class="pin" />
    <circle cx="440" cy="210" r="4" class="pin" />
  </svg>
  <figcaption>The MPU6050 talks I2C over two wires (SCL/SDA) with a 5V supply — the motor driver connects in parallel, using the remaining digital pins for PWM and direction.</figcaption>
</figure>

## Sample code

```cpp
#include <Wire.h>
#include <MPU6050_light.h>

MPU6050 mpu(Wire);

// Motor driver control pins (e.g. TB6612FNG)
const int AIN1 = 7, AIN2 = 8, PWMA = 5; // Left motor
const int BIN1 = 9, BIN2 = 10, PWMB = 6; // Right motor
const int STBY = 4;

// PID constants - tune these for your own robot, treat these as a starting point only
double Kp = 25.0;
double Ki = 140.0;
double Kd = 0.8;

double setpoint = 0.0; // the ideal balance angle, fine-tune this after assembly
double integral = 0.0;
double lastError = 0.0;
unsigned long lastTime = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  byte status = mpu.begin();
  while (status != 0) { } // halt if the MPU6050 fails to connect

  Serial.println("Calibrating MPU6050, keep the robot still...");
  delay(1000);
  mpu.calcOffsets(); // auto-compensate gyro/accel offsets
  Serial.println("Done!");

  pinMode(AIN1, OUTPUT); pinMode(AIN2, OUTPUT); pinMode(PWMA, OUTPUT);
  pinMode(BIN1, OUTPUT); pinMode(BIN2, OUTPUT); pinMode(PWMB, OUTPUT);
  pinMode(STBY, OUTPUT);
  digitalWrite(STBY, HIGH);

  lastTime = millis();
}

void loop() {
  mpu.update();
  double angle = mpu.getAngleX(); // swap X/Y/Z depending on how your MPU6050 is mounted

  unsigned long now = millis();
  double dt = (now - lastTime) / 1000.0;
  if (dt <= 0) dt = 0.001;

  double error = setpoint - angle;
  integral += error * dt;
  integral = constrain(integral, -255, 255); // anti-windup clamp
  double derivative = (error - lastError) / dt;

  double output = Kp * error + Ki * integral + Kd * derivative;
  output = constrain(output, -255, 255);

  driveMotors(output);

  lastError = error;
  lastTime = now;

  // Past 45 degrees, treat it as a fall and stop the motors instead of thrashing
  if (abs(angle) > 45) {
    driveMotors(0);
    integral = 0;
  }
}

void driveMotors(double speed) {
  bool forward = speed >= 0;
  int pwm = constrain(abs((int)speed), 0, 255);

  digitalWrite(AIN1, forward ? HIGH : LOW);
  digitalWrite(AIN2, forward ? LOW : HIGH);
  analogWrite(PWMA, pwm);

  digitalWrite(BIN1, forward ? HIGH : LOW);
  digitalWrite(BIN2, forward ? LOW : HIGH);
  analogWrite(PWMB, pwm);
}
```

The `MPU6050_light` library computes a stable tilt angle using a complementary filter that blends accelerometer and gyroscope data — good enough for this project without writing a full Kalman filter yourself. For higher accuracy, the MPU6050 also has a built-in DMP (Digital Motion Processor) that can compute quaternions directly on the chip.

## Common pitfalls

- **How the MPU6050 is mounted decides which axis is "tilt angle"** — if the robot falls in the direction opposite what `angle`'s sign suggests, either flip the output's sign or switch which axis you read (`getAngleX`/`getAngleY`) to match reality.
- **Motor deadband**: too small a PWM value (below roughly 30-40) can't overcome static friction, so the motor sits still despite a nonzero signal — you may need to add a minimum PWM offset whenever the output is nonzero.
- **Unbounded integral windup** makes the robot lurch violently after being held tilted for a while and then released — always clamp (`constrain`) the `integral` variable.
- **Printing to Serial every loop iteration** noticeably slows down the PID loop frequency — only print while debugging, and remove it entirely once tuning is done.

**Practical PID tuning advice**: start with `Ki = Kd = 0`, increase `Kp` gradually until the robot starts to visibly oscillate around upright, then back `Kp` off to roughly 70-80% of that value. Next, add `Kd` to smooth out and damp the oscillation. Finally, add a small amount of `Ki` to eliminate any remaining steady-state drift — if `Ki` is too large, the robot will sway back and forth slowly and widely.

## Where to go from here

Add a Bluetooth module or an ESP32 for remote control (nudging `setpoint` slightly to make the robot drive forward/backward on command), try auto-tuning PID with the Ziegler-Nichols method, or upgrade to an ESP32 to stream real-time tilt-angle logs over WiFi for easier debugging.
