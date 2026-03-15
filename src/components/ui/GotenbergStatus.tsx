import { useState, useEffect, useCallback } from 'react'
import { Server, RefreshCw, CheckCircle2, XCircle, Loader2, Zap } from 'lucide-react'

type ServiceStatus = 'online' | 'offline' | 'waking' | 'checking' | 'unknown'

interface HealthResponse {
  status: ServiceStatus
  message: string
  responseTime?: number
  timestamp: string
}

interface GotenbergStatusProps {
  autoWakeOnMount?: boolean
}

const STATUS_CONFIG: Record<ServiceStatus, {
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
  label: string
  pulse?: boolean
}> = {
  online: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    color: 'var(--status-success)',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    label: '在线',
  },
  offline: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    color: 'var(--status-error)',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    label: '离线',
  },
  waking: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    color: 'var(--status-warning)',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    label: '唤醒中',
    pulse: true,
  },
  checking: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    color: 'var(--status-info)',
    bgColor: 'rgba(99, 102, 241, 0.1)',
    borderColor: 'rgba(99, 102, 241, 0.25)',
    label: '检测中',
  },
  unknown: {
    icon: <Server className="w-3.5 h-3.5" />,
    color: 'var(--text-muted)',
    bgColor: 'rgba(156, 163, 175, 0.1)',
    borderColor: 'rgba(156, 163, 175, 0.25)',
    label: '未知',
  },
}

export function GotenbergStatus({ autoWakeOnMount = true }: GotenbergStatusProps) {
  const [status, setStatus] = useState<ServiceStatus>('unknown')
  const [message, setMessage] = useState<string>('')
  const [responseTime, setResponseTime] = useState<number | undefined>()
  const [isWaking, setIsWaking] = useState(false)

  const checkHealth = useCallback(async (signal?: AbortSignal): Promise<HealthResponse> => {
    const res = await fetch('/api/gotenberg-health', { signal })
    return res.json()
  }, [])

  const updateStatus = useCallback((data: HealthResponse) => {
    setStatus(data.status)
    setMessage(data.message)
    setResponseTime(data.responseTime)
  }, [])

  const handleCheck = useCallback(async () => {
    setStatus('checking')
    setMessage('正在检测服务状态...')

    try {
      const data = await checkHealth()
      updateStatus(data)
    } catch {
      setStatus('offline')
      setMessage('无法连接到健康检查接口')
    }
  }, [checkHealth, updateStatus])

  const handleWake = useCallback(async () => {
    if (isWaking) return

    setIsWaking(true)
    setStatus('waking')
    setMessage('正在唤醒 Gotenberg 服务，预计需要 30-60 秒...')

    const maxAttempts = 12
    const interval = 5000

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        const data = await checkHealth(controller.signal)
        clearTimeout(timeoutId)

        if (data.status === 'online') {
          updateStatus(data)
          setIsWaking(false)
          return
        }

        if (attempt < maxAttempts) {
          setMessage(`服务正在启动... (${attempt}/${maxAttempts})`)
          await new Promise(resolve => setTimeout(resolve, interval))
        }
      } catch {
        if (attempt < maxAttempts) {
          setMessage(`等待服务响应... (${attempt}/${maxAttempts})`)
          await new Promise(resolve => setTimeout(resolve, interval))
        }
      }
    }

    setStatus('offline')
    setMessage('服务唤醒超时，请稍后重试')
    setIsWaking(false)
  }, [checkHealth, updateStatus, isWaking])

  useEffect(() => {
    const controller = new AbortController()

    const init = async () => {
      try {
        const data = await checkHealth(controller.signal)
        updateStatus(data)

        if (autoWakeOnMount && data.status !== 'online') {
          handleWake()
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatus('offline')
          setMessage('无法连接到健康检查接口')
        }
      }
    }

    init()

    return () => controller.abort()
  }, [])

  const config = STATUS_CONFIG[status]

  return (
    <div
      className={`rounded-xl px-4 py-3 theme-transition ${config.pulse ? 'animate-pulse-ring' : ''}`}
      style={{
        background: config.bgColor,
        border: `1px solid ${config.borderColor}`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div style={{ color: config.color }}>{config.icon}</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Gotenberg 服务
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ background: config.bgColor, color: config.color, border: `1px solid ${config.borderColor}` }}
              >
                {config.label}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {message}
              {responseTime !== undefined && status === 'online' && (
                <span className="ml-2" style={{ color: 'var(--status-success)' }}>
                  ({responseTime}ms)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCheck}
            disabled={status === 'checking' || isWaking}
            className="p-2 rounded-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-secondary)',
              color: 'var(--text-secondary)',
            }}
            title="刷新状态"
          >
            <RefreshCw className={`w-4 h-4 ${status === 'checking' ? 'animate-spin' : ''}`} />
          </button>

          {status !== 'online' && (
            <button
              onClick={handleWake}
              disabled={isWaking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'var(--accent-gradient)',
                color: 'white',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <Zap className="w-3.5 h-3.5" />
              {isWaking ? '唤醒中...' : '唤醒服务'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
