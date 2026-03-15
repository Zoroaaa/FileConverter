import type { DataFormat, SupportedFormat } from '@/types'

interface ParsedData {
  type: 'object' | 'array' | 'primitive'
  data: unknown
}

function parseJson(content: string): ParsedData {
  const data = JSON.parse(content)
  return {
    type: Array.isArray(data) ? 'array' : typeof data === 'object' ? 'object' : 'primitive',
    data
  }
}

function parseXml(content: string): ParsedData {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/xml')
  
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('XML 解析错误: 无效的 XML 格式')
  }
  
  function xmlToJson(node: Element | Document): unknown {
    if (node.nodeType === Node.DOCUMENT_NODE) {
      const root = (node as Document).documentElement
      return { [root.tagName]: xmlToJson(root) }
    }
    
    const obj: Record<string, unknown> = {}
    const children = Array.from((node as Element).children)
    
    if (children.length === 0) {
      const text = (node as Element).textContent?.trim()
      if ((node as Element).attributes.length > 0) {
        obj['_text'] = text ?? ''
        for (const attr of Array.from((node as Element).attributes)) {
          obj[`@${attr.name}`] = attr.value
        }
        return obj
      }
      return text ?? ''
    }
    
    for (const child of children) {
      const childName = child.tagName
      const childValue = xmlToJson(child)
      
      if (obj[childName]) {
        if (!Array.isArray(obj[childName])) {
          obj[childName] = [obj[childName]]
        }
        (obj[childName] as unknown[]).push(childValue)
      } else {
        obj[childName] = childValue
      }
    }
    
    if ((node as Element).attributes.length > 0) {
      for (const attr of Array.from((node as Element).attributes)) {
        obj[`@${attr.name}`] = attr.value
      }
    }
    
    return obj
  }
  
  const data = xmlToJson(doc)
  return {
    type: typeof data === 'object' && data !== null ? 'object' : 'primitive',
    data
  }
}

function parseCsv(content: string): ParsedData {
  const lines = content.split(/\r?\n/)
  if (lines.length === 0) {
    return { type: 'array', data: [] }
  }
  
  function parseCsvLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current.trim())
    return result
  }
  
  const headers = parseCsvLine(lines[0])
  const data: Record<string, string>[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    const values = parseCsvLine(line)
    const row: Record<string, string> = {}
    
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? ''
    }
    
    data.push(row)
  }
  
  return { type: 'array', data }
}

function parseYaml(content: string): ParsedData {
  const data = simpleYamlParse(content)
  return {
    type: Array.isArray(data) ? 'array' : typeof data === 'object' ? 'object' : 'primitive',
    data
  }
}

function simpleYamlParse(content: string): unknown {
  const lines = content.split('\n')
  const result: Record<string, unknown> = {}
  const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [{ indent: -1, obj: result }]
  
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    
    const indent = line.search(/\S/)
    const trimmed = line.trim()
    
    if (trimmed.startsWith('- ')) {
      continue
    }
    
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue
    
    const key = trimmed.slice(0, colonIndex).trim()
    let value = trimmed.slice(colonIndex + 1).trim()
    
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }
    
    const current = stack[stack.length - 1].obj
    
    if (value === '' || value === '|' || value === '>') {
      current[key] = {}
      stack.push({ indent, obj: current[key] as Record<string, unknown> })
    } else {
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1)
      } else if (value === 'true') {
        value = true as unknown as string
      } else if (value === 'false') {
        value = false as unknown as string
      } else if (value === 'null' || value === '~') {
        value = null as unknown as string
      } else if (!isNaN(Number(value))) {
        value = Number(value) as unknown as string
      }
      current[key] = value
    }
  }
  
  return result
}

function parseToml(content: string): ParsedData {
  const data = simpleTomlParse(content)
  return {
    type: typeof data === 'object' && data !== null ? 'object' : 'primitive',
    data
  }
}

function simpleTomlParse(content: string): Record<string, unknown> {
  const lines = content.split('\n')
  const result: Record<string, unknown> = {}
  let currentSection = result
  let currentSectionName = ''
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    if (!trimmed || trimmed.startsWith('#')) continue
    
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      currentSectionName = sectionMatch[1]
      currentSection = {}
      result[currentSectionName] = currentSection
      continue
    }
    
    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex === -1) continue
    
    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()
    
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1)
    } else if (value === 'true') {
      currentSection[key] = true
      continue
    } else if (value === 'false') {
      currentSection[key] = false
      continue
    } else if (!isNaN(Number(value))) {
      currentSection[key] = Number(value)
      continue
    }
    
    currentSection[key] = value
  }
  
  return result
}

function toJson(data: unknown): string {
  return JSON.stringify(data, null, 2)
}

