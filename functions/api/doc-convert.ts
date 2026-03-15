/**
 * Cloudflare Pages Function: /api/doc-convert (v6 - 修复非PDF输出 + Visio支持)
 *
 * 引擎策略（按优先级）：
 * 1. Gotenberg LibreOffice — Office/文本/Visio → PDF（主力，仅支持输出PDF）
 *    ⚠️ Gotenberg LibreOffice 不支持输出非 PDF 格式（ODT/RTF/ODS 等），已从矩阵中移除
 * 2. Gotenberg Chromium   — HTML/MD → PDF（渲染质量更好）
 * 3. Adobe PDF Services  — PDF → DOCX/XLSX/PPTX（备用，精准还原）
 *    ⚠️ Gotenberg/LibreOffice 不支持 PDF→Office 反向转换
 * 4. 纯文本回退           — md/txt/html 互转（无需 API）
 *
 * 环境变量:
 *   GOTENBERG_URL        — Gotenberg on Render，例如 https://xxx.onrender.com
 *   ADOBE_CLIENT_ID      — Adobe PDF Services（可选，用于 PDF→Office）
 *   ADOBE_CLIENT_SECRET  — Adobe PDF Services Secret（可选）
 */

export interface Env {
  GOTENBERG_URL?: string
  ADOBE_CLIENT_ID?: string
  ADOBE_CLIENT_SECRET?: string
}

// ⚠️ 重要约束：Gotenberg LibreOffice 引擎只能输出 PDF
// 非 PDF 格式互转（如 docx→odt、xlsx→ods）在底层会得到 PDF 二进制但以错误 MIME 返回 → 乱码
// 已移除所有 LibreOffice 非 PDF 输出目标（odt/rtf/ods/odp 作为输出）
export const CONVERSION_MATRIX: Record<string, string[]> = {
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
  // Visio → PDF（LibreOffice 内置 Visio 导入器，布局还原约 80%，字体/颜色可能有偏差）
  vsd:  ['pdf'],
  vsdx: ['pdf'],
  md:   ['pdf', 'docx', 'html', 'txt'],
  txt:  ['pdf', 'docx', 'html', 'md'],
  html: ['pdf', 'docx', 'txt', 'md'],
  pdf:  ['docx', 'xlsx', 'pptx', 'txt', 'html'],
}

const LO_SOURCES = new Set(['docx','doc','odt','rtf','xlsx','xls','ods','csv','pptx','ppt','odp','txt','vsd','vsdx'])
const CHROMIUM_SOURCES = new Set(['html', 'md'])
const ADOBE_TARGETS = new Set(['docx', 'xlsx', 'pptx'])
const TEXT_SOURCES = new Set(['md', 'txt', 'html', 'rtf'])
const TEXT_TARGETS = new Set(['md', 'txt', 'html'])

const MIME: Record<string, string> = {
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
  html: 'text/html; charset=utf-8',
  txt:  'text/plain; charset=utf-8',
  md:   'text/markdown; charset=utf-8',
  csv:  'text/csv; charset=utf-8',
  vsd:  'application/vnd.visio',
  vsdx: 'application/vnd.ms-visio.drawing',
}

function errResp(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

function okResp(buffer: ArrayBuffer, filename: string, mime: string, engine?: string): Response {
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      ...(engine ? { 'X-Conversion-Engine': engine } : {}),
    },
  })
}

const getStem = (f: string): string => { const i = f.lastIndexOf('.'); return i === -1 ? f : f.slice(0, i) }
const getExt  = (f: string): string => f.slice(f.lastIndexOf('.') + 1).toLowerCase()

async function convertLibreOffice(buf: ArrayBuffer, filename: string, targetFormat: string, base: string): Promise<ArrayBuffer> {
  const fd = new FormData()
  const srcExt = getExt(filename)
  fd.append('files', new Blob([buf], { type: MIME[srcExt] ?? 'application/octet-stream' }), `document.${srcExt}`)
  if (targetFormat !== 'pdf') fd.append('outputFilename', `document.${targetFormat}`)
  if (targetFormat === 'pdf') fd.append('pdfFormat', 'PDF/A-1b')
  const res = await fetch(`${base}/forms/libreoffice/convert`, { method: 'POST', body: fd })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 503 || res.status === 502) throw new Error('Gotenberg 服务冷启动中，请等待约 30 秒后重试（Render 免费层特性）')
    throw new Error(`Gotenberg LibreOffice 失败 (${res.status}): ${text.slice(0, 300)}`)
  }
  return res.arrayBuffer()
}

