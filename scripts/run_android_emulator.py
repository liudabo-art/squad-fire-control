"""Run the test AVD headlessly with bundled runtime DLL directories."""
from pathlib import Path
import os, subprocess
root = Path(__file__).resolve().parents[1]
base = root / '.tools/emulator/emulator'
environment = dict(os.environ)
environment['ANDROID_AVD_HOME'] = str(root / 'build/avd')
environment['ANDROID_SDK_ROOT'] = str(root / '.tools')
environment['PATH'] = ';'.join(str(p) for p in {f.parent for f in base.rglob('*.dll')}) + ';' + environment['PATH']
subprocess.run([str(base / 'qemu/windows-x86_64/qemu-system-x86_64-headless.exe'), '-avd', 'sqd-api35', '-sysdir', str(root / '.tools/system-image/x86_64'), '-no-window', '-no-audio', '-no-snapshot', '-no-boot-anim', '-gpu', 'swiftshader', '-port', '5556'], env=environment, check=True)
