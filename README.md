# POPOP 生产链路工具站

面向产品内容生产链路的工具集合，做内容管线与可视化。

## 技术栈

React 19 + TypeScript + Vite 7 + Tailwind v4 + Zustand + react-router-dom 7。

## 工具一：文字自动化排版

输入文字（≤500 字），抽取排版结构并套用模板，产出 3:4（1080×1440）纯文字排版图片。

链路设计：

```
输入文字(≤500字)
  → [结构抽取] extractLayout()  现为本地 mock 规则，不调用模型生产内容
  → LayoutSchema（稳定契约：blocks + 推荐模板）
  → [模板渲染] LayoutCanvas + TemplateDefinition
  → 导出 PNG（1080×1440）
```

### 关键约定

- `LayoutSchema`（`src/types/layout.ts`）是整条链路的稳定契约。后端模型接入后，
  只需把 `src/services/layoutExtractor.ts` 里的 `USE_BACKEND` 置 `true` 并实现
  `extractLayoutFromBackend`，调用方与渲染层不变。
- 模板是纯数据（`src/types/template.ts` + `src/data/templates.ts`），样式数值基于
  1080×1440 设计画布，渲染时整体缩放。追加模板不动渲染引擎。

### 目录

```
src/
├── types/        layout.ts（契约）/ template.ts（模板定义）
├── services/     apiClient.ts / layoutExtractor.ts（抽取，mock + 后端占位）
├── data/         templates.ts（内置模板）
├── features/text-layout/  LayoutCanvas / TemplatePicker / store / exportImage
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

- 接入后端结构抽取（替换 mock）
- 整合用户提供的文字排版模板到 `src/data/templates.ts`
- 后端基于输入文字 + 格式规则产出文字图片
