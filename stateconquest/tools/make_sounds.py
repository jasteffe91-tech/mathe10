#!/usr/bin/env python3
"""Erzeugt alle Soundeffekte und die Hintergrundmusik synthetisch (eigene Werke, frei nutzbar).

Ausgabe: assets/audio/*.wav (22,05 kHz, mono, 16 Bit).  Aufruf: python3 tools/make_sounds.py
"""
import math
import os
import random
import struct
import wave

RATE = 22050
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "audio")


def note(name):
    names = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
    base = names[name[0]]
    i = 1
    if len(name) > 2 or (len(name) == 2 and name[1] in "#b"):
        base += 1 if name[1] == "#" else -1
        i = 2
    octave = int(name[i:])
    return 440.0 * 2 ** ((base + (octave - 4) * 12) / 12)


def write(name, samples, gain=0.9):
    peak = max(1e-6, max(abs(s) for s in samples))
    k = gain / peak if peak > gain else 1.0
    path = os.path.join(OUT, name + ".wav")
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s * k)) * 32000)) for s in samples))
    print("%-10s %5.2f s" % (name, len(samples) / RATE))


def env(t, attack, decay):
    if t < attack:
        return t / attack
    return math.exp(-(t - attack) / decay)


def bell(freq, dur, decay=0.25, harmonics=((1, 1.0), (2, 0.35), (3, 0.12), (4.2, 0.06))):
    n = int(dur * RATE)
    out = []
    for i in range(n):
        t = i / RATE
        e = env(t, 0.004, decay)
        out.append(e * sum(a * math.sin(2 * math.pi * freq * h * t) for h, a in harmonics))
    return out


def mix(dst, src, offset_s, gain=1.0):
    off = int(offset_s * RATE)
    need = off + len(src)
    if len(dst) < need:
        dst.extend([0.0] * (need - len(dst)))
    for i, s in enumerate(src):
        dst[off + i] += s * gain
    return dst


def sfx_send():
    n = int(0.12 * RATE)
    out = []
    ph = 0.0
    rnd = random.Random(1)
    for i in range(n):
        t = i / RATE
        f = 480 + 520 * (t / 0.12)
        ph += 2 * math.pi * f / RATE
        e = env(t, 0.005, 0.04)
        out.append(e * (math.sin(ph) * 0.8 + (rnd.random() * 2 - 1) * 0.08))
    return out


def sfx_capture():
    out = []
    mix(out, bell(note("E5"), 0.35, 0.12), 0.0, 0.7)
    mix(out, bell(note("B5"), 0.45, 0.16), 0.07, 0.6)
    return out


def sfx_lost():
    n = int(0.3 * RATE)
    out = []
    ph = 0.0
    for i in range(n):
        t = i / RATE
        f = 320 - 170 * (t / 0.3)
        ph += 2 * math.pi * f / RATE
        e = env(t, 0.008, 0.09)
        out.append(e * (math.sin(ph) + 0.3 * math.sin(2 * ph)))
    return out


def sfx_click():
    n = int(0.045 * RATE)
    return [env(i / RATE, 0.001, 0.012) * math.sin(2 * math.pi * 1250 * i / RATE) for i in range(n)]


def sfx_select():
    n = int(0.08 * RATE)
    return [env(i / RATE, 0.003, 0.03) * (math.sin(2 * math.pi * 880 * i / RATE) + 0.3 * math.sin(2 * math.pi * 1760 * i / RATE)) for i in range(n)]


def sfx_victory():
    out = []
    for k, (nm, at) in enumerate([("C5", 0.0), ("E5", 0.12), ("G5", 0.24), ("C6", 0.36)]):
        mix(out, bell(note(nm), 1.2 - at, 0.35), at, 0.55)
    mix(out, bell(note("G4"), 1.3, 0.5, ((1, 1.0), (2, 0.2))), 0.36, 0.35)
    mix(out, bell(note("E6"), 0.9, 0.3), 0.5, 0.25)
    return out


def sfx_defeat():
    out = []
    for nm, at in [("A4", 0.0), ("F4", 0.25), ("D4", 0.5)]:
        n = int(0.7 * RATE)
        f = note(nm)
        seg = []
        for i in range(n):
            t = i / RATE
            e = env(t, 0.02, 0.25)
            seg.append(e * (math.sin(2 * math.pi * f * t) + 0.25 * math.sin(4 * math.pi * f * t) + 0.1 * math.sin(6 * math.pi * f * t)))
        mix(out, seg, at, 0.5)
    return out


def sfx_upgrade():
    out = []
    for k, nm in enumerate(["G5", "B5", "D6", "G6"]):
        mix(out, bell(note(nm), 0.4, 0.1), k * 0.05, 0.45)
    rnd = random.Random(3)
    for k in range(10):
        mix(out, bell(note("D6") * (1.5 + rnd.random()), 0.15, 0.04), 0.2 + k * 0.025, 0.12)
    return out


def music():
    """Ruhige Schleife: Pad-Akkorde + gezupftes Arpeggio, 4 Akkorde à 6 s."""
    chords = [["C3", "G3", "C4", "E4"], ["A2", "E3", "A3", "C4"], ["F2", "C3", "F3", "A3"], ["G2", "D3", "G3", "B3"]]
    arps = [["C5", "E5", "G5", "E5", "D5", "E5", "G5", "C6"], ["A4", "C5", "E5", "C5", "B4", "C5", "E5", "A5"],
            ["F4", "A4", "C5", "A4", "G4", "A4", "C5", "F5"], ["G4", "B4", "D5", "B4", "A4", "B4", "D5", "G5"]]
    seg = 6.0
    total = seg * len(chords)
    out = [0.0] * int((total + 3.0) * RATE)
    for ci, ch in enumerate(chords):
        start = ci * seg
        n = int((seg + 2.5) * RATE)
        freqs = [note(x) for x in ch]
        for i in range(n):
            t = i / RATE
            a = min(1.0, t / 1.6) * (1.0 if t < seg else max(0.0, 1.0 - (t - seg) / 2.5))
            s = 0.0
            for f in freqs:
                s += math.sin(2 * math.pi * f * t) + 0.5 * math.sin(2 * math.pi * f * 1.003 * t + 1.0)
            out[int(start * RATE) + i] += a * s * 0.06
        step = seg / 16
        for k in range(16):
            nm = arps[ci][k % 8]
            pl = bell(note(nm), 0.9, 0.22, ((1, 1.0), (2, 0.25), (3, 0.05)))
            mix(out, pl, start + k * step, 0.11 if k % 2 == 0 else 0.07)
    # Ausklang an den Anfang falten, damit die Schleife nahtlos ist
    loop_n = int(total * RATE)
    for i in range(loop_n, len(out)):
        out[i - loop_n] += out[i]
    return out[:loop_n]


def main():
    os.makedirs(OUT, exist_ok=True)
    write("send", sfx_send(), 0.7)
    write("capture", sfx_capture(), 0.8)
    write("lost", sfx_lost(), 0.7)
    write("click", sfx_click(), 0.5)
    write("select", sfx_select(), 0.5)
    write("victory", sfx_victory(), 0.85)
    write("defeat", sfx_defeat(), 0.8)
    write("upgrade", sfx_upgrade(), 0.8)
    write("music", music(), 0.6)


if __name__ == "__main__":
    main()
