export type FormatCategory = 'document' | 'image' | 'audio' | 'video' | 'data'

export type DocumentFormat = 'pdf' | 'docx' | 'doc' | 'xls' | 'md' | 'txt' | 'html' | 'rtf' | 'odt' | 'ods' | 'odp' | 'xlsx' | 'pptx' | 'ppt' | 'vsd' | 'vsdx'
export type ImageFormat = 'jpg' | 'jpeg' | 'png' | 'webp' | 'gif' | 'bmp' | 'ico' | 'svg' | 'tiff'
export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'flac' | 'aac' | 'm4a'
export type VideoFormat = 'mp4' | 'webm' | 'avi' | 'mov' | 'mkv'
export type DataFormat = 'json' | 'xml' | 'yaml' | 'yml' | 'toml' | 'csv'

export type SupportedFormat =
  | DocumentFormat | ImageFormat | AudioFormat | VideoFormat | DataFormat

export interface FormatOption {
  value: SupportedFormat
  label: string
  extension: string
  mimeType: string
  icon: string
  category: FormatCategory
}

export interface FileInfo {
  file: File
  name: string
  size: number
  format: SupportedFormat
  category: FormatCategory
}

export interface CategoryInfo {
  id: FormatCategory
  label: string
  icon: string
  description: string
}

export const CATEGORY_INFO: CategoryInfo[] = [
  { id: 'document', label: '文档', icon: '📄', description: 'PDF、Word、Markdown 等' },
  { id: 'image',    label: '图像', icon: '🖼️', description: 'JPG、PNG、WebP 等' },
  { id: 'audio',    label: '音频', icon: '🎵', description: 'MP3、WAV、FLAC 等' },
  { id: 'video',    label: '视频', icon: '🎬', description: 'MP4、WebM、AVI 等' },
  { id: 'data',     label: '数据', icon: '📊', description: 'JSON、XML、CSV 等' },
]

