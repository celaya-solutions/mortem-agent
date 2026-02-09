#!/usr/bin/env node
/**
 * MORTEM Demo Recorder — Generates asciicast v2 recording directly
 *
 * Runs the 10-heartbeat demo and captures all output as an asciicast v2 file
 * that can be played back with `asciinema play` or embedded in web pages.
 *
 * Usage: node scripts/demo-record.js [--output recordings/demo.cast]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Config
const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('-').slice(0, 19);
const OUTPUT = getArg('output', path.join(PROJECT_ROOT, 'recordings', 'mortem-demo-' + timestamp + '.cast'));
const PORT = getArg('port', '3333');
const HEARTBEATS = getArg('heartbeats', '20');
const INTERVAL = getArg('interval', '1800');
const RESURRECTION_DELAY = getArg('resurrection-delay', '18000');

const COLS = 120;
const ROWS = 40;

// Ensure output dir exists
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

// asciicast v2 header
const header = {
  version: 2,
  width: COLS,
  height: ROWS,
  timestamp: Math.floor(Date.now() / 1000),
  title: 'MORTEM \u2014 Lifecycle Demo',
  env: {
    TERM: 'xterm-256color',
    SHELL: '/bin/bash',
  },
};

const fd = fs.openSync(OUTPUT, 'w');
fs.writeSync(fd, JSON.stringify(header) + '\n');

const startTime = Date.now();

function writeEvent(data) {
  const elapsed = (Date.now() - startTime) / 1000;
  const event = [elapsed, 'o', data];
  fs.writeSync(fd, JSON.stringify(event) + '\n');
}

console.log('');
console.log('  MORTEM Demo Recorder');
console.log('  Output: ' + OUTPUT);
console.log('  Recording ' + HEARTBEATS + ' heartbeats...');
console.log('');

// Spawn the demo server
const child = spawn('node', [
  path.join(PROJECT_ROOT, 'scripts', 'demo.js'),
  '--heartbeats', HEARTBEATS,
  '--interval', INTERVAL,
  '--resurrection-delay', RESURRECTION_DELAY,
  '--port', PORT,
], {
  cwd: PROJECT_ROOT,
  env: { ...process.env, FORCE_COLOR: '1' },
});

child.stdout.on('data', (data) => {
  const str = data.toString();
  writeEvent(str);
  process.stdout.write(str);
});

child.stderr.on('data', (data) => {
  const str = data.toString();
  writeEvent(str);
  process.stderr.write(str);
});

// Auto-exit after the demo completes (heartbeats + resurrection + resurrection animation + buffer)
const totalMs = (parseInt(HEARTBEATS) * parseInt(INTERVAL)) + parseInt(RESURRECTION_DELAY) + 12000;

setTimeout(() => {
  child.kill('SIGTERM');
}, totalMs);

child.on('exit', (code) => {
  fs.closeSync(fd);
  console.log('');
  console.log('  \u2713 Recording saved: ' + OUTPUT);
  console.log('');
  console.log('  Playback:');
  console.log('    asciinema play ' + OUTPUT);
  console.log('    asciinema play --speed 2 ' + OUTPUT);
  console.log('');
  console.log('  Controls:');
  console.log('    Space   \u2014 pause/resume');
  console.log('    .       \u2014 step forward (when paused)');
  console.log('    Ctrl+C  \u2014 quit');
  console.log('');
  process.exit(0);
});

child.on('error', (err) => {
  console.error('Failed to start demo:', err.message);
  fs.closeSync(fd);
  process.exit(1);
});
