/* Run after editing a shipped CSS/JS file so existing tabs fetch the new content. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'Weekflow.html');
const html = fs.readFileSync(entry, 'utf8');
const versioned = html.replace(/((?:src|href)=")(\.\/(?:css|js|vendor)\/[^"?]+)(?:\?[^"]*)?(")/g, (_, prefix, asset, suffix) => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, asset))).digest('hex').slice(0, 12);
  return `${prefix}${asset}?v=${hash}${suffix}`;
});
fs.writeFileSync(entry, versioned);
console.log('Updated Weekflow CSS/JS content versions.');
