# 跨平台"弹幕式弱提醒"桌面软件调研报告

> 调研日期：2026-08-28
> 产品定位：定时提醒工具（如每小时提醒喝水），到时播放一段音频，并以弹幕式弱提醒从屏幕飘过，不打断用户焦点。

## 摘要

产品定位在技术上**完全可行且方案成熟**：核心是"全屏透明无边框置顶窗口 + 鼠标事件穿透 + CSS 动画"，Electron 和 Tauri 都能实现。竞品多为"模态弹窗锁屏式"提醒（如 Stretchly），**"零打扰弹幕"恰好是差异化的空白点**。最终选型：**Electron + TypeScript + React**（生态最成熟、AI 辅助开发效率最高）。

## 关键结论

- **弹幕悬浮窗是成熟技术**：Electron 的 `transparent + frameless + alwaysOnTop + setIgnoreMouseEvents(true)` 是桌面弹幕/桌宠/屏幕标注类应用的标准做法，双平台均有大量实践案例。
- **Tauri 也能做**：有 `setIgnoreCursorEvents` API 和透明窗口支持，同类先例（喝水提醒应用 Shui 基于 Tauri）；但 Windows 上 WebView2 透明窗口仍有零星 bug，资料少于 Electron。
- **窗口可以真正做到"不打断焦点"**：鼠标穿透后窗口永远拿不到焦点，配合"不 focus、不显示在任务栏"，用户正在打字/游戏/开会时弹幕直接飘过，无感知打断。
- **最大的工程坑在平台细节**：macOS 全屏应用/多桌面（Spaces）下的置顶行为、Windows 全屏独占游戏会盖住悬浮层、多显示器与 DPI 缩放、系统休眠唤醒后定时器补偿。
- **竞品多走"强提醒"路线**，弱提醒 + 弹幕是差异化卖点。

## 技术栈选型

| 维度 | Electron | Tauri v2 | Flutter Desktop |
|---|---|---|---|
| 透明+穿透窗口 | 一等公民，文档齐全，案例极多 | 支持，但透明窗口自动按像素穿透官方不做，需手动切换/全程开启 ignore 模式 | 透明窗口支持有限、需大量平台侧 hack |
| 常驻内存 | 较高（约 80–150MB） | 低（约为 Electron 的 40–60%） | 中等 |
| 安装包体积 | 大（~80MB+） | 小（~5–10MB，比 Electron 小 ~96%） | 中 |
| AI 辅助开发效率 | **最高**（训练语料/问答资料最多） | 中等（Rust 侧报错需多轮迭代） | 较低（桌面端资料少） |
| 双端一致性 | Chromium 自携，渲染一致 | 依赖系统 WebView，需真机双测 | 自绘引擎，一致性好但透明窗口弱 |
| 先例 | 大量弹幕/桌宠/标注类应用 | Shui 喝水提醒 | 少见 |

**结论**：MVP 用 Electron。这是一个 7×24 常驻的小工具，功能简单，内存劣势可接受；弹幕窗口的平台兼容坑在 Electron 生态里都有现成答案，对 AI 辅助开发尤其友好。若上线后用户对"内存占用"敏感，再评估迁移 Tauri（Shui 证明了可行性）。

## 核心功能可行性

### ① 弹幕式弱提醒窗口（产品核心）

- 每块显示器开一个全屏透明无边框窗口：`transparent: true, frame: false, alwaysOnTop: true, skipTaskbar: true`，并 `setIgnoreMouseEvents(true)`——鼠标直接穿过，窗口永不获焦。
- 弹幕动画用 CSS 即可：随机轨道（纵向车道）、`translateX` 从屏幕右到左、8–12 秒线性飘过、随机字号/颜色/速度，可多条并发。
- 置顶级别用 `'screen-saver'`，防止被其他应用抢焦点时盖住。
- `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` 保证 macOS 全屏应用与多桌面上可见。

### ② 定时调度

- 应用内调度即可（主进程 `setTimeout`/`setInterval`），无需系统级任务计划。
- **必须处理系统休眠**：监听 `powerMonitor` 的 suspend/resume 事件，唤醒后对"错过的提醒"立即补发。这是提醒类工具最常见的差评来源。
- 需要"安静时段"（会议/深夜免打扰）：先做手动暂停 + 时间段配置，自动检测"正在投屏/开会"作为后续功能。

### ③ 音频播放

