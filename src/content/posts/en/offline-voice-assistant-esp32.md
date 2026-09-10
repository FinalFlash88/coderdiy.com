---
title: "Building an Offline Voice Assistant with ESP32 and Keyword Spotting"
description: "No audio sent to the cloud: use an ESP32-S3 and a tiny keyword-spotting model to trigger a device by voice, running entirely on-device."
pubDate: 2026-09-03
lang: en
category: article
translationId: offline-voice-assistant-esp32
tags: ["esp32", "voice", "edge-ai"]
heroEmoji: "🎙️"
author: "CoderDIY"
---

Commercial voice assistants all send audio to a server for processing. But if you only need to recognize a handful of fixed keywords — "turn on the light," "turn off the fan" — you can run that entirely on a cheap microcontroller, with no internet connection and no data leaving the device.

## Why this works on a microcontroller

Recognizing *one specific keyword* (wake word / keyword spotting) is far lighter than free-form speech recognition. The model only needs to distinguish a few audio classes (e.g. "light on" / "light off" / silence), so it can be compressed down to a few hundred KB — small enough to run on an ESP32-S3 with its limited memory.

## Hardware

- An ESP32-S3 (more RAM makes audio buffering much easier)
- An I2S microphone (e.g. the INMP441) — noticeably better quality than an analog mic
- A relay or MOSFET to drive the target device (light, fan, etc.)

## Processing pipeline

1. The I2S mic continuously writes audio into a circular buffer.
2. Roughly every ~1 second, extract audio features (typically MFCCs — Mel-Frequency Cepstral Coefficients).
3. Run the features through a small pre-trained neural network (e.g. exported from Edge Impulse or TensorFlow Lite Micro).
4. If the confidence score crosses a threshold, trigger the matching action.

```cpp
#include "model.h" // exported TFLite Micro model

void loop() {
  int16_t audio_buffer[SAMPLE_COUNT];
  read_i2s_samples(audio_buffer, SAMPLE_COUNT);

  float features[NUM_FEATURES];
  extract_mfcc(audio_buffer, features);

  float scores[NUM_CLASSES];
  run_inference(features, scores);

  if (scores[CLASS_TURN_ON] > 0.85) {
    digitalWrite(RELAY_PIN, HIGH);
  } else if (scores[CLASS_TURN_OFF] > 0.85) {
    digitalWrite(RELAY_PIN, LOW);
  }
}
```

## Training your own model

You don't need deep machine-learning knowledge to get started — tools like Edge Impulse let you:

1. Record a few dozen samples per keyword (your own voice, in the real environment you'll use it in).
2. Record extra "background noise" samples (fan noise, TV, etc.) so the model learns to ignore them.
3. Train on their cloud, then export a `.h` file to embed directly in your Arduino/ESP-IDF code.

## Limitations worth knowing about

- Accuracy drops sharply in noisy environments or when the speaker's voice differs from the training samples — record samples in the actual conditions you'll use it in.
- More keywords means a bigger, more confusable model — on a microcontroller, 3-5 keywords is a reasonable ceiling.
- This isn't a "natural language" voice assistant — it's only good at recognizing a handful of fixed sound patterns. In exchange, you get complete privacy and near-instant response.

## Where to go from here

Combine it with the earlier [ESP32 weather station](/en/posts/esp32-weather-station/) project to build a small "control hub" that both reads sensors and responds to voice — all on the same board, with no cloud dependency.
