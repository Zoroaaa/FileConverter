import type { ImageFormat, SupportedFormat } from '@/types'

export interface ImageConversionOptions {
  quality?: number
  width?: number
  height?: number
  maintainAspectRatio?: boolean
}

const IMAGE_MIME_TYPES: Record<ImageFormat, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  tiff: 'image/tiff',
}

function getMimeType(format: ImageFormat): string {
  return IMAGE_MIME_TYPES[format] ?? 'image/png'
}

function canUseCanvasConversion(targetFormat: ImageFormat): boolean {
  const supportedFormats: ImageFormat[] = ['jpg', 'jpeg', 'png', 'webp', 'bmp']
  return supportedFormats.includes(targetFormat)
}

export async function convertImage(
  file: File,
  targetFormat: ImageFormat,
  options: ImageConversionOptions = {}
): Promise<Blob> {
  const {
    quality = 0.92,
    width,
    height,
    maintainAspectRatio = true
  } = options

  if (!canUseCanvasConversion(targetFormat)) {
    throw new Error(`不支持的图像转换目标格式: ${targetFormat}`)
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let targetWidth = width ?? img.naturalWidth
      let targetHeight = height ?? img.naturalHeight

      if (width && height && maintainAspectRatio) {
        const aspectRatio = img.naturalWidth / img.naturalHeight
        if (width / height > aspectRatio) {
          targetWidth = height * aspectRatio
          targetHeight = height
        } else {
          targetWidth = width
          targetHeight = width / aspectRatio
        }
      } else if (width && !height && maintainAspectRatio) {
        targetWidth = width
        targetHeight = width / (img.naturalWidth / img.naturalHeight)
      } else if (height && !width && maintainAspectRatio) {
        targetWidth = height * (img.naturalWidth / img.naturalHeight)
        targetHeight = height
      }

      const canvas = document.createElement('canvas')
      canvas.width = Math.round(targetWidth)
      canvas.height = Math.round(targetHeight)

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 Canvas 上下文'))
        return
      }

      if (targetFormat === 'jpg' || targetFormat === 'jpeg') {
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const mimeType = getMimeType(targetFormat)
      const qualityValue = (targetFormat === 'jpg' || targetFormat === 'jpeg' || targetFormat === 'webp')
        ? quality
        : undefined

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('图像转换失败'))
          }
        },
        mimeType,
        qualityValue
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('无法加载图像文件'))
    }

    img.src = objectUrl
  })
}

export async function convertSvgToRaster(
  svgContent: string,
  targetFormat: 'png' | 'jpg' | 'webp',
  options: ImageConversionOptions = {}
): Promise<Blob> {
  const { quality = 0.92, width = 800, height = 600 } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const objectUrl = URL.createObjectURL(svgBlob)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 Canvas 上下文'))
        return
      }

      if (targetFormat === 'jpg') {
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      ctx.drawImage(img, 0, 0, width, height)

      const mimeType = getMimeType(targetFormat)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('SVG 转换失败'))
          }
        },
        mimeType,
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('无法加载 SVG 文件'))
    }

    img.src = objectUrl
  })
}

export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('无法加载图像'))
    }

    img.src = objectUrl
  })
}

export function isImageFormat(format: SupportedFormat): format is ImageFormat {
  const imageFormats: ImageFormat[] = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'ico', 'svg', 'tiff']
  return imageFormats.includes(format as ImageFormat)
}

export function supportsCanvasConversion(sourceFormat: ImageFormat, targetFormat: ImageFormat): boolean {
  const rasterFormats: ImageFormat[] = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif']
  
  if (sourceFormat === 'svg') {
    return ['png', 'jpg', 'webp'].includes(targetFormat)
  }
  
  if (sourceFormat === 'gif') {
    return rasterFormats.includes(targetFormat)
  }
  
  if (targetFormat === 'gif') {
    return ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(sourceFormat)
  }
  
  return rasterFormats.includes(sourceFormat) && rasterFormats.includes(targetFormat)
}
