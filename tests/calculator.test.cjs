const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'mortar-calculator.js'), 'utf8'), context);
const calc = context.window.MortarCalc;
test('all 53 maps have unique metadata and positive independent dimensions', () => {
  assert.equal(calc.maps.length, 53);
  assert.equal(new Set(calc.maps.map(m => m.id)).size, 53);
  for (const map of calc.maps) {
    assert.ok(map.widthKm > 0 && map.heightKm > 0);
    assert.equal(map.gridSizeMeters, 300);
    assert.ok(map.basemapUrl.startsWith('https://'));
  }
});
test('local map assets are either omitted or complete', () => {
  const mapDir = path.join(root, 'map-assets');
  const files = fs.existsSync(mapDir) ? fs.readdirSync(mapDir).filter(file => file.endsWith('.webp')) : [];
  assert.ok(files.length === 0 || files.length === 53, `Expected 0 or 53 local maps, got ${files.length}`);
  if (files.length === 0) return;
  for (const map of calc.maps) {
    const file = fs.readFileSync(path.join(root, map.localBasemapUrl));
    assert.equal(file.toString('ascii', 0, 4), 'RIFF');
    assert.equal(file.toString('ascii', 8, 12), 'WEBP');
  }
});
test('non-square maps preserve independent X/Y distances and compass directions', () => {
  const options = { weaponId: 'mortar-table-squ', mapWidthKm: 4, mapHeightKm: 2 };
  const gun = { x: .5, y: .5 };
  for (const [target, distance, bearing] of [
    [{ x: .75, y: .5 }, 1000, 90], [{ x: .5, y: .25 }, 500, 0],
    [{ x: .25, y: .5 }, 1000, 270], [{ x: .5, y: .75 }, 500, 180]
  ]) {
    const solution = calc.computeSolution(gun, target, options);
    assert.equal(solution.rangeMeters, distance);
    assert.equal(solution.bearingDeg, bearing);
  }
});
test('SQU table knots, interpolation, and out-of-range boundary', () => {
  const solve = meters => calc.computeSolution({ x: 0, y: .5 }, { x: meters / 4000, y: .5 }, { mapId: 'al-basrah', weaponId: 'mortar-table-squ' });
  assert.equal(solve(500).elevationMils, 1387);
  assert.equal(solve(525).elevationMils, 1376);
  assert.equal(solve(1250).reachable, true);
  assert.equal(solve(1251).reachable, false);
});
test('all 28 ammunition choices have finite range and correctly ordered damage boundaries', () => {
  assert.equal(calc.weapons.length, 28);
  for (const weapon of calc.weapons) {
    assert.ok(Number.isFinite(weapon.maxRange) && weapon.maxRange > weapon.minRange, weapon.id);
    const radius = calc.getDamageRadii(weapon.id);
    assert.ok(Number.isFinite(radius.hundredDamageRadius) && radius.hundredDamageRadius >= 0, weapon.id);
    assert.ok(radius.twentyFiveDamageRadius >= radius.hundredDamageRadius, weapon.id);
  }
});
