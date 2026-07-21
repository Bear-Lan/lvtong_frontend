/**
 * 车牌底色 — 对齐 DetailDialog::applyPlateColorStyle
 * color: "0"蓝 "1"黄 "2"黑 "3"白 "4"/"11"绿 "5"/"6"青 "7"紫 "12"红
 */
export function plateColorStyle(color?: string | null): { background: string; color: string } | null {
  if (!color) return null
  const map: Record<string, { background: string; color: string }> = {
    '0': { background: '#2980b9', color: '#ffffff' },
    '1': { background: '#f1c40f', color: '#2c3e50' },
    '2': { background: '#2c3e50', color: '#ecf0f1' },
    '3': { background: '#ecf0f1', color: '#2c3e50' },
    '4': { background: '#27ae60', color: '#ffffff' },
    '11': { background: '#27ae60', color: '#ffffff' },
    '5': { background: '#16a085', color: '#ffffff' },
    '6': { background: '#16a085', color: '#ffffff' },
    '7': { background: '#8e44ad', color: '#ffffff' },
    '12': { background: '#ff0000', color: '#ffffff' },
  }
  return map[color] ?? { background: '#7f8c8d', color: '#ffffff' }
}
