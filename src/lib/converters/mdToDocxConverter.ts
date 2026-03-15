/**
 * Markdown → DOCX 前端转换器
 * 
 * 使用 docx 库在浏览器本地完成转换，无需后端服务
 * 支持：标题、段落、粗体、斜体、代码、列表、引用、链接、表格
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, ExternalHyperlink } from 'docx'
import type { ConversionResult } from './types'
import { getFileNameWithoutExtension } from '@/types'

interface MdNode {
  type: 'heading' | 'paragraph' | 'list' | 'blockquote' | 'code' | 'hr' | 'table'
  level?: number
  content?: string
  children?: MdNode[]
  items?: string[]
  lang?: string
  rows?: string[][]
}

function parseMarkdown(md: string): MdNode[] {
  const lines = md.split('\n')
  const nodes: MdNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.match(/^#{1,6}\s/)) {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      if (match) {
        nodes.push({ type: 'heading', level: match[1].length, content: match[2] })
      }
      i++
    } else if (line.match(/^[-*+]\s/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^[-*+]\s/)) {
        items.push(lines[i].replace(/^[-*+]\s/, ''))
        i++
      }
      nodes.push({ type: 'list', items })
    } else if (line.match(/^\d+\.\s/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push(lines[i].replace(/^\d+\.\s/, ''))
        i++
      }
      nodes.push({ type: 'list', items })
    } else if (line.startsWith('> ')) {
      const content: string[] = []
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        content.push(lines[i].replace(/^>?\s?/, ''))
        i++
      }
      nodes.push({ type: 'blockquote', content: content.join('\n') })
    } else if (line.startsWith('```')) {
      const lang = line.slice(3)
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++
      nodes.push({ type: 'code', lang, content: codeLines.join('\n') })
    } else if (line.match(/^---+$/)) {
      nodes.push({ type: 'hr' })
      i++
    } else if (line.includes('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|')) {
        if (!lines[i].match(/^\s*\|?[-:|]+\|?\s*$/)) {
          rows.push(lines[i].split('|').map(cell => cell.trim()).filter(Boolean))
        }
        i++
      }
      if (rows.length > 0) {
        nodes.push({ type: 'table', rows })
      }
    } else if (line.trim()) {
      nodes.push({ type: 'paragraph', content: line })
      i++
    } else {
      i++
    }
  }

  return nodes
}

interface TextSegment {
  text?: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  link?: { text: string; url: string }
}

interface MatchResult {
  type: 'link' | 'bold' | 'italic' | 'code'
  index: number
  length: number
  segment?: { text: string; url: string }
  text?: string
}

function parseInlineFormatting(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let remaining = text

  while (remaining.length > 0) {
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/)
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    const italicMatch = remaining.match(/\*(.+?)\*/)
    const codeMatch = remaining.match(/`([^`]+)`/)

    const matches = [
      linkMatch && { type: 'link' as const, index: linkMatch.index!, length: linkMatch[0].length, segment: { text: linkMatch[1], url: linkMatch[2] } },
      boldMatch && { type: 'bold' as const, index: boldMatch.index!, length: boldMatch[0].length, text: boldMatch[1] },
      italicMatch && { type: 'italic' as const, index: italicMatch.index!, length: italicMatch[0].length, text: italicMatch[1] },
      codeMatch && { type: 'code' as const, index: codeMatch.index!, length: codeMatch[0].length, text: codeMatch[1] },
    ].filter(Boolean) as MatchResult[]

    if (matches.length === 0) {
      if (remaining.length > 0) {
        segments.push({ text: remaining })
      }
      break
    }

    const firstMatch = matches.sort((a, b) => a.index - b.index)[0]

    if (firstMatch.index > 0) {
      segments.push({ text: remaining.slice(0, firstMatch.index) })
    }

    if (firstMatch.type === 'link') {
      segments.push({ link: firstMatch.segment })
    } else if (firstMatch.type === 'bold') {
      segments.push({ text: firstMatch.text!, bold: true })
    } else if (firstMatch.type === 'italic') {
      segments.push({ text: firstMatch.text!, italic: true })
    } else if (firstMatch.type === 'code') {
      segments.push({ text: firstMatch.text!, code: true })
    }

    remaining = remaining.slice(firstMatch.index + firstMatch.length)
  }

  return segments
}

function createTextRun(text: string, options: { bold?: boolean; italic?: boolean; code?: boolean; size?: number } = {}): TextRun {
  return new TextRun({
    text,
    bold: options.bold,
    italics: options.italic,
    size: options.size ?? 24,
    font: {
      name: options.code ? 'Consolas' : 'Calibri',
      eastAsia: 'SimSun',
    },
    shading: options.code ? { fill: 'F5F5F5' } : undefined,
  })
}

function createTextRuns(segments: TextSegment[]): (TextRun | ExternalHyperlink)[] {
  return segments.map(seg => {
    if (seg.link) {
      return new ExternalHyperlink({
        children: [new TextRun({ 
          text: seg.link.text, 
          style: 'Hyperlink', 
          color: '2563EB', 
          underline: { type: 'single' },
          font: { name: 'Calibri', eastAsia: 'SimSun' },
        })],
        link: seg.link.url,
      })
    }
    return createTextRun(seg.text || '', { bold: seg.bold, italic: seg.italic, code: seg.code })
  })
}

function createParagraphFromMd(node: MdNode): Paragraph {
  switch (node.type) {
    case 'heading': {
      const headingLevels: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      }
      const segments = parseInlineFormatting(node.content || '')
      return new Paragraph({
        children: segments.map(seg => {
          if (seg.link) {
            return new ExternalHyperlink({
              children: [new TextRun({ 
                text: seg.link.text, 
                style: 'Hyperlink', 
                color: '2563EB', 
                underline: { type: 'single' },
                font: { name: 'Calibri', eastAsia: 'SimSun' },
              })],
              link: seg.link.url,
            })
          }
          return createTextRun(seg.text || '', { 
            bold: true, 
            size: node.level === 1 ? 36 : node.level === 2 ? 32 : node.level === 3 ? 28 : 24 
          })
        }),
        heading: headingLevels[node.level || 1],
        spacing: { before: 240, after: 120 },
      })
    }
    case 'paragraph': {
      const segments = parseInlineFormatting(node.content || '')
      return new Paragraph({
        children: createTextRuns(segments),
        spacing: { after: 120 },
      })
    }
    case 'blockquote': {
      return new Paragraph({
        children: [createTextRun(node.content || '', { italic: true })],
        indent: { left: 720 },
        border: { left: { style: BorderStyle.SINGLE, size: 24, color: '3B82F6' } },
        spacing: { after: 120 },
      })
    }
    case 'code': {
      return new Paragraph({
        children: [new TextRun({ 
          text: node.content || '', 
          font: { name: 'Consolas', eastAsia: 'Consolas' },
          size: 20, 
        })],
        spacing: { after: 120 },
        shading: { fill: 'F5F5F5' },
      })
    }
    case 'hr': {
      return new Paragraph({
        children: [],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB' } },
        spacing: { before: 240, after: 240 },
      })
    }
    default:
      return new Paragraph({ children: [] })
  }
}

async function convertMdToDocx(mdContent: string): Promise<Blob> {
  const nodes = parseMarkdown(mdContent)
  const children: Paragraph[] = []

  for (const node of nodes) {
    if (node.type === 'list' && node.items) {
      for (const item of node.items) {
        const segments = parseInlineFormatting(item)
        children.push(new Paragraph({
          children: createTextRuns(segments),
          bullet: { level: 0 },
          spacing: { after: 60 },
        }))
      }
    } else if (node.type === 'table' && node.rows) {
      for (let ri = 0; ri < node.rows.length; ri++) {
        const row = node.rows[ri]
        children.push(new Paragraph({
          children: row.map(cell => createTextRun(cell + '  ', { bold: ri === 0, size: 22 })),
          spacing: { after: 60 },
        }))
      }
    } else {
      children.push(createParagraphFromMd(node))
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  })

  const buffer = await Packer.toBlob(doc)
  return buffer
}

export async function convertMdToDocxFile(file: File): Promise<ConversionResult> {
  const content = await file.text()
  const blob = await convertMdToDocx(content)
  const stem = getFileNameWithoutExtension(file.name)

  return {
    blob,
    filename: `${stem}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
}

export function isMdToDocx(src: string, tgt: string): boolean {
  return src === 'md' && tgt === 'docx'
}
