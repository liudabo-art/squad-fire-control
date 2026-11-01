"""Install the release APK and exercise its native Android UI on the test emulator."""
from pathlib import Path
import json, re, subprocess, time, xml.etree.ElementTree as ET
ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
OUT = ROOT / 'build/verification'
ADB = ROOT / '.tools/platform-tools/platform-tools/adb.exe'
MAPS = ROOT / 'map-assets'
LOCAL_MAP_COUNT = len(list(MAPS.glob('*.webp'))) if MAPS.exists() else 0
if LOCAL_MAP_COUNT not in (0, 53): raise RuntimeError(f'Expected 0 or 53 local maps, got {LOCAL_MAP_COUNT}')
HAS_OFFLINE_MAPS = LOCAL_MAP_COUNT == 53
def adb(*args):
    return subprocess.check_output([str(ADB), '-s', 'emulator-5556', *args], encoding='utf-8', errors='replace')
def tree():
    adb('shell', 'uiautomator', 'dump', '/sdcard/sqd-ui.xml')
    return ET.fromstring(adb('shell', 'cat', '/sdcard/sqd-ui.xml'))
def find(label, root=None):
    for node in (root if root is not None else tree()).iter('node'):
        if label in (node.get('text', '') + node.get('content-desc', '')): return node
    raise AssertionError('UI not found: ' + label)
def center(node):
    x, y, r, b = map(int, re.findall(r'\d+', node.get('bounds')))
    return ((x+r)//2, (y+b)//2)
def tap(label):
    x, y = center(find(label)); adb('shell', 'input', 'tap', str(x), str(y)); time.sleep(.3)
def wait_ready():
    for _ in range(20):
        ui = tree()
        if any('炮位，拖动' in (n.get('content-desc', '') + n.get('text', '')) for n in ui.iter('node')): return ui
        time.sleep(1)
    raise AssertionError('Map interface did not initialize')
def screenshot(name):
    with (OUT / name).open('wb') as output:
        subprocess.run([str(ADB), '-s', 'emulator-5556', 'exec-out', 'screencap', '-p'], stdout=output, check=True)

print(adb('install', '-r', str(ROOT / f'release/android/SQD-Fire-Control-{VERSION}-Android.apk')).strip(), flush=True)
if HAS_OFFLINE_MAPS:
    adb('shell', 'svc', 'wifi', 'disable'); adb('shell', 'svc', 'data', 'disable')
else:
    adb('shell', 'svc', 'wifi', 'enable'); adb('shell', 'svc', 'data', 'enable')
adb('shell', 'am', 'force-stop', 'com.sqdfirecontrol.app')
adb('shell', 'am', 'start', '-W', '-n', 'com.sqdfirecontrol.app/.MainActivity')
wait_ready(); screenshot('android-native-map.png')
tap('重置当前计划'); tap('放置炮位')
stage = find('地图标记区域'); x, y, r, b = map(int, re.findall(r'\d+', stage.get('bounds')))
adb('shell', 'input', 'tap', str(int(x+(r-x)*.35)), str(int(y+(b-y)*.6)))
tap('添加目标')
for px, py in [(.45,.55),(.56,.65)]: adb('shell', 'input', 'tap', str(int(x+(r-x)*px)), str(int(y+(b-y)*py)))
ui = tree(); find('目标 B', ui)
adb('shell', 'input', 'swipe', str(x+60), str(y+60), str(x+120), str(y+100), '350')
assert not any('目标 C' in (n.get('content-desc', '') + n.get('text', '')) for n in tree().iter('node')), 'pan created an unwanted target'
find('目标 B'); find('方位'); find('mil'); screenshot('android-native-map-solutions.png')
tap('复制全部射击口令')
tap('导出当前火力计划')
ui = tree()
assert any(n.get('package') == 'com.android.documentsui' for n in ui.iter('node')), 'native save dialog not opened'
screenshot('android-native-save.png')
save = next((n for n in ui.iter('node') if n.get('resource-id') == 'com.android.documentsui:id/button1'), None)
if save is None: save = find('SAVE', ui)
sx, sy = center(save); adb('shell', 'input', 'tap', str(sx), str(sy)); time.sleep(1)
tap('导入火力计划')
ui = tree(); assert any(n.get('package') == 'com.android.documentsui' for n in ui.iter('node'))
adb('shell', 'input', 'keyevent', '4'); time.sleep(.5)
adb('shell', 'am', 'force-stop', 'com.sqdfirecontrol.app')
adb('shell', 'am', 'start', '-W', '-n', 'com.sqdfirecontrol.app/.MainActivity')
ui=wait_ready(); find('目标 B',ui)
(OUT/'android-result.json').write_text(json.dumps({'passed':True,'device':'Android 15 / API 35 x86_64 emulator','releaseApkInstalled':True,'offlineLaunch':HAS_OFFLINE_MAPS,'localMapCount':LOCAL_MAP_COUNT,'twoTargetPlacement':True,'inlineSolutionsVisibleAfterPlacement':True,'panDoesNotAddTargets':True,'nativeSaveDialog':True,'nativeImportDialog':True,'persistenceAfterRestart':True,'physicalPhoneTested':False},indent=2),encoding='utf-8')
print('PASS Android release installation, offline launch, placement, pan, native file dialogs and persistence',flush=True)
