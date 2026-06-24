/**
 * MoodPic 写链路路由：POST /api/moodpic/upload
 *
 * 入参（JSON）：{ imageUrl, prompt, configJson, ratio, resolution }
 * 流程：
 *   1. 拉 apimart 临时直链字节 → 传 OSS（moodpic/<uuid>.<ext>）
 *   2. 调 arca POST /moodpic/save 登记元数据（image TOSObject + prompt + config_json + ...）
 *   3. 返回 { assetId, objectKey, url }
 *
 * 降级：未配 OSS key 时返回 { skipped: true }，前端据此回退本地暂存，不阻断主流程。
 * 与框架解耦（纯 async 函数），Express 与 vite dev 中间件都复用。
 */

import { readOssConfig, fetchAndUpload } from './ossUploader';

const ARCA_ORIGIN = process.env.ARCA_ORIGIN ?? 'https://i18n-api.imaginewithu.com';

export interface UploadRequestBody {
  imageUrl: string;
  prompt: string;
  /** 结构化配置序列化（前端已 JSON.stringify） */
  configJson: string;
  ratio: string;
  resolution: string;
}

export interface UploadResult {
  /** 未配 OSS 时为 true，前端回退本地暂存 */
  skipped?: boolean;
  assetId?: string;
  objectKey?: string;
  url?: string;
}

/** 调 arca /moodpic/save 登记，返回 asset_id。 */
async function saveToArca(body: {
  bucketName: string;
  objectKey: string;
  url: string;
  prompt: string;
  configJson: string;
  ratio: string;
  resolution: string;
}): Promise<string> {
  const payload = {
    image: {
      bucket_name: body.bucketName,
      object_key: body.objectKey,
      object_type: 'image',
      url: body.url,
    },
    prompt: body.prompt,
    config_json: body.configJson,
    ratio: body.ratio,
    resolution: body.resolution,
  };
  const resp = await fetch(`${ARCA_ORIGIN}/moodpic/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    throw new Error(`arca 登记失败（${resp.status}）`);
  }
  const json = (await resp.json()) as { code: number; msg: string; data?: { asset_id?: string } };
  if (json.code !== 0) {
    throw new Error(json.msg || `arca 登记业务错误（code=${json.code}）`);
  }
  return json.data?.asset_id ?? '';
}

/** 核心处理：拉图传 OSS + 登记 arca。配置缺失返回 skipped。 */
export async function handleUpload(input: UploadRequestBody): Promise<UploadResult> {
  if (!input?.imageUrl) {
    throw new Error('缺少 imageUrl');
  }
  const cfg = readOssConfig();
  if (!cfg) {
    return { skipped: true };
  }

  const uploaded = await fetchAndUpload(cfg, input.imageUrl);
  const assetId = await saveToArca({
    bucketName: uploaded.bucketName,
    objectKey: uploaded.objectKey,
    url: uploaded.url,
    prompt: input.prompt ?? '',
    configJson: input.configJson ?? '',
    ratio: input.ratio ?? '',
    resolution: input.resolution ?? '',
  });

  return { assetId, objectKey: uploaded.objectKey, url: uploaded.url };
}
