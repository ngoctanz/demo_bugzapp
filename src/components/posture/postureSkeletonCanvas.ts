import type { ThreeTierPostureOutput } from '../../lib/frontPostureEngine';

function drawCleanLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeColor: string,
  width = 1.8,
  alpha = 0.85
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawCleanNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  borderColor: string,
  radius = 4.0,
  hasOuterRing = false
) {
  ctx.save();
  if (hasOuterRing) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export interface HudCanvasRenderTarget {
  canvasEl: HTMLCanvasElement | null;
  videoEl: HTMLVideoElement | null;
  activeHostEl: HTMLDivElement | null;
  viewVisible: boolean;
  showSkeletonHud: boolean;
  mirrorMode: boolean;
}

export function drawBiomechanicalHudCanvas(
  target: HudCanvasRenderTarget,
  pts: Array<{ x: number; y: number; visibility: number }>,
  tierOut: ThreeTierPostureOutput
) {
  const { canvasEl: cvs, videoEl: vid, activeHostEl: host } = target;
  if (!cvs || !vid || !host || !target.viewVisible || !target.showSkeletonHud) {
    return;
  }

  const cw = host.clientWidth || 640;
  const ch = host.clientHeight || 360;
  if (cvs.width !== cw || cvs.height !== ch) {
    cvs.width = cw;
    cvs.height = ch;
  }

  const ctx = cvs.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, cw, ch);

  const vw = vid.videoWidth || 640;
  const vh = vid.videoHeight || 360;
  const scale = Math.min(cw / vw, ch / vh);
  const drawW = vw * scale;
  const drawH = vh * scale;
  const offX = (cw - drawW) * 0.5;
  const offY = (ch - drawH) * 0.5;
  const mirror = target.mirrorMode;

  const toX = (nx: number) => offX + (mirror ? 1.0 - nx : nx) * drawW;
  const toY = (ny: number) => offY + ny * drawH;

  // Tông màu dịu mắt, tối giản (không dùng neon chói):
  // - Ngồi chuẩn: Xanh lam nhạt dịu mắt (#93c5fd)
  // - Lưu ý nhẹ: Vàng kem dịu (#fcd34d)
  // - Ngồi sai: Đỏ san hô dịu (#fca5a5)
  const lineColor =
    tierOut.status === 'GOOD'
      ? '#93c5fd'
      : tierOut.status === 'WARNING'
        ? '#fcd34d'
        : '#fca5a5';
  const nodeBorderColor =
    tierOut.status === 'GOOD'
      ? '#3b82f6'
      : tierOut.status === 'WARNING'
        ? '#d97706'
        : '#e11d48';

  // 1. Vẽ 4 góc khung ngắm mảnh, dịu mắt
  const marginX = 28;
  const topY = 68;
  const botY = ch - 28;
  const arm = 20;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  if (cw > 240 && botY - topY > 120) {
    ctx.beginPath();
    ctx.moveTo(marginX, topY + arm);
    ctx.lineTo(marginX, topY);
    ctx.lineTo(marginX + arm, topY);

    ctx.moveTo(cw - marginX - arm, topY);
    ctx.lineTo(cw - marginX, topY);
    ctx.lineTo(cw - marginX, topY + arm);

    ctx.moveTo(marginX, botY - arm);
    ctx.lineTo(marginX, botY);
    ctx.lineTo(marginX + arm, botY);

    ctx.moveTo(cw - marginX - arm, botY);
    ctx.lineTo(cw - marginX, botY);
    ctx.lineTo(cw - marginX, botY - arm);
    ctx.stroke();
  }
  ctx.restore();

  const nose = { x: toX(pts[0].x), y: toY(pts[0].y), v: pts[0].visibility };
  // Tâm con ngươi từng mắt: kết hợp điểm mắt trong (1, 4) và điểm giữa mắt (2, 5)
  // (Không dùng điểm đuôi mắt 3, 6 và hệ số 0.64x vốn đẩy 2 chấm lệch hẳn ra ngoài thái dương)
  const lEyeInner = pts[1] || pts[2];
  const rEyeInner = pts[4] || pts[5];
  const lPupilRaw = {
    x: toX(lEyeInner.x * 0.38 + pts[2].x * 0.62),
    y: toY(lEyeInner.y * 0.38 + pts[2].y * 0.62),
  };
  const rPupilRaw = {
    x: toX(rEyeInner.x * 0.38 + pts[5].x * 0.62),
    y: toY(rEyeInner.y * 0.38 + pts[5].y * 0.62),
  };

  const lSh = { x: toX(pts[11].x), y: toY(pts[11].y), v: pts[11].visibility };
  const rSh = { x: toX(pts[12].x), y: toY(pts[12].y), v: pts[12].visibility };
  const lElb = { x: toX(pts[13].x), y: toY(pts[13].y), v: pts[13].visibility };
  const rElb = { x: toX(pts[14].x), y: toY(pts[14].y), v: pts[14].visibility };

  // Tâm giữa hai mắt (nằm đúng giữa sống mũi ngang tầm hai con ngươi)
  const midBrow = {
    x: (lPupilRaw.x + rPupilRaw.x) * 0.5,
    y: (lPupilRaw.y + rPupilRaw.y) * 0.5,
  };

  // Khử nhiễu lệch cao độ giả của BlazePose khi 1 bên mặt bị tối (giữ 2 chấm nằm đúng tâm 2 mắt):
  // - Khi đầu thẳng (góc lệch < ~6.5°), làm phẳng nhẹ trục dọc Y để 2 chấm bám chuẩn vào 2 con ngươi
  // - Khi nghiêng đầu thật sự, thanh ngang vẫn nghiêng mượt theo mắt
  const halfEyeDx = (rPupilRaw.x - lPupilRaw.x) * 0.5;
  const rawHalfEyeDy = (rPupilRaw.y - lPupilRaw.y) * 0.5;
  const eyeSpanAbs = Math.max(Math.abs(halfEyeDx), 1.0);
  const tiltRatio = Math.abs(rawHalfEyeDy) / eyeSpanAbs;
  const dyGain = tiltRatio < 0.12 ? 0.22 : Math.min(0.85, 0.22 + (tiltRatio - 0.12) * 2.2);
  const halfEyeDy = rawHalfEyeDy * dyGain;

  const lTemple = {
    x: midBrow.x - halfEyeDx,
    y: midBrow.y - halfEyeDy,
  };
  const rTemple = {
    x: midBrow.x + halfEyeDx,
    y: midBrow.y + halfEyeDy,
  };

  const midSh = {
    x: (lSh.x + rSh.x) * 0.5,
    y: (lSh.y + rSh.y) * 0.5,
  };
  const spineDx = midSh.x - midBrow.x;
  const spineDy = Math.max(40, midSh.y - midBrow.y);
  const lowerTorso = {
    x: midSh.x + spineDx * 0.45,
    y: midSh.y + spineDy * 0.65,
  };

  // Điểm mũi chiếu thẳng lên trục dọc đầu-cổ để đường trục không bị gấp khúc lệch sang bên
  const noseT = Math.max(0.15, Math.min(0.65, (nose.y - midBrow.y) / spineDy));
  const alignedNose = {
    x: midBrow.x + spineDx * noseT,
    y: nose.y,
  };

  // 2. Đường chuẩn dọc mờ (nét đứt nhẹ làm mốc đối chiếu)
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(midSh.x, midBrow.y - 16);
  ctx.lineTo(midSh.x, lowerTorso.y);
  ctx.stroke();
  ctx.restore();

  // 3. Các trục khung xương chính gọn gàng, cân đối
  drawCleanLine(ctx, lTemple.x, lTemple.y, rTemple.x, rTemple.y, lineColor, 1.6, 0.85);
  drawCleanLine(ctx, midBrow.x, midBrow.y, midSh.x, midSh.y, lineColor, 1.8, 0.88);
  drawCleanLine(ctx, midSh.x, midSh.y, lowerTorso.x, lowerTorso.y, lineColor, 1.6, 0.65);
  drawCleanLine(ctx, lSh.x, lSh.y, rSh.x, rSh.y, lineColor, 2.0, 0.9);

  const lArmEnd =
    lElb.v > 0.25
      ? lElb
      : {
          x: lSh.x + (lSh.x < rSh.x ? -24 : 24),
          y: lSh.y + spineDy * 0.65,
        };
  const rArmEnd =
    rElb.v > 0.25
      ? rElb
      : {
          x: rSh.x + (lSh.x < rSh.x ? 24 : -24),
          y: rSh.y + spineDy * 0.65,
        };
  drawCleanLine(ctx, lSh.x, lSh.y, lArmEnd.x, lArmEnd.y, lineColor, 1.6, 0.65);
  drawCleanLine(ctx, rSh.x, rSh.y, rArmEnd.x, rArmEnd.y, lineColor, 1.6, 0.65);

  // 4. Các điểm khớp tròn phẳng, dịu mắt (không chói)
  drawCleanNode(ctx, lTemple.x, lTemple.y, nodeBorderColor, 3.2, false);
  drawCleanNode(ctx, midBrow.x, midBrow.y, nodeBorderColor, 3.5, false);
  drawCleanNode(ctx, rTemple.x, rTemple.y, nodeBorderColor, 3.2, false);
  drawCleanNode(ctx, alignedNose.x, alignedNose.y, nodeBorderColor, 3.5, false);

  drawCleanNode(ctx, lSh.x, lSh.y, nodeBorderColor, 4.5, true);
  drawCleanNode(ctx, midSh.x, midSh.y, nodeBorderColor, 3.8, false);
  drawCleanNode(ctx, rSh.x, rSh.y, nodeBorderColor, 4.5, true);
}
