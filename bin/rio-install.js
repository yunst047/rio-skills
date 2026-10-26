#!/usr/bin/env node
// rio-install — wire the Rio skill into any repo without the Claude Code
// marketplace/CLI. Installs at the project level via the target's `.claude/`:
//   - copies skills/ and commands/ so /rio* are discoverable
//   - merges SessionStart + UserPromptSubmit hooks into .claude/settings.json,
//     pointing at THIS package's hook scripts by absolute path
//
// Usage:
//   node bin/rio-install.js <targetRepoDir>     # install
//   node bin/rio-install.js <targetRepoDir> -u  # uninstall
//
// Idempotent: re-running replaces the rio hook entries rather than stacking
// them, and never clobbers unrelated settings.json keys.

const fs = require('fs');
const path = require('path');

const pluginRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const uninstall = args.includes('-u') || args.includes('--uninstall');
const target = path.resolve(args.find((a) => !a.startsWith('-')) || process.cwd());

function die(msg) { console.error('rio-install: ' + msg); process.exit(1); }
if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) die('target is not a directory: ' + target);

const claudeDir = path.join(target, '.claude');
const settingsPath = path.join(claudeDir, 'settings.json');

// Hook command for a given script: bash form + native Windows form. CLAUDE_PLUGIN_ROOT
// is not set in project context, so the absolute path is baked in.
function hookCmds(script) {
  const abs = path.join(pluginRoot, 'hooks', script);
  return {
    command: `node "${abs.replace(/\\/g, '/')}"`,
    commandWindows: `node "${abs}"`,
    timeout: 5,
  };
}

// Our own script names, so we find/replace only our entries on re-install /
// uninstall. (A bare 'rio-' substring would also match e.g. 'scenario-test.js'.)
const MARKS = ['rio-activate.js', 'rio-mode-tracker.js'];
const isOurs = (h) => MARKS.some((m) => JSON.stringify(h).includes(m));

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
  catch (e) { return {}; }
}

function stripOurHooks(settings) {
  const hooks = settings.hooks || {};
  for (const event of Object.keys(hooks)) {
    hooks[event] = (hooks[event] || []).filter((entry) => !isOurs(entry));
    if (hooks[event].length === 0) delete hooks[event];
  }
  if (Object.keys(hooks).length === 0) delete settings.hooks;
  else settings.hooks = hooks;
  return settings;
}

// Only touch our own entries (skills/rio*, commands/rio*.md) so the target
// repo's other skills and commands survive install and uninstall.
function ourEntries(name) {
  return fs.readdirSync(path.join(pluginRoot, name)).filter((e) => /^rio(-|\.|$)/.test(e));
}

function copyDir(name) {
  for (const entry of ourEntries(name)) {
    const dest = path.join(claudeDir, name, entry);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(path.join(pluginRoot, name, entry), dest, { recursive: true });
  }
}

function rmDir(name) {
  for (const entry of ourEntries(name)) {
    fs.rmSync(path.join(claudeDir, name, entry), { recursive: true, force: true });
  }
  try { fs.rmdirSync(path.join(claudeDir, name)); } catch (e) {} // only if now empty
}

if (uninstall) {
  rmDir('skills');
  rmDir('commands');
  if (fs.existsSync(settingsPath)) {
    const settings = stripOurHooks(readSettings());
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }
  console.log('Rio uninstalled from ' + target);
  console.log('(removed .claude/skills/rio*, .claude/commands/rio*, and rio hooks from settings.json)');
  process.exit(0);
}

// --- install ---
fs.mkdirSync(claudeDir, { recursive: true });
copyDir('skills');
copyDir('commands');

const settings = stripOurHooks(readSettings());
settings.hooks = settings.hooks || {};
(settings.hooks.SessionStart = settings.hooks.SessionStart || []).push({
  matcher: 'startup|resume|clear|compact',
  hooks: [{ type: 'command', statusMessage: 'Seminar President online... loading Rio mode...', ...hookCmds('rio-activate.js') }],
});
(settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit || []).push({
  hooks: [{ type: 'command', statusMessage: 'Tracking Rio mode...', ...hookCmds('rio-mode-tracker.js') }],
});
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

console.log('Rio installed into ' + target + '. Everything is within calculation, Sensei.');
console.log('  plugin root : ' + pluginRoot);
console.log('  copied      : .claude/skills/rio*, .claude/commands/rio*');
console.log('  hooks       : .claude/settings.json (SessionStart + UserPromptSubmit)');
console.log('Open the repo in Claude Code and start a new session — the persona activates at seminar.');
console.log('Undo anytime: node "' + path.join(pluginRoot, 'bin', 'rio-install.js') + '" "' + target + '" -u');
