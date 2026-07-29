/**
 * 图片路径归一工具 — 与 flask_backend/app/services/image_store.py 对齐
 *
 * 三层形态：
 *   1. storage path（磁盘绝对路径，对齐 Qt m_*ImagePath）
 *        例：E:/code_product/gcms_src/captures/2026/07/29/head/xxx.jpg
 *   2. relative path（IMAGE_STORAGE_ROOT 之下的相对路径，前端内部标准存值）
 *        例：2026/07/29/head/xxx.jpg
 *   3. API URL（前端 <img :src> 用）
 *        例：/api/images/2026/07/29/head/xxx.jpg
 *
 * 兼容：/api/image?path=<encoded>（旧代理）和 image_ready 推送的 mock 路径
 *       都被 toApiUrl() 透传 / 切到 /api/images/<rel> 形态。
 */

/** 任意引用 → API URL（用于 <img :src> 显示）。空 → ''。 */
export function toApiUrl(reference: string | undefined | null): string {
  if (!reference) return ''
  const s = String(reference).trim()
  if (!s) return ''

  // 已是 /api/images/<rel>
  if (s.startsWith('/api/images/')) return s

  // /api/image?path=<encoded> 或 /api/mock/captures/file?path=<encoded>
  // 旧形态：抽 path，转相对（若落在 IMAGE_STORAGE_ROOT 内）
  if (s.startsWith('/api/image') || s.includes('?path=')) {
    const rel = extractRelFromUrl(s)
    if (rel) return rel.startsWith('/') ? rel : `/api/images/${rel}`
    return s // 抽不出来，原样返回（保留 query，让旧代理兜底）
  }

  // 绝对路径（在 IMAGE_STORAGE_ROOT 内 → 转 /api/images/<rel>）
  const rel = absToRel(s)
  if (rel) return `/api/images/${rel}`

  // 外部 URL 或相对路径（无根目录迹象）：原样返回
  return s
}

/** 任意引用 → "提交时使用的字符串"。
 *  - 优先返回磁盘绝对路径（让后端 persist_to_storage 直接归一）
 *  - 没绝对路径信息时返回原值（后端会兜底处理）
 */
export function toStoragePath(reference: string | undefined | null): string {
  if (!reference) return ''
  const s = String(reference).trim()
  if (!s) return ''
  if (s.startsWith('http://') || s.startsWith('https://')) return s

  // /api/image?path=<encoded>
  if (s.startsWith('/api/image') || s.includes('?path=')) {
    const abs = extractAbsFromUrl(s)
    if (abs) return abs
    return s
  }

  // /api/images/<rel> 或相对：原样返回（后端 persist_to_storage 会拼 IMAGE_STORAGE_ROOT）
  if (s.startsWith('/api/images/')) return s.slice('/api/images/'.length)
  return s
}

/** 多图字段：把每项过 toStoragePath，用 | 拼。空项过滤。 */
export function joinImagePaths(references: (string | undefined | null)[]): string {
  return references
    .map((r) => toStoragePath(r))
    .filter(Boolean)
    .join('|')
}

// ---- 内部工具 ----

function extractRelFromUrl(url: string): string | null {
  const q = url.indexOf('?')
  if (q < 0) return null
  const qs = url.slice(q + 1)
  for (const part of qs.split('&')) {
    const [k, v] = part.split('=')
    if (k === 'path' && v) {
      return absToRel(decodeURIComponent(v))
    }
  }
  return null
}

function extractAbsFromUrl(url: string): string | null {
  const q = url.indexOf('?')
  if (q < 0) return null
  const qs = url.slice(q + 1)
  for (const part of qs.split('&')) {
    const [k, v] = part.split('=')
    if (k === 'path' && v) return decodeURIComponent(v)
  }
  return null
}

/** 绝对路径 → 相对 IMAGE_STORAGE_ROOT 的字符串。
 *  简化版：前端没有 IMAGE_STORAGE_ROOT 常量，用绝对路径前缀启发式匹配。
 *  事实上前端没法准确判断根目录，兜底由后端 persist_to_storage 完成；
 *  这里只在"明显像 capturess/xxx"时返回相对段，否则返回 null。
 */
function absToRel(absPath: string): string | null {
  // 已规范化的标准目录：captures/YYYY/MM/DD/<category>/<file>
  const m = absPath.match(/[\\\/]captures[\\\/](\d{4}[\\\/]\d{2}[\\\/]\d{2}[\\\/][^\\\/]+[\\\/][^\\\/]+\.\w+)\s*$/i)
  if (m && m[1]) return m[1].replace(/\\/g, '/')
  return null
}
