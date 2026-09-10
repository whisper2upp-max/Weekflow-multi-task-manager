'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');

test('every shipped CSS/JS URL identifies its current content to bypass older cached resources', () => {
  const html = fs.readFileSync(path.join(root, 'Weekflow.html'), 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="(\.\/(?:css|js|vendor)\/[^"]+)"/g)];
  assert.ok(assets.length > 0);
  for (const [, value] of assets) {
    const url = new URL(value, 'http://localhost/');
    const expected = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, url.pathname))).digest('hex').slice(0, 12);
    assert.equal(url.searchParams.get('v'), expected, `${url.pathname} changed: run npm run assets:version before publishing`);
  }
});