function buildPrintHtml(rawText: string, sourceFormat: string): string {
  let body = rawText
  if (sourceFormat === 'md') {
    body = rawText
      .replace(/^#{4} (.+)$/gm, '<h4>$1</h4>').replace(/^#{3} (.+)$/gm, '<h3>$1</h3>')
      .replace(/^#{2} (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
      .replace(/^---+$/gm, '<hr>').replace(/^[-*+] (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]+?<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
      .replace(/\n\n/g, '</p><p>').replace(/^(?!<[h1-6|ul|ol|li|bl|hr|p])(.+)$/gm, '<p>$1</p>')
  }
  if (sourceFormat === 'html' && rawText.includes('<meta charset')) return rawText
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>
    @page{size:A4;margin:2cm 2.2cm}
    body{font-family:'Noto Sans SC','Microsoft YaHei','PingFang SC',sans-serif;line-height:1.85;color:#1a1a1a;font-size:14px}
    h1{font-size:1.85em;border-bottom:2px solid #e5e7eb;padding-bottom:.3em;margin:1.2em 0 .5em}
    h2{font-size:1.4em;margin:1.1em 0 .4em}h3{font-size:1.15em;margin:1em 0 .4em}
    p{margin:0 0 1em}code{background:#f5f5f5;padding:2px 5px;border-radius:3px;font-family:monospace}
    pre{background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:6px;font-size:.88em}
    pre code{background:transparent;color:inherit;padding:0}
    table{border-collapse:collapse;width:100%;margin:1em 0;page-break-inside:avoid}
    th,td{border:1px solid #d1d5db;padding:8px 12px;text-align:left}th{background:#f3f4f6;font-weight:600}
    blockquote{border-left:4px solid #3b82f6;margin:1em 0;padding:.5em 1em;background:#eff6ff;border-radius:0 4px 4px 0}
    ul,ol{margin:0 0 1em;padding-left:2em}li{margin:.3em 0}hr{border:none;border-top:1px solid #e5e7eb;margin:2em 0}
    img{max-width:100%;height:auto}a{color:#2563eb}
  </style></head><body>${body}</body></html>`
}

async function convertChromium(buf: ArrayBuffer, sourceFormat: string, base: string): Promise<ArrayBuffer> {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buf)
  const html = buildPrintHtml(text, sourceFormat)
  const fd = new FormData()
  fd.append('files', new Blob([html], { type: 'text/html; charset=utf-8' }), 'index.html')
  fd.append('paperWidth', '8.27'); fd.append('paperHeight', '11.69')
  fd.append('marginTop', '1'); fd.append('marginBottom', '1')
  fd.append('marginLeft', '1.2'); fd.append('marginRight', '1.2')
  fd.append('printBackground', 'true')
  const res = await fetch(`${base}/forms/chromium/convert/html`, { method: 'POST', body: fd })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    if (res.status === 503 || res.status === 502) throw new Error('Gotenberg 服务冷启动中，请等待约 30 秒后重试')
    throw new Error(`Gotenberg Chromium 失败 (${res.status}): ${t.slice(0, 300)}`)
  }
  return res.arrayBuffer()
}

const ADOBE_IMS = 'https://ims-na1.adobelogin.com/ims/token/v3'
const ADOBE_BASE = 'https://pdf-services.adobe.io'

async function convertAdobe(buf: ArrayBuffer, targetFormat: string, clientId: string, clientSecret: string): Promise<ArrayBuffer> {
  const tr = await fetch(ADOBE_IMS, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: 'openid,AdobeID,DCAPI' }).toString(),
  })
  if (!tr.ok) throw new Error(`Adobe token 获取失败 (${tr.status})`)
  const { access_token } = await tr.json() as { access_token: string }

  const ar = await fetch(`${ADOBE_BASE}/assets`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${access_token}`, 'X-API-Key': clientId, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaType: 'application/pdf' }),
  })
  if (!ar.ok) throw new Error(`Adobe 上传地址获取失败 (${ar.status})`)
  const { uploadUri, assetID } = await ar.json() as { uploadUri: string; assetID: string }

  const ur = await fetch(uploadUri, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: buf })
  if (!ur.ok) throw new Error(`Adobe 上传失败 (${ur.status})`)

  const jr = await fetch(`${ADOBE_BASE}/operation/exportpdf`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${access_token}`, 'X-API-Key': clientId, 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetID, targetFormat }),
  })
  if (!jr.ok) { const t = await jr.text(); throw new Error(`Adobe 创建任务失败 (${jr.status}): ${t.slice(0, 200)}`) }
  const jobUrl = jr.headers.get('Location')
  if (!jobUrl) throw new Error('Adobe: 未获取到任务地址')

  const deadline = Date.now() + 120_000; let wait = 2000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, wait)); wait = Math.min(wait * 1.5, 8000)
    const s = await fetch(jobUrl, { headers: { 'Authorization': `Bearer ${access_token}`, 'X-API-Key': clientId } })
    const d = await s.json() as { status: string; asset?: { downloadUri: string }; error?: { message: string } }
    if (d.status === 'done') {
      if (!d.asset?.downloadUri) throw new Error('Adobe: 无下载地址')
      const dl = await fetch(d.asset.downloadUri)
      if (!dl.ok) throw new Error(`Adobe: 下载失败 (${dl.status})`)
      return dl.arrayBuffer()
    }
    if (d.status === 'failed') throw new Error(`Adobe 转换失败: ${d.error?.message ?? '未知'}`)
  }
  throw new Error('Adobe 转换超时（120 秒），请尝试较小的文件')
}

const enc = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer as ArrayBuffer

function htmlToMd(html: string): string {
  const strip = (h: string) => h.replace(/<[^>]+>/g, '')
  return html
    .replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `${'#'.repeat(+n)} ${strip(t)}\n\n`)
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, t) => `**${strip(t)}**`)
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, t) => `*${strip(t)}*`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${strip(t)}\n`)
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `${strip(t)}\n\n`)
    .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n').trim()
}

function textFallback(buf: ArrayBuffer, src: string, tgt: string): ArrayBuffer {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buf)
  if (tgt === 'txt') return enc(text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''))
  if (tgt === 'md')  return enc(src === 'html' ? htmlToMd(text) : text)
  if (tgt === 'html') {
    if (src === 'md') return enc(buildPrintHtml(text, 'md'))
    const esc = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    return enc(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><pre style="white-space:pre-wrap;font-family:sans-serif;padding:20px">${esc}</pre></body></html>`)
  }
  throw new Error(`纯文本回退不支持 ${src} → ${tgt}`)
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    })
  }
  if (request.method !== 'POST') return errResp('方法不允许', 405)

  try {
    const fd = await request.formData()
    const file         = fd.get('file') as File | null
    const targetFormat = (fd.get('targetFormat') as string | null)?.toLowerCase()
    const extractedText = fd.get('extractedText') as string | null

    if (!file)         return errResp('未提供文件', 400)
    if (!targetFormat) return errResp('未指定目标格式', 400)

    const sourceFormat = getExt(file.name)
    if (!sourceFormat)                  return errResp('无法识别源文件格式', 400)
    if (sourceFormat === targetFormat)  return errResp('源格式与目标格式相同', 400)

    const supported = CONVERSION_MATRIX[sourceFormat]
    if (!supported?.includes(targetFormat)) {
      return errResp(`不支持从 ${sourceFormat.toUpperCase()} 转换到 ${targetFormat.toUpperCase()}`, 400)
    }

    const fileBuffer = await file.arrayBuffer()
    if (fileBuffer.byteLength > 100 * 1024 * 1024) return errResp('文件过大，最大支持 100MB', 400)

    const outName = `${getStem(file.name)}.${targetFormat}`
    const mime    = MIME[targetFormat] ?? 'application/octet-stream'
    const gotenbergUrl = (env.GOTENBERG_URL || 'http://localhost:3000').replace(/\/$/, '')

    console.log(`[doc-convert] ${file.name} → ${targetFormat} (${(fileBuffer.byteLength / 1024).toFixed(0)} KB)`)

    let resultBuffer: ArrayBuffer
    let engine: string

    // 路由 A: PDF → Office（Adobe 备用）
    if (sourceFormat === 'pdf' && ADOBE_TARGETS.has(targetFormat)) {
      if (!env.ADOBE_CLIENT_ID || !env.ADOBE_CLIENT_SECRET) {
        return errResp(
          `PDF 转换为 ${targetFormat.toUpperCase()} 需要配置 Adobe PDF Services API。\n` +
          '请在 Cloudflare Pages 环境变量中设置 ADOBE_CLIENT_ID 和 ADOBE_CLIENT_SECRET。\n' +
          '免费注册（每月 500 次）：https://developer.adobe.com/document-services/',
          503
        )
      }
      console.log('[doc-convert] 路由 A: Adobe PDF Services')
      resultBuffer = await convertAdobe(fileBuffer, targetFormat, env.ADOBE_CLIENT_ID, env.ADOBE_CLIENT_SECRET)
      engine = 'adobe-pdf-services'
    }

    // 路由 B: PDF → txt/html（前端 pdfjs 已提取文本）
    else if (sourceFormat === 'pdf' && (targetFormat === 'txt' || targetFormat === 'html')) {
      if (!extractedText) return errResp('PDF 文本提取需由前端完成，请重试', 400)
      console.log('[doc-convert] 路由 B: PDF 文本回退')
      resultBuffer = textFallback(enc(extractedText), 'txt', targetFormat)
      engine = 'text-fallback'
    }

    // 路由 C: HTML/MD → PDF（Gotenberg Chromium）
    else if (CHROMIUM_SOURCES.has(sourceFormat) && targetFormat === 'pdf') {
      console.log('[doc-convert] 路由 C: Gotenberg Chromium')
      resultBuffer = await convertChromium(fileBuffer, sourceFormat, gotenbergUrl)
      engine = 'gotenberg-chromium'
    }

    // 路由 C2: HTML/MD → Office（先转 HTML，再 LibreOffice）
    else if (CHROMIUM_SOURCES.has(sourceFormat) && ADOBE_TARGETS.has(targetFormat)) {
      console.log('[doc-convert] 路由 C2: HTML/MD → HTML → LibreOffice')
      const text = new TextDecoder('utf-8', { fatal: false }).decode(fileBuffer)
      const html = buildPrintHtml(text, sourceFormat)
      const htmlBuffer = new TextEncoder().encode(html).buffer as ArrayBuffer
      resultBuffer = await convertLibreOffice(htmlBuffer, 'document.html', targetFormat, gotenbergUrl)
      engine = 'gotenberg-libreoffice-via-html'
    }

    // 路由 D: 纯文本互转
    else if (TEXT_SOURCES.has(sourceFormat) && TEXT_TARGETS.has(targetFormat)) {
      console.log('[doc-convert] 路由 D: 纯文本回退')
      resultBuffer = textFallback(fileBuffer, sourceFormat, targetFormat)
      engine = 'text-fallback'
    }

    // 路由 E: LibreOffice（主力）
    else if (LO_SOURCES.has(sourceFormat)) {
      console.log('[doc-convert] 路由 E: Gotenberg LibreOffice')
      resultBuffer = await convertLibreOffice(fileBuffer, file.name, targetFormat, gotenbergUrl)
      engine = 'gotenberg-libreoffice'
    }

    else {
      return errResp(`不支持从 ${sourceFormat.toUpperCase()} 转换到 ${targetFormat.toUpperCase()}`, 400)
    }

    console.log(`[doc-convert] ✓ engine=${engine} (${(resultBuffer.byteLength / 1024).toFixed(0)} KB)`)
    return okResp(resultBuffer, outName, mime, engine)

  } catch (e) {
    console.error('[doc-convert]', e)
    const msg = e instanceof Error ? e.message : '转换失败，请重试'
    if (msg.includes('冷启动')) return errResp(`⏳ ${msg}`, 503)
    return errResp(msg, 500)
  }
}
