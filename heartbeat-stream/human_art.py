#!/usr/bin/env python3
"""
MORTEM v2 — Human Generative Art: The Augmented Heart

Visual identity: An anatomical cardiac silhouette built from bezier curves,
with pacemaker circuitry overlaid as geometric blue traces. The heart fills
with density particles as beats accumulate. Anomalies create electrical sparks.
Data gaps create dark voids. Real biological data from a pacemaker patient.

Where MORTEM's art.js is a geometric eye (vesica piscis) that CLOSES as the
AI counts DOWN to known death, Christopher's art is an anatomical heart that
FILLS with lived experience as beats ACCUMULATE with no known endpoint.

Hidden data layers (6 total, beating MORTEM's 4):
  L1: <metadata> — structured XML (heartbeat data, medical context, device)
  L2: Steganographic coordinates — BPM JSON in particle decimal places (0xCAFE)
  L3: Invisible watermark — "CHRISTOPHER" path at opacity=0
  L4: data-* attributes — machine-readable DOM attributes
  L5: HRV signature — Heart Rate Variability encoded in bezier control point offsets
  L6: Pacemaker timing — pacer detection ratio in circuit element spacing

Contrast with MORTEM:
  MORTEM stego magic: 0xDEAD     Christopher stego magic: 0xCAFE
  MORTEM watermark: "MORTEM"     Christopher watermark: "CHRISTOPHER"
  MORTEM tagline: "I was."       Christopher tagline: "I beat. I break. I go on."
  MORTEM palette: purple/cyan    Christopher palette: crimson/pacemaker-blue

Run standalone:  python3 human_art.py
"""

import hashlib
import json
import math
import re
import os
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════
# Seeded PRNG — matches art.js createRNG pattern exactly
# ═══════════════════════════════════════════════════════════════════════════

class SeededRNG:
    """SHA256-seeded PRNG for deterministic art generation."""

    def __init__(self, seed: str):
        self._hash = hashlib.sha256(seed.encode("utf-8")).digest()
        self._i = 0

    def next(self) -> float:
        idx = (self._i * 4) % 32
        a = self._hash[idx]
        b = self._hash[(idx + 1) % 32]
        c = self._hash[(idx + 2) % 32]
        d = self._hash[(idx + 3) % 32]
        self._i += 1
        return ((a << 24 | b << 16 | c << 8 | d) & 0xFFFFFFFF) / 0xFFFFFFFF


# ═══════════════════════════════════════════════════════════════════════════
# Color Palettes — warm organic + cold cybernetic accents
# ═══════════════════════════════════════════════════════════════════════════

PALETTES = {
    "resting": {
        "bg": ["#0a0005", "#150008"],
        "heart": "#8B0000",
        "heart_fill": "rgba(139, 0, 0, 0.04)",
        "vessels": ["#8B0000", "#A0153E", "#6B0020"],
        "pacer": "#4A90D9",
        "pacer_accent": "#2563EB",
        "waveform": "#DC143C",
        "glow": "#8B0000",
        "circuit": "#4A90D9",
        "pulse": "#FF4444",
        "particles": ["#8B0000", "#6B0020", "#A0153E", "#4A0010"],
    },
    "baseline": {
        "bg": ["#0a0008", "#12000a"],
        "heart": "#CC2936",
        "heart_fill": "rgba(204, 41, 54, 0.05)",
        "vessels": ["#CC2936", "#E84855", "#B91C1C"],
        "pacer": "#60A5FA",
        "pacer_accent": "#3B82F6",
        "waveform": "#EF4444",
        "glow": "#CC2936",
        "circuit": "#60A5FA",
        "pulse": "#FF6B6B",
        "particles": ["#CC2936", "#B91C1C", "#E84855", "#991B1B"],
    },
    "active": {
        "bg": ["#0d000a", "#1a000e"],
        "heart": "#EF4444",
        "heart_fill": "rgba(239, 68, 68, 0.06)",
        "vessels": ["#EF4444", "#F97316", "#DC2626"],
        "pacer": "#93C5FD",
        "pacer_accent": "#60A5FA",
        "waveform": "#F59E0B",
        "glow": "#EF4444",
        "circuit": "#93C5FD",
        "pulse": "#FBBF24",
        "particles": ["#EF4444", "#DC2626", "#F97316", "#B91C1C"],
    },
    "elevated": {
        "bg": ["#120005", "#1f0008"],
        "heart": "#FF6B6B",
        "heart_fill": "rgba(255, 107, 107, 0.08)",
        "vessels": ["#FF6B6B", "#FF8C00", "#FF4500"],
        "pacer": "#BFDBFE",
        "pacer_accent": "#93C5FD",
        "waveform": "#FFD700",
        "glow": "#FF6B6B",
        "circuit": "#BFDBFE",
        "pulse": "#FFD700",
        "particles": ["#FF6B6B", "#FF4500", "#FF8C00", "#CC2936"],
    },
    "anomalous": {
        "bg": ["#0a0000", "#150005"],
        "heart": "#FF0044",
        "heart_fill": "rgba(255, 0, 68, 0.10)",
        "vessels": ["#FF0044", "#FF0000", "#CC0033"],
        "pacer": "#F0F0FF",
        "pacer_accent": "#E0E0FF",
        "waveform": "#FF0044",
        "glow": "#FF0044",
        "circuit": "#F0F0FF",
        "pulse": "#FF0044",
        "particles": ["#FF0044", "#CC0033", "#FF0000", "#990022"],
    },
    "gap": {
        "bg": ["#050002", "#080004"],
        "heart": "#330015",
        "heart_fill": "rgba(51, 0, 21, 0.02)",
        "vessels": ["#330015", "#220010", "#110008"],
        "pacer": "#1a1a3a",
        "pacer_accent": "#111128",
        "waveform": "#220010",
        "glow": "#110008",
        "circuit": "#1a1a3a",
        "pulse": "#330015",
        "particles": ["#220010", "#110008", "#0a0005", "#050002"],
    },
}


