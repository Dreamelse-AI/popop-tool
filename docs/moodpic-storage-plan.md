# MoodPic 存储链路方案 + 后端接口需求清单

> 面向 popop-tool「视觉资产生产引擎」的生成图持久化需求。
> 决策前提（已与需求方确认）：
> - **后端走 arca**（推动后端在 `common_idl-i18n` 契约新增图库接口）。
> - **存储走阿里云 OSS**（后端 TOS 后续也会迁 OSS）。
> - 前端是 arca 契约的消费者，**不改契约**；本文件是「给后端的需求」，最终字段以后端落定的 `arca.api` 为准。

---

## 1. 名词与目标

把「视觉资产引擎」每次生成的图，从临时直链转为永久存储，并支持：

- 出图后**存档**：图片落 OSS + 元数据（提示词 / 结构化配置 / 比例 / 分辨率 / 时间）落库
- **列表**：分页查看历史生成
- **批量删除**：同时删 OSS 对象与库记录
- 提示词**永久存储**（不再只存浏览器本地）

为什么必须转存：apimart 出图返回的是**临时直链**，会过期；不落库后续就打不开。

---

## 2. 存储位置（OSS）

| 项 | 值 |
|---|---|
| Bucket | `bucket-popop-i18n-prod` |
| 访问域名 | `bucket-popop-i18n-prod.oss-ap-northeast-1.aliyuncs.com` |
| 目录前缀 | `moodpic/`（本工具专用，需求方已建） |
| Region | `ap-northeast-1` |

> OSS AccessKey / SecretKey **只在后端**（K8s Secret），绝不进前端 bundle。
> 前端只通过 arca 临时凭证或后端代理接触存储。

---

## 3. 端到端链路

```
前端：视觉资产引擎出图（apimart gpt-image-2）
   └─ 得到 apimart 临时直链（有时效）
        │
        ▼
   [压缩]  ← 走飞书文档约定的后端压缩接口（参数待补：见 §6）
        │
        ▼
   [上传 OSS]  moodpic/{uuid}.{ext}
        │       上传方式见 §5（前端拿临时凭证直传 / 或后端代传）
        ▼
   [保存元数据]  调 arca 图库保存接口（§4.1）
        │
        ▼
   完成：列表可见、可删
```

---

## 4. 需要后端在 arca 契约新增的接口（需求，非最终契约）

约束：JWT 鉴权（`Authorization: Bearer <jwt>`）、字段 **snake_case**、统一 `{code,msg,data}`、`code=0` 成功。
可复用契约已有的 `TOSObject`（`bucket_name` / `object_key` / `object_type` / `url`）。
路径与字段名后端可调整，下面是语义需求。

### 4.1 保存一条图库资产 `POST /moodpic/save`

请求：

| 字段 | 类型 | 说明 |
|---|---|---|
| `image` | TOSObject | 已上传到 OSS 的对象信息（bucket/object_key/url） |
| `prompt` | string | 扩写后实际送去出图的 prompt |
| `config_json` | string | 结构化配置序列化（emotion/subject/type/dna/style） |
| `ratio` | string | 比例，如 `9:16` |
| `resolution` | string | 分辨率，如 `2k` |

响应：`{ asset_id: string }`

### 4.2 分页列出图库 `POST /moodpic/list`

请求：`{ page: int, page_size: int }`
响应：

```
{
  items: [{
    asset_id, image (TOSObject), prompt, config_json,
    ratio, resolution, created_at
  }],
  total: int
}
```

### 4.3 批量删除 `POST /moodpic/batch_delete`

请求：`{ asset_ids: string[] }`
响应：空（后端同时删 OSS 对象 + 库记录）

### 4.4 OSS 临时上传凭证（复用现有）

现有契约：`POST /file/tos_credential` → 返回临时 AK/SK/SessionToken + bucket/region/endpoint。
**需求**：后端迁 OSS 后，让该接口（或新增等价接口）返回**阿里云 OSS** 的临时 STS 凭证，指向 `bucket-popop-i18n-prod`，并允许写 `moodpic/` 前缀。

> 需求方 OSS 配置中已具备：`RoleTrn`（STS AssumeRole）、`TempCredentialExpire`、`PresignedURLExpire`，与「后端发临时凭证、前端直传」模式吻合。

---

## 5. 上传方式（已确认：前端拿临时凭证直传）

1. 前端调 `/file/tos_credential`（迁 OSS 后）拿临时 STS 凭证
2. 前端用 OSS SDK（`ali-oss`，走 STS 临时凭证，**不接触长期密钥**）把压缩后的图直传 `moodpic/{uuid}.{ext}`
3. 直传成功后，用返回的 `object_key` / `url` 调 `/moodpic/save` 落元数据

> 安全：前端只持有**临时**、**最小权限**（限 `moodpic/` 写）的 STS 凭证，过期即失效。长期 AccessKey/SecretKey 只在后端。

---

## 6. 压缩（待补）

压缩走飞书文档约定的**后端压缩接口**。该文档当前抓取受限（需登录），待通过飞书 MCP 读取后补全：

- [ ] 压缩接口路径 / 入参 / 出参
- [ ] 目标格式（webp / jpeg）、质量、长边上限
- [ ] 压缩发生在「上传 OSS 之前」还是「OSS 触发器」

补全后回填本节并接入 §3 链路。

---

## 7. 读图访问

桶为私有，前端 `<img>` 不能直接访问。需求方已配 CDN：

- CDN 域名：`https://cdn-prod-i18n-private.popop.ai`
- 带签名（TypeA，`PrimaryKey`），`PresignedURLExpire` 最长 7 天

**需求**：`/moodpic/list` 返回的 `image.url` 直接给**可访问的 CDN 签名 URL**（后端签好），前端拿到即可渲染，避免前端再签名。

---

## 8. 前端侧改造（popop-tool，本仓库可先做的部分）

- 出图成功后调存档链路（§3）：拿凭证 → 直传 OSS → `/moodpic/save`
- 视觉资产页结果区接「图库」视图：调 `/moodpic/list` 分页展示
- 选择 + 批量删除：调 `/moodpic/batch_delete`
- 提示词改为从图库读取（永久），本地仅作草稿缓存

接入 arca 调用统一走仓库的 `arcaPost/arcaGet` 封装（若本仓库尚无，则按 arca-integration 规范新建一份，域名走 `ARCA_ORIGIN` 环境变量，生产 `/arca` 反代）。

---

## 9. 给后端的一句话

> popop-tool 需要一组「通用图库」接口（保存 / 分页列表 / 批量删除）+ 把 `/file/tos_credential` 迁成返回阿里云 OSS（`bucket-popop-i18n-prod`，限 `moodpic/` 前缀）的临时 STS 凭证；列表返回的 url 请给 CDN 签名直链。字段命名你们定，定稿后更新 `arca.api`，我这边按契约对齐。
