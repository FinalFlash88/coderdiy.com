---
title: "Building an Obstacle-Avoiding Robot with Raspberry Pi and Python"
description: "Project log: using a Raspberry Pi, an ultrasonic sensor and Python to turn a basic robot chassis into a self-driving obstacle avoider."
pubDate: 2026-07-20
lang: en
category: article
translationId: robot-vacuum-pi
tags: ["raspberry-pi", "python", "robotics", "gpio"]
heroEmoji: "🤖"
author: "CoderDIY"
---

You don't need to buy a fancy robot vacuum — you can build a two-wheel obstacle-avoiding robot yourself with a Raspberry Pi. It's cheap, and you'll learn both the hardware and software side.

## Hardware

- A Raspberry Pi (3B+ or newer is comfortable)
- A two-wheel robot chassis + DC motors + motor driver (L298N)
- An HC-SR04 ultrasonic distance sensor
- A power bank for the Pi, and a separate battery pack for the motors

## Control logic

The main loop is simple: measure the distance ahead → if something's close, stop and turn → otherwise keep driving forward.

```python
import RPi.GPIO as GPIO
import time

TRIG, ECHO = 23, 24
MOTOR_LEFT_FWD, MOTOR_RIGHT_FWD = 17, 27

GPIO.setmode(GPIO.BCM)
GPIO.setup(TRIG, GPIO.OUT)
GPIO.setup(ECHO, GPIO.IN)
GPIO.setup([MOTOR_LEFT_FWD, MOTOR_RIGHT_FWD], GPIO.OUT)

def read_distance_cm():
    GPIO.output(TRIG, True)
    time.sleep(0.00001)
    GPIO.output(TRIG, False)

    start = time.time()
    while GPIO.input(ECHO) == 0:
        start = time.time()
    while GPIO.input(ECHO) == 1:
        stop = time.time()

    return (stop - start) * 34300 / 2

def drive_forward():
    GPIO.output(MOTOR_LEFT_FWD, True)
    GPIO.output(MOTOR_RIGHT_FWD, True)

def stop():
    GPIO.output(MOTOR_LEFT_FWD, False)
    GPIO.output(MOTOR_RIGHT_FWD, False)

try:
    while True:
        distance = read_distance_cm()
        if distance < 20:
            stop()
            time.sleep(0.3)
            # turn right to avoid the obstacle — drive left/right wheels separately
        else:
            drive_forward()
        time.sleep(0.1)
finally:
    GPIO.cleanup()
```

## Real-world gotchas

- **Power the motors and the Pi separately** — sharing one supply tends to brown-out and reset the Pi when the motors kick in.
- Ultrasonic sensors reflect poorly off angled or soft surfaces, so add a timeout to `read_distance_cm`.
- Cheap wheels rarely spin at exactly the same speed on both sides — calibrate with per-side PWM instead of the simple on/off used in this example.

## Where to go from here

Once obstacle avoidance is reliable, extend it: log the path travelled for a basic map, add a Pi camera for object detection, or drive it remotely from a small Flask web app. This is a great project for seeing the gap between "writing code" and "code that controls something physical" — hardware quirks will teach you things pure software never will.
