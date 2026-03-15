import { useState, useCallback, useRef } from 'react'
import {
  Download, X, Loader2,
  Trash2, Plus, FileText
} from 'lucide-react'
import type { SupportedFormat } from '@/types'
import {
  detectFormatFromExtension, getFileExtension, getCompatibleTargetFormats,
  getFormatInfo, formatFileSize, SUPPORTED_FORMATS, CATEGORY_INFO
} from '@/types'
import { convertFile } from '@/lib/converters'

interface BatchItem {
  id: string
  file: File
  sourceFormat: SupportedFormat
  targetFormat: SupportedFormat | null
  status: 'pending' | 'converting' | 'success' | 'error'
  error?: string
  result?: { blob: Blob; filename: string }
}

export function BatchConverter() {
  const [items, setItems] = useState<BatchItem[]>([])
  const [globalTarget, setGlobalTarget] = useState<SupportedFormat | null>(null)
  const [converting, setConverting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: BatchItem[] = []
    for (const file of Array.from(files)) {
      const ext = getFileExtension(file.name)
      const fmt = detectFormatFromExtension(ext)
      if (!fmt) continue
      const compatible = getCompatibleTargetFormats(fmt)
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        sourceFormat: fmt,
        targetFormat: globalTarget && compatible.includes(globalTarget) ? globalTarget : null,
        status: 'pending',
      })
    }
    setItems(prev => [...prev, ...newItems])
  }, [globalTarget])

  const removeItem = (id: string) =>
    setItems(prev => prev.filter(i => i.id !== id))

  const setItemTarget = (id: string, fmt: SupportedFormat) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, targetFormat: fmt, status: 'pending', error: undefined, result: undefined } : i))

  const applyGlobalTarget = (fmt: SupportedFormat) => {
    setGlobalTarget(fmt)
    setItems(prev => prev.map(i => {
      const compatible = getCompatibleTargetFormats(i.sourceFormat)
      return compatible.includes(fmt) ? { ...i, targetFormat: fmt, status: 'pending', error: undefined, result: undefined } : i
    }))
  }

  const convertAll = useCallback(async () => {
    const todo = items.filter(i => i.targetFormat && i.status === 'pending')
    if (!todo.length) return
    setConverting(true)
    for (const item of todo) {
      if (!item.targetFormat) continue
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'converting' } : i))
      try {
        const result = await convertFile(item.file, item.sourceFormat, item.targetFormat, { quality: 0.92 })
        setItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'success', result: { blob: result.blob, filename: result.filename } } : i
        ))
      } catch (err) {
        setItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'error', error: err instanceof Error ? err.message : '转换失败' } : i
        ))
      }
    }
    setConverting(false)
  }, [items])

  const downloadItem = (item: BatchItem) => {
    if (!item.result) return
    const url = URL.createObjectURL(item.result.blob)
    const a = document.createElement('a')
    a.href = url; a.download = item.result.filename; a.click()
    URL.revokeObjectURL(url)
  }

  const downloadAll = () => {
    items.filter(i => i.status === 'success' && i.result)
      .forEach((item, idx) => setTimeout(() => downloadItem(item), idx * 180))
  }

  const retryItem = (id: string) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'pending', error: undefined, result: undefined } : i))

  const pendingCount = items.filter(i => i.status === 'pending' && i.targetFormat).length
  const successCount = items.filter(i => i.status === 'success').length
  const totalCount = items.length

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={e => { e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files) }}
        onDragOver={e => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onClick={() => inputRef.current?.click()}
        className={`file-drop-zone border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          dragActive ? 'drag-active' : 'border-surface-200 hover:border-primary-300 hover:bg-primary-50/30'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className={`p-4 rounded-full transition-colors ${dragActive ? 'bg-primary-100 text-primary-500' : 'bg-surface-100 text-surface-400'}`}>
            <Plus className="w-7 h-7" />
          </div>
          <div>
            <p className="font-medium text-surface-700">{dragActive ? '松开以添加文件' : '点击或拖拽文件到此处'}</p>
            <p className="text-sm text-surface-400 mt-1">支持所有格式，可同时选择多个文件</p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 mt-1">
            {CATEGORY_INFO.map(c => (
              <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-100 rounded-full text-xs text-surface-500">
                {c.icon} {c.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <input ref={inputRef} type="file" multiple className="hidden"
        onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />

      {items.length > 0 && (
        <>
          {/* Global target + stats bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-primary-50 rounded-2xl border border-primary-100">
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-medium text-primary-700">统一转换为</span>
            </div>
            <select
              value={globalTarget ?? ''}
              onChange={e => e.target.value && applyGlobalTarget(e.target.value as SupportedFormat)}
              className="flex-1 text-sm border border-primary-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value="">— 统一设置目标格式（可选）—</option>
              {CATEGORY_INFO.map(cat => (
                <optgroup key={cat.id} label={`${cat.icon} ${cat.label}`}>
                  {SUPPORTED_FORMATS.filter(f => f.category === cat.id)
                    .filter((f, i, arr) => arr.findIndex(x => x.value === f.value) === i)
                    .map(f => <option key={f.value} value={f.value}>{f.label} ({f.extension})</option>)
                  }
                </optgroup>
              ))}
            </select>
            <div className="flex items-center gap-3 text-xs text-surface-500 flex-shrink-0">
              <span>{totalCount} 个文件</span>
              {successCount > 0 && <span className="text-emerald-600 font-medium">✓ {successCount} 成功</span>}
              <button onClick={() => setItems([])} className="flex items-center gap-1 text-surface-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />清空
              </button>
            </div>
          </div>

          {/* File list */}
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {items.map(item => {
              const targets = getCompatibleTargetFormats(item.sourceFormat)
              const srcInfo = getFormatInfo(item.sourceFormat)
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border bg-white transition-all status-${item.status}`}
                >
                  {/* File icon */}
                  <div className="flex-shrink-0 w-9 h-9 bg-surface-100 rounded-lg flex items-center justify-center text-base">
                    {srcInfo?.icon ?? '📄'}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-surface-400">{formatFileSize(item.file.size)}</span>
                      <span className="text-xs text-surface-300">·</span>
                      <span className="text-xs font-medium text-surface-500 uppercase">{item.sourceFormat}</span>
                      {item.targetFormat && <span className="text-xs text-surface-400">→ <span className="font-medium text-primary-600 uppercase">{item.targetFormat}</span></span>}
                      {item.error && <span className="text-xs text-red-500 truncate max-w-32">{item.error}</span>}
                    </div>
                  </div>

                  {/* Format select / status */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {item.status === 'pending' && (
                      <select
                        value={item.targetFormat ?? ''}
                        onChange={e => e.target.value && setItemTarget(item.id, e.target.value as SupportedFormat)}
                        className="text-xs border border-surface-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400 max-w-28 bg-white"
                      >
                        <option value="">选择格式</option>
                        {targets.map(t => {
                          const info = getFormatInfo(t)
                          return <option key={t} value={t}>{info?.label ?? t} ({info?.extension ?? `.${t}`})</option>
                        })}
                      </select>
                    )}
                    {item.status === 'converting' && (
                      <span className="flex items-center gap-1.5 text-xs text-primary-600">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />转换中
                      </span>
                    )}
                    {item.status === 'success' && (
                      <button
                        onClick={() => downloadItem(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />下载
                      </button>
                    )}
                    {item.status === 'error' && (
                      <button
                        onClick={() => retryItem(item.id)}
                        className="text-xs text-red-500 hover:text-red-600 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 transition-colors"
                      >
                        重试
                      </button>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="flex-shrink-0 p-1 text-surface-300 hover:text-surface-500 hover:bg-surface-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Action bar */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              onClick={convertAll}
              disabled={!pendingCount || converting}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {converting
                ? <><Loader2 className="w-4 h-4 animate-spin" />转换中…</>
                : <><FileText className="w-4 h-4" />开始批量转换{pendingCount > 0 ? ` (${pendingCount} 个)` : ''}</>
              }
            </button>
            {successCount > 0 && (
              <button
                onClick={downloadAll}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                全部下载 ({successCount})
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
