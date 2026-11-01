"""Build a signed universal release APK using Google's SDK tools (no Gradle)."""
from pathlib import Path
import os, subprocess, zipfile, json, secrets

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
TOOLS = ROOT / '.tools'
BUILD = ROOT / 'build' / 'android'
RELEASE = ROOT / 'release' / 'android'

def find(root, name):
    results = list(root.rglob(name))
    if len(results) != 1: raise RuntimeError(f'Expected one {name} under {root}, found {len(results)}. Run scripts/bootstrap_android.py first.')
    return results[0]

def run(*args, **kwargs):
    subprocess.run([str(arg) for arg in args], check=True, cwd=ROOT, **kwargs)

def build():
    BUILD.mkdir(parents=True, exist_ok=True)
    RELEASE.mkdir(parents=True, exist_ok=True)
    java = find(TOOLS / 'jdk', 'java.exe')
    javac = java.parent / 'javac.exe'
    keytool = java.parent / 'keytool.exe'
    android = find(TOOLS / 'platform', 'android.jar')
    aapt = find(TOOLS / 'build-tools', 'aapt2.exe')
    align = aapt.parent / 'zipalign.exe'
    d8 = aapt.parent / 'lib' / 'd8.jar'
    signer = aapt.parent / 'lib' / 'apksigner.jar'
    classes = BUILD / 'classes'
    dex = BUILD / 'dex'
    classes.mkdir(exist_ok=True); dex.mkdir(exist_ok=True)
    compiled = BUILD / 'resources.zip'
    unsigned = BUILD / 'unsigned.apk'
    aligned = BUILD / 'aligned.apk'
    apk = RELEASE / f'SQD-Fire-Control-{VERSION}-Android.apk'
    run(aapt, 'compile', '--dir', ROOT / 'android' / 'res', '-o', compiled)
    run(aapt, 'link', '-o', unsigned, '-I', android, '--manifest', ROOT / 'android' / 'AndroidManifest.xml', '--auto-add-overlay', compiled)
    sources = list((ROOT / 'android' / 'src').rglob('*.java'))
    run(javac, '-encoding', 'UTF-8', '-source', '8', '-target', '8', '-classpath', android, '-d', classes, *sources)
    run(java, '-cp', d8, 'com.android.tools.r8.D8', '--release', '--min-api', '26', '--lib', android, '--output', dex, *classes.rglob('*.class'))
    with zipfile.ZipFile(unsigned, 'a', compression=zipfile.ZIP_DEFLATED) as archive:
        for path in dex.glob('*.dex'): archive.write(path, path.name)
        for name in ['index.html', 'styles.css', 'app.js', 'mortar-calculator.js', 'platform.js', 'THIRD-PARTY-NOTICES.txt']:
            archive.write(ROOT / name, 'assets/web/' + name)
        for name in ['map-assets', 'vendor', 'licenses']:
            asset_dir = ROOT / name
            if not asset_dir.exists(): continue
            for path in asset_dir.rglob('*'):
                if path.is_file(): archive.write(path, 'assets/web/' + path.relative_to(ROOT).as_posix(), compress_type=zipfile.ZIP_STORED if path.suffix == '.webp' else zipfile.ZIP_DEFLATED)
    run(align, '-f', '-p', '4', unsigned, aligned)
    # Kept outside the release directory. Reuse this key for all future updates.
    secret_dir = Path(os.environ['USERPROFILE']) / '.sqd-fire-control' / 'signing'
    secret_dir.mkdir(parents=True, exist_ok=True)
    secret = secret_dir / 'release-key.json'
    keystore = secret_dir / 'release.jks'
    if not secret.exists():
        if keystore.exists(): raise RuntimeError('Keystore exists without credentials; refusing to overwrite')
        secret.write_text(json.dumps({'alias': 'sqdfirecontrol', 'password': secrets.token_urlsafe(32)}), encoding='utf-8')
    credentials = json.loads(secret.read_text(encoding='utf-8'))
    environment = dict(os.environ, SQD_SIGNING_PASSWORD=credentials['password'])
    if not keystore.exists():
        run(keytool, '-genkeypair', '-keystore', keystore, '-alias', credentials['alias'], '-storepass:env', 'SQD_SIGNING_PASSWORD', '-keypass:env', 'SQD_SIGNING_PASSWORD', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=SQD Fire Control, OU=Community Game Tools', '-noprompt', env=environment)
    run(java, '-jar', signer, 'sign', '--ks', keystore, '--ks-key-alias', credentials['alias'], '--ks-pass', 'env:SQD_SIGNING_PASSWORD', '--key-pass', 'env:SQD_SIGNING_PASSWORD', '--out', apk, aligned, env=environment)
    run(java, '-jar', signer, 'verify', '--verbose', '--print-certs', apk)
    run(align, '-c', '4', apk)
    print(f'Release APK: {apk}', flush=True)
    print(f'Keep signing material private and back it up: {secret_dir}', flush=True)

if __name__ == '__main__': build()
