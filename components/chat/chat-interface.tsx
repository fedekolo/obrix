'use client'

import { useRef, useEffect, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Send, Mic, MicOff, ImagePlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ChatMessage } from './chat-message'
import type { Sector, Rubro } from '@/lib/types'

interface ChatInterfaceProps {
  obraId: string
  sectores: Sector[]
  rubros: Rubro[]
  userId: string
}

export function ChatInterface({ obraId, sectores, rubros, userId }: ChatInterfaceProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [inputValue, setInputValue] = useState('')
  
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { obraId, sectores, rubros },
    }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

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
    } catch (err) {
      console.error('[v0] Error accessing microphone:', err)
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
    } catch (err) {
      console.error('[v0] Transcription error:', err)
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
      } catch (err) {
        console.error('[v0] Upload error:', err)
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
        {messages.length === 0 ? (
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
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
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
