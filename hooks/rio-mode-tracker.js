#!/usr/bin/env node
// rio — UserPromptSubmit hook to track which Rio mode is active.
// Inspects user input for /rio commands and writes the mode to the flag file.
// Accepts both engine names (lite/full/ultra/off) and the Rio aliases
// (memo/seminar/big-sister).

const { getDefaultMode, normalizeMode } = require('./rio-config');
const { clearMode, setMode, writeHookOutput } = require('./rio-runtime');

const LABEL = { lite: 'memo', full: 'seminar', ultra: 'big-sister' };

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    // Strip UTF-8 BOM some shells prepend when piping (breaks JSON.parse)
    const data = JSON.parse(input.replace(/^﻿/, ''));
    const prompt = (data.prompt || '').trim().toLowerCase();

    // Match /rio commands (also @rio / $rio for Codex-style hosts). Only the
    // bare /rio command switches level; /rio-plan, /rio-yml etc. leave it alone.
    if (/^[/@$]rio\b/.test(prompt)) {
      const parts = prompt.split(/\s+/);
      const cmd = parts[0].replace(/^[@$]/, '/');
      const arg = parts[1] || '';

      let mode = null;

      if (cmd === '/rio' || cmd === '/rio:rio') {
        if (arg === 'off') mode = 'off';
        else mode = normalizeMode(arg) || getDefaultMode();
      }

      if (mode && mode !== 'off') {
        setMode(mode);
        writeHookOutput(
          'UserPromptSubmit',
          mode,
          'RIO MODE CHANGED — level: ' + (LABEL[mode] || mode),
        );
      } else if (mode === 'off') {
        clearMode();
        writeHookOutput('UserPromptSubmit', 'off', 'RIO MODE OFF');
      }
    }

    // Detect deactivation
    if (/\b(stop rio|normal mode)\b/i.test(prompt)) {
      clearMode();
      writeHookOutput('UserPromptSubmit', 'off', 'RIO MODE OFF');
    }
  } catch (e) {
    // Silent fail
  }
});
