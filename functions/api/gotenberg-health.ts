/**
 * Cloudflare Pages Function: /api/gotenberg-health
 *
 * 功能：检查 Gotenberg 服务健康状态，并可用于触发冷启动
 *
 * 环境变量:
 *   GOTENBERG_URL — Gotenberg on Render，例如 https://xxx.onrender.com
 */

export interface Env {
  GOTENBERG_URL?: string
}

export interface HealthResponse {
  status: 'online' | 'offline' | 'waking' | 'unknown'
  message: string
  responseTime?: number
  timestamp: string
}

function jsonResponse(data: HealthResponse, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  })
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  const gotenbergUrl = (env.GOTENBERG_URL || 'http://localhost:3000').replace(/\/$/, '')
  const timestamp = new Date().toISOString()

  if (!env.GOTENBERG_URL) {
    return jsonResponse({
      status: 'unknown',
      message: '未配置 GOTENBERG_URL 环境变量',
      timestamp,
    })
  }

  try {
    const startTime = Date.now()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const res = await fetch(`${gotenbergUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime

    if (res.ok) {
      return jsonResponse({
        status: 'online',
        message: 'Gotenberg 服务运行正常',
        responseTime,
        timestamp,
      })
    } else if (res.status === 503 || res.status === 502) {
      return jsonResponse({
        status: 'waking',
        message: 'Gotenberg 服务正在冷启动中（Render 免费层特性），请稍后重试',
        responseTime,
        timestamp,
      })
    } else {
      return jsonResponse({
        status: 'offline',
        message: `Gotenberg 服务响应异常 (${res.status})`,
        responseTime,
        timestamp,
      })
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '未知错误'

    if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
      return jsonResponse({
        status: 'waking',
        message: 'Gotenberg 服务正在冷启动中，预计需要 30-60 秒',
        timestamp,
      })
    }

    return jsonResponse({
      status: 'offline',
      message: `无法连接 Gotenberg 服务: ${errorMessage}`,
      timestamp,
    })
  }
}