- 直接用 Web Audio 合成 2–3 秒短提示音（或 HTML5 Audio 播放资源），双平台无额外依赖。
- 提供音量独立调节与"仅弹幕不发声"选项。
- 多显示器场景下只在主屏窗口发声，避免重复播放。

### ④ 基础配套

系统托盘（暂停/跳过/设置入口）、开机自启（`app.setLoginItemSettings`，Linux 需写 `~/.config/autostart/*.desktop`）、本地 JSON 存储配置（无服务端，隐私友好）。

## 竞品格局

| 产品 | 平台 | 提醒方式 | 特点/弱点 |
|---|---|---|---|
| Stretchly（开源） | Win/Mac/Linux | 自有弹窗，严格模式会锁屏 | 最知名，但偏"强打断"；可检测全屏应用跳过 |
| Shui（开源，Tauri） | Win/Mac | 定时全屏提醒+菜单栏倒计时 | 中文圈先例，但同样是全屏强提醒 |
| Just Drink | Win/Mac | 系统通知 | 付费小工具，形态普通 |
| 喝水时间（Store） | Windows | 系统通知 | 功能单薄 |
| Time Out（Dejal） | macOS | 全屏渐隐锁定 | 老牌但仅 macOS，强打断 |

**差异化机会**：现有产品几乎都在"模态弹窗/锁屏"和"系统通知（易被忽略、受勿扰模式屏蔽）"之间二选一。**"弹幕飘过 + 轻音效"这种零焦点抢占的弱提醒是明确的空白**——同时满足"看得见"和"不打断"，弹幕形态自带情感化设计空间（文案、皮肤、节日彩蛋），利于传播。

**风险**：品类整体客单价低（多为免费/捐赠制），适合当开源/独立开发小而美项目。

## 平台注意事项（踩坑清单）

**macOS**
- 置顶窗口默认不会显示在其他应用的全屏模式里，需设置 `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` + 合适的 alwaysOnTop 级别。
- 分发需 Apple Developer ID 签名 + 公证（Notarization），否则用户无法直接打开。

**Windows**
- 独占全屏游戏/视频会盖住悬浮层（系统机制，无解），可检测全屏应用时自动暂停。
- 多显示器不同 DPI 缩放时，窗口尺寸要用实际像素计算，文字渲染按 scale 适配。
- WebView2/Chromium 由 Electron 自带，无额外运行时依赖。
- 不签名会触发 SmartScreen 警告，建议至少用 OV 代码签名证书积累信誉。

**Linux**
- 托盘图标依赖桌面环境的 StatusNotifier 支持。
- 开机自启需要写 `.desktop` 文件到 `~/.config/autostart/`。

**通用**
- 弹幕窗口设置 `skipTaskbar`，避免出现在任务栏/应用切换器里。
- 提醒频率默认值建议保守（45–60 分钟），过密是此类应用卸载的首要原因。
- **多窗口共用一个渲染入口时，Vite 会把所有视图的 CSS 打进同一 bundle**：任何视图里的全局 `body/html` 样式都会污染其他窗口。弹幕窗依赖透明 body，因此各视图样式必须作用域化（用组件外层容器承载背景色等"全局"样式）。本次开发曾因此 bug 导致透明窗口整屏不透明。

## 参考来源

- Tauri vs Electron Benchmark: https://www.reddit.com/r/programming/comments/1jwjw7b/
- Tauri vs Electron 2026: https://rustify.rs/articles/rust-tauri-vs-electron-2026
- Best Desktop App Frameworks 2026: https://www.pkgpulse.com/guides/best-desktop-app-frameworks-2026
- Tauri 透明窗口点击穿透 issue: https://github.com/tauri-apps/tauri/issues/13070
- Tauri Windows 透明子窗口 bug: https://github.com/tauri-apps/tauri/issues/12450
- Electron 窗口忽略点击: https://github.com/electron/electron/issues/2864
- Electron 透明区域穿透: https://github.com/electron/electron/issues/1335
- Electron BrowserWindow 文档: https://electronjs.org/docs/latest/api/browser-window
- Electron 全屏置顶: https://syobochim.medium.com/electron-keep-apps-on-top-whether-in-full-screen-mode-or-on-other-desktops-d7d914579fce
- Stretchly: https://hovancik.net/stretchly/ / https://github.com/hovancik/stretchly
- Shui 喝水提醒: https://github.com/ruanyf/weekly/issues/6704
- Just Drink: https://just-drink.app/
- Flutter 桌面透明窗口局限: https://github.com/flutter/flutter/issues/96732
