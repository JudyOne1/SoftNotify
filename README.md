# Notify

跨平台定时提醒工具：到点后一段轻音效 + 弹幕式文字从屏幕飘过，提醒你喝水、护眼、活动一下——**不打断你的焦点**。

- 平台：Windows / macOS / Linux
- 技术栈：Electron + TypeScript + React

## 特性

- 弹幕式弱提醒：透明置顶穿透窗口，文字飘过即消失，不抢焦点、不弹窗、不进任务栏
- 声音提醒：轻柔合成提示音，可关闭、可调音量
- 多显示器支持：每块屏幕独立弹幕窗口
- 托盘常驻：暂停/恢复、立即提醒、打开设置
- 休眠补偿：电脑睡眠错过提醒，唤醒后自动补发
- 无服务端、无账号：所有配置保存在本地

## 开发

```bash
npm install
npm run dev        # 启动开发模式（带 HMR）
npm run typecheck  # 类型检查
npm run build      # 构建（输出到 out/）
```

## 打包

```bash
npm run build:win    # NSIS 安装包
npm run build:mac    # DMG
npm run build:linux  # AppImage + deb
```

产物输出到 `release/`。

## 文档

- [调研报告](docs/research.md)：技术选型、竞品分析、平台踩坑清单
- [开发计划](docs/development-plan.md)：阶段规划与决策记录

## 协议

[MIT](LICENSE)
