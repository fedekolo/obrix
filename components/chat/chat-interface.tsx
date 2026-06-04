'use client'

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useChat, type Message } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Send, Mic, MicOff, ImagePlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch(`/api/chat/history?obraId=${obraId}`)
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
}: ChatInterfaceProps & { initialMessages: MessageWithDate[] }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [inputValue, setInputValue] = useState('')
  
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
      },
    }),
  }), [obraId, sectores, rubros, tareas])

  const { messages, sendMessage, status, setMessages } = useChat({ 
    transport,
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

  // Merge messages with dates for rendering
  const messagesWithDates = useMemo(() => {
    // Cast messages to include potential createdAt from history
    return messages.map((msg, index) => {
      const historyMsg = initialMessages.find(h => h.id === msg.id)
      return {
        ...msg,
        createdAt: historyMsg?.createdAt || (index === 0 ? undefined : new Date().toISOString()),
      } as MessageWithDate
    })
  }, [messages, initialMessages])

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

  // Track saved message IDs to avoid duplicates
  const savedIdsRef = useRef<Set<string>>(new Set(initialMessages.map(m => m.id)))

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
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() && pendingImages.length === 0) return

    const messageContent = inputValue.trim()
    setInputValue('')
    setPendingImages([])

    await sendMessage({
      text: messageContent,
      ...(pendingImages.length > 0 && {
        experimental_attachments: pendingImages.map(url => ({
          contentType: 'image/jpeg',
          url,
        })),
      }),
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
        setInputValue((prev) => (prev ? `${prev} ${text}` : text))
        textareaRef.current?.focus()
      }
    } catch {
      // Transcription failed
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('obraId', obraId)

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (res.ok) {
          const { url } = await res.json()
          setPendingImages(prev => [...prev, url])
        }
      } catch {
        // Upload failed
      }
    }

    e.target.value = ''
  }

  const removePendingImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
          messagesWithDates.map((message, index) => {
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
                <ChatMessage message={message} />
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending images preview */}
      {pendingImages.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/30">
          <div className="flex gap-2 overflow-x-auto">
            {pendingImages.map((url, i) => (
              <div key={i} className="relative shrink-0">
                <img src={url} alt="" className="h-16 w-16 object-cover rounded-md" />
                <button
                  onClick={() => removePendingImage(i)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center"
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
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <ImagePlus className="w-4 h-4" />
          </Button>
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