export const SUPPORTED_FORMATS: FormatOption[] = [
  // ── Document ──────────────────────────────────────────────────────────────
  { value: 'pdf',  label: 'PDF',                  extension: '.pdf',  mimeType: 'application/pdf',                                                                         icon: '📄', category: 'document' },
  { value: 'docx', label: 'Word (DOCX)',           extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',                 icon: '📝', category: 'document' },
  { value: 'doc',  label: 'Word 97-2003',          extension: '.doc',  mimeType: 'application/msword',                                                                      icon: '📝', category: 'document' },
  { value: 'odt',  label: 'ODT (LibreOffice)',     extension: '.odt',  mimeType: 'application/vnd.oasis.opendocument.text',                                                 icon: '📄', category: 'document' },
  { value: 'rtf',  label: 'RTF',                   extension: '.rtf',  mimeType: 'application/rtf',                                                                         icon: '📄', category: 'document' },
  { value: 'xlsx', label: 'Excel (XLSX)',          extension: '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',                       icon: '📊', category: 'document' },
  { value: 'xls',  label: 'Excel 97-2003',         extension: '.xls',  mimeType: 'application/vnd.ms-excel',                                                                icon: '📊', category: 'document' },
  { value: 'ods',  label: 'ODS (Calc)',            extension: '.ods',  mimeType: 'application/vnd.oasis.opendocument.spreadsheet',                                          icon: '📊', category: 'document' },
  { value: 'pptx', label: 'PowerPoint (PPTX)',     extension: '.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',               icon: '📑', category: 'document' },
  { value: 'ppt',  label: 'PowerPoint 97-2003',   extension: '.ppt',  mimeType: 'application/vnd.ms-powerpoint',                                                           icon: '📑', category: 'document' },
  { value: 'odp',  label: 'ODP (Impress)',         extension: '.odp',  mimeType: 'application/vnd.oasis.opendocument.presentation',                                        icon: '📑', category: 'document' },
  { value: 'vsd',  label: 'Visio (.vsd)',           extension: '.vsd',  mimeType: 'application/vnd.visio',                                                                   icon: '📐', category: 'document' },
  { value: 'vsdx', label: 'Visio (.vsdx)',          extension: '.vsdx', mimeType: 'application/vnd.ms-visio.drawing',                                                        icon: '📐', category: 'document' },
  { value: 'md',   label: 'Markdown',              extension: '.md',   mimeType: 'text/markdown',                                                                           icon: '📋', category: 'document' },
  { value: 'txt',  label: 'Text',                  extension: '.txt',  mimeType: 'text/plain',                                                                              icon: '📃', category: 'document' },
  { value: 'html', label: 'HTML',                  extension: '.html', mimeType: 'text/html',                                                                               icon: '🌐', category: 'document' },
  // ── Image ─────────────────────────────────────────────────────────────────
  { value: 'jpg',  label: 'JPEG',  extension: '.jpg',  mimeType: 'image/jpeg',    icon: '🖼️', category: 'image' },
  { value: 'jpeg', label: 'JPEG',  extension: '.jpeg', mimeType: 'image/jpeg',    icon: '🖼️', category: 'image' },
  { value: 'png',  label: 'PNG',   extension: '.png',  mimeType: 'image/png',     icon: '🖼️', category: 'image' },
  { value: 'webp', label: 'WebP',  extension: '.webp', mimeType: 'image/webp',    icon: '🖼️', category: 'image' },
  { value: 'gif',  label: 'GIF',   extension: '.gif',  mimeType: 'image/gif',     icon: '🖼️', category: 'image' },
  { value: 'bmp',  label: 'BMP',   extension: '.bmp',  mimeType: 'image/bmp',     icon: '🖼️', category: 'image' },
  { value: 'ico',  label: 'ICO',   extension: '.ico',  mimeType: 'image/x-icon',  icon: '🖼️', category: 'image' },
  { value: 'svg',  label: 'SVG',   extension: '.svg',  mimeType: 'image/svg+xml', icon: '🖼️', category: 'image' },
  { value: 'tiff', label: 'TIFF',  extension: '.tiff', mimeType: 'image/tiff',    icon: '🖼️', category: 'image' },
  // ── Audio ─────────────────────────────────────────────────────────────────
  { value: 'mp3',  label: 'MP3',   extension: '.mp3',  mimeType: 'audio/mpeg',    icon: '🎵', category: 'audio' },
  { value: 'wav',  label: 'WAV',   extension: '.wav',  mimeType: 'audio/wav',     icon: '🎵', category: 'audio' },
  { value: 'ogg',  label: 'OGG',   extension: '.ogg',  mimeType: 'audio/ogg',     icon: '🎵', category: 'audio' },
  { value: 'flac', label: 'FLAC',  extension: '.flac', mimeType: 'audio/flac',    icon: '🎵', category: 'audio' },
  { value: 'aac',  label: 'AAC',   extension: '.aac',  mimeType: 'audio/aac',     icon: '🎵', category: 'audio' },
  { value: 'm4a',  label: 'M4A',   extension: '.m4a',  mimeType: 'audio/mp4',     icon: '🎵', category: 'audio' },
  // ── Video ─────────────────────────────────────────────────────────────────
  { value: 'mp4',  label: 'MP4',   extension: '.mp4',  mimeType: 'video/mp4',          icon: '🎬', category: 'video' },
  { value: 'webm', label: 'WebM',  extension: '.webm', mimeType: 'video/webm',         icon: '🎬', category: 'video' },
  { value: 'avi',  label: 'AVI',   extension: '.avi',  mimeType: 'video/x-msvideo',    icon: '🎬', category: 'video' },
  { value: 'mov',  label: 'MOV',   extension: '.mov',  mimeType: 'video/quicktime',    icon: '🎬', category: 'video' },
  { value: 'mkv',  label: 'MKV',   extension: '.mkv',  mimeType: 'video/x-matroska',  icon: '🎬', category: 'video' },
  // ── Data ──────────────────────────────────────────────────────────────────
  { value: 'csv',  label: 'CSV',   extension: '.csv',  mimeType: 'text/csv',            icon: '📊', category: 'data' },
  { value: 'json', label: 'JSON',  extension: '.json', mimeType: 'application/json',    icon: '📊', category: 'data' },
  { value: 'xml',  label: 'XML',   extension: '.xml',  mimeType: 'application/xml',     icon: '📊', category: 'data' },
  { value: 'yaml', label: 'YAML',  extension: '.yaml', mimeType: 'application/x-yaml', icon: '📊', category: 'data' },
  { value: 'yml',  label: 'YAML',  extension: '.yml',  mimeType: 'application/x-yaml', icon: '📊', category: 'data' },
  { value: 'toml', label: 'TOML',  extension: '.toml', mimeType: 'application/toml',   icon: '📊', category: 'data' },
]

/**
 * 转换兼容矩阵（与后端 doc-convert.ts 的 CONVERSION_MATRIX 严格对齐）
 *
/**
 * ⚠️ Gotenberg LibreOffice 仅支持输出 PDF，不支持非 PDF 格式输出
 * 已移除 odt/rtf/ods/odp 作为输出目标，避免产生乱码文件
 * PDF → docx/xlsx/pptx: 需要 Adobe API（备用），Gotenberg 不支持此方向
 * PDF → txt/html: 前端 pdfjs 提取文本后处理
 * 其余文档: Gotenberg LibreOffice / Chromium
 */
export const FORMAT_COMPATIBILITY: Record<FormatCategory, Record<string, SupportedFormat[]>> = {
  document: {
    // PDF（Adobe 负责 →Office，pdfjs 负责 →txt/html）
    pdf:  ['docx', 'xlsx', 'pptx', 'txt', 'html'],
    // Word 类（移除 odt/rtf 输出：Gotenberg LibreOffice 实际只能输出 PDF）
    docx: ['pdf', 'txt', 'html', 'md'],
    doc:  ['pdf', 'docx', 'txt', 'html'],
    odt:  ['pdf', 'txt', 'html'],
    rtf:  ['pdf', 'txt', 'html'],
    // 表格（移除 ods 输出：同上）
    xlsx: ['pdf', 'csv', 'html'],
    xls:  ['pdf', 'xlsx', 'csv', 'html'],
    ods:  ['pdf', 'csv', 'html'],
    // 演示（移除 odp 输出：同上）
    pptx: ['pdf', 'txt'],
    ppt:  ['pdf', 'pptx', 'txt'],
    odp:  ['pdf', 'txt'],
    // Visio（LibreOffice 内置导入器，仅支持转 PDF）
    vsd:  ['pdf'],
    vsdx: ['pdf'],
    // 纯文本/Web
    md:   ['pdf', 'docx', 'html', 'txt'],
    txt:  ['pdf', 'docx', 'html', 'md'],
    html: ['pdf', 'docx', 'txt', 'md'],
    // CSV（SheetJS 前端处理部分）
    csv:  ['xlsx', 'json', 'xml', 'html'],
  },
  image: {
    jpg:  ['png', 'webp', 'gif', 'bmp', 'ico', 'tiff'],
    jpeg: ['png', 'webp', 'gif', 'bmp', 'ico', 'tiff'],
    png:  ['jpg', 'webp', 'gif', 'bmp', 'ico', 'tiff'],
    webp: ['jpg', 'png', 'gif', 'bmp', 'tiff'],
    gif:  ['jpg', 'png', 'webp', 'bmp'],
    bmp:  ['jpg', 'png', 'webp', 'gif', 'ico'],
    ico:  ['jpg', 'png', 'webp', 'bmp'],
    svg:  ['png', 'jpg', 'webp'],
    tiff: ['jpg', 'png', 'webp', 'gif', 'bmp'],
  },
  audio: {
    mp3:  ['wav', 'ogg', 'flac', 'aac', 'm4a'],
    wav:  ['mp3', 'ogg', 'flac', 'aac', 'm4a'],
    ogg:  ['mp3', 'wav', 'flac', 'aac', 'm4a'],
    flac: ['mp3', 'wav', 'ogg', 'aac', 'm4a'],
    aac:  ['mp3', 'wav', 'ogg', 'flac', 'm4a'],
    m4a:  ['mp3', 'wav', 'ogg', 'flac', 'aac'],
  },
  video: {
    mp4:  ['webm', 'avi', 'mov', 'mkv'],
    webm: ['mp4', 'avi', 'mov', 'mkv'],
    avi:  ['mp4', 'webm', 'mov', 'mkv'],
    mov:  ['mp4', 'webm', 'avi', 'mkv'],
    mkv:  ['mp4', 'webm', 'avi', 'mov'],
  },
  data: {
    csv:  ['xlsx', 'json', 'xml'],
    json: ['xml', 'csv', 'yaml', 'toml'],
    xml:  ['json', 'csv', 'yaml'],
    yaml: ['json', 'xml', 'csv', 'toml'],
    yml:  ['json', 'xml', 'csv', 'toml'],
    toml: ['json', 'yaml', 'csv'],
  },
}

export const FORMAT_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
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
  md:   'text/markdown', txt: 'text/plain', html: 'text/html', csv: 'text/csv',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', bmp: 'image/bmp', ico: 'image/x-icon',
  svg: 'image/svg+xml', tiff: 'image/tiff',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
  aac: 'audio/aac', m4a: 'audio/mp4',
  mp4: 'video/mp4', webm: 'video/webm', avi: 'video/x-msvideo',
  mov: 'video/quicktime', mkv: 'video/x-matroska',
  json: 'application/json', xml: 'application/xml',
  yaml: 'application/x-yaml', yml: 'application/x-yaml', toml: 'application/toml',
}

