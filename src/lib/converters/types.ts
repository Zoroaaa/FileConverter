export interface ConversionOptions {
  quality?: number   // 0.0 – 1.0 for image
  width?: number     // target width px (image resize)
  height?: number    // target height px (image resize)
  maintainAspectRatio?: boolean
}

export interface ConversionResult {
  blob: Blob
  filename: string
  mimeType: string
  /** 非致命警告，如 mammoth 跳过 OLE 嵌入对象时填充 */
  warnings?: string[]
}
