"""Fetch checksum-pinned Windows packaging tools, with resumable downloads."""
from pathlib import Path
import concurrent.futures, hashlib, tarfile, time, urllib.request, urllib.error, zipfile

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / '.tools'
BASE = 'https://github.com/electron-userland/electron-builder-binaries/releases/download/'
PACKAGES = [
    ('electron', 'https://github.com/electron/electron/releases/download/v45.2.1/electron-v45.2.1-win32-x64.zip', '7c342aee45d5b4ccafe5dfe9037028796b082735a576e21e2b4e2d8422ebb727'),
    ('7zip', BASE + '7zip@1.0.0/7zip-win-x64.tar.gz', 'be071f15bd6da2f78fe81c6ddef2009b0c4d8a51f36b780cb806c7e6df95e1b3'),
    ('nsis', BASE + 'nsis@1.2.1/nsis-bundle-3.12.tar.gz', '56997fdefe25e7928a1a68b4583d08b240b66cf660234053b20131a74cc082f4'),
    ('rcedit', BASE + 'win-codesign@1.1.0/rcedit-windows-2_0_0.zip', 'c66591ebe0919c60231f0bf79ff223e6504bfa69bc13edc1fa8bfc6177b73402'),
]

def digest(path, algorithm):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, algorithm).hexdigest()

def download(url, archive, algorithm, checksum):
    for attempt in range(8):
        if archive.exists() and digest(archive, algorithm) == checksum: return
        offset = archive.stat().st_size if archive.exists() else 0
        request = urllib.request.Request(url, headers={'Range': f'bytes={offset}-'} if offset else {})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                append = response.status == 206 and offset > 0
                with archive.open('ab' if append else 'wb') as output:
                    while chunk := response.read(1024 * 1024): output.write(chunk)
            if digest(archive, algorithm) == checksum: return
            print(f'{archive.name}: incomplete download; retrying', flush=True)
        except Exception as error:
            print(f'{archive.name}: attempt {attempt + 1}: {type(error).__name__}', flush=True)
            if isinstance(error, urllib.error.HTTPError) and error.code == 416:
                archive.unlink(missing_ok=True)
        time.sleep(2)
    raise RuntimeError(f'Could not obtain verified download: {archive.name}')

def install(package):
    name, url, checksum = package
    folder = TOOLS / name
    marker = folder / '.verified'
    if marker.exists() and marker.read_text() == checksum:
        print(f'{name}: ready', flush=True); return
    archive = TOOLS / (name + ('.zip' if url.endswith('.zip') else '.tar.gz'))
    print(f'{name}: downloading', flush=True)
    download(url, archive, 'sha256', checksum)
    folder.mkdir(exist_ok=True)
    if url.endswith('.zip'):
        with zipfile.ZipFile(archive) as source: source.extractall(folder)
    else:
        with tarfile.open(archive) as source: source.extractall(folder, filter='data')
    marker.write_text(checksum)
    print(f'{name}: verified and extracted', flush=True)

if __name__ == '__main__':
    TOOLS.mkdir(exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        list(executor.map(install, PACKAGES))
