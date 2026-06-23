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

## 6. 压缩（已查证：aigc `/api/v1/image/compress`）

压缩走 aigc 服务的图片压缩接口。该接口**仅供 arca 后端调用，不面向前端、不鉴权**，
因此前端不能直连，必须由 arca 转发（与图库接口同样走 arca）。

来源：飞书「aigc-i18n 接口文档」§6.2（已通过 lark-cli 读取核对）。

- 方法：`POST /api/v1/image/compress`（JSON）
- 入参（`image_url` 与 `image_base64` 二选一）：
  - `image_url` string — 图片公网 URL
  - `image_base64` string — base64 数据
  - `quality` integer — 压缩质量 1-100，默认 100
  - `format` string — 输出格式，默认 `webp`
  - `max_size` integer — 最大文件字节数，默认 4MB（4194304）
- 返回：`{ code, msg, data: { image_url } }`
  - `image_url` 是**压缩后上传 TOS 的永久 URL**（非临时直链，不会 24h 过期）

**重要影响：**
- 压缩接口落 **TOS（火山引擎）**，不是本方案早先设想的阿里云 OSS。说明后端图片基建当前是 TOS。
- 这一步同时解决了「永久化」：apimart 出图是 ~24h 临时直链，经 `compress` 后得到的是 TOS 永久 URL。
- 因此存储链路可简化为：**apimart 临时直链 → arca 转发 compress → 拿 TOS 永久 URL → 存图库元数据**。
  不再需要前端拿 OSS 临时凭证直传（除非后端明确要求走 OSS 而非 TOS）。

**待与后端确认：**
- [ ] arca 是否已有（或愿意新增）转发到 aigc `/api/v1/image/compress` 的对外接口？路径/字段？
- [ ] 最终落 TOS 还是迁 OSS（`bucket-popop-i18n-prod` 的 `moodpic/`）？两者读图签名方式不同。
- [ ] compress 接口接受 `image_url`，apimart 直链是否公网可达（能被 aigc 拉取）？

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

## 9. 给后端的问题清单（待确认，请逐条回复）

> 背景：popop-tool 是独立工具站，需要把视觉资产引擎生成的图做**压缩 + 永久存储 + 图库（列表/批量删除）**，
> 提示词与配置也要永久存。已读 aigc「aigc-i18n 接口文档」§6.2 压缩接口与 arca `arca.api` 现有契约。

**Q1 压缩接口的对外通道**
aigc `/api/v1/image/compress` 是内部接口（仅 arca 可调）。arca 是否已有/能否新增一个对外接口转发它？
前端要传 `image_url`(apimart 临时直链) → 拿回压缩后的永久 URL。请给路径与字段。

**Q2 最终落 TOS 还是 OSS**
compress 文档写的是落 **TOS**；但产品侧给的是阿里云 **OSS**（`bucket-popop-i18n-prod` 的 `moodpic/`）。
最终以哪个为准？这决定读图签名方式（TOS vs OSS/CDN）。

**Q3 通用图库接口**
arca 现有契约没有「保存任意生成图+提示词、分页列表、批量删除」的通用接口
（`get/del_generation_temp_asset` 强绑角色场景，emoji/post 都不通用）。
能否新增本文件 §4 描述的三个接口（save / list / batch_delete）？字段命名你们定，定稿后更新 `arca.api`。

**Q4 apimart 直链可达性**
compress 接受 `image_url`，apimart 出图直链是否能被 aigc 服务端公网拉取？
若不可达，则前端需改传 `image_base64`（compress 也支持）。

**Q5 鉴权**
工具站走 arca 的话，沿用 JWT（`Authorization: Bearer`）即可？工具站的用户身份/token 怎么发？

---

## 10. 给后端的一句话（旧版，待 Q1-Q5 确认后作废或更新）

> popop-tool 需要：①一个能转发 aigc `/api/v1/image/compress` 的 arca 对外接口；
> ②一组通用图库接口（保存 / 分页列表 / 批量删除）；③明确最终落 TOS 还是 OSS。
> 字段命名你们定，定稿后更新 `arca.api`，前端按契约对齐。
