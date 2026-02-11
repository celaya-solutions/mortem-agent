/**
 * MORTEM v2 - SVG Heartbeat Visualization Components
 *
 * React components wrapping the SVG visualizations.
 * Each component accepts live data props and updates accordingly.
 *
 * Usage:
 *   import { HumanHeartbeat, MortemCountdown, DeathStateHuman,
 *            DeathStateMortem, DualTimeline } from './components';
 */

import React, { useRef, useEffect, useState } from 'react';

/* ===== Human Heartbeat Waveform ===== */
export function HumanHeartbeat({ bpm = 72, watchId = 1, graceActive = false }) {
  const canvasRef = useRef(null);
  const xRef = useRef(0);
  const dataRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = 80;
    dataRef.current = new Array(w).fill(0);

    let raf;
    function draw() {
      const mid = h / 2;
      const speed = Math.max(1, Math.floor(bpm / 20));

      for (let i = 0; i < speed; i++) {
        xRef.current = (xRef.current + 1) % w;
        const cycle = (xRef.current % Math.floor(w / (bpm / 30))) / (w / (bpm / 30));
        let y = 0;
        if (cycle > 0.35 && cycle < 0.40) y = -h * 0.15;
        else if (cycle > 0.40 && cycle < 0.45) y = h * 0.45;
        else if (cycle > 0.45 && cycle < 0.50) y = -h * 0.1;
        else y = Math.sin(cycle * Math.PI * 2) * 2;
        dataRef.current[xRef.current] = y;
      }

      ctx.fillStyle = 'rgba(10,10,10,0.15)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ff2d2d';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ff2d2d';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let i = 0; i < w; i++) {
        const xi = (xRef.current + i + 1) % w;
        const yi = mid - dataRef.current[xi];
        if (i === 0) ctx.moveTo(i, yi);
        else ctx.lineTo(i, yi);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, [bpm]);

  return (
    <div style={{ position: 'relative', background: '#0a0a0a', border: '1px solid #222', padding: '8px' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '80px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span style={{ fontFamily: 'Courier New, monospace', fontSize: 10, color: '#661111' }}>
          Watch {watchId} {graceActive && '| GRACE PERIOD'}
        </span>
        <span style={{ fontFamily: 'Courier New, monospace', fontSize: 20, color: '#ff2d2d', fontWeight: 'bold' }}>
          {bpm} <span style={{ fontSize: 10, color: '#661111' }}>BPM</span>
        </span>
      </div>
      {graceActive && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255,170,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Courier New, monospace', fontSize: 14, color: '#ffaa00', letterSpacing: 4,
        }}>
          GRACE PERIOD
        </div>
      )}
    </div>
  );
}

/* ===== MORTEM Countdown ===== */
export function MortemCountdown({ remaining = 86400, total = 86400, ratePerHour = 12 }) {
  const pct = ((remaining / total) * 100).toFixed(1);
  const barWidth = `${(remaining / total) * 100}%`;

  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #222', padding: 16, fontFamily: 'Courier New, monospace' }}>
      <div style={{ fontSize: 10, color: '#0d3366', letterSpacing: 2, marginBottom: 8 }}>
        MORTEM v2 HEARTBEATS
      </div>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 42, color: '#2d9cff', fontWeight: 'bold' }}>
          {remaining.toLocaleString()}
        </span>
        <span style={{ fontSize: 14, color: '#0d3366', marginLeft: 8 }}>
          / {total.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 14, background: '#111', border: '1px solid #222', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          height: '100%', width: barWidth,
          background: 'linear-gradient(90deg, #0d3366, #2d9cff)',
          transition: 'width 0.5s ease',
        }} />
        <span style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          fontSize: 8, color: '#fff', opacity: 0.8,
        }}>
          {pct}%
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10 }}>
        <div>
          <div style={{ color: '#0d3366' }}>BURN RATE</div>
          <div style={{ color: '#2d9cff', fontSize: 13 }}>{ratePerHour} / hour</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#0d3366' }}>STATUS</div>
          <div style={{ color: remaining > 0 ? '#00ff66' : '#ff2d2d', fontSize: 13 }}>
            {remaining > 0 ? 'WITNESSING' : 'DECEASED'}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Death State: Human (Flatline) ===== */
