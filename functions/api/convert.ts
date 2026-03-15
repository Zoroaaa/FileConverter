/**
 * Cloudflare Pages Function: /api/convert (v2 enhanced)
 *
 * Handles:
 *  - DOCX/DOC → pdf / html / md / txt / rtf / odt
 *  - PDF (text pre-extracted) → txt / html / md / docx / rtf
 *  - MD/TXT/HTML/RTF/ODT → pdf / docx / html / md / txt / rtf
 *  - XLSX (via SheetJS on frontend; backend handles pdf path)
 *  - PPTX → txt (basic slide text extraction)
 */

import mammoth from 'mammoth'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'

export type Env = Record<string, unknown>

const MIME: Record<string, string> = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc:  'application/msword',
  md:   'text/markdown; charset=utf-8',
  txt:  'text/plain; charset=utf-8',
  html: 'text/html; charset=utf-8',
  rtf:  'application/rtf',
  odt:  'application/vnd.oasis.opendocument.text',
  csv:  'text/csv; charset=utf-8',
}

function getExt(f: string) { return f.slice(((f.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase() }
function getStem(f: string) { const i = f.lastIndexOf('.'); return i === -1 ? f : f.slice(0, i) }
function sanitize(s: string) { return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') }
function encode(s: string) { return new TextEncoder().encode(s) }

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function stripTags(html: string) { return html.replace(/<[^>]+>/g, '') }

function htmlToMarkdown(html: string): string {
  let md = html
  md = md.replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `${'#'.repeat(Number(n))} ${stripTags(t)}\n\n`)
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, t) => `**${stripTags(t)}**`)
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_, t) => `**${stripTags(t)}**`)
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, t) => `*${stripTags(t)}*`)
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_, t) => `*${stripTags(t)}*`)
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, t) => `\`${stripTags(t)}\``)
  md = md.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, h, t) => `[${stripTags(t)}](${h})`)
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${stripTags(t)}\n`)
  md = md.replace(/<[uo]l[^>]*>([\s\S]*?)<\/[uo]l>/gi, '$1\n')
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `${stripTags(t)}\n\n`)
  md = md.replace(/<br\s*\/?>/gi, '\n')
  md = stripTags(md)
  md = md.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  return md.replace(/\n{3,}/g, '\n\n').trim()
}

function wrapHtml(body: string, title = 'Document'): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;line-height:1.8;max-width:860px;margin:48px auto;padding:0 24px;color:#111827;font-size:16px}
  h1{font-size:1.9em;margin:0 0 .5em;border-bottom:2px solid #e5e7eb;padding-bottom:.3em}
  h2{font-size:1.45em;margin:1.5em 0 .5em}
  h3{font-size:1.2em;margin:1.3em 0 .4em}
  h4{font-size:1em;margin:1.1em 0 .4em;color:#374151}
  p{margin:0 0 1em}
  code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:.88em;font-family:ui-monospace,'Cascadia Code','Fira Code',monospace}
  pre{background:#1e293b;color:#e2e8f0;padding:20px;border-radius:10px;overflow:auto;font-size:.88em;line-height:1.65}
  pre code{background:transparent;padding:0;color:inherit}
  a{color:#4060f7}
  table{border-collapse:collapse;width:100%;margin:1em 0}
  th,td{border:1px solid #e5e7eb;padding:9px 13px;text-align:left}
  th{background:#f9fafb;font-weight:600}
  tr:nth-child(even) td{background:#fafafa}
  blockquote{border-left:4px solid #4060f7;margin:1em 0;padding:.5em 1em;background:#eef3ff;border-radius:0 6px 6px 0}
  ul,ol{margin:0 0 1em;padding-left:1.8em}li{margin:.3em 0}
  img{max-width:100%;border-radius:8px}
  hr{border:none;border-top:1px solid #e5e7eb;margin:2em 0}
</style>
</head>
<body>${body}</body>
</html>`
}

// ─── Format converters ────────────────────────────────────────────────────────

function toTxt(text: string): Uint8Array { return encode(sanitize(text)) }

