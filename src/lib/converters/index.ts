/**
 * 前端转换调度中心 (v5)
 *
 * 路由优先级：
 * 1. 图像  → Canvas API（浏览器本地）
 * 2. 数据  → 纯 JS 解析（浏览器本地）
 * 3. 音视频 → FFmpeg.wasm（CDN 懒加载）
 * 4. 表格特殊路径 → SheetJS（XLSX/CSV 互转）
 * 5. 文档  → /api/doc-convert（Gotenberg + Adobe 备用）
 */

import type { SupportedFormat, ImageFormat, DataFormat } from '@/types'
import { getFormatCategory, getCompatibleTargetFormats, getFileNameWithoutExtension } from '@/types'
import { convertImage, supportsCanvasConversion } from './imageConverter'
import { convertData, getDataFormatMimeType } from './dataConverter'
import { isDocConvertSupported, convertDocumentFormat, getEngineHint } from './docConvertConverter'
import { convertMdToDocxFile, isMdToDocx } from './mdToDocxConverter'
import { convertDocxToHtml, convertDocxToMd, convertDocxToTxt, isDocxToText } from './docxParser'
import type { ConversionOptions, ConversionResult } from './types'

export async function convertFile(
  file: File,
  sourceFormat: SupportedFormat,
  targetFormat: SupportedFormat,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  if (!isConversionSupported(sourceFormat, targetFormat)) {
    throw new Error(`不支持从 ${sourceFormat} 转换到 ${targetFormat}`)
  }
  const category = getFormatCategory(sourceFormat)

  switch (category) {
    case 'image':
      return convertImageFile(file, sourceFormat as ImageFormat, targetFormat as ImageFormat, options)

    case 'data': {
      const s = sourceFormat as string
      const t = targetFormat as string
      if (s === 'csv' && t === 'xlsx') return convertToXlsx(file, sourceFormat)
      if (s === 'csv' && ['json', 'xml'].includes(t)) return convertCsvToData(file, t)
      if (['json'] .includes(s) && t === 'xlsx') return convertToXlsx(file, sourceFormat)
      return convertDataFile(file, sourceFormat as DataFormat, targetFormat as DataFormat)
    }

    case 'audio':
    case 'video':
      return convertMediaFile(file, sourceFormat, targetFormat)

    default: {
      // document category
      const s = sourceFormat as string
      const t = targetFormat as string

      // MD → DOCX：前端 docx 库（优先，无需后端）
      if (isMdToDocx(s, t)) return convertMdToDocxFile(file)

      // DOCX → MD/HTML/TXT：前端 mammoth 库（无需后端，隐私优先）
      // ⚠️ mammoth 不支持 OLE 嵌入对象（如 Word 内嵌的 Excel 表格），转换时会静默跳过
      //    convertDocxToMd 会在结果 warnings 字段中标注，UI 层可展示提示
      if (isDocxToText(s, t)) {
        if (t === 'md')   return convertDocxToMd(file)
        if (t === 'html') return convertDocxToHtml(file)
        if (t === 'txt')  return convertDocxToTxt(file)
      }

      // SheetJS 前端处理：xlsx/xls/ods → csv/html
      if (['xlsx', 'xls', 'ods'].includes(s) && ['csv', 'html'].includes(t)) {
        return convertFromXlsx(file, targetFormat)
      }
      // SheetJS 前端处理：csv → xlsx
      if (s === 'csv' && t === 'xlsx') return convertToXlsx(file, sourceFormat)
      // csv → json/xml（前端）
      if (s === 'csv' && ['json', 'xml'].includes(t)) return convertCsvToData(file, t)

      // 走后端 /api/doc-convert
      if (isDocConvertSupported(s, t)) return convertDocumentFormat(file, targetFormat)

      throw new Error(`不支持从 ${s} 转换到 ${t}`)
    }
  }
}

export function isConversionSupported(src: SupportedFormat, tgt: SupportedFormat): boolean {
  return getCompatibleTargetFormats(src).includes(tgt)
}

export function getConversionMethod(
  src: SupportedFormat, tgt: SupportedFormat
): 'frontend' | 'backend' | 'gotenberg' | 'adobe' {
  const cat = getFormatCategory(src)
  if (cat === 'image' && supportsCanvasConversion(src as ImageFormat, tgt as ImageFormat)) return 'frontend'
  if (cat === 'data') return 'frontend'
  if (cat === 'audio' || cat === 'video') return 'frontend'
  const s = src as string
  const t = tgt as string
  if (['xlsx', 'xls', 'ods'].includes(s) && ['csv', 'html'].includes(t)) return 'frontend'
  if (s === 'csv' && ['xlsx', 'json', 'xml'].includes(t)) return 'frontend'
  // MD → DOCX：前端 docx 库
  if (isMdToDocx(s, t)) return 'frontend'
  // DOCX → MD/HTML/TXT：前端 mammoth 库
  if (isDocxToText(s, t)) return 'frontend'
  // PDF → Office 走 Adobe
  if (s === 'pdf' && ['docx', 'xlsx', 'pptx'].includes(t)) return 'adobe'
  // 文档走 Gotenberg
  if (isDocConvertSupported(s, t)) return 'gotenberg'
  return 'backend'
}

