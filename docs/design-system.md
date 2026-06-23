# POPOP 工具站设计语言（sticker / cream）

> 单一权威。新增工具、改造页面一律遵循本文件。
> 实现层：`src/index.css`（token + `.pop-*` 组件类）、`src/components/`（共享 React 组件）。
> 设计基因来自品牌架构稿：粗黑描边 + 硬阴影 + 奶油品牌色 + 圆角胶囊 + 纸张纹理底。

---

## 0. 一句话风格

「奶油贴纸」：纯色纸底（`paper-2`），元素一律 **2px 纯黑描边**，关键容器带 **右下硬阴影**（`3px 3px 0 #0B0B0B`），品牌奶油色 `#EAD9A2` 作强调，圆角偏大，标题用 Baloo 2。不用柔和投影、不用细灰边、不用 neutral 灰底、不用平铺纹理。

---

## 1. 设计 Token（已落地在 `src/index.css` 的 `@theme`）

所有颜色都注册成 Tailwind v4 颜色 token，可直接写 `bg-*` / `text-*` / `border-*`。

### 1.1 纸 / 墨

| Token | 值 | 用途 |
|---|---|---|
| `paper` | `#FFFFFF` | 卡片、输入框底 |
| `paper-2` | `#FBFAF4` | 页面底色（body） |
| `soft` | `#F4F0E4` | 次级底、占位图底 |
| `code-bg` | `#FCF7E7` | 代码 / prompt 展示底 |
| `ink` | `#0B0B0B` | 主文字、所有描边 |
| `ink-2` | `#46423A` | 副文字 |
| `ink-3` | `#8C877B` | 弱文字、占位、hint |
| `line` | `#ECE7D8` | 极弱分隔（禁用态边框） |

### 1.2 品牌奶油色

| Token | 值 | 用途 |
|---|---|---|
| `cream` | `#EAD9A2` | 主强调：选中态底、深底上的文字 |
| `cream-2` | `#E3CD85` | 强调描边、hover |
| `cream-soft` | `#FBF3D9` | hero 底、hover 浅底 |
| `cream-deep` | `#D7BD6E` | kicker 小标 |
| `cream-line` | `#E6D199` | 虚线分隔、奶色边 |

### 1.3 语义色（各配一个 `-soft` 浅底）

