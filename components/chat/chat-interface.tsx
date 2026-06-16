'use client'

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useChat, type Message } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Send, Mic, MicOff, ImagePlus, Loader2, Camera, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChatMessage } from './chat-message'
import type { Sector, Rubro, Tarea } from '@/lib/types'

interface ChatInterfaceProps {
  obraId: string
  sectores: Sector[]
  rubros: Rubro[]
  tareas: Tarea[]
}

interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// A locally-uploaded image awaiting association with an avance
interface PendingImage {
  id: string // short stable id used to reference the image to the LLM
  url: string // local serving URL (/api/file?pathname=...)
  pathname: string // blob pathname stored in DB
  nombre: string // original filename
}

// Extended Message type with createdAt for date separators
interface MessageWithDate extends Message {
  createdAt?: string
}

// Helper to format date for separator
function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  const isToday = date.toDateString() === today.toDateString()
  const isYesterday = date.toDateString() === yesterday.toDateString()
  
  if (isToday) return 'Hoy'
  if (isYesterday) return 'Ayer'
  
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

// Date separator component
function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground font-medium px-2">
        {formatDateSeparator(date)}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

// Wrapper that loads history first
export function ChatInterface({ obraId, sectores, rubros, tareas }: ChatInterfaceProps) {
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [initialMessages, setInitialMessages] = useState<MessageWithDate[]>([])
  const [initialHasMore, setInitialHasMore] = useState(false)

  // Load most recent page (20 messages) of chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch(`/api/chat/history?obraId=${obraId}&offset=0`)
        if (res.ok) {
          const data = await res.json()
          const storedMessages = data.messages
          if (storedMessages && storedMessages.length > 0) {
            const converted: MessageWithDate[] = storedMessages.map((m: StoredMessage) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.created_at,
            }))
            setInitialMessages(converted)
          }
          setInitialHasMore(!!data.hasMore)
        }
      } catch {
        // Failed to load history, continue with empty chat
      } finally {
        setIsLoadingHistory(false)
      }
    }
    loadHistory()
  }, [obraId])

  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <ChatInterfaceInner
      key={`chat-${obraId}-${initialMessages.length}`}
      obraId={obraId}
      sectores={sectores}
      rubros={rubros}
      tareas={tareas}
      initialMessages={initialMessages}
      initialHasMore={initialHasMore}
    />
  )
}

