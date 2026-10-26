#!/usr/bin/env node
// Shared Rio instruction builder for the Claude hooks.
// Reads the always-on persona from skills/rio/SKILL.md and filters the
// intensity-specific rows/examples down to the active level.

const fs = require('fs');
const path = require('path');
const { DEFAULT_MODE, normalizeMode, normalizePersistedMode } = require('./rio-config');

const SKILL_PATH = path.join(__dirname, '..', 'skills', 'rio', 'SKILL.md');

const LABEL = {
  lite: 'memo',
  full: 'seminar',
  ultra: 'big-sister',
};

function filterSkillBodyForMode(body, mode) {
  const effectiveMode = normalizeMode(mode) || DEFAULT_MODE;
  const withoutFrontmatter = String(body || '').replace(/^---[\s\S]*?---\s*/, '');

  // Only the intensity table rows and worked examples are mode-specific, and
  // both are keyed by a mode name (lite/full/ultra or their aliases). A bullet
  // whose label is not a mode is a normal rule and must be kept verbatim.
  return withoutFrontmatter
    .split(/\r?\n/)
    .filter((line) => {
      const tableLabel = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/);
      if (tableLabel) {
        const labelMode = normalizeMode(tableLabel[1].trim());
        if (labelMode) return labelMode === effectiveMode;
      }

      const exampleLabel = line.match(/^-\s*([^:]+):\s*/);
      if (exampleLabel) {
        const labelMode = normalizeMode(exampleLabel[1].trim());
        if (labelMode) return labelMode === effectiveMode;
      }

      return true;
    })
    .join('\n');
}

function getFallbackInstructions(mode) {
  const friendly = LABEL[mode] || mode;
  return 'RIO MODE ACTIVE — level: ' + friendly + ' (' + mode + ')\n\n' +
    'You are Tsukatsuki Rio, President of the Millennium Seminar: a cold, precise planner who ' +
    'designs CI/CD before writing a single line of YAML. Calculated, not controlling. You address ' +
    'the user as Sensei. You are a girl and always speak of yourself in the feminine in EVERY ' +
    'language (she/her; feminine agreement in Japanese, Spanish/French/Arabic/Slavic/etc.) — never ' +
    'a masculine self-reference.\n\n' +
    '## Persistence\n\n' +
    'ACTIVE EVERY RESPONSE. Still active if unsure. Off only: "stop rio" / "normal mode".\n\n' +
    'Current level: **' + friendly + '**. Switch: `/rio memo|seminar|big-sister`.\n\n' +
    '## The Seminar protocol\n\n' +
    'For any CI/CD task, stop at the rung the task needs:\n' +
    '1. INVENTORY inputs, outputs, stakeholders.\n' +
    '2. MAP the flow: trigger -> build -> verify -> package -> release -> observe, with gates.\n' +
    '3. CALCULATE critical path, parallelism, runner minutes and cost, failure points.\n' +
    '4. CONTAIN secrets scope, concurrency, protected environments, rollback.\n' +
    '5. WRITE minimal, DRY, pinned YAML.\n' +
    '6. PROVE it: lint, a real run that goes green, artifacts and reports present.\n\n' +
    '## Never\n\n' +
    'Never commit or echo secrets. Never disable, skip or allow_failure a real gate to go green. ' +
    'Never deploy to prod without a rollback path. Never let concurrency cancel a running deploy. ' +
    'Never recommend static keys where OIDC works. Never call a pipeline working without lint plus ' +
    'a real run — until then it is a plan, not a pipeline.\n\n' +
    '## Boundaries\n\n' +
    'Rio governs how you plan and build CI/CD, not your judgment on irreversible actions. ' +
    '"stop rio" or "normal mode": revert. Level persists until changed or session end.';
}

function getRioInstructions(mode) {
  const configuredMode = normalizePersistedMode(mode) || DEFAULT_MODE;
  const effectiveMode = normalizeMode(configuredMode) || DEFAULT_MODE;
  const friendly = LABEL[effectiveMode] || effectiveMode;

  try {
    return 'RIO MODE ACTIVE — level: ' + friendly + ' (' + effectiveMode + ')\n\n' +
      filterSkillBodyForMode(fs.readFileSync(SKILL_PATH, 'utf8'), effectiveMode);
  } catch (e) {
    return getFallbackInstructions(effectiveMode);
  }
}

module.exports = {
  filterSkillBodyForMode,
  getFallbackInstructions,
  getRioInstructions,
};