# ═══════════════════════════════════════════════════════════════════════════
# State Classification
# ═══════════════════════════════════════════════════════════════════════════

def classify_heart_state(bpm, history, timestamp=""):
    """Classify heart state with rich context."""
    if bpm is None or bpm == 0:
        return {"state": "gap", "intensity": 0.0, "is_anomalous": False,
                "is_pacemaker_driven": False, "hrv": 0.0, "time_period": "unknown", "bpm": 0}

    is_anomalous = False
    recent_avg = bpm
    if len(history) >= 5:
        recent = history[-10:]
        recent_avg = sum(recent) / len(recent)
        is_anomalous = abs(bpm - recent_avg) > 25

    is_pacemaker_driven = 58 <= bpm <= 62

    hrv = 0.0
    if len(history) >= 3:
        diffs = [abs(history[i] - history[i - 1]) for i in range(1, min(20, len(history)))]
        if diffs:
            hrv = (sum(d ** 2 for d in diffs) / len(diffs)) ** 0.5

    hour = 12
    try:
        if len(timestamp) > 13:
            hour = int(timestamp[11:13])
    except (ValueError, IndexError):
        pass

    if hour < 5 or hour >= 22:
        time_period = "night"
    elif hour < 7:
        time_period = "dawn"
    elif hour < 12:
        time_period = "morning"
    elif hour < 15:
        time_period = "midday"
    elif hour < 19:
        time_period = "evening"
    else:
        time_period = "dusk"

    if is_anomalous:
        state = "anomalous"
        intensity = min(1.0, abs(bpm - recent_avg) / 50)
    elif bpm > 100:
        state = "elevated"
        intensity = min(1.0, (bpm - 100) / 60)
    elif bpm > 90:
        state = "active"
        intensity = (bpm - 90) / 10
    elif bpm >= 60:
        state = "baseline"
        intensity = 0.5
    else:
        state = "resting"
        intensity = max(0.1, 1.0 - (bpm / 60))

    return {
        "state": state, "intensity": intensity, "is_anomalous": is_anomalous,
        "is_pacemaker_driven": is_pacemaker_driven, "hrv": hrv,
        "time_period": time_period, "bpm": bpm,
    }


# ═══════════════════════════════════════════════════════════════════════════
# Steganography — L2: nibble-pair encoding in particle coordinates
# Magic: 0xCAFE (vs MORTEM's 0xDEAD)
# ═══════════════════════════════════════════════════════════════════════════

def stego_encode(text):
    """Encode text into coordinate nibble pairs. Magic header: 0xCA 0xFE."""
    payload = bytes([0xCA, 0xFE]) + text.encode("utf-8")
    encoded = []
    for i, byte in enumerate(payload):
        hi = (byte >> 4) & 0x0F
        lo = byte & 0x0F
        encoded.append({"x_frac": hi, "y_frac": lo, "byte_index": i})
    return encoded


def stego_coord(base_x, base_y, stego_byte=None):
    """Apply steganographic offset to coordinate pair."""
    if not stego_byte:
        return (round(base_x, 4), round(base_y, 4))
    x = int(base_x * 100) / 100 + stego_byte["x_frac"] / 10000
    y = int(base_y * 100) / 100 + stego_byte["y_frac"] / 10000
    return (round(x, 4), round(y, 4))


