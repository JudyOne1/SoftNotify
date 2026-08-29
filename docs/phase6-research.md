# 阶段 6 调研与改造方案（显示定向 × 会议免打扰 × 声音扩展 × 弹幕区域）

_2026-08-29 起草。四个功能点均来自所有者实测反馈。_

## 0. 本机实测探测结论（2026-08-29，所有者机器）

| 探测项 | 结果 |
|---|---|
| 摄像头/麦克风使用记录（注册表 ConsentStore） | **可用**：HKCU 下 webcam/microphone 的 NonPackaged 子键存在（PotPlayer、OBS 等条目，含 LastUsedTimeStart/Stop FILETIME），无需管理员 |
| 系统 TTS 语音包 | **仅有英文**（Microsoft David/Zira en-US），无中文语音 → 中文播报会退化，需降级设计 |
| 参考来源 | [DFIR: 追踪摄像头/麦克风访问](https://dfir.pubpub.org/pub/nm5b39ae)、[Stack Overflow: 检测摄像头占用](https://stackoverflow.com/questions/61132854/how-can-i-determine-if-a-webcam-is-in-use-on-windows-10-without-activating-the-c)、[注册表监控实践](http://davidarno.org/using-the-registry-to-monitor-webcam-and-microphone-use/)；注意 Win11 部分新构建迁移到 SQLite（[分析](https://medium.com/@cyber.sundae.dfir/capability-access-manager-forensics-in-windows-11-f586ef8aac79)），表现为检测静默失效，无副作用 |

## 1. 指定屏幕输出弹幕

**方案**：`Config.displayMode: 'all' | 'primary' | 'custom'` + `customDisplays: number[]`（显示器按屏幕 x 坐标从左到右编号）。

- 设置页「弹幕」区新增「输出屏幕」：全部 / 仅主屏 / 自定义；选自定义时列出当前检测到的显示器（如「显示器 1 · 主屏 2560×1440」「显示器 2 · 左侧 2256×1440」）多选
- `overlay.ts sendReminder` 按目标显示器过滤投递；overlay 窗口仍全部创建（车道逻辑不变）
- 显示器热插拔/重排后索引失配 → 回退「全部」并在 tooltip 提示重新选择
- 改动：types/store/overlay.ts/settings UI。**成本：低**

## 2. 会议状态免打扰

**两层设计**：

| 层 | 方案 | 成本 |
|---|---|---|
| 手动会议模式 | 托盘菜单加「会议模式」开关（与暂停并列，tooltip 显示「会议中」）；开启后一切弹幕静默（同安静时段逻辑，优先级最高） | 低 |
| 自动检测（仅 Windows） | 每 15s 轮询 `reg query` HKCU/HKLM ConsentStore 的 webcam + microphone NonPackaged，任一应用 LastUsedTimeStart > LastUsedTimeStop 即「使用中」→ 视为会议，静默；检测异常视为不在会议（静默失效无副作用）。设置项「检测到摄像头/麦克风时自动免打扰」默认关 | 中 |

- 检测实现：`child_process.execFile('reg', [...])`，解析 FILETIME；本机已验证可读
- 已知风险：Win11 最新构建若注册表停更 → 自动检测不触发（手动模式不受影响）

## 3. 铃声扩展 + 提醒项声音配置

**音色引擎**（`chime.ts` 重构）：预置音色全部 WebAudio 合成、零依赖：

| 音色 | 合成思路 |
|---|---|
| classic 经典双音 | 现有 A5→D6 |
| windchime 风铃 | 随机五声上行琶音，高频衰减 |
| water 水滴 | 频率快速下滑的正弦 + 短包络 |
| knock 木鱼 | 短促带噪声的敲击（低通滤波脉冲） |
| musicbox 八音盒 | 方波+泛音，慢衰减 |

- `Config.soundPreset: string`（默认 classic）；现有「自定义音频文件」优先级高于预置（逻辑保留）
- **提醒项级**（RemindersSection/SchedulesSection 卡片各加一行）：`soundPreset?: string`（默认「跟随全局」下拉含各音色）+ `voice?: boolean`（语音播报开关，开启后念文案替代提示音）

**语音播报（TTS）**：
- 引擎用系统 SAPI（`Add-Type System.Speech`，离线零依赖），主进程 spawn 播放
- 优先选 zh 语音；**本机无中文语音包 → 自动回退提示音**，设置页显示「未检测到中文语音包，可在系统设置→语音中安装」
- 可选增强（本轮不做，记录）：Edge TTS 在线音色（自然但需联网，与「无服务端」理念冲突，做也默认关）
- **成本：中**

## 4. 弹幕显示区域

- `Config.danmakuZone: 'full' | 'top-half' | 'top-30'`，设置页「弹幕」区下拉：全屏 / 上半屏 / 顶部 30%
- OverlayApp 计算生效：车道分布在区间内，区域高度不足时车道数自动减少（最少 3 道），车道内偏移相应收窄
- **成本：低**

## 5. 分批建议

| 批次 | 内容 |
|---|---|
| 批次 1 | 指定屏幕 + 弹幕区域（都是「显示在哪」，UI 同区块） |
| 批次 2 | 音色引擎 + 提醒项声音配置 + TTS（含无中文语音降级） |
| 批次 3 | 会议免打扰（手动 + 自动检测） |

## 6. 待决策点

1. 本轮范围（推荐三批全做，总量不大）
2. 会议免打扰形态（推荐手动+自动检测两层）
3. TTS 引擎（推荐 SAPI 离线 + 无中文语音降级；Edge TTS 在线暂不做）
4. 弹幕区域粒度（推荐三档预设；可加自定义起止百分比滑杆）
