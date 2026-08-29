# UI 风格版图与组件库选型调研

_2026-08-29 追加。回应两个问题：① 除已调研的风格外还有哪些风格；② 有没有现成的框架/组件库可用。结论均标注来源，最后给出针对 Notify 的组合建议。_

## 1. 风格版图（2026 视角）

| 风格 | 一句话 | 参照物 | 优点 | 短板 | Notify 适配度 |
|---|---|---|---|---|---|
| **新拟物 Neumorphism** | 同色背景 + 双光影，从背景里凸起/凹进的柔软塑料感 | 2020 年音乐播放器类 UI | 柔软触感、气质独特 | 可访问性差、暗色光影难、2020 复古感 | ★★★（局部好用，全量危险，详见 ui-research.md 附录） |
| **黏土风 Claymorphism** | 新拟物的可爱版：更大圆角、蓬松 3D、常配明快渐变 | 儿童/社交类 App、游戏 | 亲切、趣味、和「弹幕」的轻松感搭 | 严肃工具感弱；3D 质感 CSS 实现费劲 | ★★★（若想要「轻松可爱」定位可考虑） |
| **玻璃拟态 / Liquid Glass** | 磨砂玻璃卡片 + 背景模糊；Apple 2025 把它升级为「液态玻璃」系统语言 | iOS 26 控制中心、visionOS | 现代、通透、2026 主流 | 大面积用伤可读性；模糊有性能成本 | ★★★★（适合 toast/弹窗/引导页局部） |
| **Aurora 极光渐变** | 柔和流动的多色渐变背景 | Stripe、Linear 落地页 | 氛围感强、成本低（纯 CSS） | 容易抢内容风头 | ★★★（可做背景层叠加） |
| **新粗野主义 Neo-Brutalism** | 粗黑描边、硬阴影、高饱和撞色、不圆角 | Figma、Gumroad 风潮 | 个性极强、当下独立圈流行 | 与「轻柔不打扰」气质相反 | ★ |
| **终端/CLI 风** | 等宽字体、单色、边框字符、扫描线 | Warp、terminal 主题 | 极客感拉满、和开发者用户同频 | 文本密度已经很高的设置页会更干 | ★★ |
| **Material 3 / Material You** | Google 系：动态取色、大圆角、明确层级 | Google 全家桶 | 组件库成熟（MUI） | Google 感强，桌面端存在感弱 | ★★ |
| **Fluent / Win11 原生** | Mica 材质、左侧导航、原生控件感 | Windows 11 设置 | Windows 用户零学习成本 | 离开 Windows 就不成立 | ★★★★（已部分吸收 Mica） |
| **极简白（Notion 风）** | 大量留白、细线、几乎无装饰 | Notion、Things | 耐看、永不踩坑 | 记忆点低 | ★★★ |
| **可爱/kawaii 粉彩** | 圆润、粉彩、贴纸感、微动效 |LINE 好友、小众工具 | 与弹幕气质天然契合 | 男性向工具用户可能嫌弃 | ★★★ |