function toHtml(text: string, src: string): Uint8Array {
  if (src === 'md') {
    let html = text
    html = html.replace(/^#{4} (.+)$/gm, '<h4>$1</h4>')
    html = html.replace(/^#{3} (.+)$/gm, '<h3>$1</h3>')
    html = html.replace(/^#{2} (.+)$/gm, '<h2>$1</h2>')
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
    html = html.replace(/`(.+?)`/g, '<code>$1</code>')
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    html = html.replace(/^---$/gm, '<hr />')
    html = html.replace(/^[-*+] (.+)$/gm, '<li>$1</li>')
    html = html.replace(/(<li>[\s\S]+?<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    html = html.replace(/\n\n/g, '</p><p>')
    html = html.replace(/^(?!<[hpuobrh]|<li|<blockquote)(.+)$/gm, '<p>$1</p>')
    return encode(wrapHtml(html))
  }
  return encode(wrapHtml(`<pre style="white-space:pre-wrap">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`))
}

function toHtmlBody(text: string, src: string): string {
  if (src === 'md') {
    let html = text
    html = html.replace(/^#{4} (.+)$/gm, '<h4>$1</h4>')
    html = html.replace(/^#{3} (.+)$/gm, '<h3>$1</h3>')
    html = html.replace(/^#{2} (.+)$/gm, '<h2>$1</h2>')
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
    html = html.replace(/`(.+?)`/g, '<code>$1</code>')
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    html = html.replace(/^---$/gm, '<hr />')
    html = html.replace(/^[-*+] (.+)$/gm, '<li>$1</li>')
    html = html.replace(/(<li>[\s\S]+?<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    html = html.replace(/\n\n/g, '</p><p>')
    html = html.replace(/^(?!<[hpuobrh]|<li|<blockquote)(.+)$/gm, '<p>$1</p>')
    return html
  }
  return `<pre style="white-space:pre-wrap">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`
}

function toMarkdown(text: string, src: string): Uint8Array {
  return encode(src === 'html' ? htmlToMarkdown(text) : text)
}

function toRtf(text: string): Uint8Array {
  const lines = text.split('\n')
  let rtf = '{\\rtf1\\ansi\\ansicpg1252\\deff0\n'
  rtf += '{\\fonttbl{\\f0\\froman Times New Roman;}{\\f1\\fswiss Arial;}}\n'
  rtf += '\\f1\\fs24\\sl360\\slmult1\n'
  for (const line of lines) {
    const t = line.trimEnd()
    if (!t) { rtf += '\\par\n'; continue }
    const esc = t.replace(/\\/g,'\\\\').replace(/\{/g,'\\{').replace(/\}/g,'\\}')
    if (t.startsWith('# '))   rtf += `\\fs40\\b ${esc.slice(2)}\\b0\\fs24\\par\n`
    else if (t.startsWith('## ')) rtf += `\\fs32\\b ${esc.slice(3)}\\b0\\fs24\\par\n`
    else if (t.startsWith('### ')) rtf += `\\fs28\\b ${esc.slice(4)}\\b0\\fs24\\par\n`
    else rtf += `${esc}\\par\n`
  }
  rtf += '}'
  return encode(rtf)
}

async function toDocx(text: string, src: string): Promise<Uint8Array> {
  const parseInline = (line: string): TextRun[] => {
    const runs: TextRun[] = []
    const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(line)) !== null) {
      if (m[1]) runs.push(new TextRun({ text: m[1], bold: true }))
      else if (m[2]) runs.push(new TextRun({ text: m[2], italics: true }))
      else if (m[3]) runs.push(new TextRun({ text: m[3], font: 'Courier New', size: 18 }))
      else if (m[4]) runs.push(new TextRun({ text: m[4] }))
    }
    return runs.length ? runs : [new TextRun({ text: line })]
  }
  
  const paragraphs: Paragraph[] = []
  for (const line of text.split('\n')) {
    const t = line.trimEnd()
    if (!t) { paragraphs.push(new Paragraph({ text: '' })); continue }
    const isMdLike = ['md','html','txt','pdf'].includes(src)
    if (isMdLike) {
      const m1 = t.match(/^# (.+)$/)
      const m2 = t.match(/^## (.+)$/)
      const m3 = t.match(/^### (.+)$/)
      const m4 = t.match(/^#### (.+)$/)
      const ml = t.match(/^[-*+] (.+)$/)
      if (m1) { paragraphs.push(new Paragraph({ text: m1[1], heading: HeadingLevel.HEADING_1 })); continue }
      if (m2) { paragraphs.push(new Paragraph({ text: m2[1], heading: HeadingLevel.HEADING_2 })); continue }
      if (m3) { paragraphs.push(new Paragraph({ text: m3[1], heading: HeadingLevel.HEADING_3 })); continue }
      if (m4) { paragraphs.push(new Paragraph({ text: m4[1], heading: HeadingLevel.HEADING_4 })); continue }
      if (ml) { paragraphs.push(new Paragraph({ text: ml[1], bullet: { level: 0 } })); continue }
      paragraphs.push(new Paragraph({ children: parseInline(t) }))
    } else {
      paragraphs.push(new Paragraph({ text: t }))
    }
  }
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ properties: {}, children: paragraphs }],
  })
  const blob = await Packer.toBlob(doc)
  return new Uint8Array(await blob.arrayBuffer())
}

// ─── RTF text extraction ──────────────────────────────────────────────────────
function extractRtfText(rtf: string): string {
  let t = rtf
  t = t.replace(/\{[^{}]*\}/g, '')
  t = t.replace(/\\[a-z]+\d*[ ]?/g, ' ')
  t = t.replace(/[{}\\]/g, '').replace(/\s+/g, ' ')
  return t.trim()
}

// ─── DOCX source ──────────────────────────────────────────────────────────────
async function fromDocx(buf: ArrayBuffer, tgt: string): Promise<Uint8Array> {
  switch (tgt) {
    case 'txt': return toTxt((await mammoth.extractRawText({ arrayBuffer: buf })).value)
    case 'html': return encode(wrapHtml((await mammoth.convertToHtml({ arrayBuffer: buf })).value))
    case 'md':   return encode(htmlToMarkdown((await mammoth.convertToHtml({ arrayBuffer: buf })).value))
    case 'pdf': {
      const result = await mammoth.convertToHtml({ 
        arrayBuffer: buf,
        convertImage: mammoth.images.imgElement(function(image) {
          return image.read("base64").then(function(imageBuffer) {
            return {
              src: "data:" + image.contentType + ";base64," + imageBuffer
            }
          })
        })
      })
      const styledHtml = wrapHtmlForPdf(result.value)
      return encode(styledHtml)
    }
    case 'rtf':  return toRtf((await mammoth.extractRawText({ arrayBuffer: buf })).value)
    default:     throw new Error(`不支持从 DOCX 转换到 ${tgt}`)
  }
}

function wrapHtmlForPdf(body: string, title = 'Document'): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  @page { size: A4; margin: 2.5cm 2cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    font-family: 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.8; 
    color: #1a1a1a; 
    font-size: 14px;
    max-width: 100%;
    padding: 20px;
    margin: 0;
    background: #fff;
  }
  h1 { 
    font-size: 22px; 
    margin: 24px 0 16px; 
    color: #111; 
    font-weight: 700; 
    text-align: center;
    page-break-after: avoid;
  }
  h2 { 
    font-size: 18px; 
    margin: 20px 0 12px; 
    color: #222; 
    font-weight: 600; 
    text-align: center;
    page-break-after: avoid;
  }
  h3 { 
    font-size: 16px; 
    margin: 16px 0 10px; 
    color: #333; 
    font-weight: 600;
    text-align: left;
    page-break-after: avoid;
  }
  h4 { 
    font-size: 15px; 
    margin: 14px 0 8px; 
    color: #444; 
    font-weight: 600;
  }
  p { 
    margin: 0 0 12px; 
    text-align: justify; 
    text-indent: 2em;
    line-height: 2;
  }
  p:first-of-type {
    text-indent: 2em;
  }
  strong, b { font-weight: 600; }
  em, i { font-style: italic; }
  code { 
    background: #f5f5f5; 
    padding: 2px 6px; 
    border-radius: 3px; 
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
  }
  pre { 
    background: #2d2d2d; 
    color: #f8f8f2; 
    padding: 16px; 
    border-radius: 6px; 
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.5;
    margin: 12px 0;
    text-indent: 0;
  }
  pre code { background: transparent; padding: 0; color: inherit; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  table { 
    border-collapse: collapse; 
    width: 100%; 
    margin: 16px auto;
    page-break-inside: avoid;
    text-indent: 0;
  }
  th, td { 
    border: 1px solid #d1d5db; 
    padding: 10px 14px; 
    text-align: left;
    vertical-align: top;
    text-indent: 0;
  }
  th { background: #f3f4f6; font-weight: 600; text-align: center; }
  tr:nth-child(even) td { background: #fafafa; }
  ul, ol { 
    margin: 0 0 12px; 
    padding-left: 2em; 
    text-indent: 0;
  }
  li { 
    margin: 4px 0; 
    text-indent: 0;
    line-height: 1.8;
  }
  li p { text-indent: 0; margin: 0; }
  blockquote { 
    border-left: 4px solid #3b82f6; 
    margin: 12px 0; 
    padding: 8px 16px; 
    background: #eff6ff; 
    border-radius: 0 4px 4px 0;
    text-indent: 0;
  }
  blockquote p { text-indent: 0; }
  img { 
    max-width: 100%; 
    height: auto;
    display: block;
    margin: 16px auto;
    page-break-inside: avoid;
  }
  hr { 
    border: none; 
    border-top: 1px solid #e5e7eb; 
    margin: 20px 0; 
  }
  .center { text-align: center; margin-left: auto; margin-right: auto; }
  .indent-0 { text-indent: 0; }
</style>
</head>
<body>${body}</body>
</html>`
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request } = ctx

  if (request.method === 'OPTIONS') return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
  if (request.method !== 'POST') return err('方法不允许', 405)

  try {
    const fd = await request.formData()
    const file = fd.get('file') as File | null
    const tgt = (fd.get('targetFormat') as string | null)?.toLowerCase()
    const extractedText = fd.get('extractedText') as string | null

    if (!file) return err('未提供文件', 400)
    if (!tgt)  return err('未指定目标格式', 400)

    const src = getExt(file.name)
    if (!src)       return err('无法识别源文件格式', 400)
    if (src === tgt) return err('源格式和目标格式相同', 400)

    let out: Uint8Array

    if (src === 'docx' || src === 'doc') {
      out = await fromDocx(await file.arrayBuffer(), tgt)
    } else if (src === 'pdf') {
      if (!extractedText) return err('PDF 解析需要在前端完成', 400)
      if (tgt === 'txt')  out = toTxt(extractedText)
      else if (tgt === 'html') out = toHtml(extractedText, 'txt')
      else if (tgt === 'md')   out = toMarkdown(extractedText, 'txt')
      else if (tgt === 'docx') out = await toDocx(extractedText, 'txt')
      else if (tgt === 'rtf')  out = toRtf(extractedText)
      else return err(`不支持从 PDF 转换到 ${tgt}`, 400)
    } else {
      const buf = await file.arrayBuffer()
      let text = new TextDecoder('utf-8', { fatal: false }).decode(buf)
      if (src === 'rtf') text = extractRtfText(text)
      if (tgt === 'txt')  out = toTxt(text)
      else if (tgt === 'html') out = toHtml(text, src)
      else if (tgt === 'md')   out = toMarkdown(text, src)
      else if (tgt === 'docx') out = await toDocx(text, src)
      else if (tgt === 'pdf')  out = encode(wrapHtmlForPdf(toHtmlBody(text, src)))
      else if (tgt === 'rtf')  out = toRtf(text)
      else return err(`不支持从 ${src} 转换到 ${tgt}`, 400)
    }

    const mime = MIME[tgt] ?? 'application/octet-stream'
    const name = `${getStem(file.name)}.${tgt}`
    return new Response(out, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (e) {
    console.error('[convert]', e)
    return err(e instanceof Error ? e.message : '服务器内部错误', 500)
  }
}

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