`ok`(#2F8B57) / `err`(#CF4A33) / `info`(#2E72BE) / `warn`(#BE921A)。
错误文字用 `text-err`，错误块用 `.pop-callout-err`。

### 1.4 圆角 / 阴影 / 字体

| Token | 值 |
|---|---|
| `rounded-pop` | 10px |
| `rounded-pop-lg` | 18px |
| `rounded-pop-xl` | 24px |
| `shadow-sticker` | `3px 3px 0 #0B0B0B` |
| `shadow-sticker-sm` | `2px 2px 0 #0B0B0B` |
| `shadow-sticker-lg` | `6px 6px 0 #0B0B0B` |
| `font-display` | Baloo 2（标题、品牌字、数字） |
| `font-sans` | Plus Jakarta Sans + PingFang SC（正文） |
| `font-mono` | JetBrains Mono（标签、hint、代码、读数） |

---

## 2. 组件类（`@layer components`，直接写 class 名复用）

| 类名 | 说明 |
|---|---|
| `.pop-card` | 主卡片：白底 + 2px 黑边 + 硬阴影 + 圆角 |
| `.pop-card-flat` | 同上但无阴影（嵌套块、details） |
| `.pop-btn-primary` | 主按钮：黑底奶油字 + 硬阴影，按下位移 1px |
| `.pop-btn-secondary` | 次按钮：白底黑字 + 硬阴影 |
| `.pop-btn-danger` | 危险按钮：红底白字（批量删除等） |
| `.pop-link` | 朴素文字操作（下载/清空），hover 变深 |
| `.pop-chip` / `.pop-chip-on` | 胶囊选择：圆角全黑边，选中变奶油底 + 小硬阴影 |
| `.pop-toggle` / `.pop-toggle-on` | 小切换键（比例/分辨率/去背景），选中变黑底奶油字 |
| `.pop-chip-tag` / `-on` / `-muted` | 带 ✕ 的可删除预设 chip（含选中 / 忽略态） |
| `.pop-input` / `.pop-textarea` | 表单控件：2px 黑边，聚焦变奶油浅底 |
| `.pop-label` | 字段标题（粗体 ink-2） |
| `.pop-tag` / `.pop-tag-cream` | 角标小标签（mono 大写） |
| `.pop-topbar` | 顶栏：粘顶 + 毛玻璃 + 粗黑下边 |
| `.pop-callout` / `-err` / `-info` / `-ok` | 左侧粗色条提示块 |
| `.pop-empty` | 空状态：虚线奶色边 + 居中弱文字 |
| `.pop-spinner` | 加载转圈（奶色环 + 黑色顶） |

> Tailwind v4 限制：`@apply` **不能引用另一个自定义 component 类**（如 `@apply pop-btn`）。
> 新增变体时把基础 utility 直接展开重写，不要自引用，否则报 `unknown utility class`。

---

## 3. 共享 React 组件（`src/components/`）

| 组件 | 用途 |
|---|---|
| `ToolHeader` | 工具页统一顶栏：返回箭头 icon（标题左侧并排）+ 标题 + 副标题 + 右侧 `actions` 插槽。**所有工具页必须用它**，不要再手写 header。 |
| `ResultPanel` | 工具页右侧统一结果区：全屏高度虚线框，`sticky` 钉在视口（上下留固定安全间距 `top-6`/`h-[calc(100vh-3rem)]`），不随表单滚动；**无标题栏**，内容超出仅面板内部滚动。children 直接放结果。**所有生成类工具页右侧必须用它**。 |
| `Lightbox` | 全屏看大图浮层。传 `url`（null 不渲染）+ `onClose`。替代各页重复的 lightbox。 |
| `PopopMascot` | 品牌图形。`variant="mascot"` 仅吉祥物（默认）/ `"logo"` 完整 logo，`size` 控高。图源 `public/popop-mascot.png`、`popop-logo.png`。 |
| `icons` | 共享线性 icon：`IconDownload`（下载）、`IconSave`（存入图库）。结果项操作统一用 icon，不用文字按钮。 |

---

## 4. 版式规范

- 页面根节点：`<div className="min-h-full">`，body 已是 `paper-2` 纸底，**不要再加 `bg-neutral-*`**。
- 顶栏：用 `ToolHeader`。首页用自带的 `.pop-topbar` 品牌栏。
- 主内容：`mx-auto max-w-6xl p-6 sm:p-8`；双栏工具用 `grid lg:grid-cols-2 gap-8`。
- 标题用 `font-display font-extrabold`；hint / 标签 / 读数用 `font-mono`。
- 间距阶梯：卡片内 `gap-4`，区块间 `gap-5`，主栏间 `gap-8`。

---

## 5. 新增工具的接入清单（照做即可统一）

1. 页面根 `<div className="min-h-full">`，开头放 `<ToolHeader title=… subtitle=… actions=… />`。
2. 左侧配置区：每组用 `.pop-card` 包裹，字段标题 `.pop-label`。
3. 选择类控件：多选用 `.pop-chip`，单选 / 小切换用 `.pop-toggle`，可删预设用 `.pop-chip-tag`。
4. 表单：`.pop-input` / `.pop-textarea`。
5. 操作按钮：主 `.pop-btn-primary`、次 `.pop-btn-secondary`、删除 `.pop-btn-danger`、轻量 `.pop-link`。
6. 结果区：右侧统一用 `<ResultPanel>`（全屏高度虚线框 + sticky 钉死 + 内部滚动，无标题栏）；有图直接展示，不套额外的尺寸框。结果卡片 `rounded-pop border-2 border-ink + shadow-sticker-sm`，底部信息条 `border-t-2 border-ink`。
7. **生成 / 提交按钮统一放在左侧表单最下方**，不要放进右侧结果区。
8. **下载 / 存图等操作统一用 icon**（`IconDownload`/`IconSave`），跟随在每张图上或图旁，不做独立大按钮。批量操作放结果区顶部一行轻量文字链接。
9. 多次生成累加排列、不互相覆盖（store 用 `items: [...new, ...old]`，不要整体替换）。
10. 空状态在 `ResultPanel` 内用居中弱文字，加载 `.pop-spinner`，错误 `.pop-callout-err`。
11. 看大图统一用 `<Lightbox>`。
12. 新工具在 `src/pages/HomePage.tsx` 的 `TOOLS` 数组登记（含 `tag` 角标），并在 `src/router.tsx` 注册路由。
13. 颜色只用 token（`bg-cream` / `text-ink-2` …），**禁止再引入 `neutral` 灰阶**。

---

## 6. 禁止事项

- ❌ 细灰边（`border-neutral-200`）、柔和阴影（`shadow-sm/md`）、neutral 灰底。
- ❌ 手写 lightbox / header（用共享组件）。
- ❌ `@apply` 里引用 `.pop-*` 组件类（Tailwind v4 不支持）。
- ❌ 用 emoji 替代品牌吉祥物或图标。
- ❌ 硬编码颜色十六进制值（除 sticker 棋盘格等纯装饰背景），一律走 token。