> 趋势依据：[Tubik Studio 2026 趋势](https://tubikstudio.com/blog/ui-design-trends-2026/)、[Setproduct 的 Liquid Glass vs Glassmorphism vs Neumorphism 对比](https://www.setproduct.com/blog/liquid-glass-vs-glassmorphism)、[Setproduct 粗野主义 2026 实战指南](https://www.setproduct.com/blog/retro-brutalist-ui-design-2026)、[SolGuruz 28 条 2026 趋势](https://solguruz.com/blog/ui-ux-design-trends/)。

## 2. 组件库版图（React + Electron 视角）

### 主流通用库

| 库 | 模式 | 风格默认值 | 中文 | 现状 | 一句话点评 |
|---|---|---|---|---|---|
| **shadcn/ui** | 不是依赖，是「代码拷进你仓库」（Radix + Tailwind） | 中性深/浅，全可改 | 社区版 | 2025-2026 事实主流 | 风格完全可控 = 想做什么风格都行，代价是引入 Tailwind 且组件自维护 |
| **Mantine** | npm 依赖 | 中性、干净 | 文档英文为主 | 活跃，100+ 组件 | 全家桶出活最快，但要它的风格就得覆盖它的样式 |
| **Ant Design** | npm 依赖 | 企业中后台 | 官方中文 | 活跃 | 后台管理系统标配；做「轻巧桌面小工具」显得重 |
| **Arco Design**（字节） | npm 依赖 | 比antd 更精致 | 官方中文 | 活跃，60+ 组件 | 颜值在线的国产选项；注意与 antd 同用时样式冲突（[官方说明](https://arco.design/react/en-US/docs/question)） |
| **Fluent UI React v9**（微软） | npm 依赖 | Win11 原生感 | 一般 | 微软维护 | Windows 原生气质的唯一正解（[Fluent 2](https://fluent2.microsoft.design/components/web/react)） |
| **MUI** | npm 依赖 | Material 3 | 社区 | 活跃 | Google 风；桌面存在感弱 |
| **HeroUI**（原 NextUI） | npm 依赖（Tailwind 底） | 玻璃感、渐变、颜值流 | 一般 | 活跃 | 开箱最好看的玻璃/现代风，轻量（[对比](https://designrevision.com/compare/heroui-vs-shadcn)） |
| **daisyUI** | Tailwind 插件（纯 CSS 类） | 多主题（30+ 预设） | 一般 | 活跃 | 不锁组件结构，换主题=换类名，轻 |

> 依据：[Untitled UI 2026 库评比](https://www.untitledui.com/blog/react-component-libraries)、[HeroUI 2026 评比](https://heroui.com/en/blog/best-react-ui-component-libraries)、[Makers Den 2025 对比](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra)、[ShadcnDeck: Mantine vs shadcn](https://www.shadcndeck.com/blog/mantine-vs-shadcn)、[Reddit 桌面级应用讨论](https://www.reddit.com/r/reactjs/comments/1bc16y2/choosing_a_ui_library_that_makes_everyones_life/)、[Electron UI 库指南](https://www.astrolytics.io/blog/best-electron-ui-libraries-2023)、[daisyUI + Electron](https://daisyui.com/electron-component-library/?lang=en)。

### 拟物/风格化专用

- **没有活跃维护的专用 React 拟物组件库**——搜索结论：生态里只有（[Creative Tim 的 Soft UI Design System](https://www.creative-tim.com/blog/web-design/free-bootstrap-ui-kits-and-templates/)（React/Bootstrap 版，含付费 PRO，2021 审美、更新一般）和 [neumorphism.io](https://www.neumorphism.io/) 阴影参数生成器；拟物普遍作为「叠加在现有库上的美学」而非独立库存在
- 黏土/粗野/极光同样没有成熟专用库，通行做法是**在通用库/手写 CSS 上叠风格层**

## 3. 关键权衡（针对 Notify）

Notify 的 UI 面：3 个窗口、约 30 个控件、大量**自定义卡片**（提醒项/日程卡片），这些卡片任何库都没有现成的，终究要手写。引入组件库的收益在未来开发提速和一致性，代价是 Tailwind/依赖引入、现有设计令牌体系迁移、打包体积。

- **全量拟物**：没有现成库可用是事实。路径 = 手写 CSS 拟物主题（neumorphism.io 出参数 + 现有令牌体系加一组拟物阴影变量）。不需要也不建议为此引入 CreativeTim 整套。
- **要组件库红利**：shadcn/ui + Tailwind 是风格自由度最大的底座（拟物/玻璃/粗野都能在其上做皮肤），但迁移成本最高。
- **要 Windows 原生**：Fluent UI v9，但放弃拟物。
- **要快速好看**：HeroUI/daisyUI，但拟物不在其预设里。

## 4. 组合建议

| 你要什么 | 推荐组合 |
|---|---|
| 全量拟物（上一轮的选择） | **手写 CSS 拟物主题**：令牌体系加 `--shadow-raised/--shadow-inset` 变量，卡片/控件全量双光影；文字对比度手动守住 |
| 拟物 + 长期组件库红利 | **shadcn/ui + Tailwind 底座**，先做拟物皮肤；以后换风格只改主题层 |
| Windows 原生感 | **Fluent UI React v9**（放弃拟物） |
| 轻松可爱向（弹幕气质） | **黏土风手写 CSS**（圆角加大 + 蓬松阴影 + 粉彩渐变） |

_来源汇总见上文各节链接；拟物专项结论见 ui-research.md 附录。_
