import { useState } from 'react'
import { Settings2, ChevronDown, ChevronUp } from 'lucide-react'
import type { ConversionOptions } from '@/lib/converters/types'
import type { FormatCategory } from '@/types'

interface ImageOptionsProps {
  category: FormatCategory | null
  options: ConversionOptions
  onChange: (opts: ConversionOptions) => void
}

export function ImageOptions({ category, options, onChange }: ImageOptionsProps) {
  const [open, setOpen] = useState(false)
  if (category !== 'image') return null

  const quality = Math.round((options.quality ?? 0.92) * 100)

  return (
    <div className="rounded-xl overflow-hidden border border-surface-200">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-50 hover:bg-surface-100 transition-colors text-sm"
      >
        <span className="flex items-center gap-2 font-medium text-surface-700">
          <Settings2 className="w-4 h-4 text-primary-500" />
          图像转换选项
          {options.width || options.height
            ? <span className="text-xs text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">
                {options.width && options.height ? `${options.width}×${options.height}` : options.width ? `宽 ${options.width}px` : `高 ${options.height}px`}
              </span>
            : null
          }
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
      </button>

      {open && (
        <div className="p-4 bg-white space-y-5 border-t border-surface-100">
          {/* Quality */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-surface-700">压缩质量</label>
              <span className="text-sm font-semibold text-primary-600">{quality}%</span>
            </div>
            <input
              type="range" min={10} max={100} step={5}
              value={quality}
              onChange={e => onChange({ ...options, quality: Number(e.target.value) / 100 })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-surface-400 mt-1">
              <span>最小体积</span><span>最佳质量</span>
            </div>
          </div>

          {/* Resize */}
          <div>
            <label className="text-sm font-medium text-surface-700 block mb-2">
              调整尺寸 <span className="text-xs font-normal text-surface-400">（留空保持原始尺寸）</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-surface-500 mb-1 block">宽度 (px)</label>
                <input
                  type="number" min={1} max={8000}
                  value={options.width ?? ''}
                  onChange={e => onChange({ ...options, width: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="自动"
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="text-xs text-surface-500 mb-1 block">高度 (px)</label>
                <input
                  type="number" min={1} max={8000}
                  value={options.height ?? ''}
                  onChange={e => onChange({ ...options, height: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="自动"
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 mt-2 text-xs text-surface-500 cursor-pointer">
              <input
                type="checkbox"
                checked={options.maintainAspectRatio !== false}
                onChange={e => onChange({ ...options, maintainAspectRatio: e.target.checked })}
                className="rounded"
              />
              保持原始宽高比
            </label>
          </div>

          {/* Quick size presets */}
          <div>
            <label className="text-xs text-surface-500 mb-2 block">快速预设</label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '1920×1080', w: 1920, h: 1080 },
                { label: '1280×720', w: 1280, h: 720 },
                { label: '800×600', w: 800, h: 600 },
                { label: '512×512', w: 512, h: 512 },
                { label: '256×256', w: 256, h: 256 },
                { label: '原始', w: undefined, h: undefined },
              ].map(p => (
                <button
                  key={p.label}
                  onClick={() => onChange({ ...options, width: p.w, height: p.h })}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                    options.width === p.w && options.height === p.h
                      ? 'border-primary-400 bg-primary-50 text-primary-700'
                      : 'border-surface-200 text-surface-600 hover:border-surface-300 hover:bg-surface-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
