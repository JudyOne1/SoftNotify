# UI 风格与交互调研（供决策）

_2026-08-29 起草。目的：给 Notify 的界面升级做方向决策。写给非设计背景的读者，术语都配了常见应用做参照。_

## 1. 现状盘点（基于当前代码）

**视觉**
- 唯一的设置窗口 480×800、不可调整大小；浅色单主题（背景 #f7f8fa、强调色天蓝 #38bdf8、系统字体）
- 颜色、圆角、间距全部硬编码散落在 CSS 里，没有统一的设计变量（改一处主题要改十几处）
- 视觉层级弱：分区标题是小号灰字，和正文区分不明显；卡片没有阴影/描边层次

**布局与交互**
- 七个分区（间隔提醒/定时日程/模式/声音/免打扰/弹幕/底部操作）从上到下一根长滚动条，找设置靠滚
- 即时保存（改了就生效，右上角短暂显示「已保存」），没有确认/撤销
- 控件基本是原生 HTML（checkbox/select/range），没有悬停反馈、没有过渡动画、点击无按压感
- 无暗色模式；弹幕历史/引导页是独立窗口，风格与设置页一致但更简陋

**做得对的（保留）**
- 弹幕悬浮层本身零 UI，符合产品「不打扰」哲学
- 信息密度合理，所有功能一屏可达，没有弹窗套弹窗

## 2. 主流风格流派（2025-2026 趋势，通俗版）

| 流派 | 参照物 | 特点 | 适合 Notify 吗 |
|---|---|---|---|
| **Fluent 原生风** | Windows 11 设置、PowerToys | 云母/亚克力半透明材质（Mica，透出桌面壁纸色调）、圆角、左侧导航、亮暗跟随系统 | 桌面常驻工具的主流选择，Windows 用户最有「原生感」 |
| **macOS 原生风** | macOS 系统设置 | 毛玻璃侧栏（vibrancy）、紧凑表单、细腻动效 | macOS 用户原生感强，但 Notify 用户大概率以 Windows 为主 |
| **深色精致工具风** | Raycast、Linear、Arc | 暗色为主、低饱和、细描边、精致微动效、命令面板气质 | 开发者群体审美偏好，和「弹幕」气质搭 |
| **玻璃拟态 Glassmorphism** | 手机控制中心、iOS 小组件 | 磨砂玻璃卡片、模糊背景、半透明层次 | 2026 年回潮并演进为「液态玻璃」；适合弹幕/toast，大面积用于设置窗有可读性风险 |
| **Bento 网格** | 苹果官网、很多仪表盘 | 模块化卡片网格拼装 | 适合首页/仪表盘，设置页用处不大 |

趋势背景（2026）：暗色模式已是标配、玻璃拟态回潮、bento 布局流行（来源见文末）。

## 3. 四个改造方向（选一个作为主基调）

### 方向 A：轻量打磨（保守）
保持现有布局与亮色基调，只做质感统一：设计变量（颜色/圆角/间距/字号收成一套 CSS 变量）、悬停与按压反馈、过渡动画、聚焦样式、卡片描边+浅阴影、统一图标。
- 成本：低（1 个批次内完成）；风险：几乎为零
- 效果：从「工程 demo」到「干净的小工具」，但气质不变

### 方向 B：Fluent 原生风（Windows 用户的舒适区）
对齐 Windows 11 设置：窗口背景用 Mica 材质（Electron 原生支持 `backgroundMaterial: 'mica'`，透出壁纸色调）、左侧窄图标导航栏、亮暗跟随系统、原生感控件样式。
- 成本：中；风险：Mica 仅 Win11（Win10/老机器回退纯色，需写回退）；需把窗口改为可缩放+侧栏布局
- 效果：Windows 用户会觉得「这就是个正经 Windows 软件」

