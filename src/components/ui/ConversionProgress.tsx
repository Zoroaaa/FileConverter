import { cn } from '@/lib/utils'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

type ConversionStatus = 'idle' | 'converting' | 'success' | 'error'

interface ConversionProgressProps {
  status: ConversionStatus
  progress: number
  error?: string
  className?: string
}

export function ConversionProgress({ status, progress, error, className }: ConversionProgressProps) {
  if (status === 'idle') return null

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center gap-3 mb-3">
        {status === 'converting' && (
          <>
            <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
            <span className="text-sm font-medium text-surface-600">正在转换中...</span>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-green-600">转换成功！</span>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium text-red-600">转换失败</span>
          </>
        )}
      </div>
      
      {status === 'converting' && (
        <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-400 to-accent-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      
      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
