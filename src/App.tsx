import { useState, useCallback } from 'react'
import {
  FileText, ArrowRight, Download, Sparkles, Zap, Shield,
  RefreshCw, Info, CheckCircle2, XCircle, Loader2, Layers,
  Globe, Eye, Server, Cpu, Cloud, Github
} from 'lucide-react'
import { FileUpload } from '@/components/ui/FileUpload'
import { FormatSelector } from '@/components/ui/FormatSelector'
import { Button } from '@/components/ui/Button'
import { BatchConverter } from '@/components/converter/BatchConverter'
import { ImageOptions } from '@/components/converter/ImageOptions'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { GotenbergStatus } from '@/components/ui/GotenbergStatus'
import { ThemeProvider } from '@/contexts/ThemeContext'
import type { FileInfo, SupportedFormat } from '@/types'
import { getFileNameWithoutExtension, getFormatCategory } from '@/types'
import { convertFile, getConversionMethod, getConversionEngineHint, previewFile } from '@/lib/converters'
import type { ConversionOptions } from '@/lib/converters/types'

type ConversionStatus = 'idle' | 'loading' | 'converting' | 'success' | 'error'
type AppTab = 'single' | 'batch'

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<AppTab>('single')

  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)
  const [targetFormat, setTargetFormat] = useState<SupportedFormat | null>(null)
  const [status, setStatus] = useState<ConversionStatus>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | undefined>()
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadName, setDownloadName] = useState<string>('')
  const [convMethod, setConvMethod] = useState<'frontend' | 'backend' | 'gotenberg' | 'adobe' | null>(null)
  const [imgOptions, setImgOptions] = useState<ConversionOptions>({ quality: 0.92, maintainAspectRatio: true })
  const [convWarnings, setConvWarnings] = useState<string[]>([])

  const reset = useCallback(() => {
    setStatus('idle'); setProgress(0); setErrorMsg(undefined)
    setDownloadUrl(null); setDownloadName(''); setStatusMsg(''); setConvWarnings([])
  }, [])

  const handleFileSelect = useCallback((fileInfo: FileInfo) => {
    setSelectedFile(fileInfo); setTargetFormat(null); reset()
  }, [reset])

  const handleFileRemove = useCallback(() => {
    setSelectedFile(null); setTargetFormat(null); reset()
  }, [reset])

  const handleTargetFormat = useCallback((fmt: SupportedFormat) => {
    setTargetFormat(fmt)
    if (selectedFile) setConvMethod(getConversionMethod(selectedFile.format, fmt))
    reset()
  }, [selectedFile, reset])

  const handleConvert = async () => {
    if (!selectedFile || !targetFormat) return

    const isMedia = ['audio', 'video'].includes(getFormatCategory(selectedFile.format))
    const isCloud = convMethod === 'gotenberg' || convMethod === 'adobe'

    setStatus(isMedia ? 'loading' : 'converting')
    setStatusMsg(
      isMedia ? '正在加载 FFmpeg 解码器，首次使用约需 20-40 秒...'
      : convMethod === 'adobe' ? '正在通过 Adobe PDF Services 转换（精准还原 PDF 格式）...'
      : isCloud ? '正在通过 Gotenberg（LibreOffice 引擎）转换...'
      : '正在转换...'
    )
    setProgress(0); setErrorMsg(undefined); setDownloadUrl(null)

    const ticker = setInterval(() => {
      setProgress(prev => {
        if (prev >= 88) { clearInterval(ticker); return prev }
        return prev + (isMedia ? 2 : isCloud ? 4 : 12)
      })
    }, 400)

    try {
      const opts: ConversionOptions = getFormatCategory(selectedFile.format) === 'image'
        ? imgOptions : { quality: 0.92 }

      const result = await convertFile(selectedFile.file, selectedFile.format, targetFormat, opts)
      clearInterval(ticker); setProgress(100)
      setDownloadUrl(URL.createObjectURL(result.blob))
      setDownloadName(result.filename)
      setConvWarnings(result.warnings ?? [])
      setStatus('success')
    } catch (err) {
      clearInterval(ticker)
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : '转换失败，请重试')
    }
  }

  const handleDownload = () => {
    if (!downloadUrl) return
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = downloadName || `${getFileNameWithoutExtension(selectedFile?.name ?? 'file')}.${targetFormat}`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const handlePreview = async () => {
    if (!downloadUrl || !downloadName) return
    try {
      const response = await fetch(downloadUrl)
      const blob = await response.blob()
      await previewFile(blob, downloadName)
    } catch (err) {
      console.error('Preview failed:', err)
    }
  }

  const isConverting = ['loading', 'converting'].includes(status)
  const canConvert = !!selectedFile && !!targetFormat && !isConverting
  const engineHint = selectedFile && targetFormat
    ? getConversionEngineHint(selectedFile.format as string, targetFormat as string)
    : null

  return (
    <div className="min-h-screen theme-transition" style={{ background: 'var(--bg-gradient)' }}>
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ background: 'var(--bg-glow-1)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-15" style={{ background: 'var(--bg-glow-2)' }} />
        <div className="absolute top-1/2 left-0 w-64 h-64 rounded-full blur-3xl opacity-10" style={{ background: 'var(--bg-glow-3)' }} />
      </div>

      <div className="relative z-10">
        {/* ── Header ── */}
        <header style={{ background: 'var(--bg-header)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-primary)' }} className="sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-gradient)' }}>
                  <RefreshCw className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <span className="font-bold text-lg" style={{ fontFamily: "'Syne', 'Space Grotesk', sans-serif", letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                    File<span style={{ color: 'var(--accent-secondary)' }}>Flow</span>
                  </span>
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded text-white font-medium" style={{ background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.4)' }}>v5</span>
                </div>
              </div>

              <nav className="flex items-center rounded-xl p-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-secondary)' }}>
                {([
                  { id: 'single', icon: <FileText className="w-4 h-4" />, label: '单文件转换' },
                  { id: 'batch',  icon: <Layers className="w-4 h-4" />,   label: '批量转换' },
                ] as { id: AppTab; icon: React.ReactNode; label: string }[]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    title={tab.label}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? 'text-white shadow-lg'
                        : ''
                    }`}
                    style={activeTab === tab.id ? { background: 'var(--accent-gradient)' } : { color: 'var(--text-tertiary)' }}
                  >
                    {tab.icon}<span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </nav>

              <div className="flex items-center gap-2 sm:gap-3">
                <a
                  href="https://github.com/Zoroaaa/FileConverter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-9 h-9 rounded-lg transition-all hover:scale-105"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-secondary)', color: 'var(--text-tertiary)' }}
                  title="GitHub 仓库"
                >
                  <Github className="w-4.5 h-4.5" />
                </a>
                <div className="hidden sm:flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <Globe className="w-3.5 h-3.5" />
                  <span>免费 · 无限制</span>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>

        {/* ── Hero ── */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-primary)' }}>
              <Sparkles className="w-4 h-4" />
              Powered by Gotenberg · LibreOffice 引擎 · 40+ 格式
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold mb-5 leading-none" style={{ fontFamily: "'Syne', 'DM Sans', sans-serif", letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
              {activeTab === 'single' ? (
                <>文件格式<br /><span style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>智能转换</span></>
              ) : (
                <>批量文件<br /><span style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>并行转换</span></>
              )}
            </h1>
            <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
              {activeTab === 'single'
                ? '文档转换由 Gotenberg（LibreOffice 引擎）驱动，完美还原格式。图像数据在浏览器本地处理，文件不离开设备。'
                : '同时处理多个文件，为每个文件独立选择格式，批量转换后一次下载全部结果。'
              }
            </p>
          </div>

          {/* ── Single File Tab ── */}
          {activeTab === 'single' && (
            <div className="max-w-2xl mx-auto space-y-5">
              {/* Gotenberg Status */}
              <GotenbergStatus autoWakeOnMount={true} />

              {/* Main card */}
              <div className="rounded-3xl p-6 sm:p-8 theme-transition" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', backdropFilter: 'blur(20px)' }}>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>上传文件</label>
                    <FileUpload
                      onFileSelect={handleFileSelect}
                      onFileRemove={handleFileRemove}
                      selectedFile={selectedFile}
                    />
                  </div>

                  {selectedFile && getFormatCategory(selectedFile.format) === 'image' && (
                    <ImageOptions category="image" options={imgOptions} onChange={setImgOptions} />
                  )}

                  <FormatSelector
                    sourceFormat={selectedFile?.format ?? null}
                    targetFormat={targetFormat}
                    onTargetFormatChange={handleTargetFormat}
                  />

                  {/* Engine hint */}
                  {convMethod && targetFormat && status === 'idle' && engineHint && (
                    <EngineHint method={convMethod} hint={engineHint} />
                  )}

                  {/* Status panel */}
                  {status !== 'idle' && (
                    <StatusPanel status={status} progress={progress} errorMsg={errorMsg} msg={statusMsg} warnings={convWarnings} />
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button onClick={handleConvert} disabled={!canConvert} className="flex-1" size="lg">
                      {isConverting
                        ? <><Loader2 className="w-5 h-5 animate-spin" />转换中…</>
                        : <><FileText className="w-5 h-5" />开始转换<ArrowRight className="w-4 h-4" /></>
                      }
                    </Button>
                    {status === 'success' && downloadUrl && (
                      <>
                        <Button onClick={handlePreview} variant="outline" size="lg">
                          <Eye className="w-5 h-5" />预览
                        </Button>
                        <Button onClick={handleDownload} variant="secondary" size="lg">
                          <Download className="w-5 h-5" />下载
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Feature row */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: <Zap className="w-4 h-4" />, title: '本地处理', desc: '图像数据在浏览器内完成，零上传' },
                  { icon: <Shield className="w-4 h-4" />, title: '隐私安全', desc: '非文档文件从不离开你的设备' },
                  { icon: <Server className="w-4 h-4" />, title: 'LibreOffice 引擎', desc: 'Gotenberg 驱动，格式还原完美' },
                ].map(f => (
                  <div key={f.title} className="rounded-2xl p-4 text-center transition-all hover:scale-[1.02] theme-transition" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-secondary)' }}>
                    <div className="p-2 rounded-xl w-fit mx-auto mb-2.5" style={{ background: 'rgba(99,102,241,0.2)', color: 'var(--accent-primary)' }}>{f.icon}</div>
                    <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                  </div>
                ))}
              </div>

              {/* Format table */}
              <FormatGrid />
            </div>
          )}

          {/* ── Batch Tab ── */}
          {activeTab === 'batch' && (
            <div className="max-w-3xl mx-auto">
              {/* Gotenberg Status */}
              <GotenbergStatus autoWakeOnMount={false} />

              <div className="mt-5 rounded-3xl p-6 sm:p-8 theme-transition" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', backdropFilter: 'blur(20px)' }}>
                <BatchConverter />
              </div>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: '⚡', title: '并发处理', desc: '多文件同步转换，提高效率' },
                  { icon: '🎯', title: '格式各异', desc: '每个文件可独立选择目标格式' },
                  { icon: '📦', title: '批量下载', desc: '转换完成后一键下载全部文件' },
                ].map(f => (
                  <div key={f.title} className="rounded-2xl p-4 flex items-start gap-3 theme-transition" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-secondary)' }}>
                    <span className="text-2xl">{f.icon}</span>
                    <div>
                      <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <footer style={{ borderTop: '1px solid var(--border-secondary)', background: 'var(--bg-header)' }} className="mt-8">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--accent-gradient)' }}>
                  <RefreshCw className="w-3 h-3 text-white" />
                </div>
                <span className="font-semibold text-sm" style={{ color: 'var(--text-tertiary)' }}>FileConverter</span>
              </div>
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Cloudflare Pages · Gotenberg on Render · © {new Date().getFullYear()}
              </p>
              <div className="text-xs space-x-3" style={{ color: 'var(--text-muted)' }}>
                <span>Gotenberg LibreOffice</span>
                <span>·</span>
                <span>Adobe PDF Services（备用）</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function EngineHint({ method, hint }: { method: string; hint: string }) {
  const configs = {
    frontend: { icon: <Cpu className="w-3.5 h-3.5" />, color: 'var(--status-success)', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', label: '浏览器本地' },
    gotenberg: { icon: <Server className="w-3.5 h-3.5" />, color: 'var(--accent-primary)', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.25)', label: 'Gotenberg' },
    adobe:    { icon: <Cloud className="w-3.5 h-3.5" />, color: 'var(--status-warning)', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', label: 'Adobe API' },
    backend:  { icon: <Info className="w-3.5 h-3.5" />, color: 'var(--text-tertiary)', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)', label: '服务器' },
  }
  const cfg = configs[method as keyof typeof configs] ?? configs.backend
  return (
    <div className="flex items-start gap-2 text-xs rounded-xl px-3.5 py-2.5" style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      {cfg.icon}
      <div>
        <span className="font-semibold">[{cfg.label}] </span>
        <span style={{ opacity: 0.85 }}>{hint}</span>
      </div>
    </div>
  )
}

function StatusPanel({ status, progress, errorMsg, msg, warnings }: {
  status: ConversionStatus; progress: number; errorMsg?: string; msg: string; warnings: string[]
}) {
  const isActive = ['loading', 'converting'].includes(status)
  return (
    <div className="rounded-xl overflow-hidden theme-transition" style={{ border: '1px solid var(--border-secondary)' }}>
      {isActive && (
        <div className="w-full h-1" style={{ background: 'var(--bg-tertiary)' }}>
          <div
            className="h-full transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%`, background: 'var(--accent-gradient)' }}
          />
        </div>
      )}
      <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'var(--bg-tertiary)' }}>
        {isActive && (
          <>
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{msg}</p>
              {status !== 'loading' && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{progress}%</p>}
            </div>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--status-success)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--status-success)' }}>转换完成！点击右侧「下载」按钮保存文件</p>
              {warnings.length > 0 && warnings.map((w: string, i: number) => (
                <p key={i} className="text-xs mt-1" style={{ color: 'var(--status-warning)' }}>⚠️ {w}</p>
              ))}
            </div>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--status-error)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--status-error)' }}>转换失败</p>
              {errorMsg && <p className="text-xs mt-0.5" style={{ color: 'var(--status-error)', opacity: 0.8 }}>{errorMsg}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function FormatGrid() {
  const rows = [
    {
      cat: '📄 文档（Word / PDF / Office）',
      items: [
        { src: 'DOCX → MD/HTML/TXT', targets: 'Markdown · HTML · 纯文本', note: 'mammoth（本地）⚠️ OLE嵌入对象会跳过', engine: 'local' },
        { src: 'DOCX → PDF',         targets: 'PDF',                       note: 'LibreOffice',       engine: 'gotenberg' },
        { src: 'DOC',                 targets: 'PDF · DOCX · TXT · HTML',  note: 'LibreOffice',       engine: 'gotenberg' },
        { src: 'ODT / RTF',           targets: 'PDF · TXT · HTML',         note: 'LibreOffice',       engine: 'gotenberg' },
        { src: 'VSD / VSDX（Visio）', targets: 'PDF',                      note: 'LibreOffice',       engine: 'gotenberg' },
        { src: 'PDF → Office',        targets: 'DOCX · XLSX · PPTX',       note: 'Adobe（备用）',     engine: 'adobe' },
        { src: 'PDF → 文本',          targets: 'TXT · HTML',               note: '浏览器 pdfjs',      engine: 'local' },
        { src: 'MD → DOCX',           targets: 'Word 文档',                 note: 'docx 库（本地）',   engine: 'local' },
        { src: 'MD / HTML → PDF',     targets: 'PDF',                       note: 'Chromium',          engine: 'gotenberg' },
        { src: 'TXT → PDF/DOCX',      targets: 'PDF · DOCX',               note: 'LibreOffice',       engine: 'gotenberg' },
        { src: 'TXT / HTML / MD 互转', targets: 'MD · TXT · HTML',          note: '纯文本（本地）',    engine: 'local' },
      ],
    },
    {
      cat: '📊 表格',
      items: [
        { src: 'XLSX / XLS → PDF',         targets: 'PDF',                        note: 'LibreOffice',    engine: 'gotenberg' },
        { src: 'XLSX / XLS / ODS → CSV/HTML', targets: 'CSV · HTML',              note: 'SheetJS（本地）', engine: 'local' },
        { src: 'ODS → PDF',                targets: 'PDF',                        note: 'LibreOffice',    engine: 'gotenberg' },
        { src: 'CSV → XLSX/JSON/XML', targets: 'XLSX · JSON · XML',   note: 'SheetJS（本地）', engine: 'local' },
      ],
    },
    {
      cat: '📑 演示文稿',
      items: [
        { src: 'PPTX / PPT', targets: 'PDF · TXT', note: 'LibreOffice', engine: 'gotenberg' },
        { src: 'ODP',        targets: 'PDF · TXT', note: 'LibreOffice', engine: 'gotenberg' },
      ],
    },
    {
      cat: '🖼️ 图像',
      items: [
        { src: 'JPG / PNG / WebP', targets: '互转 · GIF · BMP · ICO · TIFF', note: '浏览器本地', engine: 'local' },
        { src: 'GIF', targets: 'JPG · PNG · WebP · BMP', note: '浏览器本地', engine: 'local' },
        { src: 'BMP', targets: 'JPG · PNG · WebP · GIF · ICO', note: '浏览器本地', engine: 'local' },
        { src: 'ICO', targets: 'JPG · PNG · WebP · BMP', note: '浏览器本地', engine: 'local' },
        { src: 'SVG', targets: 'PNG · JPG · WebP', note: '浏览器本地', engine: 'local' },
        { src: 'TIFF', targets: 'JPG · PNG · WebP · GIF · BMP', note: '浏览器本地', engine: 'local' },
      ],
    },
    {
      cat: '🎵 音频 / 🎬 视频',
      items: [
        { src: 'MP3/WAV/OGG/FLAC', targets: '互转 · AAC · M4A', note: 'FFmpeg.wasm（本地）', engine: 'local' },
        { src: 'MP4/WebM/AVI/MOV', targets: '互转 · MKV', note: 'FFmpeg.wasm（本地）', engine: 'local' },
      ],
    },
    {
      cat: '📋 数据',
      items: [
        { src: 'JSON', targets: 'XML · CSV · YAML · TOML', note: '浏览器本地', engine: 'local' },
        { src: 'XML', targets: 'JSON · CSV · YAML', note: '浏览器本地', engine: 'local' },
        { src: 'CSV', targets: 'XLSX · JSON · XML', note: 'SheetJS（本地）', engine: 'local' },
        { src: 'YAML', targets: 'JSON · XML · CSV · TOML', note: '浏览器本地', engine: 'local' },
        { src: 'TOML', targets: 'JSON · YAML · CSV', note: '浏览器本地', engine: 'local' },
      ],
    },
  ]

  const engineColors: Record<string, { bg: string; text: string }> = {
    gotenberg: { bg: 'rgba(99,102,241,0.2)', text: 'var(--accent-primary)' },
    adobe:     { bg: 'rgba(245,158,11,0.2)', text: 'var(--status-warning)' },
    local:     { bg: 'rgba(16,185,129,0.15)', text: 'var(--status-success)' },
  }

  return (
    <div className="rounded-2xl p-5 sm:p-6 theme-transition" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-secondary)' }}>
      <h3 className="text-sm font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        <RefreshCw className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
        支持的转换格式一览
      </h3>
      <div className="space-y-6">
        {rows.map(row => (
          <div key={row.cat}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>{row.cat}</p>
            <div className="space-y-2">
              {row.items.map(item => {
                const ec = engineColors[item.engine] ?? engineColors.local
                return (
                  <div
                    key={item.src}
                    className="rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm"
                    style={{
                      background: 'var(--bg-tertiary)',
                    }}
                  >
                    <span className="font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>{item.src}</span>
                    <span className="sm:flex-1" style={{ color: 'var(--text-muted)' }}>→ {item.targets}</span>
                    {item.note && (
                      <span className="shrink-0 px-2.5 py-1 rounded text-xs font-medium w-fit" style={{ background: ec.bg, color: ec.text }}>{item.note}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-6 pt-4" style={{ borderTop: '1px solid var(--border-secondary)' }}>
        {[
          { color: engineColors.gotenberg, label: 'Gotenberg（LibreOffice/Chromium）' },
          { color: engineColors.adobe,     label: 'Adobe PDF Services（备用）' },
          { color: engineColors.local,     label: '浏览器本地（隐私优先）' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.color.text }} />
            <span style={{ color: 'var(--text-muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
