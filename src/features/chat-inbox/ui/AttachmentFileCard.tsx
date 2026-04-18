import { FileText, Download, ImageOff } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface Props {
  url: string | null | undefined
  filename: string | null | undefined
  sizeBytes?: number | null
  variant: 'user' | 'agent' | 'system'
}

/**
 * Renders a non-image attachment (currently PDF) as a click-to-open
 * file card inside a chat bubble. Admin-side mirror of the web one —
 * same layout, shadcn tokens for the background instead of raw colors
 * so it blends with both light and dark theme surfaces.
 */
export function AttachmentFileCard({ url, filename, sizeBytes, variant }: Props) {
  const display = filename || 'Archivo'
  const size = typeof sizeBytes === 'number' ? `${(sizeBytes / 1024).toFixed(0)} KB` : ''

  const baseClasses =
    'mx-3 mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2 max-w-[280px] transition-colors'
  const toneClasses =
    variant === 'agent'
      ? 'bg-white/10 hover:bg-white/15 text-white dark:bg-white/5 dark:hover:bg-white/10 dark:text-foreground'
      : 'bg-black/5 hover:bg-black/10 text-foreground'

  if (!url) {
    return (
      <div className={cn(baseClasses, toneClasses, 'opacity-70 cursor-not-allowed')} role="status">
        <div className="h-9 w-9 rounded bg-red-500/20 flex items-center justify-center shrink-0">
          <ImageOff className="h-4 w-4 text-red-400" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{display}</p>
          <p className="text-[10px] opacity-70">Archivo no disponible</p>
        </div>
      </div>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={filename ?? undefined}
      aria-label={`Abrir ${display}`}
      className={cn(baseClasses, toneClasses)}
    >
      <div className="h-9 w-9 rounded bg-red-500/20 flex items-center justify-center shrink-0">
        <FileText className="h-4 w-4 text-red-400" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate" title={display}>
          {display}
        </p>
        {size && <p className="text-[10px] opacity-70">{size}</p>}
      </div>
      <Download className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
    </a>
  )
}
