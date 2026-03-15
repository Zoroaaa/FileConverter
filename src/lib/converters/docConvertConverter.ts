/**
 * 文档格式转换前端调用层 (v6 - 修复非PDF输出 + Visio支持)
 *
 * 调用 /api/doc-convert，后端路由：
 * - Gotenberg LibreOffice: Office/Visio → PDF（仅支持 PDF 输出）
 * - Gotenberg Chromium:    HTML/MD → PDF（渲染更精准）
 * - Adobe PDF Services:   PDF → DOCX/XLSX/PPTX（备用，LibreOffice 不支持此方向）
 * - 纯文本回退:            MD/TXT/HTML 互转
 *
 * ⚠️ PDF→txt/html 由前端 pdfjs 提取文本后随表单传入
 * ⚠️ LibreOffice 不支持输出非 PDF 格式，已移除 odt/rtf/ods/odp 作为输出目标
 */

import type { SupportedFormat } from '@/types'
import { getFileNameWithoutExtension } from '@/types'
import { extractTextFromPdf } from './index'
import type { ConversionResult } from './types'

/**
 * 与后端 CONVERSION_MATRIX 严格对齐。
 * ⚠️ 已移除 odt/rtf/ods/odp 作为输出目标（Gotenberg LibreOffice 实际只能输出 PDF）
 * ⚠️ docx→md/html/txt 由前端 mammoth 处理，不走本模块（index.ts 优先拦截）
 * PDF→txt/html 由前端辅助（extractedText 参数）。
 */
const DOC_CONVERT_MATRIX: Record<string, string[]> = {
  docx: ['pdf', 'txt', 'html', 'md'],
  doc:  ['pdf', 'docx', 'txt', 'html'],
  odt:  ['pdf', 'txt', 'html'],
  rtf:  ['pdf', 'txt', 'html'],
  xlsx: ['pdf', 'csv', 'html'],
  xls:  ['pdf', 'xlsx', 'csv', 'html'],
  ods:  ['pdf', 'csv', 'html'],
  csv:  ['pdf', 'xlsx', 'html'],
  pptx: ['pdf', 'txt'],
  ppt:  ['pdf', 'pptx', 'txt'],
  odp:  ['pdf', 'txt'],
  vsd:  ['pdf'],
  vsdx: ['pdf'],
  md:   ['pdf', 'docx', 'html', 'txt'],
  txt:  ['pdf', 'docx', 'html', 'md'],
  html: ['pdf', 'docx', 'txt', 'md'],
  pdf:  ['docx', 'xlsx', 'pptx', 'txt', 'html'],
}

const MIME_MAP: Record<string, string> = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc:  'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:  'application/vnd.ms-excel',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt:  'application/vnd.ms-powerpoint',
  odt:  'application/vnd.oasis.opendocument.text',
  ods:  'application/vnd.oasis.opendocument.spreadsheet',
  odp:  'application/vnd.oasis.opendocument.presentation',
  rtf:  'application/rtf',
  html: 'text/html',
  txt:  'text/plain',
  md:   'text/markdown',
  csv:  'text/csv',
  vsd:  'application/vnd.visio',
  vsdx: 'application/vnd.ms-visio.drawing',
}

/** 判断此转换是否应走 /api/doc-convert */
export function isDocConvertSupported(src: string, tgt: string): boolean {
  return !!(DOC_CONVERT_MATRIX[src]?.includes(tgt))
}

/**
 * 返回转换说明信息（用于 UI Badge）
 * 让用户了解使用哪个引擎
 */
export function getEngineHint(src: string, tgt: string): string {
  if (src === 'pdf' && ['docx', 'xlsx', 'pptx'].includes(tgt)) {
    return 'Adobe PDF Services（精准还原排版，每月免费 500 次）'
  }
  if (['html', 'md'].includes(src) && tgt === 'pdf') {
    return 'Gotenberg Chromium（完美中文渲染）'
  }
  if (src === 'md' && tgt === 'docx') {
    return '浏览器本地转换（docx 库，无需上传）'
  }
  if (src === 'docx' && ['html', 'txt', 'md'].includes(tgt)) {
    return '浏览器本地转换（mammoth 库，无需上传）⚠️ OLE 嵌入对象会跳过'
  }
  if (['vsd', 'vsdx'].includes(src)) {
    return 'Gotenberg LibreOffice（Visio 导入，布局还原约 80%）'
  }
  if (['md', 'txt', 'html', 'rtf'].includes(src) && ['md', 'txt', 'html'].includes(tgt)) {
    return '浏览器本地转换（无需上传）'
  }
  return 'Gotenberg LibreOffice（完整格式还原）'
}

/** 调用 /api/doc-convert 进行文档转换 */
export async function convertDocumentFormat(
  file: File,
  targetFormat: SupportedFormat,
): Promise<ConversionResult> {
  const target = targetFormat as string
  const srcExt = file.name.split('.').pop()?.toLowerCase() ?? ''

  const fd = new FormData()
  fd.append('file', file)
  fd.append('targetFormat', target)

  // PDF → txt/html：前端提取文本后随表单一同发送
  if (srcExt === 'pdf' && (target === 'txt' || target === 'html')) {
    const extractedText = await extractTextFromPdf(file)
    fd.append('extractedText', extractedText)
  }

  const res = await fetch('/api/doc-convert', { method: 'POST', body: fd })

  if (!res.ok) {
    let msg = '文档转换失败'
    try {
      const data = await res.json() as { error?: string }
      msg = data.error ?? msg
    } catch { /* ignore */ }

    if (res.status === 503) throw new Error(`⚠️ ${msg}`)
    if (res.status === 429) throw new Error(`⏰ ${msg}`)
    throw new Error(msg)
  }

  const blob = await res.blob()
  const stem = getFileNameWithoutExtension(file.name)
  const mimeType = MIME_MAP[target] ?? blob.type ?? 'application/octet-stream'

  return {
    blob,
    filename: `${stem}.${target}`,
    mimeType,
  }
}
