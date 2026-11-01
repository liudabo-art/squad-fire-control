"""Download checksum-pinned build tools into this project's ignored .tools directory."""
import concurrent.futures
import hashlib
import pathlib
import urllib.request
import zipfile
import sys
from bootstrap_windows import download

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOLS = ROOT / '.tools'
PACKAGES = [
    ('jdk', 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_x64_windows_hotspot_17.0.20.1_1.zip', 'sha256', 'e53a79c3c3d86865bd7e787903884331068e71321714ffd44f145785affc7cb0'),
    ('platform', 'https://dl.google.com/android/repository/platform-35_r02.zip', 'sha1', '0bb560a90a7a2cbd0dd8348224d518b638fe7949'),
    ('build-tools', 'https://dl.google.com/android/repository/build-tools_r35_windows.zip', 'sha1', 'af059bb67cf7786f45ee0db85e2d24985df1b4b6'),
    ('platform-tools', 'https://dl.google.com/android/repository/platform-tools_r37.0.1-win.zip', 'sha1', 'e03e78b1d80b396f1c3358e31251cb31740e1110'),
]

def install(package):
    name, url, algorithm, checksum = package
    folder = TOOLS / name
    marker = folder / '.verified'
    if marker.exists() and marker.read_text() == checksum:
        print(f'{name}: ready', flush=True)
        return
    archive = TOOLS / (name + '.zip')
    if not archive.exists() or hashlib.file_digest(archive.open('rb'), algorithm).hexdigest() != checksum:
        print(f'{name}: downloading', flush=True)
        download(url, archive, algorithm, checksum)
    with archive.open('rb') as stream:
        actual = hashlib.file_digest(stream, algorithm).hexdigest()
    if actual != checksum:
        raise RuntimeError(f'{name}: checksum mismatch')
    folder.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive) as source:
        source.extractall(folder)
    marker.write_text(checksum)
    print(f'{name}: verified and extracted', flush=True)

if __name__ == '__main__':
    if '--emulator' in sys.argv:
        PACKAGES.extend([
            ('emulator', 'https://dl.google.com/android/repository/emulator-windows_x64-16740729.zip', 'sha1', '4d7268aa7787c640ad892844e6c9a5f159e91ad3'),
            ('system-image', 'https://dl.google.com/android/repository/sys-img/android/x86_64-35_r02.zip', 'sha1', '2d857d170c0d1b827149565da34b3383e5306f7f'),
        ])
    TOOLS.mkdir(exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        list(executor.map(install, PACKAGES))
