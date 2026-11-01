# SQD / FIRE CONTROL

Squad 游戏间接火力计算器，提供 Android APK、Windows 安装版和免安装版，也可直接使用网页版本。

## 下载

- Android： [Android 8+ APK](https://github.com/liudabo-art/squad-fire-control/releases/latest/download/SQD-Fire-Control-1.0.0-Android.apk)
- Windows 10/11 x64： [安装版](https://github.com/liudabo-art/squad-fire-control/releases/latest/download/SQD-Fire-Control-1.0.0-Windows-x64-Setup.exe)；[免安装版](https://github.com/liudabo-art/squad-fire-control/releases/latest/download/SQD-Fire-Control-1.0.0-Windows-x64-Portable.exe)
- [安装说明、SHA-256 和第三方声明](https://github.com/liudabo-art/squad-fire-control/releases/latest)

本仓库公开应用源码和构建脚本，不提交 APK、EXE、构建缓存、签名密钥或游戏地图图像。没有本地地图图像时，地图底图通过 SquadCalc 在线加载，因此运行时需要网络。

## 本地分发包

本机生成的 1.0.0 打包文件位于 `release/distribute/`，不会随源码提交。Android 版要求 Android 8.0 或以上并保持 Android System WebView 更新；Windows 版面向 Windows 10/11 x64。安装后无需 Node.js、Python 或开发环境。离线版本包含 53 张地图底图、图标和 28 种武器/弹药选项；在线地形/高程图仍需网络。

手机使用“地图 / 设置”切换页面，单指拖动平移、双指缩放，点击放置炮位和目标。目标距离、方位角/密位、射程状态及高程修正在地图下方即时显示，支持多个目标和内部滚动。电脑和手机可通过导出/导入 JSON 文件交换计划，现有网页版本的标记不会自动迁移到独立应用。

Android 包使用持久发布密钥签名。Windows 包未购买商业代码签名证书，因此可能显示“未知发布者”提示。软件仅用于免费、非商业分享；上游来源、作者及完整许可见 `THIRD-PARTY-NOTICES.txt` 与 `licenses/`。

## 从源码构建

在 Windows 开发机安装 Node.js 与 Python，然后运行：

```powershell
npm ci
python scripts/bootstrap_windows.py
npm run build:windows
python scripts/bootstrap_android.py
npm run build:android
```

下载脚本会校验工具归档的固定哈希；工具位于忽略的 `.tools/`，不会打包给玩家。Android 使用 JDK 17、API 35 和 Build Tools 35；Windows 使用锁定的 Electron 与 electron-builder 版本。

Android 更新必须继续使用原签名：私钥与凭据在 `%USERPROFILE%\.sqd-fire-control\signing\`。请私下备份整个目录，绝不能放入分发包或公开仓库。后续更新时同时增加 Android `versionCode` 和应用版本号。

验证命令：`npm test`；`node scripts/verify_ui.cjs`（需要 Puppeteer 与 Edge）；`node scripts/verify_windows.cjs`。没有本地地图图像时，界面验证覆盖地图元数据和交互；完整离线地图验证需要本机提供全部 53 张有权使用的图像。验证报告及截图位于 `build/verification/`。`python scripts/distribute.py` 仅适用于本机已有 53 张地图、签名 APK 和 Windows 构建产物的情况。

Android 原生验证：`python scripts/bootstrap_android.py --emulator` 获取测试工具，运行 `scripts/start_android_test.ps1` 启动无窗口模拟器，待启动后执行 `python scripts/verify_android.py`。此次发布已在 Android 15 / API 35 模拟器验证安装、断网启动、标记、平移、保存/导入文件选择器和重启保留计划；尚未进行实体手机兼容性测试。Windows 最终 Portable EXE 已实测启动、离线底图和原生剪贴板。

## 启动

在此目录运行：

```powershell
python -m http.server 4173
```

然后打开 `http://127.0.0.1:4173/`。

## 当前功能

- 内置 25 张原版地图与 28 张模组地图，按类别分组；每张地图默认加载对应 SquadCalc 底图
- 53 张地图分别使用 SquadCalc 上游中的 Squad SDK `corner0/corner1` 边界，X/Y 尺寸保留到厘米并独立换算屏幕像素
- 地图上绘制真实米制网格：300 米主网格；放大后显示 100 米和约 33.33 米细分网格
- 鼠标滚轮以指针下的地图位置为锚点缩放；Shift+拖动可平移，适配按钮恢复全图
- 底图加载失败时可重试或导入本地地图图片
- 地图下拉列表和底图、地形图、高程图图层选择
- 点击地图放置炮位
- 切换到“添加目标”后，点击地图创建 A、B、C… 多目标
- 拖动炮位或目标，实时更新距离、方位角、密位、弹道仰角和飞行时间
- 当前武器最大射程范围圈；地图目标同步显示是否在射程内
- 炮位和目标落点均为 5×5 px 中心点，配合透明 34 px 拖动热区
- 每个目标按所选弹药显示 100 / 25 伤害边界圈；地图尺寸按 X/Y 实际比例分别换算，拖动和滚轮缩放时同步跟随
- 目标高度、炮位高度和地图宽高比例修正
- 5 组社区迫击炮射表，以及 Squad、Galactic Contention、SuperMod、Steel Division 等来源支持的曲射武器参数
- 导入地图图片（只保留当前会话）
- 火力计划 JSON 导入/导出
- localStorage 自动保存标记、地图、图层、武器和比例

## 地图资源

GitHub 源码仓库不包含 `map-assets/` 中的 53 张底图。应用会回退至 SquadCalc 的在线底图服务；使用者也可导入自己有权使用的地图图像。离线分发包需要本机提供完整地图资源。地图图片属于 Squad 游戏素材，版权归 Offworld Industries 等相关权利方及相应模组作者；地图边界和资源路径来自 SquadCalc 上游项目。

## 公开与许可

仓库公开提供源码，但不将整个项目重新授权为 MIT。SquadCalc 衍生部分保留 `licenses/SquadCalc-LICENSE.txt` 中的非商业限制与署名要求；SquadMC、Lucide 和其他组件保留各自许可证。地图图像未包含在仓库中，也不受这些代码许可证覆盖。因此，当前版本是公开源码项目，不是整体采用 OSI 批准许可证的开源发行版。

## 武器数据边界

SQU、GER、BR3、BR4、US6 的迫击炮使用 SquadMC 公布的距离/密位表，表格刻度之间采用线性插值；其最大射程分别为 1,250 m、1,400 m、1,400 m、2,500 m、1,400 m。其余武器使用固定版本 SquadCalc 的速度、重力倍率、仰角、离膛高度、角度修正、火箭减速和弹药寿命参数，按抛体方程计算射角及理论最大射程；模型重力常数采用 SquadCalc 的 9.78 m/s²，射表推导采用 SquadMC 使用的 9.8 m/s²。

这些是社区逆向整理的数据，不是 Offworld 发布的服务器射表。该模型不模拟空气阻力、风、地图高程采样和运行时版本差异；最大射程圈表示平地条件下的理论可达边界。目标的实线 / 虚线圈按 SquadCalc 固定版本中的爆炸参数和伤害衰减公式计算，分别表示 100 / 25 伤害边界，不模拟掩体、护甲、地形遮挡或运行时版本差异。迫击炮射表武器共用 SquadCalc 的通用 Mortar 爆炸参数；PZL-07 的高爆弹和空爆弹分列为两个弹药选项。地图上的点选精度取决于底图边界、SDK 尺寸和像素级标注精度。

来源版本：

- SquadCalc 武器配置：https://github.com/sh4rkman/SquadCalc/blob/24828d6d3081c7ce52b10ef39ec86036ebf010b5/src/data/weapons.js
- SquadCalc 伤害半径公式：https://github.com/sh4rkman/SquadCalc/blob/24828d6d3081c7ce52b10ef39ec86036ebf010b5/src/js/squadWeapons.js 与 https://github.com/sh4rkman/SquadCalc/wiki/Deducing-Damage-Radius
- SquadCalc 弹道公式：https://github.com/sh4rkman/SquadCalc/blob/24828d6d3081c7ce52b10ef39ec86036ebf010b5/src/js/squadFiringSolution.js
- SquadMC 迫击炮射表：https://github.com/Endebert/squadmc/blob/master/calcMortarSettings.js

SquadCalc 上游项目：<https://github.com/sh4rkman/SquadCalc>
