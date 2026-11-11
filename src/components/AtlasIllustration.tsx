import React from 'react';
import { ILLUSTRATION_MANIFEST, type IllustrationId } from '../domain/p05GameEngine';

interface AtlasIllustrationProps {
  illustrationId: IllustrationId;
  className?: string;
  showCaption?: boolean;
}

const POSITION_CLASS_MAP: Record<IllustrationId, string> = {
  POSTURE: 'bg-[position:0%_0%]',
  DESK: 'bg-[position:100%_0%]',
  EYES: 'bg-[position:0%_100%]',
  MOVE: 'bg-[position:100%_100%]',
};

const SCENE_LABEL_MAP: Record<IllustrationId, string> = {
  POSTURE: 'Cảnh Atlas 1/4 (POSTURE · Ô trên trái): Tư thế ngồi đọc ở bàn học',
  DESK: 'Cảnh Atlas 2/4 (DESK · Ô trên phải): Bàn ghế, kê chân và đèn học',
  EYES: 'Cảnh Atlas 3/4 (EYES · Ô dưới trái): Nghỉ nhìn gần bên cửa sổ có cây xanh ở xa',
  MOVE: 'Cảnh Atlas 4/4 (MOVE · Ô dưới phải): Đứng dậy nghỉ vận động nhẹ',
};

/**
 * Hiển thị đúng 1 trong 4 ô cảnh của ảnh `assets/bugz_learning_atlas.png` (1254×1254 px, lưới 2×2)
 * theo đúng hợp đồng `illustration_manifest.json` (`background-size: 200% 200%`, `aspect-ratio: 1 / 1`).
 * Hình minh họa chỉ dẫn chuyện cho câu hỏi trò chơi; tuyệt đối không thay ảnh flashcard 28 ngày gốc
 * và không dùng tọa độ ảnh AI để đo góc hay khoảng cách cm.
 */
export const AtlasIllustration: React.FC<AtlasIllustrationProps> = ({
  illustrationId,
  className = '',
  showCaption = true,
}) => {
  const cell =
    ILLUSTRATION_MANIFEST.illustrations[illustrationId] ||
    ILLUSTRATION_MANIFEST.illustrations.POSTURE;
  const posClass = POSITION_CLASS_MAP[illustrationId] || POSITION_CLASS_MAP.POSTURE;

  return (
    <figure className={`space-y-2 ${className}`} data-testid={`atlas-figure-${illustrationId}`}>
      <div
        role="img"
        aria-label={cell.alt}
        data-testid={`atlas-cell-${illustrationId}`}
        data-illustration-id={illustrationId}
        data-bg-position={cell.background_position}
        className={`w-full aspect-square rounded-2xl border border-slate-200 bg-[url('/assets/bugz_learning_atlas.png')] bg-[length:200%_200%] bg-no-repeat shadow-xs ${posClass}`}
      />
      {showCaption && (
        <figcaption className="text-[11px] leading-relaxed text-slate-500">
          <span className="font-semibold text-slate-700">{SCENE_LABEL_MAP[illustrationId]}</span>
          <span aria-hidden="true"> · </span>
          <span>{cell.alt}</span>
          <span aria-hidden="true"> · </span>
          <span className="font-mono text-[10px] text-slate-400">
            Minh họa dẫn chuyện (không đo góc/cm từ ảnh)
          </span>
        </figcaption>
      )}
    </figure>
  );
};
