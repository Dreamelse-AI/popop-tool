/**
 * IP 档案库 store（会话内存，暂不持久化）。
 *
 * 一个 IP 档案 = 名称 + 一组素材图（IP 形象主图 + 表情包参考图，base64）。
 * 当前不接存储：图片只在内存里用于图生图参考，刷新即清空。后续接入 OSS/图库后，
 * 在此换成持久化实现（调上传 + 列表接口）即可，调用方接口不变。
 *
 * 当前选中的 IP（currentId）供延展 store 取参考图。
 */

import { create } from 'zustand';
import type { IpAssetImage, IpProfile } from '@/types/ipExtend';

interface IpLibraryState {
  profiles: IpProfile[];
  /** 当前选中的 IP 档案 id（用于延展）。 */
  currentId: string | null;

  /** 新建一个 IP 档案，返回新档案 id（名称为空则用默认名）。 */
  createProfile: (name: string) => string;
  /** 重命名档案。 */
  renameProfile: (id: string, name: string) => void;
  /** 删除档案（同时清理当前选中指向）。 */
  removeProfile: (id: string) => void;
  /** 选中某档案为当前 IP。 */
  selectProfile: (id: string) => void;
  /** 往档案追加素材图（按 role 分类）。 */
  addImages: (id: string, images: IpAssetImage[]) => void;
  /** 从档案移除某张素材图（按 url 匹配）。 */
  removeImage: (id: string, url: string) => void;
}

/** 生成稳定唯一 id。 */
function makeId(): string {
  return `ip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useIpLibraryStore = create<IpLibraryState>((set, get) => ({
  profiles: [],
  currentId: null,

  createProfile: (name) => {
    const id = makeId();
    const profile: IpProfile = {
      id,
      name: name.trim() || `未命名 IP ${get().profiles.length + 1}`,
      characterImages: [],
      stickerImages: [],
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ profiles: [profile, ...s.profiles], currentId: id }));
    return id;
  },

  renameProfile: (id, name) =>
    set((s) => ({
      profiles: s.profiles.map((p) =>
        p.id === id ? { ...p, name: name.trim() || p.name } : p,
      ),
    })),

  removeProfile: (id) =>
    set((s) => ({
      profiles: s.profiles.filter((p) => p.id !== id),
      currentId: s.currentId === id ? null : s.currentId,
    })),

  selectProfile: (id) => set({ currentId: id }),

  addImages: (id, images) =>
    set((s) => ({
      profiles: s.profiles.map((p) => {
        if (p.id !== id) return p;
        const character = [...p.characterImages];
        const sticker = [...p.stickerImages];
        for (const img of images) {
          if (img.role === 'character') character.push(img);
          else sticker.push(img);
        }
        return { ...p, characterImages: character, stickerImages: sticker };
      }),
    })),

  removeImage: (id, url) =>
    set((s) => ({
      profiles: s.profiles.map((p) =>
        p.id === id
          ? {
              ...p,
              characterImages: p.characterImages.filter((i) => i.url !== url),
              stickerImages: p.stickerImages.filter((i) => i.url !== url),
            }
          : p,
      ),
    })),
}));

/** 取当前选中的 IP 档案（无则 null）。 */
export function getCurrentProfile(state: IpLibraryState): IpProfile | null {
  if (!state.currentId) return null;
  return state.profiles.find((p) => p.id === state.currentId) ?? null;
}
