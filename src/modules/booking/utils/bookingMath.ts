/** 像素到米 — 对齐 OrderDialog.h PIXEL_TO_METER */
export const PIXEL_TO_METER = 0.01

const BIG_HEIGHT_THRESHOLD = 2.8
const SMALL_HEIGHT = 1.8
const BIG_HEIGHT = 3.0

export function vehicleTypeFromRadarHeight(height: number): 'small' | 'big' {
  return height > BIG_HEIGHT_THRESHOLD ? 'big' : 'small'
}

export function toggleVehicleHeight(current: number): number {
  return current > SMALL_HEIGHT ? SMALL_HEIGHT : BIG_HEIGHT
}

/** 取包络串第一个数值（支持 JSON / 逗号分隔）；失败为 0 */
function envelopeFirstNumber(envelopeStr: string): number {
  const s = (envelopeStr || '').trim()
  if (!s) return 0
  try {
    const obj = JSON.parse(s) as Record<string, unknown>
    for (const key of ['x', 'x1', 'left', 'center'] as const) {
      const val = obj[key]
      if (typeof val === 'number' && Number.isFinite(val)) return val
      if (typeof val === 'string') {
        const n = Number.parseFloat(val)
        if (!Number.isNaN(n)) return n
      }
    }
  } catch {
    /* 非 JSON */
  }
  const first = s.split(',')[0]?.trim() ?? ''
  const n = Number.parseFloat(first)
  return Number.isNaN(n) ? 0 : n
}

/** 解析 Image-Envelope 为竖线相对位置 0~1 */
export function parseImageEnvelope(envelopeStr: string, imageWidth: number): number | null {
  if (!envelopeStr?.trim() || imageWidth <= 0) return null

  try {
    const obj = JSON.parse(envelopeStr) as Record<string, unknown>
    for (const key of ['x', 'x1', 'left', 'center'] as const) {
      const val = obj[key]
      let n = NaN
      if (typeof val === 'number') n = val
      else if (typeof val === 'string') n = Number.parseFloat(val)
      if (!Number.isNaN(n) && n >= 0) {
        return Math.min(1, Math.max(0, n / imageWidth))
      }
    }
  } catch {
    /* 非 JSON */
  }

  const first = envelopeStr.split(',')[0]?.trim()
  const x = Number.parseFloat(first ?? '')
  if (!Number.isNaN(x) && x >= 0) {
    return Math.min(1, Math.max(0, x / imageWidth))
  }
  return null
}

export function distanceFromLinePosition(position: number, originalImageWidth: number): number {
  if (originalImageWidth <= 0) return 0
  return position * originalImageWidth * PIXEL_TO_METER
}

/**
 * 默认红线：有颜色/车头起点往后 defaultMeters（默认 1.5m）对应像素。
 * 返回相对位置 0~1；无法计算时返回 null。
 */
export function defaultLinePositionAfterOrigin(
  originPx: number,
  imageWidth: number,
  defaultMeters: number = 1.5,
): number | null {
  if (imageWidth <= 0) return null
  const px = Math.max(0, originPx) + defaultMeters / PIXEL_TO_METER
  return Math.min(1, Math.max(0, px / imageWidth))
}

/**
 * 车头长度 — 对齐 Qt 意图 + 1px=0.01m
 *
 * Qt 原文：
 *   realDistance = linePx * 0.01
 *   rDistance = realDistance - (vw - iw)
 * 其中 iw/vw 与包络同为像素坐标，直接减「米」单位不一致。
 *
 * 正确物理量（与 PIXEL_TO_METER 一致）：
 *   车头长 = (红线像素 - 车头起点像素) * 0.01
 *   车头起点 = VehicleHeader.x - ImageEnvelope.x
 *
 * 无包络时后端会用点云内容最左列填入 vw，避免从画布左边缘虚高。
 */
export function calcCarHeadLength(
  linePosition: number,
  originalImageWidth: number,
  imageEnvelope: string,
  vehicleHeaderEnvelope: string,
  defaultWidth: number,
): number {
  if (originalImageWidth <= 0) return defaultWidth

  const linePx = linePosition * originalImageWidth
  const iw = envelopeFirstNumber(imageEnvelope)
  const vw = envelopeFirstNumber(vehicleHeaderEnvelope)
  const originPx = vw - iw
  const rDistance = (linePx - originPx) * PIXEL_TO_METER

  if (!Number.isFinite(rDistance)) return defaultWidth
  return rDistance > defaultWidth ? rDistance : defaultWidth
}

/** 导出包络首值，供默认红线起算 */
export { envelopeFirstNumber }
