const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require(process.env.PUPPETEER_MODULE || path.join(process.env.APPDATA, 'npm/node_modules/puppeteer'));
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build/verification');
fs.mkdirSync(output, { recursive: true });
const mapDir = path.join(root, 'map-assets');
const localMapCount = fs.existsSync(mapDir) ? fs.readdirSync(mapDir).filter(file => file.endsWith('.webp')).length : 0;
assert.ok(localMapCount === 0 || localMapCount === 53, `Expected 0 or 53 local maps, got ${localMapCount}`);
const hasOfflineMaps = localMapCount === 53;
const executable = process.env.SQD_TEST_EXE || path.join(root, 'release/windows/win-unpacked/SQD Fire Control.exe');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  let browser;
  const child = spawn(executable, ['--smoke-test', '--remote-debugging-port=9333', '--user-data-dir=' + path.join(output, 'electron-profile')], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let diagnostic = '';
  child.stderr.on('data', data => { diagnostic += data.toString(); });
  try {
    for (let i = 0; i < 60; i++) {
      try { browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333' }); break; }
      catch { await pause(500); }
    }
    assert.ok(browser, diagnostic);
    let pages;
    for (let i = 0; i < 30; i++) {
      pages = await browser.pages();
      if (pages.some(page => page.url().includes('index.html'))) break;
      await pause(250);
    }
    const page = pages.find(page => page.url().includes('index.html'));
    assert.ok(page, 'packaged window loads local index');
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setOfflineMode(hasOfflineMaps);
    await page.reload();
    if (hasOfflineMaps) await page.waitForFunction(() => document.querySelector('#mapRaster').naturalWidth > 0);
    const bridge = await page.evaluate(() => ({ save: typeof DesktopApp.savePlan, copy: typeof DesktopApp.copyText, node: typeof require }));
    assert.deepEqual(bridge, { save: 'function', copy: 'function', node: 'undefined' });
    const mapCount = await page.evaluate(() => MortarCalc.maps.length);
    assert.equal(mapCount, 53);
    for (const id of ['corvette', 'morak-legacy', 'skorpo', 'al-basrah']) {
      await page.select('#mapSelect', id);
      await page.waitForFunction(id => document.querySelector('#mapSelect').value === id, {}, id);
      if (hasOfflineMaps) await page.waitForFunction(id => document.querySelector('#mapRaster').src.includes(id + '.webp') && document.querySelector('#mapRaster').complete && document.querySelector('#mapRaster').naturalWidth > 0, {}, id);
    }
    const result = await page.evaluate(async () => {
      await DesktopApp.copyText('SQD native clipboard verification');
      try { await DesktopApp.copyText('a'.repeat(100001)); return false; } catch { return true; }
    });
    assert.ok(result, 'native clipboard bridge succeeds and rejects oversized data');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'windows-result.json'), JSON.stringify({ passed: true, executable, mapDefinitions: mapCount, localMaps: localMapCount, bridge, errors }, null, 2));
    console.log('PASS packaged Windows launch, offline map decoding, preload isolation and native clipboard');
  } finally {
    if (browser) { try { await browser.close(); } catch {} }
    if (child.exitCode == null) child.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
