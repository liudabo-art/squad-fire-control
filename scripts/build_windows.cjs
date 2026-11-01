const fs = require('node:fs');
const path = require('node:path');
const { build, Platform, Arch } = require('electron-builder');
const root = path.resolve(__dirname, '..');
const tools = path.join(root, '.tools');
for (const name of ['electron', '7zip', 'nsis', 'rcedit']) {
  if (!fs.existsSync(path.join(tools, name, '.verified'))) throw new Error('Run python scripts/bootstrap_windows.py first');
}
process.env.ELECTRON_BUILDER_7ZIP_PATH = path.join(tools, '7zip/7zip/bin/7za.exe');
process.env.ELECTRON_BUILDER_NSIS_DIR = path.join(tools, 'nsis/nsis-bundle');
process.env.ELECTRON_BUILDER_NSIS_RESOURCES_DIR = path.join(tools, 'nsis/nsis-bundle');
process.env.ELECTRON_BUILDER_RCEDIT_PATH = path.join(tools, 'rcedit');
build({ projectDir: root, targets: Platform.WINDOWS.createTarget(['nsis', 'portable'], Arch.x64), config: { electronDist: path.join(tools, 'electron') } })
  .then(files => files.forEach(file => console.log(file)))
  .catch(error => { console.error(error); process.exitCode = 1; });
