const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const root = path.resolve(__dirname, '..');
const archive = path.join(root, 'release/windows/win-unpacked/resources/app.asar');
const files = ['index.html', 'app.js', 'styles.css', 'mortar-calculator.js', 'platform.js', 'THIRD-PARTY-NOTICES.txt', 'desktop/main.cjs', 'desktop/preload.cjs'];
for (const directory of ['map-assets', 'vendor', 'licenses']) {
  const assetDir = path.join(root, directory);
  if (fs.existsSync(assetDir)) for (const file of fs.readdirSync(assetDir)) files.push(directory + '/' + file);
}
for (const file of files) assert.ok(asar.extractFile(archive, file).equals(fs.readFileSync(path.join(root, file))), 'Stale ASAR asset: ' + file);
const listing = asar.listPackage(archive);
const mapDir = path.join(root, 'map-assets');
const expectedMaps = fs.existsSync(mapDir) ? fs.readdirSync(mapDir).filter(file => file.endsWith('.webp')).length : 0;
assert.ok(expectedMaps === 0 || expectedMaps === 53, `Expected 0 or 53 local maps, got ${expectedMaps}`);
assert.equal(listing.filter(file => /[/\\]map-assets[/\\].*\.webp$/.test(file)).length, expectedMaps);
assert.ok(!listing.some(file => /\.jks$|release-key\.json$|[/\\]\.tools[/\\]/.test(file)), 'no signing secrets/toolchain');
console.log(`PASS Windows ASAR contains exact current assets, ${expectedMaps} local maps, no signing secrets`);
