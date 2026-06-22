# POPOP 生产链路工具站

面向产品内容生产链路的工具集合，做内容管线与可视化。

## 技术栈

React 19 + TypeScript + Vite 7 + Tailwind v4 + Zustand + react-router-dom 7。

## 工具二：氛围背景图生成器

Atmospheric Motion Background System v1.0。组合五层维度生成统一品牌语言的抽象氛围背景：

```
Background = Motion + Medium + Light + Color + Mood
```

- **Motion 运动**：Breeze / Flow / Wave / Orbit / Burst
- **Medium 介质**：Air / Cloud / Silk / Glass / Light
- **Light 光感**：Soft Bloom / Daylight / Pearl / Neon / Spotlight
- **Color 色彩**：Calm Mint / Dream Lavender / Ocean Blue / Sunset / Midnight
- **Mood 情绪**：Relaxed / Dreamy / Premium / Energetic / Nostalgic

每层选项携带一段英文 prompt 片段，叠加固定「品牌视觉底座」拼成最终 prompt，调用图像生成 API 出图。内置「放松慵懒 / 梦幻浪漫 / 科技高级 / Apple Intelligence 风格」推荐组合一键套用。

链路：

```
选 5 层 → [拼装] buildPrompt() = 品牌底座 + 各层片段 + 自定义词
  → BackgroundRecipe（selection + ratio + resolution）
  → [同源代理 /img-api] generateBackground() 转发 apimart
  → 返回图片 url / base64 → 预览 + 下载
```

### 密钥安全（重要）

图像生成 API key **绝不进前端 bundle**。前端只请求同源代理路径 `/img-api`，
由 vite dev server（开发）按 `proxyReq` 注入 `Authorization` 头转发到 apimart。

本地运行前，复制 `.env.example` 为 `.env` 并填入密钥：

```bash
cp .env.example .env
# 编辑 .env，填 IMAGE_API_KEY
```

`.env` 已在 `.gitignore` 中，不会被提交。生产环境需自行用反向代理（Nginx/网关）
对 `/img-api` 注入同样的鉴权头，不要把 key 暴露到浏览器。

### 目录

```
src/
├── types/background.ts              契约：五层 id / Selection / Recipe
├── data/backgroundOptions.ts        品牌底座 + 五层选项 + 推荐组合
├── services/
│   ├── promptBuilder.ts             拼装最终 prompt
│   └── imageClient.ts               调用图像生成 API（走 /img-api 代理）
├── features/background/
│   ├── store.ts                     Zustand 状态（含请求取消防竞态）
│   ├── LayerPicker.tsx              单层选项卡片
│   ├── PresetPicker.tsx            推荐组合
│   └── downloadImage.ts            跨域图片下载
└── pages/BackgroundPage.tsx        页面组装
```

## 工具一：文字自动化排版

输入文字（≤500 字），选特效并微调参数，产出 4:3（1080×810）文字排版图片。

排版采用「生成式视觉特效」范式：每种特效是一套 Canvas 2D 逐字绘制算法，
参数 + 随机种子决定具体形态（相同输入 + 相同种子 = 相同结果）。

已支持特效：

- **竖排雨落层次（rain）**：文字拆字成竖列从上飘落，虚实层次。
- **横排弹幕模式（barrage）**：文字横向成行围绕中轴散开。
- **泪水模糊（tearBlur）**：居中文字叠加径向模糊圆，局部晕开。
- **图片填充字（imageFill）**：上传形状图片，文字填满轮廓内部（需上传图片）。

> 算法范式参考自 [文字排版效果生成器 @shiemezz](https://shiemezz9.github.io/text-layout-generator/)。

链路设计：

```
输入文字(≤500字)
  → [结构抽取] extractLayout()  现为本地 mock 规则，按文字特征推荐特效，不调用模型生产内容
  → LayoutRecipe（稳定契约：mode + params）
  → [Canvas 渲染] renderLayout() 分派到对应特效算法
  → 导出 PNG（1080×810，导出按 2x 重绘保清晰）
```

### 关键约定

- `LayoutRecipe`（`src/types/layout.ts`）是整条链路的稳定契约。后端模型接入后，
  只需把 `src/services/layoutExtractor.ts` 里的 `USE_BACKEND` 置 `true` 并实现
  `extractRecipeFromBackend`，调用方与渲染层不变。
- 特效预设是纯数据（`src/data/effectPresets.ts`），新增特效需：① 加 `EffectMode`
  与预设；② 在 `src/features/text-layout/effects/` 下实现一个 `draw` 函数；
  ③ 在 `renderer.ts` 注册分派。
- 所有特效尺寸基于 1080×810 画布，导出时由 `RenderContext.scale` 统一放大。

### 目录

```
src/
├── types/        layout.ts（契约：EffectMode / EffectParams / LayoutRecipe）
├── services/     apiClient.ts / layoutExtractor.ts（抽取，mock + 后端占位）
├── data/         effectPresets.ts（各特效元信息 + 默认参数）
├── features/text-layout/
│   ├── effects/  shared.ts / rain / barrage / tearBlur / imageFill（绘制算法）
│   ├── renderer.ts        渲染调度
│   ├── LayoutCanvas.tsx   Canvas 组件（含高清导出）
│   ├── ModePicker.tsx     特效选择
│   ├── ParamControls.tsx  参数微调
│   ├── exportImage.ts     下载
│   └── store.ts           Zustand 状态
├── pages/        HomePage（工具列表）/ TextLayoutPage（排版工具）
└── router.tsx
```

## 本地运行

```bash
pnpm install
pnpm dev      # http://localhost:5180
pnpm build    # 类型检查 + 构建
```

## 后续

- 接入后端结构抽取（替换 mock 的 `recommendMode`）
- 整合用户提供的更多文字排版模板/特效到 `effects/` + `effectPresets.ts`
- 后端基于输入文字 + 格式规则产出文字图片