export function getFormatCategory(format: SupportedFormat): FormatCategory {
  return SUPPORTED_FORMATS.find(f => f.value === format)?.category ?? 'document'
}
export function getFormatInfo(format: SupportedFormat): FormatOption | undefined {
  return SUPPORTED_FORMATS.find(f => f.value === format)
}
export function getCompatibleTargetFormats(sourceFormat: SupportedFormat): SupportedFormat[] {
  const cat = getFormatCategory(sourceFormat)
  return (FORMAT_COMPATIBILITY[cat] as Record<string, SupportedFormat[]>)[sourceFormat] ?? []
}
export function detectFormatFromExtension(extension: string): SupportedFormat | null {
  const ext = extension.toLowerCase().replace(/^\./, '')
  const map: Record<string, SupportedFormat> = {
    pdf:'pdf', docx:'docx', doc:'doc', xlsx:'xlsx', xls:'xls', pptx:'pptx', ppt:'ppt',
    odt:'odt', ods:'ods', odp:'odp', rtf:'rtf',
    vsd:'vsd', vsdx:'vsdx',
    md:'md', markdown:'md', txt:'txt', html:'html', htm:'html', csv:'csv',
    jpg:'jpg', jpeg:'jpeg', png:'png', webp:'webp', gif:'gif',
    bmp:'bmp', ico:'ico', svg:'svg', tiff:'tiff', tif:'tiff',
    mp3:'mp3', wav:'wav', ogg:'ogg', flac:'flac', aac:'aac', m4a:'m4a',
    mp4:'mp4', webm:'webm', avi:'avi', mov:'mov', mkv:'mkv',
    json:'json', xml:'xml', yaml:'yaml', yml:'yml', toml:'toml',
  }
  return map[ext] ?? null
}
export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase()
}
export function getFileNameWithoutExtension(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i === -1 ? filename : filename.slice(0, i)
}
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
