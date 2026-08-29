# 阶段 4 调研与改造方案（智能化与运营）

_2026-08-29 起草。对应 ideas.md 中被选中的四个方向：一（定时点提醒）、四（个性化）、五（视觉趣味）、六（发布运营）。本文档是调研 + 可行方案，功能进入开发前以本文档为准；完成后在 development-plan.md 立项勾选。_

## 0. 平台硬约束（调研结论）

| 结论 | 依据 |
|---|---|
| macOS 自动更新**必须**代码签名，无证书无法实现；只能引导手动下载 | [electron.build 官方文档](https://www.electron.build/docs/features/auto-update)：macOS application must be signed in order for auto updating to work |
| Windows NSIS / Linux AppImage 可无签名自动更新；Linux deb 不可自更新（AppImage 可以） | 同上 + electron-updater 支持 matrix |
| 现有 Release CI 不满足自动更新：`--publish never` 且 artifact 只传安装包，缺 electron-updater 必需的 `latest*.yml` 元数据 | 见 `.github/workflows/release.yml` |
| 农历转换可选 [lunar-typescript](https://www.npmjs.com/package/lunar-typescript)（6tail，MIT，零依赖，活跃维护，含节日/节气）或 [solarlunar](https://www.npmjs.com/package/solarlunar)（MIT，轻量） | npm |

## 1. 定时提醒模型重构（方向一核心）

**调研**：现有 `ReminderItem.intervalMinutes` 是纯间隔模型。定时点场景（每天 10:00 站会、23:00 睡觉提醒、一次性倒计时）需要绝对的钟点/日期触发。参考主流做法（cron 子集），桌面提醒只需四种触发方式，不需要完整 cron。

**方案**（所有者已确认：**两类列表**）：间隔提醒保持 `reminders: ReminderItem[]` 不动（零迁移），新增 `schedules: ScheduleItem[]` 定时日程：

```ts
interface ScheduleItem {
  id: string
  name: string
  enabled: boolean
  /** HH:MM */
  time: string
  /** 周几（0-6，周日=0）；空 = 每天 */
  weekdays: number[]
  /** 一次性日程：YYYY-MM-DD，触发后自动停用；空 = 周期性 */
  date?: string
  texts: string[]
  /** 忽略安静时段（如睡前提醒） */
  ignoreQuiet: boolean
}
```

- 无旧数据迁移；设置页两个区块（「定时计划」「间隔提醒」），「＋ 倒计时」快捷创建一次性日程
- Scheduler 对两类统一维护 nextAt，定时日程按「下一个满足 time+weekdays(+date) 的本地时刻」计算；`once` 触发后主进程将其 `enabled → false`
- 改动文件：`shared/types.ts`、`main/store.ts`（normalize）、`main/scheduler.ts`（nextAt 计算）、`renderer/settings`（新区块）、托盘（两类合并取最近）

**成本**：中。风险点在 scheduler 差量更新逻辑要按 schedule 值（而非仅 interval）做变更检测。

## 2. 自动更新（方向六核心）

**调研结论**：electron-updater + GitHub Releases 是 electron-builder 原生方案，无需自建服务端，符合「无服务端」理念。macOS 无签名做不了（见 §0），策略是 **darwin 平台检测无签名 → 自动隐藏更新 UI，改显「前往下载页」链接**；Windows 正常工作（保留 SmartScreen 警告）；Linux 仅 AppImage 支持。

**方案**：
- `package.json` 加 `publish: { provider: 'github', owner: 'JudyOne1', repo: 'SoftNotify' }`；devDependencies 加 `electron-updater`
- CI 改造：`npx electron-builder --win/--mac/--linux --publish always`（`env GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`），electron-builder 会自动上传 `latest.yml` / `latest-mac.yml` / `latest-linux.yml` + blockmap；发布为 **draft**，人工确认后点发布（防呆：坏版本不会推给用户）
- 主进程：`autoUpdater.checkForUpdatesAndNotify()`，启动后延迟检查 + 每 4h 轮询；下载完成弹幕提示「重启即更新」
- 设置页：显示当前版本、检查更新按钮、下载进度
- dev 模式禁用自动更新（electron-updater 在非打包环境会抛错）

**成本**：中。风险：electron-updater 对 draft release 的可见性要在首次真实 tag 时验证。

## 3. 引导页 + Star 入口（方向六其余）

**方案**：首次启动（config.json 不存在）→ 设置窗口开 `/welcome` 路由：选预设组合（久坐党/学生党/程序员）→ 生成提醒计划 → 进入主设置。设置页底部加「GitHub Star」链接。**成本**：低，无风险。

## 4. Profile 模式（方向四）

**方案**：`Config.profiles: { id, name, patch: Partial<Config> }[]` + `activeProfile`；profile 覆盖范围限定为「提醒计划 + 安静时段 + 弹幕主题/速度」（不含 autostart/paused/声音，避免切个模式把音量也改了）。托盘菜单加 Profile 子菜单（单选）。设置页可增删改。**成本**：中低。风险：与定时模型重构同碰 `Config`，放同一批做省迁移。

## 5. 时段文案（方向四）

**方案**：每项提醒加可选 `nightTexts: string[]`（22:00-06:00 触发时优先使用，空则回落 `texts` → 内置模板）。设置界面该项卡片多一个可折叠「夜间文案」输入。**成本**：低。纯本地规则，无网络依赖。

## 6. 弹幕样式自定义（方向五）

**方案**：`Config.danmaku = { opacity: 0.3-1, fontScale: 0.8-1.5, stroke: boolean }`，设置页三个控件，OverlayApp 用 CSS 变量应用。**成本**：低。

## 7. 弹幕历史面板（方向五）

**方案**：主进程内存 + 持久化（`userData/history.json`）保留最近 50 条（时间、文案、来源提醒名）；托盘「弹幕历史」+ 全局快捷键？否——快捷键属方向三未选，只做托盘入口。新窗口路由 `/history`，简单列表。**成本**：中低。

## 8. 节日弹幕（方向五）

**方案**：启用 `lunar-typescript`（MIT、零依赖、活跃，见 §0），内置节日表（公历：元旦/劳动节/国庆；农历：春节/元宵/端午/中秋/七夕/除夕）；当天首次提醒自动附加节日祝福文案（如「新年快乐！记得喝水」），不做独立弹窗。设置页一个总开关。**成本**：中低。备选：不引库只做公历节日+用户自定义日期（零依赖，覆盖打折）。

## 9. 暂缓项及理由（本轮不做）

| 功能 | 理由 |
|---|---|
| AI 生成文案 | 需要 API key 配置、费用与隐私考量，值得单独一轮；且 key 明文存本地 config 的方案需用户认可 |
| 避开心流（活跃度检测） | 与产品哲学有张力：弹幕本就是弱提醒，再判断心流容易过度设计；技术底座 `powerMonitor.getSystemIdleTime()` 可行，留作后续 |
| 番茄钟 / 使用时长触发 | 是「会话模式」而非「计划」，与本次 schedule 模型不同构，单独设计更干净 |

## 10. 分批建议

_2026-08-29 所有者已确认：批次 1+2+3 全做；定时提醒采用**两类列表**（间隔提醒与定时日程分开，现有数据零迁移）；节日弹幕引入 lunar-typescript；AI 文案延后。_

| 批次 | 内容 | 理由 |
|---|---|---|
| 批次 1 | §1 定时模型（两类列表：`reminders` 间隔 + `schedules` 定时日程） + §5 时段文案 + §4 Profile | 同碰数据模型 |
| 批次 2 | §2 自动更新（含 CI 改造） + §3 引导/Star | 发布基建，互不依赖批次 1 |
| 批次 3 | §6 样式 + §7 历史 + §8 节日 | 纯体验增强，随时可插队 |
| 待议 | §9 各项 | 见暂缓理由 |