function toXml(data: unknown, rootName = 'root'): string {
  function objectToXml(obj: unknown, indent = ''): string {
    if (obj === null || obj === undefined) {
      return ''
    }
    
    if (typeof obj !== 'object') {
      return String(obj)
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => `${indent}<item>${objectToXml(item, indent + '  ')}</item>`).join('\n')
    }
    
    const entries = Object.entries(obj as Record<string, unknown>)
    let xml = ''
    
    for (const [key, value] of entries) {
      if (key.startsWith('@')) {
        continue
      }
      
      if (key === '_text') {
        xml += objectToXml(value, indent)
        continue
      }
      
      if (value === null || value === undefined) {
        xml += `${indent}<${key}/>\n`
      } else if (typeof value === 'object') {
        xml += `${indent}<${key}>\n${objectToXml(value, indent + '  ')}${indent}</${key}>\n`
      } else {
        xml += `${indent}<${key}>${objectToXml(value, indent)}</${key}>\n`
      }
    }
    
    return xml
  }
  
  const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
  return xmlDeclaration + `<${rootName}>\n${objectToXml(data, '  ')}\n</${rootName}>`
}

function toCsv(data: unknown): string {
  let arrData: unknown[]
  
  if (!Array.isArray(data)) {
    if (typeof data === 'object' && data !== null) {
      arrData = [data]
    } else {
      throw new Error('CSV 转换需要数组或对象数据')
    }
  } else {
    arrData = data
  }
  
  if (arrData.length === 0) {
    return ''
  }
  
  const headers = Object.keys(arrData[0] as Record<string, unknown>)
  
  function escapeCsvValue(value: unknown): string {
    const str = String(value ?? '')
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
  
  const headerLine = headers.map(escapeCsvValue).join(',')
  const dataLines = arrData.map((row: unknown) => {
    const obj = row as Record<string, unknown>
    return headers.map(h => escapeCsvValue(obj[h])).join(',')
  })
  
  return [headerLine, ...dataLines].join('\n')
}

function toYaml(data: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent)
  
  if (data === null || data === undefined) {
    return 'null'
  }
  
  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      if (data.includes('\n') || data.includes(':') || data.includes('#')) {
        return `"${data.replace(/"/g, '\\"')}"`
      }
      return data
    }
    return String(data)
  }
  
  if (Array.isArray(data)) {
    return data.map(item => {
      const value = toYaml(item, indent + 1)
      if (typeof item === 'object' && item !== null) {
        return `${spaces}- \n${value.split('\n').map(l => spaces + '  ' + l).join('\n')}`
      }
      return `${spaces}- ${value}`
    }).join('\n')
  }
  
  const entries = Object.entries(data as Record<string, unknown>)
  return entries.map(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      return `${spaces}${key}:\n${toYaml(value, indent + 1)}`
    }
    return `${spaces}${key}: ${toYaml(value, indent + 1)}`
  }).join('\n')
}

function toToml(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    throw new Error('TOML 转换需要对象数据')
  }
  
  const obj = data as Record<string, unknown>
  const sections: string[] = []
  const rootPairs: string[] = []
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sections.push(`\n[${key}]`)
      const sectionObj = value as Record<string, unknown>
      for (const [subKey, subValue] of Object.entries(sectionObj)) {
        sections.push(`${subKey} = ${formatTomlValue(subValue)}`)
      }
    } else {
      rootPairs.push(`${key} = ${formatTomlValue(value)}`)
    }
  }
  
  return [...rootPairs, ...sections].join('\n')
}

function formatTomlValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '""'
  }
  if (typeof value === 'string') {
    return `"${value.replace(/"/g, '\\"')}"`
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatTomlValue).join(', ')}]`
  }
  return String(value)
}

export async function convertData(
  content: string,
  sourceFormat: DataFormat,
  targetFormat: DataFormat
): Promise<string> {
  let parsed: ParsedData
  
  switch (sourceFormat) {
    case 'json':
      parsed = parseJson(content)
      break
    case 'xml':
      parsed = parseXml(content)
      break
    case 'csv':
      parsed = parseCsv(content)
      break
    case 'yaml':
    case 'yml':
      parsed = parseYaml(content)
      break
    case 'toml':
      parsed = parseToml(content)
      break
    default:
      throw new Error(`不支持的数据源格式: ${sourceFormat}`)
  }
  
  switch (targetFormat) {
    case 'json':
      return toJson(parsed.data)
    case 'xml':
      return toXml(parsed.data)
    case 'csv':
      return toCsv(parsed.data)
    case 'yaml':
    case 'yml':
      return toYaml(parsed.data)
    case 'toml':
      return toToml(parsed.data)
    default:
      throw new Error(`不支持的数据目标格式: ${targetFormat}`)
  }
}

export function isDataFormat(format: SupportedFormat): format is DataFormat {
  const dataFormats: DataFormat[] = ['json', 'xml', 'csv', 'yaml', 'yml', 'toml']
  return dataFormats.includes(format as DataFormat)
}

export function getDataFormatMimeType(format: DataFormat): string {
  const mimeTypes: Record<DataFormat, string> = {
    json: 'application/json',
    xml: 'application/xml',
    csv: 'text/csv',
    yaml: 'application/x-yaml',
    yml: 'application/x-yaml',
    toml: 'application/toml',
  }
  return mimeTypes[format]
}
