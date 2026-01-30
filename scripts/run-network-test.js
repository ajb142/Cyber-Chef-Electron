#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Determine electron binary path
const electronBin = path.join(__dirname, '..', 'node_modules', '.bin', 'electron');
const testScript = path.join(__dirname, 'test-network-isolation.js');

// Build electron arguments
const args = [];

// In CI environments, disable sandbox to avoid SUID sandbox configuration issues
if (process.env.CI) {
  args.push('--no-sandbox');
}

args.push(testScript);

// Spawn electron with appropriate flags
const electron = spawn(electronBin, args, {
  stdio: 'inherit',
  env: process.env
});

electron.on('close', (code) => {
  process.exit(code);
});

electron.on('error', (err) => {
  console.error('Failed to start electron:', err);
  process.exit(1);
});
