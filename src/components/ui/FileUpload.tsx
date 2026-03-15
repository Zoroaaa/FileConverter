import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { Upload, FileText, X, Image, Music, Video, Database } from 'lucide-react'
import type { FileInfo, FormatCategory } from '@/types'
import { getFileExtension, formatFileSize } from '@/types'
import { 
  SUPPORTED_FORMATS, 
  detectFormatFromExtension, 
  getFormatCategory, 
  getFormatInfo,
  CATEGORY_INFO 
} from '@/types'

interface FileUploadProps {
  onFileSelect: (fileInfo: FileInfo) => void
  onFileRemove: () => void
  selectedFile: FileInfo | null
  className?: string
}

const CATEGORY_ICONS: Record<FormatCategory, React.ReactNode> = {
  document: <FileText className="w-5 h-5" />,
  image: <Image className="w-5 h-5" />,
  audio: <Music className="w-5 h-5" />,
  video: <Video className="w-5 h-5" />,
  data: <Database className="w-5 h-5" />,
}

const ACCEPTED_EXTENSIONS = SUPPORTED_FORMATS.map(f => f.extension).join(',')

export function FileUpload({ onFileSelect, onFileRemove, selectedFile, className }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFile = useCallback((file: File) => {
    const ext = getFileExtension(file.name)
    const format = detectFormatFromExtension(ext)
    
    if (!format) {
      alert(`不支持的文件格式: .${ext}`)
      return
    }
    
    const category = getFormatCategory(format)
    
    onFileSelect({
      file,
      name: file.name,
      size: file.size,
      format,
      category,
    })
  }, [onFileSelect])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const formatInfo = selectedFile ? getFormatInfo(selectedFile.format) : null
  const categoryInfo = selectedFile ? CATEGORY_INFO.find(c => c.id === selectedFile.category) : null

  return (
    <div className={cn('w-full', className)}>
      {!selectedFile ? (
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'file-drop-zone flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300',
            isDragOver
              ? 'border-primary-400 bg-primary-50 scale-[1.02]'
              : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50'
          )}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <div className={cn(
              'p-4 rounded-full mb-4 transition-all duration-300',
              isDragOver ? 'bg-primary-100 text-primary-500' : 'bg-surface-100 text-surface-400'
            )}>
              <Upload className={cn('w-8 h-8', isDragOver && 'animate-bounce')} />
            </div>
            <p className="mb-2 text-lg font-medium text-surface-800">
              {isDragOver ? '松开以上传文件' : '拖拽文件到这里'}
            </p>
            <p className="text-sm text-surface-400">
              或 <span className="text-primary-500 font-medium">点击选择文件</span>
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-md">
              {CATEGORY_INFO.map(category => (
                <span 
                  key={category.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-surface-100 rounded-full text-xs text-surface-500"
                >
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                </span>
              ))}
            </div>
          </div>
          <input
            type="file"
            className="hidden"
            onChange={handleInputChange}
            accept={ACCEPTED_EXTENSIONS}
          />
        </label>
      ) : (
        <div className="flex items-center gap-4 p-4 bg-surface-50 rounded-2xl border border-surface-200">
          <div className={cn(
            'flex-shrink-0 p-3 rounded-xl',
            'bg-primary-100 text-primary-500'
          )}>
            {CATEGORY_ICONS[selectedFile.category]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-surface-800 truncate">{selectedFile.name}</p>
              {formatInfo && (
                <span className="flex-shrink-0 px-2 py-0.5 bg-primary-100 text-primary-600 rounded text-xs font-medium">
                  {formatInfo.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-surface-400">
              <span>{formatFileSize(selectedFile.size)}</span>
              {categoryInfo && (
                <>
                  <span>•</span>
                  <span>{categoryInfo.description}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onFileRemove}
            className="flex-shrink-0 p-2 hover:bg-surface-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-surface-400" />
          </button>
        </div>
      )}
    </div>
  )
}
