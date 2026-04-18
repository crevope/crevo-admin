import { useEffect, useRef, useState, type KeyboardEvent, type ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, Loader2, Smile, Paperclip, X as XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/button'
import { chatInboxRepository } from '../api/chatInboxRepository'
import { conversationQueryKey } from '../hooks/useConversationDetail'
import { useChatInboxStore } from '../model/useChatInboxStore'
import {
  TEMP_ID_PREFIX,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  type ChatAttachmentMimeType,
} from '../types'
import type { ChatConversationDetail, ChatMessageAdminView } from '../types'
import { EmojiPicker } from './EmojiPicker'

const MAX_LEN = 4000
/** Hard cap on auto-grow: 4 visible rows. After this, scroll appears. */
const MAX_VISIBLE_ROWS = 4
const ACCEPT_ATTRIBUTE = ALLOWED_ATTACHMENT_MIME_TYPES.join(',')

interface StagedAttachment {
  file: File
  localUrl: string
}

interface Props {
  conversationId: string
  isClosed: boolean
  /** Agent id for optimistic message authorship — replaced when REST returns. */
  agentId: string
}

/**
 * Composer with the same UX contract as the user widget: Enter sends,
 * Shift+Enter for newline, optimistic insert into the React Query cache,
 * rollback on error. Disabled when the conversation is CLOSED.
 */
export function AgentComposer({ conversationId, isClosed, agentId }: Props) {
  const qc = useQueryClient()
  const notifyTyping = useChatInboxStore((s) => s.notifyTyping)
  const [value, setValue] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [staged, setStaged] = useState<StagedAttachment | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    return () => {
      if (staged?.localUrl) URL.revokeObjectURL(staged.localUrl)
    }
  }, [staged])

  // Resize on every value change. Caps at MAX_VISIBLE_ROWS rows
  // (computed from real line-height + padding so it adapts to the
  // current font/line-height instead of a hardcoded pixel value).
  // overflow-y is hidden until we hit the cap, then auto — so the
  // scrollbar only appears once the content actually exceeds 4 rows.
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    const style = window.getComputedStyle(ta)
    const lineHeightRaw = parseFloat(style.lineHeight)
    const lineHeight = Number.isFinite(lineHeightRaw)
      ? lineHeightRaw
      : parseFloat(style.fontSize) * 1.2
    const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    const maxHeight = lineHeight * MAX_VISIBLE_ROWS + paddingY

    ta.style.height = 'auto'
    const next = Math.min(ta.scrollHeight, maxHeight)
    ta.style.height = `${next}px`
    ta.style.overflowY = ta.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [value])

  /** Insert text at the current selection without losing focus. */
  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current
    if (!ta) {
      setValue((v) => v + text)
      return
    }
    const start = ta.selectionStart ?? value.length
    const end = ta.selectionEnd ?? value.length
    const next = value.slice(0, start) + text + value.slice(end)
    setValue(next)
    requestAnimationFrame(() => {
      ta.focus()
      const cursor = start + text.length
      ta.selectionStart = ta.selectionEnd = cursor
    })
  }

  /** Args for the send mutation: text + (optional) staged attachment.
   *  Kept as a struct so optimistic-message + REST call share one payload. */
  interface SendVars {
    body: string
    attachment?: StagedAttachment
  }

  const send = useMutation({
    mutationFn: async ({ body, attachment }: SendVars) => {
      // Upload-then-send when there's an attachment.
      if (attachment) {
        setIsUploading(true)
        try {
          const signed = await chatInboxRepository.requestUploadUrl({
            conversationId,
            filename: attachment.file.name,
            mimeType: attachment.file.type,
            sizeBytes: attachment.file.size,
          })
          await chatInboxRepository.uploadAttachment(attachment.file, signed)
          return await chatInboxRepository.sendMessage(conversationId, body, {
            path: signed.path,
            mimeType: attachment.file.type,
            filename: attachment.file.name,
            sizeBytes: attachment.file.size,
          })
        } finally {
          setIsUploading(false)
        }
      }
      return chatInboxRepository.sendMessage(conversationId, body)
    },
    onMutate: async ({ body, attachment }) => {
      const tempId = `${TEMP_ID_PREFIX}${crypto.randomUUID()}`
      const tempMessage: ChatMessageAdminView = {
        id: tempId,
        conversationId,
        senderType: 'agent',
        senderId: agentId,
        body,
        readAt: null,
        createdAt: new Date().toISOString(),
        // Optimistic attachment uses the local blob URL; replaced when
        // the server-signed URL arrives in onSuccess.
        attachmentPath: attachment ? 'pending' : null,
        attachmentMimeType: attachment?.file.type ?? null,
        attachmentFilename: attachment?.file.name ?? null,
        attachmentSizeBytes: attachment?.file.size ?? null,
        attachmentUrl: attachment?.localUrl ?? null,
      }

      // Snapshot for rollback
      const previous = qc.getQueryData<ChatConversationDetail>(
        conversationQueryKey(conversationId),
      )

      const previewBase = body || (attachment ? '📎 Imagen' : '')
      qc.setQueryData<ChatConversationDetail | undefined>(
        conversationQueryKey(conversationId),
        (prev) => {
          if (!prev) return prev
          return {
            conversation: {
              ...prev.conversation,
              lastMessageAt: tempMessage.createdAt,
              lastMessageSender: 'agent',
              lastMessagePreview: previewBase.slice(0, 120),
            },
            messages: [...prev.messages, tempMessage],
            user: prev.user,
          }
        },
      )

      return { tempId, previous, attachment }
    },
    onSuccess: (saved, _vars, ctx) => {
      // Swap temp for canonical
      qc.setQueryData<ChatConversationDetail | undefined>(
        conversationQueryKey(conversationId),
        (prev) => {
          if (!prev) return prev
          return {
            conversation: prev.conversation,
            messages: prev.messages.map((m) => (m.id === ctx?.tempId ? saved : m)),
            user: prev.user,
          }
        },
      )
      // Free the optimistic blob URL once the server-signed URL is in place.
      if (ctx?.attachment?.localUrl) URL.revokeObjectURL(ctx.attachment.localUrl)
      // Invalidate inbox so the conversation jumps to top + sender flips
      qc.invalidateQueries({ queryKey: ['admin', 'chat', 'inbox'] })
    },
    onError: (err, _vars, ctx) => {
      // Rollback to snapshot
      if (ctx?.previous) {
        qc.setQueryData(conversationQueryKey(conversationId), ctx.previous)
      }
      if (ctx?.attachment?.localUrl) URL.revokeObjectURL(ctx.attachment.localUrl)
      toast.error(err instanceof Error ? err.message : 'No pudimos enviar el mensaje')
    },
  })

  if (isClosed) {
    return (
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground text-center">
          Esta conversación está cerrada. El usuario verá tu mensaje sólo si la reabre — para
          continuar pídele que inicie un nuevo chat.
        </p>
      </div>
    )
  }

  const handleSend = () => {
    const trimmed = value.trim()
    if ((!trimmed && !staged) || send.isPending) return

    const stagedSnapshot = staged
    setValue('')
    setStaged(null)

    send.mutate(
      { body: trimmed, attachment: stagedSnapshot ?? undefined },
      {
        onError: () => {
          // Restore both text and staged attachment on failure.
          setValue(trimmed)
          setStaged(stagedSnapshot)
        },
      },
    )
  }

  const handleFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type as ChatAttachmentMimeType)) {
      toast.error('Solo se aceptan imágenes (PNG, JPG, WebP, GIF).')
      return
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      const maxMb = Math.round(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024))
      toast.error(`La imagen supera el límite de ${maxMb} MB.`)
      return
    }
    if (staged?.localUrl) URL.revokeObjectURL(staged.localUrl)
    setStaged({ file, localUrl: URL.createObjectURL(file) })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const remaining = MAX_LEN - value.length
  const overLimit = remaining < 0
  const sendDisabled = (!value.trim() && !staged) || send.isPending || isUploading || overLimit

  return (
    // No border-t / bg-card here — the parent rail in ConversationDetail
    // owns those so the divider spans the full pane width while the
    // textarea+button stay centered with the thread above.
    <div className="px-3 py-2.5">
      {/* Staged-attachment preview row above the input. */}
      {staged && (
        <div className="mb-2 inline-flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-1.5 max-w-full">
          <img
            src={staged.localUrl}
            alt={staged.file.name}
            className="h-14 w-14 rounded object-cover shrink-0"
          />
          <div className="min-w-0 flex-1 pr-1 py-0.5">
            <p className="text-xs text-foreground truncate" title={staged.file.name}>
              {staged.file.name}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {(staged.file.size / 1024).toFixed(0)} KB
              {isUploading && ' · subiendo…'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (staged.localUrl) URL.revokeObjectURL(staged.localUrl)
              setStaged(null)
            }}
            disabled={isUploading}
            aria-label="Quitar imagen"
            className="shrink-0 h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          onChange={handleFilePicked}
          className="hidden"
          aria-hidden="true"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || send.isPending}
          aria-label="Adjuntar imagen"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <Paperclip className="h-4 w-4" aria-hidden="true" />
        </Button>

        {/* Emoji picker trigger — wrapper is relative so the popover can
            anchor to it via absolute positioning. */}
        <div className="relative shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setPickerOpen((p) => !p)}
            aria-label={pickerOpen ? 'Cerrar selector de emojis' : 'Abrir selector de emojis'}
            aria-expanded={pickerOpen}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <Smile className="h-4 w-4" aria-hidden="true" />
          </Button>
          {pickerOpen && (
            <EmojiPicker
              onSelect={(emoji) => insertAtCursor(emoji)}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            // Fire-and-forget — store debounces internally so this is safe
            // to call on every keystroke. Skip empty value (e.g. user just
            // backspaced everything) to avoid emitting a "typing" signal
            // when there's nothing to type.
            if (e.target.value.length > 0) notifyTyping()
          }}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu respuesta…"
          rows={1}
          maxLength={MAX_LEN + 100}
          aria-label="Respuesta al usuario"
          className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 leading-snug"
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={sendDisabled}
          aria-label="Enviar respuesta"
          className="h-9 w-9 shrink-0"
        >
          {send.isPending || isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
      {value.length > MAX_LEN - 200 && (
        <p
          className={`mt-1 text-[10px] text-right ${
            overLimit ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {overLimit
            ? `${Math.abs(remaining)} caracteres sobre el límite`
            : `${remaining} caracteres restantes`}
        </p>
      )}
    </div>
  )
}