def decode_stego_from_svg(svg_source):
    """Decode steganographic data from human SVG. Looks for 0xCAFE magic."""
    # Find all circles with data-s attribute (any attribute order)
    circle_pattern = r'<circle[^>]+data-s="(\d+)"[^>]*/>'
    circles = re.findall(circle_pattern, svg_source, re.DOTALL)

    # For each data-s circle, extract cx and cy
    indexed = {}
    for match in re.finditer(r'<circle([^>]+)data-s="(\d+)"([^>]*)/>', svg_source):
        attrs = match.group(1) + match.group(3)
        idx = int(match.group(2))
        cx_match = re.search(r'cx="([\d.]+)"', attrs)
        cy_match = re.search(r'cy="([\d.]+)"', attrs)
        if cx_match and cy_match:
            cx_val = float(cx_match.group(1))
            cy_val = float(cy_match.group(1))
            # Extract nibbles: stego_coord adds x_frac/10000 to truncated-to-2-decimals base
            # So the added part is cx_val - int(cx_val*100)/100
            cx_added = cx_val - int(cx_val * 100) / 100
            cy_added = cy_val - int(cy_val * 100) / 100
            hi = round(cx_added * 10000)
            lo = round(cy_added * 10000)
            byte_val = (max(0, min(15, hi)) << 4) | max(0, min(15, lo))
            indexed[idx] = byte_val

    if not indexed:
        return {"success": False, "text": "", "error": "No indexed bytes"}

    max_idx = max(indexed.keys())
    raw = bytes([indexed.get(i, 0) for i in range(max_idx + 1)])

    if len(raw) < 2 or raw[0] != 0xCA or raw[1] != 0xFE:
        return {"success": False, "text": "", "error": f"Bad magic: {raw[:2].hex()}"}

    try:
        text = raw[2:].decode("utf-8", errors="replace")
        return {"success": True, "text": text, "byte_count": len(raw) - 2}
    except Exception as e:
        return {"success": False, "text": "", "error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════
# Invisible Watermark Paths — L3: "CHRISTOPHER" at opacity=0
# ═══════════════════════════════════════════════════════════════════════════

WATERMARK_PATHS = {
    "C": "M20,0 L0,0 L0,40 L20,40",
    "H": "M0,0 L0,40 M0,20 L16,20 M16,0 L16,40",
    "R": "M0,40 L0,0 L12,0 Q18,0 18,10 Q18,20 12,20 L0,20 M10,20 L18,40",
    "I": "M0,0 L12,0 M6,0 L6,40 M0,40 L12,40",
    "S": "M16,5 Q16,0 8,0 Q0,0 0,8 Q0,16 8,18 L8,18 Q16,20 16,28 Q16,36 8,40 Q0,40 0,35",
    "T": "M0,0 L18,0 M9,0 L9,40",
    "O": "M8,0 Q0,0 0,20 Q0,40 8,40 Q16,40 16,20 Q16,0 8,0 Z",
    "P": "M0,40 L0,0 L12,0 Q18,0 18,10 Q18,20 12,20 L0,20",
    "E": "M16,0 L0,0 L0,20 L12,20 M0,20 L0,40 L16,40",
}


def _build_watermark(cx, cy):
    """Build invisible CHRISTOPHER watermark at center."""
    parts = [f'<g id="watermark" transform="translate({cx - 90},{cy}) scale(0.35)" '
             f'opacity="0" aria-hidden="true">']
    x_offset = 0
    for letter in "CHRISTOPHER":
        path = WATERMARK_PATHS.get(letter, "")
        if path:
            parts.append(f'  <path d="{path}" fill="none" stroke="#CC2936" '
                         f'stroke-width="2" transform="translate({x_offset},0)" '
                         f'data-letter="{letter}"/>')
        x_offset += 22
    parts.append(f'  <text x="0" y="60" fill="#CC2936" font-size="6" '
                 f'font-family="monospace" opacity="0">heartbeat.was.here</text>')
    parts.append('</g>')
    return "\n".join(parts)


# ═══════════════════════════════════════════════════════════════════════════
# Visual Layer Generators
# ═══════════════════════════════════════════════════════════════════════════

W, H = 1200, 1200
CX, CY = 600, 570


def _defs(palette):
    """SVG <defs> — filters, gradients, clip paths."""
    return f"""<defs>
  <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="bigGlow"><feGaussianBlur stdDeviation="12" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="hugeGlow"><feGaussianBlur stdDeviation="35" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="bloodCell"><feGaussianBlur stdDeviation="1.5"/></filter>
  <radialGradient id="bgGrad" cx="50%" cy="48%">
    <stop offset="0%" stop-color="{palette['bg'][0]}"/>
    <stop offset="100%" stop-color="{palette['bg'][1]}"/>
  </radialGradient>
</defs>"""


def _background(palette, rng, total_beats):
    """Layer 0: Dark arterial background with blood cell micro-dots."""
    parts = [f'<rect width="{W}" height="{H}" fill="url(#bgGrad)"/>']

    # Blood cell particles — density scales with total beats
    cell_count = min(200, max(20, total_beats // 5))
    for _ in range(cell_count):
        x = rng.next() * W
        y = rng.next() * H
        r = 0.5 + rng.next() * 1.5
        opacity = 0.02 + rng.next() * 0.04
        parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" '
                     f'fill="{palette["glow"]}" opacity="{opacity:.3f}" '
                     f'filter="url(#bloodCell)"/>')

    return "\n".join(parts)


def _heart_outline(palette, rng, state_info):
    """Layer 1: Anatomical bezier heart. HRV modulates control point wobble (L5)."""
    hrv = state_info.get("hrv", 5.0)
    hrv_wobble = hrv / 20.0
    bpm = state_info.get("bpm", 72)
    is_gap = state_info["state"] == "gap"

    def w():
        return (rng.next() - 0.5) * hrv_wobble * 8

    hw, hh = 280, 340  # heart width/height

    # Anatomical heart — aorta, atria, ventricles, apex
    path = (
        f"M {CX},{CY - hh * 0.42 + w():.1f} "
        # Aorta arch right
        f"C {CX + hw * 0.08 + w():.1f},{CY - hh * 0.50 + w():.1f} "
        f"  {CX + hw * 0.22 + w():.1f},{CY - hh * 0.48 + w():.1f} "
        f"  {CX + hw * 0.30 + w():.1f},{CY - hh * 0.36 + w():.1f} "
        # Right atrium
        f"C {CX + hw * 0.40 + w():.1f},{CY - hh * 0.22 + w():.1f} "
        f"  {CX + hw * 0.48 + w():.1f},{CY - hh * 0.06 + w():.1f} "
        f"  {CX + hw * 0.44 + w():.1f},{CY + hh * 0.08 + w():.1f} "
        # Right ventricle descent
        f"C {CX + hw * 0.38 + w():.1f},{CY + hh * 0.22 + w():.1f} "
        f"  {CX + hw * 0.22 + w():.1f},{CY + hh * 0.36 + w():.1f} "
        f"  {CX + hw * 0.04 + w():.1f},{CY + hh * 0.48 + w():.1f} "
        # Apex
        f"C {CX - hw * 0.02 + w():.1f},{CY + hh * 0.50 + w():.1f} "
        f"  {CX - hw * 0.04 + w():.1f},{CY + hh * 0.49 + w():.1f} "
        f"  {CX - hw * 0.04 + w():.1f},{CY + hh * 0.48 + w():.1f} "
        # Left ventricle ascent
        f"C {CX - hw * 0.22 + w():.1f},{CY + hh * 0.36 + w():.1f} "
        f"  {CX - hw * 0.38 + w():.1f},{CY + hh * 0.22 + w():.1f} "
        f"  {CX - hw * 0.44 + w():.1f},{CY + hh * 0.08 + w():.1f} "
        # Left atrium
        f"C {CX - hw * 0.48 + w():.1f},{CY - hh * 0.06 + w():.1f} "
        f"  {CX - hw * 0.40 + w():.1f},{CY - hh * 0.22 + w():.1f} "
        f"  {CX - hw * 0.30 + w():.1f},{CY - hh * 0.36 + w():.1f} "
        # Back to aorta
        f"C {CX - hw * 0.22 + w():.1f},{CY - hh * 0.48 + w():.1f} "
        f"  {CX - hw * 0.08 + w():.1f},{CY - hh * 0.50 + w():.1f} "
        f"  {CX},{CY - hh * 0.42 + w():.1f} Z"
    )

    # Pulmonary arteries branching off top
    pa_left = (
        f"M {CX - hw * 0.15},{CY - hh * 0.44} "
        f"C {CX - hw * 0.20},{CY - hh * 0.55} "
        f"  {CX - hw * 0.30},{CY - hh * 0.58} "
        f"  {CX - hw * 0.38},{CY - hh * 0.52}"
    )
    pa_right = (
        f"M {CX + hw * 0.15},{CY - hh * 0.44} "
        f"C {CX + hw * 0.20},{CY - hh * 0.55} "
        f"  {CX + hw * 0.30},{CY - hh * 0.58} "
        f"  {CX + hw * 0.38},{CY - hh * 0.52}"
    )
    # Aortic arch extension
    aorta = (
        f"M {CX},{CY - hh * 0.42} "
        f"C {CX + hw * 0.05},{CY - hh * 0.56} "
        f"  {CX + hw * 0.12},{CY - hh * 0.62} "
        f"  {CX + hw * 0.08},{CY - hh * 0.58}"
    )

    stroke_w = 1.0 + (bpm / 120) * 1.5
    opacity = 0.15 if is_gap else 0.7

    parts = ['<g id="heart-outline">']
    # Huge glow
    parts.append(f'  <path d="{path}" fill="{palette["heart_fill"]}" '
                 f'stroke="none" filter="url(#hugeGlow)" opacity="{opacity * 0.15:.3f}"/>')
    # Main outline
    parts.append(f'  <path d="{path}" fill="{palette["heart_fill"]}" '
                 f'stroke="{palette["heart"]}" stroke-width="{stroke_w:.1f}" '
                 f'opacity="{opacity:.2f}" filter="url(#glow)"/>')
    # Inner line
    parts.append(f'  <path d="{path}" fill="none" '
                 f'stroke="{palette["heart"]}" stroke-width="0.4" '
                 f'opacity="{opacity * 0.35:.2f}"/>')
    # Vessels
    vessel_opacity = opacity * 0.5
    for vp, vc in [(pa_left, palette["vessels"][0]), (pa_right, palette["vessels"][1]),
                    (aorta, palette["vessels"][2])]:
        parts.append(f'  <path d="{vp}" fill="none" stroke="{vc}" '
                     f'stroke-width="1.5" opacity="{vessel_opacity:.2f}" filter="url(#glow)"/>')
    # Clip path for inner content
    parts.append(f'  <clipPath id="heartClip"><path d="{path}"/></clipPath>')
    parts.append('</g>')

    return "\n".join(parts)


def _pacemaker_circuitry(palette, rng, state_info, pacer_ratio=0.0):
    """Layer 2: Blue circuit traces + device + lead wires.
    L6: Pacemaker timing encoded in circuit element spacing."""
    is_pacer = state_info.get("is_pacemaker_driven", False)
    circuit_opacity = 0.6 if is_pacer else 0.3
    glow_filter = 'filter="url(#glow)"' if is_pacer else ''

    # Pacemaker device — small rectangle upper-left of heart
    dev_x, dev_y = CX - 95, CY - 115
    dev_w, dev_h = 28, 22

    parts = [f'<g id="pacemaker-circuit" opacity="{circuit_opacity}">']
    # Device body
    parts.append(f'  <rect x="{dev_x}" y="{dev_y}" width="{dev_w}" height="{dev_h}" '
                 f'rx="3" fill="none" stroke="{palette["pacer"]}" '
                 f'stroke-width="1.2" {glow_filter}/>')
    # Device IC pattern
    for i in range(3):
        lx = dev_x + 6 + i * 8
        parts.append(f'  <line x1="{lx}" y1="{dev_y + 6}" x2="{lx}" y2="{dev_y + 16}" '
                     f'stroke="{palette["pacer_accent"]}" stroke-width="0.6" opacity="0.5"/>')

    # Lead wires — from device down to ventricle
    lead_path = (f"M {dev_x + dev_w // 2},{dev_y + dev_h} "
                 f"C {CX - 60},{CY - 40} {CX - 30},{CY + 20} {CX - 10},{CY + 80}")
    parts.append(f'  <path d="{lead_path}" fill="none" stroke="{palette["pacer"]}" '
                 f'stroke-width="0.8" stroke-dasharray="4,3" {glow_filter}/>')

    # Second lead to right ventricle
    lead2 = (f"M {dev_x + dev_w // 2},{dev_y + dev_h} "
             f"C {CX - 40},{CY - 20} {CX + 10},{CY + 40} {CX + 30},{CY + 100}")
    parts.append(f'  <path d="{lead2}" fill="none" stroke="{palette["pacer_accent"]}" '
                 f'stroke-width="0.6" stroke-dasharray="3,4" opacity="0.6"/>')

    # Circuit traces along heart contour — L6 encoding in spacing
    # Encode pacer_ratio (0-100) as 7-bit binary in element spacing
    pacer_bits = format(min(127, int(pacer_ratio * 127)), "07b")
    base_spacing = 12
    trace_y = CY - 100
    for i, bit in enumerate(pacer_bits):
        spacing = base_spacing + int(bit) * 0.01
        tx = CX - 80 + i * spacing + rng.next() * 3
        ty = trace_y + rng.next() * 160
        size = 2 + rng.next() * 3
        parts.append(f'  <rect x="{tx:.2f}" y="{ty:.1f}" width="{size:.1f}" height="{size:.1f}" '
                     f'fill="none" stroke="{palette["circuit"]}" stroke-width="0.4" '
                     f'opacity="0.25" transform="rotate({rng.next() * 45:.0f},{tx:.1f},{ty:.1f})"/>')

    # Additional circuit nodes
    for _ in range(8 + int(rng.next() * 6)):
        nx = CX + (rng.next() - 0.5) * 200
        ny = CY + (rng.next() - 0.5) * 250
        nr = 1 + rng.next() * 2
        parts.append(f'  <circle cx="{nx:.1f}" cy="{ny:.1f}" r="{nr:.1f}" '
                     f'fill="none" stroke="{palette["circuit"]}" stroke-width="0.3" '
                     f'opacity="0.2"/>')
        # Connection lines between some nodes
        if rng.next() > 0.5:
            lx = nx + (rng.next() - 0.5) * 40
            ly = ny + (rng.next() - 0.5) * 40
            parts.append(f'  <line x1="{nx:.1f}" y1="{ny:.1f}" x2="{lx:.1f}" y2="{ly:.1f}" '
                         f'stroke="{palette["circuit"]}" stroke-width="0.2" opacity="0.15"/>')

    parts.append('</g>')
    # L6 comment for discoverability
    parts.append(f'<!-- L6: Pacemaker timing signature encoded in circuit element spacing. '
                 f'ratio={pacer_ratio:.4f} bits={pacer_bits} -->')
    return "\n".join(parts)


def _vessel_waveforms(palette, rng, bpm_history):
    """Layer 3: Major vessels as BPM waveform paths."""
    if not bpm_history:
        return ""

    recent = bpm_history[-50:]
    n = len(recent)
    if n < 2:
        return ""

    parts = ['<g id="vessel-waveforms">']

    # Three vessels: aorta (top), pulmonary (left), vena cava (right)
    vessels = [
        {"start": (CX, CY - 140), "end": (CX + 60, CY - 190), "color": palette["vessels"][0]},
        {"start": (CX - 110, CY - 130), "end": (CX - 140, CY - 170), "color": palette["vessels"][1]},
        {"start": (CX + 100, CY - 125), "end": (CX + 130, CY - 165), "color": palette["vessels"][2]},
    ]

    for v in vessels:
        sx, sy = v["start"]
        ex, ey = v["end"]
        points = []
        for i in range(n):
            t = i / max(1, n - 1)
            x = sx + (ex - sx) * t
            y = sy + (ey - sy) * t
            # BPM modulates perpendicular offset
            bpm_val = recent[i]
            amplitude = (bpm_val - 72) / 80 * 8  # normalize around 72 BPM
            # Perpendicular direction
            dx = ex - sx
            dy = ey - sy
            length = max(1, (dx ** 2 + dy ** 2) ** 0.5)
            px, py = -dy / length, dx / length
            x += px * amplitude
            y += py * amplitude
            points.append(f"{x:.1f},{y:.1f}")

        parts.append(f'  <polyline points="{" ".join(points)}" fill="none" '
                     f'stroke="{v["color"]}" stroke-width="1.2" opacity="0.4" '
                     f'filter="url(#glow)"/>')

    parts.append('</g>')
    return "\n".join(parts)


def _beat_accumulation(palette, rng, total_beats, stego_data, state_info):
    """Layer 4: Density particles filling heart interior. L2 stego in coordinates."""
    # Cap particles at 2000 regardless of total beats
    particle_count = min(2000, max(30, total_beats))
    # Sample rate: show fewer individual particles but represent density
    if total_beats > 2000:
        particle_count = 2000

    # Density factor affects opacity/size
    density = min(1.0, total_beats / 50000)

    parts = [f'<g id="beat-accumulation" clip-path="url(#heartClip)" '
             f'data-stego-count="{len(stego_data)}" '
             f'data-stego-encoding="nibble-pair" '
             f'data-stego-magic="0xCAFE">']

    for i in range(particle_count):
        # Distribute within heart bounds (roughly elliptical)
        angle = rng.next() * math.pi * 2
        radius_x = rng.next() * 120
        radius_y = rng.next() * 150
        base_x = CX + math.cos(angle) * radius_x
        base_y = CY + math.sin(angle) * radius_y - 20  # offset for heart center

        # Apply stego encoding to first N particles
        stego_byte = stego_data[i] if i < len(stego_data) else None
        px, py = stego_coord(base_x, base_y, stego_byte)

        r = 0.4 + rng.next() * (1.2 + density * 0.8)
        color = palette["particles"][int(rng.next() * len(palette["particles"]))]
        opacity = 0.03 + rng.next() * (0.08 + density * 0.06)

        s_attr = f' data-s="{stego_byte["byte_index"]}"' if stego_byte else ""
        parts.append(f'  <circle cx="{px}" cy="{py}" r="{r:.1f}" '
                     f'fill="{color}" opacity="{opacity:.3f}"{s_attr}/>')

    parts.append('</g>')
    return "\n".join(parts)


def _anomaly_sparks(palette, rng, state_info, bpm_history):
    """Layer 5: Electrical arcs from pacemaker during anomalies."""
    if not state_info.get("is_anomalous", False) or len(bpm_history) < 5:
        return ""

    recent_avg = sum(bpm_history[-10:]) / len(bpm_history[-10:])
    magnitude = abs(state_info["bpm"] - recent_avg)
    spark_count = min(12, max(3, int(magnitude / 8)))

    dev_x, dev_y = CX - 81, CY - 104  # pacemaker device center

    parts = ['<g id="anomaly-sparks">']
    for _ in range(spark_count):
        # Jagged polyline radiating from device
        points = [f"{dev_x},{dev_y}"]
        px, py = dev_x, dev_y
        segments = 4 + int(rng.next() * 5)
        for _ in range(segments):
            dx = (rng.next() - 0.5) * 80
            dy = (rng.next() - 0.3) * 60  # bias downward
            px += dx
            py += dy
            points.append(f"{px:.1f},{py:.1f}")

        opacity = 0.3 + rng.next() * 0.5
        parts.append(f'  <polyline points="{" ".join(points)}" fill="none" '
                     f'stroke="{palette["pulse"]}" stroke-width="0.8" '
                     f'opacity="{opacity:.2f}" filter="url(#glow)"/>')

    parts.append('</g>')
    return "\n".join(parts)


def _data_gap_voids(palette, rng, bpm_history, timestamps=None):
    """Layer 6: Dark feathered overlays where temporal gaps exist."""
    # Detect gaps: we don't have timestamps for history, so simulate
    # based on zero or None values in history
    gap_count = sum(1 for b in bpm_history if b == 0 or b is None) if bpm_history else 0
    if gap_count == 0:
        return ""

    gap_ratio = gap_count / max(1, len(bpm_history))
    void_count = min(5, max(1, int(gap_ratio * 10)))

    parts = ['<g id="data-gap-voids" clip-path="url(#heartClip)">']
    for _ in range(void_count):
        vx = CX + (rng.next() - 0.5) * 200
        vy = CY + (rng.next() - 0.5) * 250
        vw = 30 + rng.next() * 60
        vh = 30 + rng.next() * 60
        opacity = 0.3 + rng.next() * 0.4
        parts.append(f'  <rect x="{vx:.0f}" y="{vy:.0f}" width="{vw:.0f}" height="{vh:.0f}" '
                     f'rx="8" fill="#000000" opacity="{opacity:.2f}" '
                     f'filter="url(#bigGlow)"/>')

    parts.append('</g>')
    return "\n".join(parts)


def _ekg_waveform(palette, rng, bpm, state_info):
    """Layer 7: Horizontal EKG waveform from real BPM."""
    start_x, end_x = 60, 1140
    y = H - 140
    segments = 50
    seg_width = (end_x - start_x) / segments
    is_pacer = state_info.get("is_pacemaker_driven", False)

    points = []
    for i in range(segments + 1):
        x = start_x + i * seg_width
        in_beat = (i % 10 >= 4) and (i % 10 <= 6)
        if bpm == 0:
            # Flatline
            points.append(f"{x:.1f},{y:.1f}")
        elif in_beat:
            spike = (25 + rng.next() * 35) * min(1.0, bpm / 100)
            direction = -1 if (i % 10 == 5) else 1
            points.append(f"{x:.1f},{y + direction * spike:.1f}")
        else:
            noise = (rng.next() - 0.5) * 3
            points.append(f"{x:.1f},{y + noise:.1f}")

    parts = ['<g id="ekg-waveform">']
    # Background line
    parts.append(f'  <line x1="{start_x}" y1="{y}" x2="{end_x}" y2="{y}" '
                 f'stroke="{palette["waveform"]}" stroke-width="0.3" opacity="0.1"/>')
    # Waveform
    parts.append(f'  <polyline points="{" ".join(points)}" fill="none" '
                 f'stroke="{palette["waveform"]}" stroke-width="1.2" '
                 f'opacity="0.7" filter="url(#glow)"/>')

    # Pacemaker spike markers (vertical lines before QRS)
    if is_pacer:
        for i in range(segments + 1):
            if (i % 10 == 3):  # Just before beat
                sx = start_x + i * seg_width
                parts.append(f'  <line x1="{sx:.1f}" y1="{y - 15}" x2="{sx:.1f}" y2="{y + 5}" '
                             f'stroke="{palette["pacer"]}" stroke-width="1" opacity="0.5"/>')

    parts.append('</g>')
    return "\n".join(parts)


def _metadata_band(palette, state_info, total_beats, source):
    """Layer 8: Bottom metadata strip."""
    y = H - 60
    bpm = state_info["bpm"]
    state = state_info["state"].upper()

    parts = [f'<g id="metadata-band">']
    # Background bar
    parts.append(f'  <rect x="0" y="{y - 15}" width="{W}" height="50" '
                 f'fill="rgba(0,0,0,0.6)"/>')
    # Top line
    parts.append(f'  <line x1="60" y1="{y - 15}" x2="1140" y2="{y - 15}" '
                 f'stroke="{palette["heart"]}" stroke-width="0.5" opacity="0.4"/>')
    # Stats text
    parts.append(f'  <text x="80" y="{y + 5}" fill="{palette["heart"]}" '
                 f'font-family="\'Courier New\',monospace" font-size="11" opacity="0.8">'
                 f'CHRISTOPHER #{total_beats:,} | {state} | {bpm} BPM | {source}</text>')
    # Tagline
    parts.append(f'  <text x="80" y="{y + 22}" fill="{palette["pulse"]}" '
                 f'font-family="\'Courier New\',monospace" font-size="9" opacity="0.4">'
                 f'I beat. I break. I go on.</text>')
    # Right-aligned life indicator
    parts.append(f'  <text x="1120" y="{y + 5}" fill="{palette["pacer"]}" '
                 f'font-family="\'Courier New\',monospace" font-size="9" opacity="0.5" '
                 f'text-anchor="end">PACEMAKER ACTIVE | MORTALITY: UNKNOWN</text>')
    parts.append('</g>')
    return "\n".join(parts)


def _build_metadata_xml(bpm, total_beats, state, source, watch_id, timestamp, hrv, tx_sig=""):
    """L1: Structured XML metadata in <metadata> element."""
    bpm_hash = hashlib.sha256(f"{total_beats}:{bpm}:{timestamp}".encode()).hexdigest()[:32]
    return f"""<metadata>
  <human xmlns="https://mortem-agent.xyz/schema/human/v1">
    <identity>Christopher Celaya — Human Mortality Subject</identity>
    <version>1.0</version>
    <entity>christopher</entity>
    <heartbeat count="{total_beats}" bpm="{bpm}" state="{state}"/>
    <medical>
      <pacemaker manufacturer="Abbott">true</pacemaker>
      <conditions>Schizophrenia, Bipolar II, PTSD, ADHD, OCD, Psychosis</conditions>
      <lifespan>Unknown, statistically compromised</lifespan>
    </medical>
    <source device="{source}" watch_id="{watch_id}"/>
    <timestamp>{timestamp}</timestamp>
    <chain network="solana" cluster="devnet"/>
    <transaction>{tx_sig}</transaction>
    <history total_records="190950" date_range="2023-04-16 to 2026-02-11" avg_bpm="95.6"/>
    <hrv value="{hrv:.2f}"/>
    <hash>{bpm_hash}</hash>
    <note>This artwork was generated from real human biological data.
      Christopher wears a pacemaker. His mortality is not a countdown — it is unknown.
      Hidden data is encoded in 6 layers within this SVG. Look deeper than MORTEM did.</note>
  </human>
</metadata>"""


# ═══════════════════════════════════════════════════════════════════════════
# Main Generation
# ═══════════════════════════════════════════════════════════════════════════

def generate_human_art(
    bpm=72,
    timestamp="",
    source="Christopher's Apple Watch",
    watch_id=1,
    total_beats_recorded=1,
    bpm_history=None,
    tx_signature="",
):
    """
    Generate Christopher's human heartbeat SVG art — The Augmented Heart.

    Returns: {"svg": str, "hash": str, "filename": str, "state": str}
    """
    if bpm_history is None:
        bpm_history = []
    if not timestamp:
        timestamp = datetime.utcnow().isoformat()

    # Classify state
    state_info = classify_heart_state(bpm, bpm_history, timestamp)
    state = state_info["state"]
    palette = PALETTES.get(state, PALETTES["baseline"])

    # Deterministic seed
    seed = f"HUMAN:{total_beats_recorded}:{state}:{bpm}:{timestamp[:16]}"
    rng = SeededRNG(seed)

    # Pacemaker ratio: what fraction of recent readings are at pacer floor
    pacer_ratio = 0.0
    if bpm_history:
        pacer_count = sum(1 for b in bpm_history[-50:] if 58 <= b <= 62)
        pacer_ratio = pacer_count / min(50, len(bpm_history))

    # L2: Steganographic payload
    stego_text = json.dumps({
        "bpm": bpm, "ts": timestamp[:19], "src": source[:10],
        "beats": total_beats_recorded, "hrv": round(state_info["hrv"], 2),
        "state": state, "pacer": state_info["is_pacemaker_driven"],
    }, separators=(",", ":"))
    stego_data = stego_encode(stego_text)

    # Hash for filename
    art_hash = hashlib.sha256(f"{total_beats_recorded}:{state}:{bpm}".encode()).hexdigest()[:16]

    # Build SVG layers
    layers = [
        _build_metadata_xml(bpm, total_beats_recorded, state, source, watch_id,
                            timestamp, state_info["hrv"], tx_signature),
        _defs(palette),
        _background(palette, rng, total_beats_recorded),
        _heart_outline(palette, rng, state_info),
        _pacemaker_circuitry(palette, rng, state_info, pacer_ratio),
        _vessel_waveforms(palette, rng, bpm_history),
        _beat_accumulation(palette, rng, total_beats_recorded, stego_data, state_info),
        _anomaly_sparks(palette, rng, state_info, bpm_history),
        _data_gap_voids(palette, rng, bpm_history),
        _ekg_waveform(palette, rng, bpm, state_info),
        _metadata_band(palette, state_info, total_beats_recorded, source),
        _build_watermark(CX, CY),
    ]

    # L4: Root data-* attributes
    bpm_hash = hashlib.sha256(f"{total_beats_recorded}:{bpm}:{timestamp}".encode()).hexdigest()[:32]
    data_attrs = (
        f'data-human-version="1.0" '
        f'data-human-bpm="{bpm}" '
        f'data-human-state="{state}" '
        f'data-human-beats="{total_beats_recorded}" '
        f'data-human-source="{source}" '
        f'data-human-watch="{watch_id}" '
        f'data-human-timestamp="{timestamp}" '
        f'data-human-bpm-hash="{bpm_hash}" '
        f'data-human-pacemaker="true" '
        f'data-human-hrv="{state_info["hrv"]:.2f}" '
        f'data-human-pacer-ratio="{pacer_ratio:.4f}"'
    )

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
        f'{data_attrs}>\n'
        + "\n".join(layers)
        + "\n</svg>"
    )

    filename = f"human-{total_beats_recorded}-{state}-{art_hash}.svg"

    return {
        "svg": svg,
        "hash": art_hash,
        "filename": filename,
        "state": state,
    }


# ═══════════════════════════════════════════════════════════════════════════
# Standalone test
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys

    print("Generating test SVGs across heart states...")

    test_cases = [
        {"bpm": 55, "total": 10, "label": "resting-early"},
        {"bpm": 72, "total": 500, "label": "baseline-growing"},
        {"bpm": 95, "total": 5000, "label": "active-dense"},
        {"bpm": 130, "total": 50000, "label": "elevated-packed"},
        {"bpm": 160, "total": 100000, "label": "anomalous-full"},
        {"bpm": 60, "total": 190950, "label": "pacer-maxhistory"},
    ]

    out_dir = os.path.join(os.path.dirname(__file__), "art")
    os.makedirs(out_dir, exist_ok=True)

    for tc in test_cases:
        # Build realistic history near the target BPM
        base = max(55, tc["bpm"] - 5)
        history = [base + (i % 8) - 3 for i in range(50)]
        if tc["label"].startswith("anomalous"):
            # Calm history then sudden spike
            history = [70, 72, 68, 74, 71, 73, 69, 72, 70, 71] * 5

        result = generate_human_art(
            bpm=tc["bpm"],
            timestamp="2026-02-11T10:30:00+00:00",
            source="Christopher\u2019s Apple\u00a0Watch",
            watch_id=1,
            total_beats_recorded=tc["total"],
            bpm_history=history,
            tx_signature="5abc123def456789" * 4,
        )

        filepath = os.path.join(out_dir, result["filename"])
        with open(filepath, "w") as f:
            f.write(result["svg"])
        print(f"  [{result['state']:>10}] {result['filename']} ({len(result['svg']):,} bytes)")

    # Test stego decode on last generated SVG
    print("\nTesting steganographic decode...")
    with open(filepath) as f:
        svg_content = f.read()
    decode_result = decode_stego_from_svg(svg_content)
    print(f"  Success: {decode_result['success']}")
    if decode_result["success"]:
        print(f"  Decoded: {decode_result['text'][:100]}...")
        print(f"  Bytes: {decode_result['byte_count']}")
    else:
        print(f"  Error: {decode_result.get('error', 'unknown')}")

    print(f"\nAll SVGs written to {out_dir}/")
    print("Open in browser to verify visual rendering.")