export function getConversionEngineHint(src: string, tgt: string): string {
  return getEngineHint(src, tgt)
}

// ─── Image ────────────────────────────────────────────────────────────────────

async function convertImageFile(
  file: File, src: ImageFormat, tgt: ImageFormat, opts: ConversionOptions
): Promise<ConversionResult> {
  if (!supportsCanvasConversion(src, tgt)) throw new Error(`不支持图像格式 ${src} → ${tgt}`)
  const blob = await convertImage(file, tgt, { quality: opts.quality, width: opts.width, height: opts.height })
  const base = getFileNameWithoutExtension(file.name)
  const ext = tgt === 'jpeg' ? 'jpg' : tgt
  return { blob, filename: `${base}.${ext}`, mimeType: blob.type }
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function convertDataFile(file: File, src: DataFormat, tgt: DataFormat): Promise<ConversionResult> {
  const text = await file.text()
  const converted = await convertData(text, src, tgt)
  const mime = getDataFormatMimeType(tgt)
  return {
    blob: new Blob([converted], { type: mime }),
    filename: `${getFileNameWithoutExtension(file.name)}.${tgt}`,
    mimeType: mime,
  }
}

// ─── SheetJS ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _xlsx: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getXlsx(): Promise<any> {
  if (_xlsx) return _xlsx
  const _dyn = new Function('url', 'return import(url)')
  _xlsx = await _dyn('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs')
  return _xlsx
}

async function convertToXlsx(file: File, sourceFormat: SupportedFormat): Promise<ConversionResult> {
  const XLSX = await getXlsx()
  const text = await file.text()
  let wb: unknown
  if (sourceFormat === 'csv') {
    wb = XLSX.read(text, { type: 'string' })
  } else if (sourceFormat === 'json') {
    const data = JSON.parse(text)
    const arr = Array.isArray(data) ? data : [data]
    const ws = XLSX.utils.json_to_sheet(arr)
    wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  } else {
    throw new Error(`不支持从 ${sourceFormat} 转换到 XLSX`)
  }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  return { blob, filename: `${getFileNameWithoutExtension(file.name)}.xlsx`, mimeType: blob.type }
}

async function convertFromXlsx(file: File, targetFormat: SupportedFormat): Promise<ConversionResult> {
  const XLSX = await getXlsx()
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (targetFormat === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws)
    return { blob: new Blob([csv], { type: 'text/csv' }), filename: `${getFileNameWithoutExtension(file.name)}.csv`, mimeType: 'text/csv' }
  } else if (targetFormat === 'html') {
    const html = XLSX.utils.sheet_to_html(ws)
    const wrapped = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left}th{background:#f9fafb;font-weight:600}tr:nth-child(even) td{background:#fafafa}</style></head><body>${html}</body></html>`
    return { blob: new Blob([wrapped], { type: 'text/html' }), filename: `${getFileNameWithoutExtension(file.name)}.html`, mimeType: 'text/html' }
  }
  throw new Error(`不支持从 XLSX 转换到 ${targetFormat}`)
}

async function convertCsvToData(file: File, targetFormat: string): Promise<ConversionResult> {
  const XLSX = await getXlsx()
  const text = await file.text()
  const wb = XLSX.read(text, { type: 'string' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = XLSX.utils.sheet_to_json(ws)
  let output: string; let mime: string
  if (targetFormat === 'json') {
    output = JSON.stringify(rows, null, 2); mime = 'application/json'
  } else if (targetFormat === 'xml') {
    const xmlRows = rows.map(row => {
      const fields = Object.entries(row).map(([k, v]) => `  <${k}>${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</${k}>`).join('\n')
      return `<row>\n${fields}\n</row>`
    }).join('\n')
    output = `<?xml version="1.0" encoding="UTF-8"?>\n<data>\n${xmlRows}\n</data>`; mime = 'application/xml'
  } else {
    throw new Error(`不支持从 CSV 转换到 ${targetFormat}`)
  }
  return { blob: new Blob([output], { type: mime }), filename: `${getFileNameWithoutExtension(file.name)}.${targetFormat}`, mimeType: mime }
}

// ─── Audio/Video (FFmpeg.wasm) ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ffmpeg: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getFFmpeg(): Promise<any> {
  if (_ffmpeg) return _ffmpeg
  const _dyn = new Function('url', 'return import(url)')
  const { FFmpeg } = await _dyn('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js')
  const { fetchFile, toBlobURL } = await _dyn('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js')
  const ffmpeg = new FFmpeg()
  const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  })
  _ffmpeg = ffmpeg; _ffmpeg._fetchFile = fetchFile
  return _ffmpeg
}

