# 阶段 5 调研与改造方案（数据闭环 × 弹幕打磨 × 系统感知 × 工程质量）

_2026-08-29 起草。覆盖 ideas.md 第二轮的：二（打卡闭环）、七（弹幕表现）、八（系统感知）、十（数据洞察+活跃图）、十一（工程质量）。进入开发前以本文档为准，完成后在 development-plan.md 立项。_

## 0. 技术调研结论（硬结论）

| 疑点 | 结论 | 来源 |
|---|---|---|
| 穿透弹幕如何可点击 | Electron 官方模式：窗口常驻 `setIgnoreMouseEvents(true, {forward:true})`，渲染层监听全局 mousemove 用 `elementFromPoint` 判断悬停位置，命中弹幕按钮时 IPC 通知主进程切 `setIgnoreMouseEvents(false)`（[官方教程](https://electronjs.org/docs/latest/tutorial/custom-window-interactions)、[BrowserWindow API](https://electronjs.org/docs/latest/api/browser-window)） | 官方 |
| 该模式的坑 | ① 部分非 Electron 窗口聚焦时 forward 失效（[issue #33281](https://github.com/electron/electron/issues/33281)）——表现为特定前台应用下弹幕暂时不可点，降级可接受；② 隐藏的 forward 窗口可能干扰其他窗口拖拽（[#35030](https://github.com/electron/electron/issues/35030)）——我们只有可见 overlay 用它，规避 | GitHub |
| GitHub 式活跃图 | [react-activity-calendar](https://www.npmjs.com/package/react-activity-calendar)（v3.2.1，一个月前更新，活跃维护）：传入自己的 `[{date, count, level}]` 数组即可，支持亮暗主题、tooltip。不需要 GitHub API（那是另一个包装库） | npm |
| 电池 API | `navigator.getBattery()` 在 Electron（Chromium）可用；**无电池台式机会返回 level=1.0 + charging=true**，必须特征检测并把台式机视为「市电常供」（[MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getBattery)） | MDN |
| 网络状态 | 渲染层 `online/offline` 事件即可，无需原生模块 | Chromium |
| 活跃时长 | `powerMonitor.getSystemIdleTime()`（秒）轮询，<阈值视为活跃分钟，按日累计落盘 | Electron |
| 调度器可测性 | 现状 `scheduler.ts` 直接 import electron 的 powerMonitor，无法单测。需把纯逻辑（下次触发时刻计算、差量 diff、唤醒补发判定）抽到无依赖的 `shared/schedule-core.ts`，Vitest 直测纯函数 | 设计 |

## 1. 打卡闭环（方向二核心）

**交互方案**：弹幕飘过时鼠标悬停其上（穿透自动关闭）→ 弹幕下方浮出「✓ 完成了」「忽略」两个小按钮 → 点击后弹幕提前消散并记一笔；鼠标离开 1 秒后恢复穿透。

**数据模型**（新增 `userData/stats.json`）：
```ts
interface Checkin { date: string; itemId: string; at: number }   // date=YYYY-MM-DD 便于按日聚合
interface DailyUsage { date: string; activeMinutes: number }
```
- 打卡即写入 checkin；每项提醒可设每日目标 `dailyGoal?: number`（喝水=8）
- 弹幕历史条目同步带 `checked?: boolean` 标记

**改动面**：overlay.ts（穿透切换 IPC + 鼠标监听）、OverlayApp（按钮浮层）、main/stats.ts（新增）、store（dailyGoal）、托盘 tooltip（今日进度）、设置页（目标设置）

## 2. 数据洞察 + 活跃图（方向十核心）

- **统计页**：新窗口路由 `/stats`（托盘「统计」入口）：顶部活跃图（react-activity-calendar，默认展示**打卡次数**，可切换**活跃时长**），下方今日各提醒项完成度条 + 最近 7 天柱状
- **数据导出**：统计页「导出 JSON」按钮，save 对话框落盘
- 打卡数据与活跃时长双数据源都在 stats.json，活跃图只是不同聚合视角

## 3. 弹幕表现打磨（方向七）

| 项 | 方案 | 成本 |
|---|---|---|
| 车道分配 | OverlayApp 维护每显示器车道表（workArea 高度均分 6 道），新弹幕随机选无活跃弹幕的车道；全满则随机 | 低 |
| 时长自适应 | `duration = clamp(速度档基准 × (0.8 + 字数/40), 档位min, 档位max×1.6)`——长文慢飘 | 低 |
| 重要度分级 | 提醒项加 `priority: 'normal'\|'high'`；high 弹幕字号×1.4、时长×1.5、可选触发 Windows 系统通知（Electron Notification，零依赖，设置项「重要提醒同时进通知中心」） | 中 |
| 任务栏避让 | overlay 窗口从 `display.bounds` 改用 `display.workArea` 创建，天然避开任务栏 | 低 |
| 暗色自适应 | overlay 读系统深浅（matchMedia），暗色下自动用低饱和深底配色渲染弹幕文字描边加强；手动主题优先 | 低 |

## 4. 系统感知触发（方向八）

| 项 | 方案 | 成本 |
|---|---|---|
| 间隔抖动 | Scheduler fire 时下次触发加 ±15% 随机抖动（配置开关「随机抖动」默认开） | 低 |
| 电池触发 | overlay 或专用 hidden renderer 跑 getBattery；拔电/低于 20% 各弹一次（去抖：一次插拔只报一次）；台式机（无电池）静默跳过 | 中 |
| 网络触发 | renderer online/offline 事件 → 弹幕「网络断了/恢复了」，默认关、设置开启 | 低 |
| 连续使用时长 | main 每 60s 轮询 getSystemIdleTime，<60s 记活跃分钟；满 120min 弹「该休息了」并重置计数（阈值可配）；数据同时喂给统计页 | 中 |
| 自然语言建日程 | **延后**：本地规则解析中文时间表达复杂度不低（每天/周几/明天/下午X点/点半…），单独一轮做更稳 | 高 |

## 5. 工程质量（方向十一）

| 项 | 方案 |
|---|---|
| 调度器单测 | 抽 `shared/schedule-core.ts` 纯函数（computeScheduleAt/差量diff/补发判定）→ Vitest 覆盖：每日/周几/单次计算、跨午夜、唤醒补发、抖动范围。**做其他批次前先落此批** |
| config 自愈 | getConfig 解析失败时把坏文件改名 `config.json.bak-<时间戳>` 再返回默认值（保留现场可恢复），记一次弹幕提示「配置已重置」 |
| 双开同步 | SettingsApp 监听 `config:changed`：正在编辑的字段（草稿）不覆盖，其余字段合并进 state |
| E2E | Playwright + Electron `_electron.launch` 跑「添加提醒→立即提醒→弹幕 DOM 出现」主链路。**建议延后**（成本高，先靠单测+手动） |

## 6. 分批建议

| 批次 | 内容 | 说明 |
|---|---|---|
| 批次 0（地基） | 调度器单测 + config 自愈 | 先落，后面批次都受益 |
| 批次 1（闭环） | 打卡交互 + stats 存储 + 统计页（活跃图/进度/导出）+ 每日目标 | 用户价值最直接 |
| 批次 2（弹幕） | 车道 + 时长自适应 + 任务栏避让 + 暗色自适应 + 重要度（含系统通知） | 可用性 |
| 批次 3（感知） | 抖动 + 电池 + 网络 + 活跃时长统计 | 彩蛋组 |
| 延后 | 自然语言建日程、Playwright E2E | 见上文理由 |

## 7. 待决策点

1. 本轮做哪些批次（推荐 0+1+2，3 视进度）
2. 打卡交互形态：悬停出「完成/忽略」按钮（推荐）/ 点弹幕本体直接记完成
3. 活跃图默认维度：打卡次数（推荐）/ 活跃时长 / 可切换（推荐做切换，问默认值）
4. 重要提醒的「同时进 Windows 通知中心」做不做
