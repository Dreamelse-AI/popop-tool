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
  → BackgroundRecipe（selection + size + resolution）
  → [同源代理 /apimart] generateBackground()
       → POST /apimart/v1/images/generations 提交任务拿 task_id
       → 轮询 GET /apimart/v1/tasks/{task_id} 直到 status=completed
  → result.images[0].url[0] 图片直链 → 预览 + 下载
```

> 生图走 **apimart** 的 `gpt-image-2` 模型，异步任务制（提交 + 轮询），单张通常耗时数十秒。
> `size` 传比例（`9:16` 等），`resolution` 传 `1k/2k/4k`。
> 接口规范见 [apimart 官方文档](https://docs.apimart.ai/cn/api-reference/images/gpt-image-2/generation)。

### 密钥安全（重要）

apimart API key **绝不进前端 bundle**。前端只请求同源代理路径 `/apimart`，
由 vite dev server（开发）按 `proxyReq` 注入 `Authorization` 头转发到 apimart。

本地运行前，复制 `.env.example` 为 `.env` 并填入密钥：

```bash
cp .env.example .env
# 编辑 .env，填 APIMART_API_KEY
```

`.env` 已在 `.gitignore` 中，不会被提交。若直连 apimart 不通，可在 `.env` 配
`UPSTREAM_PROXY` 走本机代理。生产环境需自行用反向代理对 `/apimart` 注入鉴权头。

### 目录

```
src/
├── types/background.ts              契约：五层 id / Selection / Recipe
├── data/backgroundOptions.ts        品牌底座 + 五层选项 + 推荐组合
├── services/
│   ├── promptBuilder.ts             拼装最终 prompt
│   └── imageClient.ts               apimart 异步任务制调用（走 /apimart 代理）
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
pnpm build    # 类型检查 + 构建（前端）
```

开发期生图走 vite dev server 的 `/apimart` 代理（见 `vite.config.ts`）。
若本机直连 apimart 不通，在 `.env` 配 `UPSTREAM_PROXY` 走本机科学上网代理。

## 部署（生产）

生产环境没有 vite dev server，改由一个轻量 **Express 服务端**（`server/`）单进程同时：
托管前端静态产物、代理 `/apimart` 并注入 key、提供 `/health`。

```bash
pnpm run build:all   # 构建前端(dist/) + 服务端(dist/server/index.mjs)
pnpm start           # node dist/server/index.mjs，监听 PORT（默认 3000）
```

容器化与 K8s（参考 dreamboys 同款 BytePlus CR + VKE）：

- `Dockerfile`：多阶段构建，最终 `node dist/server/index.mjs`
- `k8s/`：`deployment / service / configmap / hpa / kustomization`（`ingress` 与
  `secret.example` 不纳入 kustomize，分别由集群侧基础设施与命令行管理）
- `.github/workflows/deploy.yml`：push main → 质检 → 构建推镜像 → `kubectl apply -k k8s/`

**密钥安全**：`APIMART_API_KEY` 是运行时 K8s Secret，绝不进镜像、不进前端 bundle。
创建 Secret：

```bash
kubectl -n fast-projects create secret generic popop-tool-secrets \
  --from-literal=APIMART_API_KEY='sk-xxxxx'
```

> 注：popop-tool 在能直连 apimart 的服务器上运行，无需 `UPSTREAM_PROXY`。
> 本机连不上 apimart 不影响生产 —— 这正是部署上线要解决的问题。

### 服务端目录

```
server/
├── index.ts         Express 入口：静态托管 + /health + 挂载代理
└── apimartProxy.ts  /apimart 反向代理（运行时注入 Authorization）
```

## 后续

- 接入后端结构抽取（替换 mock 的 `recommendMode`）
- 整合用户提供的更多文字排版模板/特效到 `effects/` + `effectPresets.ts`
- 后端基于输入文字 + 格式规则产出文字图片
