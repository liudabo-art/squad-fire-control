$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$avdRoot = Join-Path $projectRoot 'build\avd'
$avdDirectory = Join-Path $avdRoot 'sqd-api35.avd'
$imageDirectory = Join-Path $projectRoot '.tools\system-image\x86_64'
New-Item -ItemType Directory -Path $avdDirectory -Force | Out-Null
@"
avd.ini.encoding=UTF-8
path=$avdDirectory
target=android-35
"@ | Set-Content -LiteralPath (Join-Path $avdRoot 'sqd-api35.ini') -Encoding utf8
@"
AvdId=sqd-api35
avd.ini.displayname=SQD API 35 Test
abi.type=x86_64
hw.cpu.arch=x86_64
hw.cpu.ncore=4
hw.ramSize=2048
hw.lcd.width=1080
hw.lcd.height=2160
hw.lcd.density=420
hw.gpu.enabled=yes
hw.gpu.mode=swiftshader_indirect
hw.keyboard=yes
hw.mainKeys=no
disk.dataPartition.size=3G
image.sysdir.1=$imageDirectory\
tag.id=default
tag.display=Default Android System Image
PlayStore.enabled=false
"@ | Set-Content -LiteralPath (Join-Path $avdDirectory 'config.ini') -Encoding utf8
& python (Join-Path $PSScriptRoot 'run_android_emulator.py')
