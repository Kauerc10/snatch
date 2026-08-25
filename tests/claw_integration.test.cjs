const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('browser bundle loads deterministic claw before the app', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const clawIndex = html.indexOf('./src/claw.js');
  const appIndex = html.indexOf('./app.js');
  assert.ok(clawIndex >= 0 && appIndex > clawIndex);
});

test('runtime uses a physical claw state machine and settles loot before scoring', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /SnatchClaw/);
  assert.match(app, /outbound/);
  assert.match(app, /returning/);
  assert.match(app, /settleClaw/);
  assert.match(app, /applySuccessfulGrab/);
  assert.ok(app.indexOf('settleClaw') < app.lastIndexOf('applySuccessfulGrab'));
});

test('One More is resolved by the physical claw and not a random roll', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const oneMoreSection = app.slice(app.indexOf('function beginOneMore'), app.indexOf('function showResult'));
  assert.match(oneMoreSection, /one-more-attempt/);
  assert.doesNotMatch(oneMoreSection, /Math\.random/);
});

test('One More still accepts aiming after the 60s round timer expired', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const startAim = app.slice(app.indexOf('function startAim'), app.indexOf('function releaseAim'));
  assert.doesNotMatch(startAim, /game\.finished \|\| game\.timerExpired\) return/);
  assert.match(startAim, /game\.timerExpired && game\.state\.phase !== 'one-more-attempt'/);
});
