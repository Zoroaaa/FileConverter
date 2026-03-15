import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { SupportedFormat, FormatCategory } from '@/types'
import { 
  SUPPORTED_FORMATS, 
  CATEGORY_INFO, 
  getCompatibleTargetFormats,
  getFormatCategory
} from '@/types'

interface FormatSelectorProps {
  sourceFormat: SupportedFormat | null
  targetFormat: SupportedFormat | null
  onTargetFormatChange: (format: SupportedFormat) => void
  className?: string
}

export function FormatSelector({ 
  sourceFormat, 
  targetFormat, 
  onTargetFormatChange, 
  className 
}: FormatSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<FormatCategory | 'all'>('all')
  
  const sourceCategory = sourceFormat ? getFormatCategory(sourceFormat) : null
  const availableTargets = sourceFormat ? getCompatibleTargetFormats(sourceFormat) : []
  
  const filteredFormats = SUPPORTED_FORMATS.filter(format => {
    if (selectedCategory !== 'all' && format.category !== selectedCategory) {
      return false
    }
    if (sourceFormat && !availableTargets.includes(format.value)) {
      return false
    }
    return true
  }).filter((format, index, self) => 
    self.findIndex(f => f.value === format.value) === index
  )

  const uniqueFormats = Array.from(
    new Map(filteredFormats.map(f => [f.value, f])).values()
  )

  const categoryFormats = uniqueFormats.reduce((acc, format) => {
    if (!acc[format.category]) {
      acc[format.category] = []
    }
    acc[format.category].push(format)
    return acc
  }, {} as Record<FormatCategory, typeof SUPPORTED_FORMATS>)

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-4">
        <label className="block text-sm font-medium text-surface-800">
          转换为
        </label>
        {sourceFormat && (
          <span className="text-xs text-surface-500">
            {availableTargets.length} 种可用格式
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <CategoryButton
          label="全部"
          icon="📋"
          isActive={selectedCategory === 'all'}
          onClick={() => setSelectedCategory('all')}
        />
        {CATEGORY_INFO.map(category => (
          <CategoryButton
            key={category.id}
            label={category.label}
            icon={category.icon}
            isActive={selectedCategory === category.id}
            onClick={() => setSelectedCategory(category.id)}
            highlight={sourceCategory === category.id}
          />
        ))}
      </div>

      <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
        {(selectedCategory === 'all' ? CATEGORY_INFO : CATEGORY_INFO.filter(c => c.id === selectedCategory))
          .filter(category => categoryFormats[category.id]?.length > 0)
          .map(category => (
            <div key={category.id}>
              {selectedCategory === 'all' && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{category.icon}</span>
                  <span className="text-sm font-medium text-surface-700">{category.label}</span>
                  <div className="flex-1 h-px bg-surface-100" />
                </div>
              )}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {categoryFormats[category.id]?.map(format => {
                  const isAvailable = availableTargets.includes(format.value)
                  const isSelected = targetFormat === format.value
                  
                  return (
                    <button
                      key={format.value}
                      onClick={() => isAvailable && onTargetFormatChange(format.value)}
                      disabled={!isAvailable}
                      className={cn(
                        'flex flex-col items-center gap-1 p-3 rounded-lg border transition-all duration-200',
                        isSelected
                          ? 'border-primary-400 bg-primary-50 text-primary-600 shadow-md'
                          : isAvailable
                            ? 'border-surface-200 hover:border-primary-300 hover:bg-surface-50 cursor-pointer'
                            : 'border-surface-100 bg-surface-50/50 opacity-40 cursor-not-allowed'
                      )}
                    >
                      <span className="text-xl">{format.icon}</span>
                      <span className={cn(
                        'text-xs font-medium truncate w-full text-center',
                        isSelected ? 'text-primary-600' : 'text-surface-600'
                      )}>
                        {format.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
      </div>

      {!sourceFormat && (
        <p className="mt-3 text-sm text-surface-400 text-center">
          请先上传文件以查看可转换的格式
        </p>
      )}
    </div>
  )
}

interface CategoryButtonProps {
  label: string
  icon: string
  isActive: boolean
  onClick: () => void
  highlight?: boolean
}

function CategoryButton({ label, icon, isActive, onClick, highlight }: CategoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
        isActive
          ? 'bg-primary-500 text-white shadow-md'
          : highlight
            ? 'bg-primary-100 text-primary-600 hover:bg-primary-200'
            : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
      )}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
