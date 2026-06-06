'use client'

import type { UIMessage } from 'ai'
import { Bot, User, CheckCircle2, XCircle, Loader2, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  message: UIMessage
  isAudioMessage?: boolean
}

// Renders assistant text with visual hierarchy:
// - Unidad title (largest)
// - Rubro headers (medium)
// - Tarea items (smallest, with check for finalizada)
function FormattedAssistantText({ text }: { text: string }) {
  const lines = text.split('\n')

  // Detect whether this looks like a structured avances response
  const hasStructure = /(\*\*\s*)?unidad\s*:/i.test(text)

  if (!hasStructure) {
    return <span className="whitespace-pre-wrap">{text}</span>
  }

  const elements: React.ReactNode[] = []

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim()
    if (!line) {
      elements.push(<div key={`sp-${i}`} className="h-1.5" />)
      return
    }

    // Unidad title: "**Unidad: 503**" or "Unidad: 503"
    const unidadMatch = line.match(/^\*{0,2}\s*unidad\s*:\s*(.+?)\s*\*{0,2}$/i)
    if (unidadMatch) {
      elements.push(
        <div
          key={`u-${i}`}
          className="flex items-center gap-2 mt-1 mb-1.5 first:mt-0"
        >
          <span className="text-base font-bold text-foreground">
            Unidad {unidadMatch[1].replace(/^unidad\s+/i, '')}
          </span>
        </div>
      )
      return
    }

    // Tarea item: "- paredes: finalizada" (starts with - or •)
    const tareaMatch = line.match(/^[-•]\s*(.+)$/)
    if (tareaMatch) {
      const content = tareaMatch[1]
      const colonIdx = content.indexOf(':')
      let taskName = content
      let desc = ''
      if (colonIdx !== -1) {
        taskName = content.slice(0, colonIdx).trim()
        desc = content.slice(colonIdx + 1).trim()
      }
      const isDone = /finalizad|✓|complet|termina/i.test(desc)
      const cleanDesc = desc.replace(/✓/g, '').trim()
      elements.push(
        <div key={`t-${i}`} className="flex items-start gap-1.5 pl-3 py-0.5">
          <span className="text-muted-foreground mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
          <span className="text-sm">
            <span className="font-medium text-foreground/90">{taskName}</span>
            {desc && (
              <>
                <span className="text-muted-foreground">: </span>
                {isDone ? (
                  <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                    {cleanDesc || 'finalizada'}
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className="text-foreground/80">{cleanDesc}</span>
                )}
              </>
            )}
          </span>
        </div>
      )
      return
    }

    // Rubro header: line ending with ":" (no bullet)
    const rubroMatch = line.match(/^\*{0,2}\s*(.+?)\s*:\s*\*{0,2}$/)
    if (rubroMatch) {
      elements.push(
        <div
          key={`r-${i}`}
          className="text-sm font-semibold text-primary mt-2 mb-0.5"
        >
          {rubroMatch[1]}
        </div>
      )
      return
    }

    // Plain text line
    elements.push(
      <div key={`p-${i}`} className="text-sm whitespace-pre-wrap">
        {line}
      </div>
    )
  })

  return <div className="flex flex-col">{elements}</div>
}

