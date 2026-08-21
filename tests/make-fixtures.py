#!/usr/bin/env python3
"""Synthetic audio for the browser tests.

Chrome can be pointed at a WAV file as a fake microphone
(--use-file-for-fake-audio-capture), which lets us drive the real voice
detection with known input instead of mocking it out.

Each file is mostly silence with one tone burst, so a test that starts
listening at an arbitrary moment still catches a clean onset.
"""
import math, struct, wave, pathlib, sys

SR = 48000
OUT = pathlib.Path(__file__).parent / 'fixtures'


def make(name, amp, attack_s, pre=3.0, tone=1.4, post=0.4, freq=330):
    frames = [0] * int(SR * pre)
    for i in range(int(SR * tone)):
        t = i / SR
        env = 1.0 if attack_s == 0 else min(1.0, t / attack_s)
        if t > tone - 0.15:                       # fade out so the loop doesn't click
            env *= max(0.0, (tone - t) / 0.15)
        frames.append(int(amp * env * math.sin(2 * math.pi * freq * t) * 32767))
    frames += [0] * int(SR * post)
    with wave.open(str(OUT / name), 'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', f) for f in frames))
    print(f'  {name}: amp={amp}, attack={attack_s * 1000:.0f}ms, {len(frames) / SR:.1f}s loop')


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    print('writing fixtures:')
    make('gentle.wav', 0.35, 0.30)   # an easy onset: eased in over 300ms
    make('hard.wav',   0.35, 0.0)    # a hard glottal attack: instant
    make('soft.wav',   0.04, 0.30)   # a quiet child, gently