// Inner component that renders the chat with pre-loaded messages
function ChatInterfaceInner({ 
  obraId, 
  sectores, 
  rubros, 
  tareas,
  initialMessages,
  initialHasMore,
}: ChatInterfaceProps & { initialMessages: MessageWithDate[]; initialHasMore: boolean }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [audioMessageIds, setAudioMessageIds] = useState<Set<string>>(new Set())
  const [olderMessages, setOlderMessages] = useState<MessageWithDate[]>([])
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const pendingAudioRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [inputValue, setInputValue] = useState('')

  // Keep a ref of pending images so the transport closure always reads the latest
  const pendingImagesRef = useRef<PendingImage[]>([])
  useEffect(() => {
    pendingImagesRef.current = pendingImages
  }, [pendingImages])
  
  // Memoize transport to prevent recreation on every render
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    prepareSendMessagesRequest: ({ id, messages }) => ({
      body: {
        id,
        messages,
        obraId,
        sectores,
        rubros,
        tareas,
        imagenesPendientes: pendingImagesRef.current.map(img => ({
          id: img.id,
          pathname: img.pathname,
          nombre: img.nombre,
        })),
      },
    }),
  }), [obraId, sectores, rubros, tareas])

  const { messages, sendMessage, status, setMessages, error } = useChat({ 
    transport,
    onError: (err) => {
      console.log('[v0] useChat onError:', err?.message)
    },
  })

  // Load initial messages into useChat on mount
  const hasLoadedRef = useRef(false)
  useEffect(() => {
    if (!hasLoadedRef.current && initialMessages.length > 0) {
      setMessages(initialMessages)
      hasLoadedRef.current = true
    }
  }, [initialMessages, setMessages])

  const isLoading = status === 'streaming' || status === 'submitted'

  // Track saved message IDs to avoid duplicates / re-posting
  const savedIdsRef = useRef<Set<string>>(new Set(initialMessages.map(m => m.id)))

  // Track how many messages are already loaded (older + initial) for the offset
  const loadedCountRef = useRef(initialMessages.length)
  useEffect(() => {
    loadedCountRef.current = olderMessages.length + initialMessages.length
  }, [olderMessages.length, initialMessages.length])

  // Load an older page (20) and prepend it, preserving scroll position
  const loadMore = useCallback(async () => {
    if (isLoadingMore) return
    setIsLoadingMore(true)
    const container = scrollContainerRef.current
    const prevScrollHeight = container?.scrollHeight ?? 0
    try {
      const res = await fetch(`/api/chat/history?obraId=${obraId}&offset=${loadedCountRef.current}`)
      if (res.ok) {
        const data = await res.json()
        const stored: StoredMessage[] = data.messages || []
        const converted: MessageWithDate[] = stored.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.created_at,
        }))
        if (converted.length > 0) {
          setOlderMessages(prev => [...converted, ...prev])
          // Mark older messages as already saved to avoid re-posting them
          converted.forEach(m => savedIdsRef.current.add(m.id))
        }
        setHasMore(!!data.hasMore)
        // Preserve scroll position after prepending older messages
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight
          }
        })
      }
    } catch {
      // Failed to load more
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, obraId])

  // Merge messages with dates for rendering (older history + current session)
  const messagesWithDates = useMemo(() => {
    const current = messages.map((msg, index) => {
      const historyMsg = initialMessages.find(h => h.id === msg.id)
      return {
        ...msg,
        createdAt: historyMsg?.createdAt || (index === 0 ? undefined : new Date().toISOString()),
      } as MessageWithDate
    })
    return [...olderMessages, ...current]
  }, [messages, initialMessages, olderMessages])

  // Save message to history
  const saveMessage = useCallback(async (role: 'user' | 'assistant', content: string) => {
    try {
      await fetch('/api/chat/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obraId, role, content }),
      })
    } catch {
      // Failed to save, continue anyway
    }
  }, [obraId])

  // Save new messages when they appear and are complete
  useEffect(() => {
    // Only check when not streaming (messages are complete)
    if (status === 'streaming' || status === 'submitted') {
      return
    }
    
    messages.forEach((message) => {
      // Skip if already saved
      if (savedIdsRef.current.has(message.id)) {
        return
      }
      
      // Extract text content - check multiple sources
      let textContent = ''
      
      // 1. Check if content is a string
      if (typeof message.content === 'string' && message.content) {
        textContent = message.content
      }
      // 2. Check parts array (AI SDK format)
      else if (Array.isArray(message.parts)) {
        // First try to get text parts
        const textParts = message.parts
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && 'text' in p)
          .map(p => p.text)
          .join('')
        
        if (textParts) {
          textContent = textParts
        } else if (message.role === 'assistant') {
          // For assistant messages with only tool calls, extract tool output messages
          const toolMessages = message.parts
            .filter((p): p is { type: string; output?: { message?: string; success?: boolean } } => 
              typeof p.type === 'string' && p.type.startsWith('tool-') && !!p.output?.message
            )
            .map(p => p.output?.message)
            .filter(Boolean)
            .join('\n')
          
          if (toolMessages) {
            textContent = toolMessages
          }
        }
      }
      
      if (textContent) {
        savedIdsRef.current.add(message.id)
        saveMessage(message.role as 'user' | 'assistant', textContent)
      }
    })
  }, [messages, status, saveMessage])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    
    // Check if we need to mark the last user message as audio
    if (pendingAudioRef.current) {
      const userMessages = messages.filter(m => m.role === 'user')
      const lastUserMsg = userMessages[userMessages.length - 1]
      if (lastUserMsg && !audioMessageIds.has(lastUserMsg.id)) {
        setAudioMessageIds(prev => new Set(prev).add(lastUserMsg.id))
        pendingAudioRef.current = false
      }
    }
  }, [messages, audioMessageIds])

  // Clear pending images once the assistant reports them as associated to an avance
  useEffect(() => {
    const associatedIds = new Set<string>()
    for (const m of messages) {
      if (m.role !== 'assistant') continue
      for (const part of m.parts || []) {
        // Tool output parts carry the registrarAvance result
        const output = (part as { output?: { imagenes_asociadas?: string[] } }).output
        if (output?.imagenes_asociadas) {
          output.imagenes_asociadas.forEach(id => associatedIds.add(id))
        }
      }
    }
    if (associatedIds.size > 0) {
      setPendingImages(prev => {
        const next = prev.filter(img => !associatedIds.has(img.id))
        return next.length === prev.length ? prev : next
      })
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() && pendingImages.length === 0) return

    const messageContent = inputValue.trim()
    setInputValue('')

    // Images are NOT cleared here. They stay "pending" and are sent as
    // context (imagenesPendientes) so the assistant can associate them with
    // an avance. They are cleared once a tool reports them as associated.
    await sendMessage({
      text: messageContent || '(imagen adjunta)',
    })
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(track => track.stop())
        await transcribeAudio(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      // Microphone access denied or unavailable
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.webm')

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const { text } = await res.json()
        if (text && text.trim()) {
          // Mark that we're sending an audio message
          pendingAudioRef.current = true
          
          // Send the message directly
          await sendMessage({
            text: text.trim(),
          })
        }
      }
    } catch {
      // Transcription failed
      pendingAudioRef.current = false
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('obraId', obraId)

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (res.ok) {
          const { url, pathname } = await res.json()
          // Short stable id used to reference this image to the assistant
          const imgNumber = pendingImagesRef.current.length + 1
          const newImage: PendingImage = {
            id: `img${imgNumber}-${Date.now().toString(36)}`,
            url,
            pathname,
            nombre: file.name,
          }
          setPendingImages(prev => [...prev, newImage])
        }
      } catch {
        // Upload failed
      }
    }
    setIsUploading(false)

    e.target.value = ''
  }

  const removePendingImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagesWithDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Asistente de Avance de Obra</h2>
            <p className="text-muted-foreground max-w-md mb-4">
              Puedo ayudarte a registrar avances y consultar el progreso de tu obra. 
              Usa texto, voz o imagenes para comunicarte.
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Ejemplos de lo que podes decirme:</p>
              <ul className="list-disc list-inside text-left mt-2 space-y-1">
                <li>{'"Termine la pintura en las UF 1 a 5"'}</li>
                <li>{'"Como va el avance de electricidad?"'}</li>
                <li>{'"En el hall hice pisos y pintura"'}</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center pb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Cargando...
                    </>
                  ) : (
                    'Cargar mas mensajes'
                  )}
                </Button>
              </div>
            )}
            {messagesWithDates.map((message, index) => {
              // Check if we need a date separator
              const currentDate = message.createdAt ? new Date(message.createdAt).toDateString() : null
              const prevMessage = index > 0 ? messagesWithDates[index - 1] : null
              const prevDate = prevMessage?.createdAt ? new Date(prevMessage.createdAt).toDateString() : null
              const showDateSeparator = currentDate && currentDate !== prevDate
              
              return (
                <div key={message.id}>
                  {showDateSeparator && message.createdAt && (
                    <DateSeparator date={message.createdAt} />
                  )}
                  <ChatMessage 
                    message={message} 
                    isAudioMessage={audioMessageIds.has(message.id)}
                  />
                </div>
              )
            })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error banner - shown if the assistant stream fails */}
      {error && (
        <div className="px-4 py-2 border-t bg-destructive/10">
          <div className="flex items-center justify-between gap-2 max-w-3xl mx-auto">
            <span className="text-sm text-destructive">
              Hubo un problema al procesar tu mensaje. Intenta enviarlo de nuevo.
            </span>
          </div>
        </div>
      )}

      {/* Pending images preview */}
      {pendingImages.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/30">
          <div className="flex gap-2 overflow-x-auto">
            {pendingImages.map((img, i) => (
              <div key={img.id} className="relative shrink-0">
                <img src={img.url || "/placeholder.svg"} alt={img.nombre} className="h-16 w-16 object-cover rounded-md" />
                <span className="absolute bottom-0 left-0 right-0 bg-foreground/70 text-background text-[10px] text-center rounded-b-md">
                  Imagen {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removePendingImage(i)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center"
                  aria-label={`Quitar imagen ${i + 1}`}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-background">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageUpload}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isLoading || isUploading}
                aria-label="Agregar imagen"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImagePlus className="w-4 h-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => cameraInputRef.current?.click()}>
                <Camera className="w-4 h-4 mr-2" />
                Sacar foto
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                <ImageIcon className="w-4 h-4 mr-2" />
                Elegir de galeria
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant={isRecording ? 'destructive' : 'outline'}
            size="icon"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading || isTranscribing}
          >
            {isTranscribing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Escribe un mensaje o usa el microfono..."
            className="min-h-[44px] max-h-32 resize-none flex-1"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || (!inputValue.trim() && pendingImages.length === 0)}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </form>
    </div>
  )
}
