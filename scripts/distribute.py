"""Verify exact packaged assets, then collect only shareable release files."""
from pathlib import Path
import hashlib, json, shutil, subprocess, zipfile
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'release/distribute'
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
SHARED = ['index.html', 'app.js', 'styles.css', 'mortar-calculator.js', 'platform.js', 'THIRD-PARTY-NOTICES.txt']
SHARED += [p.relative_to(ROOT).as_posix() for folder in ['map-assets', 'vendor', 'licenses'] for p in (ROOT / folder).rglob('*') if p.is_file()]
def digest(file):
    with file.open('rb') as stream: return hashlib.file_digest(stream, 'sha256').hexdigest()
apk = ROOT / f'release/android/SQD-Fire-Control-{VERSION}-Android.apk'
with zipfile.ZipFile(apk) as archive:
    for name in SHARED:
        assert archive.read('assets/web/' + name) == (ROOT / name).read_bytes(), f'Stale APK asset: {name}'
    assert len([n for n in archive.namelist() if n.startswith('assets/web/map-assets/') and n.endswith('.webp')]) == 53
subprocess.run(['node', str(ROOT / 'scripts/verify_asar.cjs')], cwd=ROOT, check=True)
DEST.mkdir(parents=True, exist_ok=True)
files = [apk] + [ROOT / f'release/windows/SQD-Fire-Control-{VERSION}-Windows-x64-{kind}.exe' for kind in ['Setup', 'Portable']]
for file in files:
    assert file.stat().st_size > 100_000_000, f'Incomplete package: {file}'
    shutil.copy2(file, DEST / file.name)
shutil.copy2(ROOT / 'THIRD-PARTY-NOTICES.txt', DEST / 'THIRD-PARTY-NOTICES.txt')
shutil.copytree(ROOT / 'licenses', DEST / 'licenses', dirs_exist_ok=True)
readme = f'''SQD 火力计算器 {VERSION} — 安装与分享说明

Android 手机：打开 Android.apk 安装。如果系统询问，允许当前文件管理器/浏览器“安装未知应用”。需要 Android 8.0+ 和较新的 Android System WebView。
Windows 10/11 x64：推荐运行 Windows-x64-Setup.exe，安装器会创建开始菜单与桌面快捷方式。无需安装环境。
Windows 免安装：Windows-x64-Portable.exe 双击即可运行，首次解包需等待数秒。两个 Windows 文件任选一个。

包含 53 张离线地图底图（25 原版、28 模组）与 28 种武器/弹药选项；300 米网格、方位角/密位、多目标、射程圈、伤害边界圈。
手机：单指拖动地图，双指缩放；点击放置标记，拖动标记修正位置。距离、方位角/密位、射程状态和高程修正在地图页下方即时显示；“设置”切换武器。最多 26 个目标。
电脑：鼠标滚轮缩放，Shift+拖动平移。右侧目标列表可独立滚动。
地图上可见落点为 5×5 屏幕逻辑像素；伤害圈随地图比例缩放。

普通底图、图标和计算可离线使用。地形/高程图及自定义网络图片需要联网。地图圈与弹道使用现有社区数据，不自动采样地形；游戏更新后的数据差异需后续校准。
计划自动保存于本设备。需要迁移或跨设备使用时，先导出 JSON，再在另一设备导入。卸载 Android 应用会移除其本地数据，请先导出重要计划。

Windows 版本没有商业代码签名证书，系统可能显示未知发布者。核对文件来源和 SHA256SUMS.txt 后再决定是否运行。
免费、非商业使用；分享时保留作者、来源和许可证。地图素材权利归 Offworld Industries 与相应模组作者。详见 THIRD-PARTY-NOTICES.txt 与 licenses/。
这些安装包可从 GitHub Releases 下载：Android 用户选择 Android APK；Windows 用户选择 x64 安装版或免安装版。分享安装包时同时提供 SHA256SUMS.txt、THIRD-PARTY-NOTICES.txt 和 licenses/。切勿分享 Android 签名私钥或凭据。
'''
(DEST / '安装说明.txt').write_text(readme, encoding='utf-8-sig')
checksums = [f'{digest(p)}  {p.relative_to(DEST).as_posix()}' for p in sorted(DEST.rglob('*')) if p.is_file() and p.name != 'SHA256SUMS.txt']
(DEST / 'SHA256SUMS.txt').write_text('\n'.join(checksums) + '\n', encoding='utf-8')
print('Verified all shared assets and 53 maps in each package.')
for file in files: print(f'{file.name}: {file.stat().st_size / 1024**2:.1f} MiB')
print(DEST)
