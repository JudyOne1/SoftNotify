<div align="center">
  <img src="./src-tauri/icons/icon.png" alt="SoftNotify" width="144" />
  <h1>SoftNotify</h1>
  <p><strong>温和地提醒，不打断正在发生的事。</strong></p>
  <p>一款开源、轻量、本地优先的桌面提醒工具，以弹幕和轻提示音把提醒送到你眼前。</p>

  [![License](https://img.shields.io/github/license/JudyOne1/SoftNotify?style=flat-square)](./LICENSE)
  [![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?style=flat-square&logo=tauri&logoColor=white)](https://v2.tauri.app/)
  [![React](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
  [![GitHub stars](https://img.shields.io/github/stars/JudyOne1/SoftNotify?style=flat-square)](https://github.com/JudyOne1/SoftNotify/stargazers)
</div>

## 为什么是 SoftNotify

传统弹窗会抢焦点，系统通知又很容易被错过。SoftNotify 使用不会抢占输入焦点的桌面弹幕，让喝水、护眼、活动、日程与专注结束提醒自然经过屏幕，同时保留完成、稍后提醒和忽略等必要操作。

所有配置、历史与统计默认只保存在本机。应用常驻系统托盘，需要时打开，平时安静工作。

## 核心能力

| 能力 | 说明 |
| --- | --- |
| 温和弹幕 | 多车道防重叠、可调速度与显示区域，不抢占当前窗口焦点 |
| 两类提醒 | 支持按间隔循环提醒，也支持每日、每周与指定日期日程 |
| 快捷响应 | 直接完成、稍后提醒或忽略；半透明胶囊样式可自由开关 |
| 专注模式 | 内置 25 / 45 / 60 分钟专注计时，专注期间自动静默其他提醒 |
| 场景组合 | 将工作、休息、周末等提醒组合保存为模式并快速切换 |
| 智能免打扰 | 支持安静时段、全屏应用检测，以及 Windows 会议状态检测 |
| 多屏控制 | 可选择全部屏幕、主屏或指定屏幕，并自定义弹幕垂直区域 |
| 本地回顾 | 提醒历史、每日打卡、连续达成与专注统计均保存在本机 |
| 托盘快捷面板 | 查看运行状态、下一个提醒、今日进度，并快速暂停或开始专注 |

## 桌面交互

SoftNotify 将日常操作分成三个层次：

1. **托盘快捷面板**：查看状态、临时暂停、补打卡、开始专注。
2. **主窗口**：通过“今天 / 提醒 / 设置”管理计划与长期偏好。
3. **弹幕浮层**：提醒到达时完成、稍后处理或忽略，不承载复杂配置。

这套结构让高频动作保持一步可达，同时避免把所有功能塞进一个冗长菜单。

## 技术架构

```text
React 19 + TypeScript + Tailwind CSS
                 |
                 | window.notifyAPI
                 v
             Tauri IPC
                 |
                 v
Rust 调度 / 托盘 / 多窗口 / 本地存储 / 系统集成
```

| 模块 | 技术 |
| --- | --- |
| 桌面运行时 | Tauri 2 + Rust |
| 用户界面 | React 19 + TypeScript |
| 样式与组件 | Tailwind CSS 4 + Radix UI + Lucide |
| 构建工具 | Vite 7 |
| 测试 | Vitest + Rust unit tests |

当前版本重点在 Windows 上验证。Tauri 架构同时为 macOS 与 Linux 构建预留了支持，相关平台仍需要进一步冒烟测试。

## 本地开发

准备 Node.js、Rust stable 工具链，以及平台所需的 Tauri 系统依赖。Windows 需要 WebView2。

```bash
git clone https://github.com/JudyOne1/SoftNotify.git
cd SoftNotify
npm install
npm run tauri dev
```

常用检查：

```bash
npm run typecheck
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

创建安装包：

```bash
npm run tauri build
```

## 数据与隐私

- 配置、提醒历史和统计保存在本机应用数据目录。
- SoftNotify 不要求账户，不提供云同步，也不会上传提醒内容。
- 更新检查只访问本项目的 GitHub Releases。
- Windows 当前沿用 `dev.notify.app` 作为应用标识，以保持已有用户数据兼容。

## 项目状态

SoftNotify 正在持续完善中，当前版本为 `0.7.0`。欢迎通过 [Issues](https://github.com/JudyOne1/SoftNotify/issues) 报告问题、提出交互建议或分享使用场景。

## 参与贡献

你可以从修复问题、改进默认提醒模板、补充跨平台验证或优化无障碍体验开始。提交改动前请确保 TypeScript、Vitest 与 Rust 测试通过。

## License

[MIT](./LICENSE) © SoftNotify contributors