function getMessageText(message: UIMessage): string {
  // First check if content is a string (from history)
  if (typeof message.content === 'string' && message.content) {
    return message.content
  }
  // Then check parts (from streaming responses)
  if (!message.parts || !Array.isArray(message.parts)) return ''
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

interface ToolPart {
  type: string
  toolCallId: string
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  input?: Record<string, unknown>
  output?: {
    success?: boolean
    resultado?: string
    message?: string
    mensaje?: string
    count?: number
    avance?: { id: string; tarea: string; rubro?: string; sector: string }
    tarea?: { id: string; nombre: string; rubro_id?: string }
    rubro?: { id: string; nombre: string }
    sector?: { id: string; nombre: string }
    opciones?: Array<{ id: string; nombre: string }>
    sugerencias?: Array<{ rubro: string; rubroId: string; tareas: { id: string; nombre: string }[] }>
    sugerencia_crear?: string
    rubros_disponibles?: Array<{ id: string; nombre: string }>
    avances?: Array<{ fecha: string; sector?: string; tarea?: string; rubro?: string; descripcion: string }>
    historial?: Array<{ fecha: string; descripcion: string; estado: string }>
    sectores?: Array<{ id: string; nombre: string; tipo: string }>
    rubros?: Array<{ id: string; nombre: string }>
  }
}

function getToolCalls(message: UIMessage): ToolPart[] {
  if (!message.parts || !Array.isArray(message.parts)) return []
  return message.parts.filter(
    (p): p is ToolPart => typeof p.type === 'string' && p.type.startsWith('tool-')
  )
}

function ToolCallDisplay({ tool }: { tool: ToolPart }) {
  const toolName = tool.type.replace('tool-', '')
  const isLoading = tool.state === 'input-streaming' || tool.state === 'input-available'
  const hasError = tool.state === 'output-error'
  const output = tool.output

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Procesando...</span>
      </div>
    )
  }

  if (hasError || !output) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
        <XCircle className="h-4 w-4" />
        <span>Error al procesar</span>
      </div>
    )
  }

  // analizarTexto - don't show UI, the LLM will respond with text
  if (toolName === 'analizarTexto') {
    // This tool's output is used by the LLM to formulate a response
    // We don't need to show it in the UI
    return null
  }

  // registrarAvance - avance registered successfully
  if (toolName === 'registrarAvance') {
    if (output.success) {
      return (
        <div className="flex items-start gap-2 text-sm bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg px-3 py-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap">{output.message}</span>
        </div>
      )
    }
    return (
      <div className="flex items-start gap-2 text-sm bg-destructive/10 text-destructive rounded-lg px-3 py-2">
        <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{output.message || 'Error al registrar'}</span>
      </div>
    )
  }

  // crearTarea - new task created
  if (toolName === 'crearTarea') {
    if (output.success) {
      return (
        <div className="flex items-center gap-2 text-sm bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg px-3 py-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{output.message}</span>
        </div>
      )
    }
    return null
  }

  // consultarAvances - the LLM formats the response as grouped text,
  // so we don't render the raw card display. Return null to let the
  // assistant's text response (grouped by unidad/rubro/tarea) show.
  if (toolName === 'consultarAvances') {
    return null
  }

  // consultarHistorial - history of a task+sector
  if (toolName === 'consultarHistorial' && output.historial) {
    if (output.historial.length === 0) {
      return (
        <div className="bg-muted rounded-lg px-3 py-2 text-sm">
          No hay historial.
        </div>
      )
    }
    return (
      <div className="bg-muted rounded-lg px-3 py-2 text-sm space-y-2">
        <div className="font-medium">{output.message}</div>
        <div className="space-y-1">
          {output.historial.map((h, i) => (
            <div key={i} className={cn(
              "text-xs border-l-2 pl-2",
              h.estado === 'actual' ? 'border-green-500' : 'border-muted-foreground/30'
            )}>
              <span className="text-muted-foreground">{h.fecha}</span>
              {h.estado === 'archivado' && <span className="text-muted-foreground"> (archivado)</span>}
              : {h.descripcion}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // listarSectores
  if (toolName === 'listarSectores' && output.sectores) {
    return (
      <div className="bg-muted rounded-lg px-3 py-2 text-sm">
        <div className="font-medium mb-1">Sectores:</div>
        <ul className="space-y-0.5">
          {output.sectores.map((s) => (
            <li key={s.id} className="text-xs">- {s.nombre} ({s.tipo})</li>
          ))}
        </ul>
      </div>
    )
  }

  // listarRubros
  if (toolName === 'listarRubros' && output.rubros) {
    return (
      <div className="bg-muted rounded-lg px-3 py-2 text-sm">
        <div className="font-medium mb-1">Rubros:</div>
        <ul className="space-y-0.5">
          {output.rubros.map((r) => (
            <li key={r.id} className="text-xs">- {r.nombre}</li>
          ))}
        </ul>
      </div>
    )
  }

  // Fallback - show message if available
  if (output.message) {
    return (
      <div className={cn(
        'rounded-lg px-3 py-2 text-sm',
        output.success ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-muted'
      )}>
        {output.success && <CheckCircle2 className="h-4 w-4 inline mr-2" />}
        {output.message}
      </div>
    )
  }

  return null
}

export function ChatMessage({ message, isAudioMessage }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const text = getMessageText(message)
  const toolCalls = getToolCalls(message)

  // Get images from parts
  const images = message.parts?.filter(
    (p): p is { type: 'file'; mimeType: string; url: string } => 
      p.type === 'file' && p.mimeType?.startsWith('image/')
  ) || []

  // If assistant message has no text and no tool calls, don't render
  if (!isUser && !text && toolCalls.length === 0) {
    return null
  }

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={cn(
        'flex flex-col gap-2 max-w-[80%]',
        isUser && 'items-end'
      )}>
        {images.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {images.map((img, i) => (
              <img 
                key={i} 
                src={img.url} 
                alt="" 
                className="max-w-48 max-h-48 rounded-lg object-cover"
              />
            ))}
          </div>
        )}
        {text && (
          <div className={cn(
            'rounded-lg px-4 py-2 text-sm',
            isUser 
              ? 'bg-primary text-primary-foreground whitespace-pre-wrap' 
              : 'bg-muted'
          )}>
            {isAudioMessage && isUser && (
              <span className="inline-flex items-center gap-1 mr-2 text-primary-foreground/70">
                <Mic className="w-3 h-3" />
              </span>
            )}
            {isUser ? text : <FormattedAssistantText text={text} />}
          </div>
        )}
        {toolCalls.map((tool) => (
          <ToolCallDisplay key={tool.toolCallId} tool={tool} />
        ))}
      </div>
    </div>
  )
}