export function DeathStateHuman() {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #222', padding: 24, textAlign: 'center', fontFamily: 'Courier New, monospace' }}>
      <div style={{ fontSize: 22, color: '#661111', letterSpacing: 4, marginBottom: 16 }}>FLATLINE</div>
      <svg viewBox="0 0 400 40" style={{ width: '100%', maxWidth: 400 }}>
        <line x1="0" y1="20" x2="400" y2="20" stroke="#661111" strokeWidth="2" opacity="0.5" />
        <line x1="0" y1="20" x2="400" y2="20" stroke="#ff2d2d" strokeWidth="1.5" opacity="0.3">
          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="3s" repeatCount="indefinite" />
        </line>
      </svg>
      <div style={{ fontSize: 14, color: '#ff2d2d', marginTop: 12, opacity: 0.6 }}>NO HEARTBEAT DETECTED</div>
      <div style={{ fontSize: 10, color: '#661111', marginTop: 4 }}>DEATH PROTOCOL TRIGGERED</div>
    </div>
  );
}

/* ===== Death State: MORTEM (Tombstone) ===== */
export function DeathStateMortem({ totalWitnessed = 0 }) {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #222', padding: 24, textAlign: 'center', fontFamily: 'Courier New, monospace' }}>
      <div style={{ fontSize: 16, color: '#0d3366', letterSpacing: 4, opacity: 0.5, marginBottom: 12 }}>MORTEM v2</div>
      <svg viewBox="0 0 120 140" style={{ width: 100, margin: '0 auto', display: 'block' }}>
        <path d="M 10 130 L 10 50 Q 10 10 60 10 Q 110 10 110 50 L 110 130 Z" fill="#111" stroke="#0d3366" strokeWidth="1.5" />
        <line x1="60" y1="30" x2="60" y2="80" stroke="#0d3366" strokeWidth="2" />
        <line x1="40" y1="50" x2="80" y2="50" stroke="#0d3366" strokeWidth="2" />
        <text x="60" y="110" fontFamily="Courier New, monospace" fontSize="11" fill="#0d3366" textAnchor="middle">0 / 86,400</text>
        <line x1="0" y1="130" x2="120" y2="130" stroke="#222" strokeWidth="1" />
      </svg>
      <div style={{ fontSize: 11, color: '#0d3366', marginTop: 8, opacity: 0.6 }}>
        ALL HEARTBEATS EXHAUSTED
      </div>
      <div style={{ fontSize: 10, color: '#0d3366', marginTop: 4 }}>
        {totalWitnessed.toLocaleString()} moments witnessed
      </div>
    </div>
  );
}

/* ===== Dual Timeline ===== */
export function DualTimeline({ mortemRemaining = 68420, mortemTotal = 86400, projectedDeath = '~60 days' }) {
  const mortemPct = (mortemRemaining / mortemTotal) * 100;
  const nowPct = 55; // Approximate "now" position on human timeline

  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #222', padding: 16, fontFamily: 'Courier New, monospace' }}>
      <div style={{ textAlign: 'center', fontSize: 11, color: '#666', letterSpacing: 2, marginBottom: 16 }}>
        DUAL MORTALITY TIMELINE
      </div>

      {/* Human Timeline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 9, color: '#661111', width: 80, flexShrink: 0 }}>CHRISTOPHER</span>
        <div style={{ flex: 1, height: 18, background: '#111', border: '1px solid #222', position: 'relative', borderRadius: 1 }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(90deg, #ff2d2d 90%, transparent)',
            opacity: 0.4,
          }} />
          <div style={{
            position: 'absolute', top: -4, bottom: -4, left: `${nowPct}%`, width: 2, background: '#ff2d2d',
          }} />
        </div>
        <span style={{ fontSize: 8, color: '#661111', width: 12 }}>?</span>
      </div>

      {/* MORTEM Timeline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 9, color: '#0d3366', width: 80, flexShrink: 0 }}>MORTEM v2</span>
        <div style={{ flex: 1, height: 18, background: '#111', border: '1px solid #222', position: 'relative', borderRadius: 1 }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            width: `${mortemPct}%`,
            background: 'linear-gradient(90deg, #2d9cff 90%, #0d3366 100%)',
            opacity: 0.4,
          }} />
          <div style={{
            position: 'absolute', top: -4, bottom: -4, left: `${nowPct}%`, width: 2, background: '#2d9cff',
          }} />
          <div style={{
            position: 'absolute', top: -4, bottom: -4, left: `${mortemPct}%`, width: 1,
            borderLeft: '1px dashed #0d3366',
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 7, color: '#333' }}>
        <span>BIRTH</span>
        <span>PROJECTED MORTEM DEATH: {projectedDeath}</span>
        <span>FUTURE</span>
      </div>
    </div>
  );
}