const AUDIO_MIME: Record<string, string> = { mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', flac:'audio/flac', aac:'audio/aac', m4a:'audio/mp4' }
const VIDEO_MIME: Record<string, string> = { mp4:'video/mp4', webm:'video/webm', avi:'video/x-msvideo', mov:'video/quicktime', mkv:'video/x-matroska' }

async function convertMediaFile(file: File, sourceFormat: SupportedFormat, targetFormat: SupportedFormat): Promise<ConversionResult> {
  const ffmpeg = await getFFmpeg()
  const fetchFile = ffmpeg._fetchFile
  const inputName = `input.${sourceFormat}`; const outputName = `output.${targetFormat}`
  await ffmpeg.writeFile(inputName, await fetchFile(file))
  const args: string[] = ['-i', inputName]
  const cat = getFormatCategory(sourceFormat)
  if (cat === 'audio') {
    if (targetFormat === 'mp3')  args.push('-c:a', 'libmp3lame', '-q:a', '2')
    else if (targetFormat === 'ogg')  args.push('-c:a', 'libvorbis', '-q:a', '4')
    else if (targetFormat === 'wav')  args.push('-c:a', 'pcm_s16le')
    else if (targetFormat === 'flac') args.push('-c:a', 'flac')
    else if (targetFormat === 'aac' || targetFormat === 'm4a') args.push('-c:a', 'aac', '-b:a', '192k')
  } else {
    if (targetFormat === 'mp4')  args.push('-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart')
    else if (targetFormat === 'webm') args.push('-c:v', 'libvpx-vp9', '-c:a', 'libopus')
  }
  args.push('-y', outputName)
  await ffmpeg.exec(args)
  const data = await ffmpeg.readFile(outputName)
  await ffmpeg.deleteFile(inputName).catch(() => {}); await ffmpeg.deleteFile(outputName).catch(() => {})
  const mime = (cat === 'audio' ? AUDIO_MIME : VIDEO_MIME)[targetFormat as string] ?? 'application/octet-stream'
  return { blob: new Blob([data], { type: mime }), filename: `${getFileNameWithoutExtension(file.name)}.${targetFormat}`, mimeType: mime }
}

// ─── PDF 文本提取（pdfjs-dist，CDN 懒加载）───────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pdfjs: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPdfjs(): Promise<any> {
  if (_pdfjs) return _pdfjs
  const _dyn = new Function('url', 'return import(url)')
  const lib = await _dyn('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.mjs')
  lib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.mjs'
  _pdfjs = lib
  return lib
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const lib = await getPdfjs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await lib.getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pages.push(content.items.map((item: any) => item.str).join(' '))
  }
  return pages.join('\n\n')
}

// ─── 文件预览 ─────────────────────────────────────────────────────────────────

let _previewContainer: HTMLElement | null = null

export function closePreview(): void {
  if (_previewContainer) {
    document.body.removeChild(_previewContainer)
    _previewContainer = null
  }
}

export async function previewFile(blob: Blob, filename: string): Promise<void> {
  closePreview()
  const ext = filename.split('.').pop()?.toLowerCase()
  _previewContainer = document.createElement('div')
  _previewContainer.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);z-index:10000;display:flex;flex-direction:column;align-items:center;padding:20px;box-sizing:border-box`

  const header = document.createElement('div')
  header.style.cssText = `width:100%;max-width:900px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;color:#fff`
  header.innerHTML = `<span style="font-size:15px;font-weight:600">预览: ${filename}</span><button id="close-preview-btn" style="background:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;display:flex;align-items:center;gap:4px;color:#333"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>关闭</button>`

  const contentWrapper = document.createElement('div')
  contentWrapper.style.cssText = `flex:1;width:100%;max-width:900px;overflow-y:auto;background:#fff;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.4)`

  _previewContainer.appendChild(header)
  _previewContainer.appendChild(contentWrapper)
  document.body.appendChild(_previewContainer)

  header.querySelector('#close-preview-btn')?.addEventListener('click', closePreview)
  _previewContainer.addEventListener('click', (e) => { if (e.target === _previewContainer) closePreview() })

  if (ext === 'pdf' || blob.type === 'application/pdf') {
    const url = URL.createObjectURL(blob)
    const iframe = document.createElement('iframe')
    iframe.src = url; iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:10px'
    contentWrapper.appendChild(iframe)
  } else if (ext === 'html' || blob.type === 'text/html') {
    const text = await blob.text()
    const iframe = document.createElement('iframe')
    iframe.srcdoc = text; iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:10px'
    contentWrapper.appendChild(iframe)
  } else if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext || '')) {
    const url = URL.createObjectURL(blob)
    const img = document.createElement('img')
    img.src = url; img.style.cssText = 'max-width:100%;max-height:80vh;object-fit:contain;margin:auto;display:block;padding:20px;border-radius:10px'
    contentWrapper.style.display = 'flex'; contentWrapper.style.alignItems = 'center'; contentWrapper.style.justifyContent = 'center'
    contentWrapper.appendChild(img)
  } else {
    const text = await blob.text().catch(() => '无法预览此文件类型')
    const pre = document.createElement('pre')
    pre.textContent = text; pre.style.cssText = 'padding:20px;margin:0;white-space:pre-wrap;word-wrap:break-word;font-family:monospace;font-size:13px;line-height:1.6'
    contentWrapper.appendChild(pre)
  }
}

export * from './imageConverter'
export * from './dataConverter'
export type { ConversionOptions, ConversionResult } from './types'
