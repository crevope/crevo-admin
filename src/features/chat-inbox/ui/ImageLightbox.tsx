import { useEffect } from 'react'
import { X, Download } from 'lucide-react'

interface Props {
  url: string
  filename?: string | null
  onClose: () => void
}

/**
 * Fullscreen image preview with backdrop click + Escape to close +
 * download button. Mirrors the user-side ImageLightbox; styled with
 * raw colors (no shadcn tokens) so the dark backdrop reads the same
 * regardless of theme.
 */
export function ImageLightbox({ url, filename, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vista de imagen"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        className="absolute top-4 right-4 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={url}
          download={filename ?? 'imagen'}
          aria-label="Descargar imagen"
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <img
        src={url}
        alt={filename ?? ''}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl"
      />
    </div>
  )
}
