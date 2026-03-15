/**
 * DOCX 前端解析器
 * 
 * 使用 mammoth 库在浏览器本地解析 DOCX 文件
 * 支持：DOCX → MD / HTML / TXT
 */

import mammoth from 'mammoth'
import type { ConversionResult } from './types'
import { getFileNameWithoutExtension } from '@/types'

function htmlToMarkdown(html: string): string {
  let md = html
  md = md.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `${'#'.repeat(Number(n))} ${stripTags(t)}\n\n`)
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, t) => `**${stripTags(t)}**`)
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_, t) => `**${stripTags(t)}**`)
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, t) => `*${stripTags(t)}*`)
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_, t) => `*${stripTags(t)}*`)
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, t) => `\`${stripTags(t)}\``)
  md = md.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, h, t) => `[${stripTags(t)}](${h})`)
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${stripTags(t).trim()}\n`)
  md = md.replace(/<[uo]l[^>]*>([\s\S]*?)<\/[uo]l>/gi, '$1\n')
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `${stripTags(t)}\n\n`)
  md = md.replace(/<br\s*\/?>/gi, '\n')
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) => `> ${stripTags(t).trim()}\n\n`)
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n\n')
  md = stripTags(md)
  md = md.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  return md.replace(/\n{3,}/g, '\n\n').trim()
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function wrapHtml(body: string, title = 'Document'): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',Helvetica,sans-serif;line-height:1.8;max-width:860px;margin:48px auto;padding:0 24px;color:#111827;font-size:16px}
  h1{font-size:1.9em;margin:0 0 .5em;border-bottom:2px solid #e5e7eb;padding-bottom:.3em}
  h2{font-size:1.45em;margin:1.5em 0 .5em}
  h3{font-size:1.2em;margin:1.3em 0 .4em}
  h4{font-size:1em;margin:1.1em 0 .4em;color:#374151}
  p{margin:0 0 1em}
  code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:.88em;font-family:ui-monospace,'Cascadia Code',monospace}
  pre{background:#1e293b;color:#e2e8f0;padding:20px;border-radius:10px;overflow:auto;font-size:.88em;line-height:1.65}
  pre code{background:transparent;padding:0;color:inherit}
  a{color:#2563eb}
  table{border-collapse:collapse;width:100%;margin:1em 0}
  th,td{border:1px solid #e5e7eb;padding:9px 13px;text-align:left}
  th{background:#f9fafb;font-weight:600}
  tr:nth-child(even) td{background:#fafafa}
  blockquote{border-left:4px solid #3b82f6;margin:1em 0;padding:.5em 1em;background:#eff6ff;border-radius:0 6px 6px 0}
  ul,ol{margin:0 0 1em;padding-left:1.8em}li{margin:.3em 0}
  img{max-width:100%;border-radius:8px}
  hr{border:none;border-top:1px solid #e5e7eb;margin:2em 0}
</style>
</head>
<body>${body}</body>
</html>`
}

export async function convertDocxToHtml(file: File): Promise<ConversionResult> {
  const buffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
  const html = wrapHtml(result.value, getFileNameWithoutExtension(file.name))
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
  
  return {
    blob,
    filename: `${getFileNameWithoutExtension(file.name)}.html`,
    mimeType: 'text/html',
  }
}

export async function convertDocxToMd(file: File): Promise<ConversionResult> {
  const buffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
  const md = htmlToMarkdown(result.value)
  const blob = new Blob([md], { type: 'text/markdown; charset=utf-8' })

  // mammoth 会在 messages 里记录它无法处理的元素（如 OLE 嵌入对象）
  const warnings: string[] = []
  const hasOle = result.messages.some(m =>
    m.message?.toLowerCase().includes('unrecognised') ||
    m.message?.toLowerCase().includes('object') ||
    m.type === 'warning'
  )
  if (hasOle) {
    warnings.push('文档包含嵌入对象（如内嵌 Excel 表格），mammoth 不支持此类元素，相关内容已跳过。如需保留嵌入内容，请先将其转换为 PDF 再提取文本。')
  }

  return {
    blob,
    filename: `${getFileNameWithoutExtension(file.name)}.md`,
    mimeType: 'text/markdown',
    warnings: warnings.length ? warnings : undefined,
  }
}

export async function convertDocxToTxt(file: File): Promise<ConversionResult> {
  const buffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  const text = result.value
  const blob = new Blob([text], { type: 'text/plain; charset=utf-8' })
  
  return {
    blob,
    filename: `${getFileNameWithoutExtension(file.name)}.txt`,
    mimeType: 'text/plain',
  }
}

export function isDocxToText(src: string, tgt: string): boolean {
  return src === 'docx' && ['md', 'html', 'txt'].includes(tgt)
}
