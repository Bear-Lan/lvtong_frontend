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

/** 解析 Image-Envelope 为竖线相对位置 0~1 */
export function parseImageEnvelope(envelopeStr: string, imageWidth: number): number | null {
  if (!envelopeStr || imageWidth <= 0) return null

  try {
    const obj = JSON.parse(envelopeStr) as Record<string, number>
    const keys = ['x', 'x1', 'left', 'center'] as const
    for (const key of keys) {
      const val = obj[key]
      if (typeof val === 'number' && val >= 0) {
        return Math.min(1, Math.max(0, val / imageWidth))
      }
    }
  } catch {
    // 非 JSON，尝试逗号分隔
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

/** 对齐 Qt OrderDialog::onLinePositionChanged */
export function calcCarHeadLength(
  linePosition: number,
  originalImageWidth: number,
  imageEnvelope: string,
  vehicleHeaderEnvelope: string,
  defaultWidth: number,
): number {
  const realDistance = distanceFromLinePosition(linePosition, originalImageWidth)
  const iw = Number.parseFloat(imageEnvelope.split(',')[0] ?? '0')
  const vw = Number.parseFloat(vehicleHeaderEnvelope.split(',')[0] ?? '0')
  const rDistance = realDistance - (vw - iw)
  return rDistance > defaultWidth ? rDistance : defaultWidth
}
