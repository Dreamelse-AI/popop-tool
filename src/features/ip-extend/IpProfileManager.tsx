/**
 * IP 档案管理器：选择/新建/删除 IP 档案，并为当前档案上传形象图 + 表情包参考图。
 *
 * 档案持久化在本地（ipLibraryStore），图片永久落 OSS，跨会话可反复选用同一 IP 延展。
 */

import { useState } from 'react';
import { useIpLibraryStore } from './ipLibraryStore';
import { IpAssetUploader } from './IpAssetUploader';

export function IpProfileManager() {
  const profiles = useIpLibraryStore((s) => s.profiles);
  const currentId = useIpLibraryStore((s) => s.currentId);
  const createProfile = useIpLibraryStore((s) => s.createProfile);
  const removeProfile = useIpLibraryStore((s) => s.removeProfile);
  const selectProfile = useIpLibraryStore((s) => s.selectProfile);
  const renameProfile = useIpLibraryStore((s) => s.renameProfile);
  const addImages = useIpLibraryStore((s) => s.addImages);
  const removeImage = useIpLibraryStore((s) => s.removeImage);

  const current = profiles.find((p) => p.id === currentId) ?? null;

  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    createProfile(newName);
    setNewName('');
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`删除 IP 档案「${name}」？（当前未接存储，删除后需重新上传）`)) {
      removeProfile(id);
    }
  };

  return (
    <div className="pop-card flex flex-col gap-4">
      <div>
        <div className="pop-label mb-1.5">
          IP 档案
          <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">
            选一个 IP 来延展，或新建一个
          </span>
        </div>

        {profiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {profiles.map((p) => (
              <div key={p.id} className="group relative">
                <button
                  type="button"
                  onClick={() => selectProfile(p.id)}
                  className={p.id === currentId ? 'pop-chip-on' : 'pop-chip'}
                  title={`${p.name}（${p.characterImages.length + p.stickerImages.length} 张素材）`}
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id, p.name)}
                  aria-label={`删除 ${p.name}`}
                  className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full border border-cream bg-ink text-[10px] text-cream group-hover:flex"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder="新 IP 名称，如「波波」"
            className="pop-input flex-1"
          />
          <button type="button" onClick={handleCreate} className="pop-btn-secondary shrink-0">
            新建
          </button>
        </div>
      </div>

      {current ? (
        <div className="flex flex-col gap-4 border-t-2 border-dashed border-cream-2 pt-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={current.name}
              onChange={(e) => renameProfile(current.id, e.target.value)}
              className="pop-input flex-1 font-semibold"
              aria-label="IP 名称"
            />
          </div>
          <IpAssetUploader
            label="IP 形象图"
            hint="主参考，决定角色长相（必填，可多张）"
            role="character"
            images={current.characterImages}
            onAdd={(imgs) => addImages(current.id, imgs)}
            onRemove={(url) => removeImage(current.id, url)}
          />
          <IpAssetUploader
            label="表情包参考图"
            hint="约束风格/表情基底（可选，可多张）"
            role="sticker"
            images={current.stickerImages}
            onAdd={(imgs) => addImages(current.id, imgs)}
            onRemove={(url) => removeImage(current.id, url)}
          />
        </div>
      ) : (
        <p className="text-xs text-ink-3">还没有选中 IP。新建一个并上传形象图后即可开始延展。</p>
      )}
    </div>
  );
}
