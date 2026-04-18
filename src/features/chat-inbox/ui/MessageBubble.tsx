import { useState } from 'react'
import { Check, CheckCheck, Info, ImageOff } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { ChatMessageAdminView } from '../types'
import { isTempId } from '../types'
import { ImageLightbox } from './ImageLightbox'

interface Props {
  message: ChatMessageAdminView
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

/**
 * ADMIN-perspective bubble. Mirror image of the user widget's bubble:
 *   - Agent's own messages → right side (the agent IS the agent)
 *   - User's messages      → left side
 *   - System messages      → centered, neutral
 *
 * Image attachments render flush to the bubble edges (no padding) and
 * open a fullscreen lightbox on click.
 */
export function MessageBubble({ message }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false)

  if (message.senderType === 'system') {
    return (
      <li className="my-3 flex justify-center">
        <div className="max-w-[85%] inline-flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-brand-accent" aria-hidden="true" />
          <span className="leading-snug">{message.body}</span>
        </div>
      </li>
    )
  }

  const isAgent = message.senderType === 'agent'
  const pending = isTempId(message.id)
  const seen = Boolean(message.readAt)
  const hasAttachment = Boolean(message.attachmentPath)
  const hasBody = Boolean(message.body)

  return (
    <>
      <li
        className={cn('flex w-full', isAgent ? 'justify-end' : 'justify-start')}
        aria-label={isAgent ? 'Mi respuesta' : 'Mensaje del usuario'}
      >
        <div
          className={cn(
            'max-w-[75%] rounded-2xl text-sm leading-snug whitespace-pre-wrap break-words overflow-hidden',
            isAgent
              ? 'bg-brand-primary text-white rounded-br-sm dark:bg-brand-secondary/15 dark:text-foreground'
              : 'bg-card text-foreground rounded-bl-sm border border-border',
          )}
        >
          {hasAttachment && (
            <button
              type="button"
              onClick={() => message.attachmentUrl && setLightboxOpen(true)}
              disabled={!message.attachmentUrl}
              aria-label="Ver imagen completa"
              className="block w-full max-w-[280px]"
            >
              {message.attachmentUrl ? (
                <img
                  src={message.attachmentUrl}
                  alt={message.attachmentFilename ?? ''}
                  className="block w-full h-auto max-h-[280px] object-cover"
                />
              ) : (
                <div className="flex items-center justify-center gap-2 h-[120px] bg-muted text-muted-foreground text-xs">
                  <ImageOff className="h-4 w-4" aria-hidden="true" />
                  <span>Imagen no disponible</span>
                </div>
              )}
            </button>
          )}

          {hasBody && <p className="px-3.5 pt-2">{message.body}</p>}

          <div
            className={cn(
              'flex items-center gap-1 justify-end text-[10px] px-3.5 pb-1.5',
              hasBody ? 'pt-1' : 'pt-1.5',
              isAgent ? 'text-white/60 dark:text-muted-foreground' : 'text-muted-foreground',
            )}
          >
            <span>{formatTime(message.createdAt)}</span>
            {isAgent &&
              (pending ? (
                <span title="Enviando" aria-label="Enviando">
                  <Check className="h-3 w-3 opacity-50" />
                </span>
              ) : seen ? (
                <span title="Leído" aria-label="Leído">
                  <CheckCheck className="h-3 w-3 text-brand-accent" />
                </span>
              ) : (
                <span title="Enviado" aria-label="Enviado">
                  <Check className="h-3 w-3" />
                </span>
              ))}
          </div>
        </div>
      </li>
      {lightboxOpen && message.attachmentUrl && (
        <ImageLightbox
          url={message.attachmentUrl}
          filename={message.attachmentFilename}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  )
}