### 方向 C：深色精致工具风（开发者审美）
以暗色为主基调（可切亮色），低饱和背景 + 细描边卡片 + 天蓝强调色保留，微动效（hover 抬升、数字滚动、进度过渡），类 Raycast/Linear 的克制精致。
- 成本：中；风险：亮暗两套都要调，工作量比 B 略大
- 效果：最有「极客工具」辨识度，与弹幕产品的极客气质最搭

### 方向 D：玻璃拟态弹窗风（激进）
磨砂玻璃卡片 + 彩色光晕背景，强调「轻、透、飘」。
- 成本：中高；风险：可读性和对比度难保证，容易显廉价；与常驻设置窗的长阅读场景相性差
- 效果：炫，但推荐只在弹幕/toast/引导页局部使用，不适合做全局基调

**我的推荐：C 为主基调（暗色精致工具风），吸收 B 的 Mica 材质作为 Win11 增强**——既有极客气质又保留原生质感；如果你更看重 Windows 原生感就选 B。

## 4. 交互优化清单（无论选哪个方向都建议做）

1. **左侧分组导航**：分区已有 7 个，长滚动开始变难找；加窄侧栏（图标+字）点击跳转/切换，设置窗口改为可缩放并记忆大小
2. **暗色模式**：跟随系统（`prefers-color-scheme`），可选手动切换
3. **反馈微交互**：按钮悬停/按压态、「已保存」改为右上角浮出的 toast、滑块拖动数值气泡、卡片悬停描边高亮、分区切换过渡
4. **保存体验**：保持即时保存（符合小工具心智），但失败要红字提示（目前静默）
5. **弹幕历史/引导页**：与新风格统一
6. **可访问性**：键盘 Tab 顺序、焦点可见、对比度达标（暗色下尤其注意）

## 5. 技术可行性注记

- **Mica/毛玻璃**：Electron 原生支持——Win11 `backgroundMaterial: 'mica'`（还有 `acrylic`，但拖动窗口有性能损耗），macOS `vibrancy: 'sidebar'`；Linux/Win10 回退纯色（官方 [BrowserWindow 文档](https://electronjs.org/docs/latest/api/browser-window)，细节见 [issue #29937](https://github.com/electron/electron/issues/29937)、[#38532](https://github.com/electron/electron/issues/38532)）
- **设计变量**：CSS 自定义属性 + `prefers-color-scheme` 媒体查询即可，不需要引入 UI 框架；继续手写保持零依赖
- **不引入组件库**（如 Fluent UI React）：包体积和风格控制考虑，继续手写 CSS，但按组件化整理

## 6. 决策点

1. 主视觉方向：A / B / C / D（推荐 C 融合 B）
2. 导航布局：左侧栏 / 顶部分段 tab / 维持单页滚动
3. 主题模式：跟随系统（支持暗色）/ 仅亮色
4. 本轮范围：仅设置页 / 设置页+历史+引导 / 全部（含托盘图标微调与弹幕 toast 样式）

## 参考来源

- [UI Design Trends for 2026 (LinkedIn)](https://www.linkedin.com/posts/shahidsaeed_ui_5-ui-design-trends-that-will-define-2026-activity-7382516760505106432-k1M2)
- [Biggest UX/UI Design Trends in 2026](https://www.sanjaydey.com/ux-ui-design-trends-2026-biggest/)
- [12 Product Design Trends for 2026 (UX Pilot)](https://uxpilot.ai/blogs/product-design-trends)
- [7 UI/UX Design Trends (Pixso)](https://pixso.net/articles/7-ui-ux-design-trends/)
- [Top UX/UI Design Trends 2025 (Fuselab)](https://fuselabcreative.com/ui-ux-design-trends-2026-modern-ui-trends-ux-trends-guide/)
- [Electron BrowserWindow API](https://electronjs.org/docs/latest/api/browser-window)
- [Electron issue #29937（Mica 支持）](https://github.com/electron/electron/issues/29937)
- [Electron issue #38532（Mica 透明度注意事项）](https://github.com/electron/electron/issues/38532)
