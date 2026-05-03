'use client'

import type { UIMessage } from 'ai'
import { Bot, User, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  message: UIMessage
}

function getMessageText(message: UIMessage): string {
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
    message?: string
    count?: number
    avances?: Array<{ fecha: string; sector: string; rubro: string; descripcion: string }>
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
        <span>Procesando {toolName === 'registrarAvances' ? 'registro...' : 'consulta...'}</span>
      </div>
    )
  }

  if (hasError || !output) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
        <XCircle className="h-4 w-4" />
        <span>Error al procesar la solicitud</span>
      </div>
    )
  }

  // Show tool result
  if (toolName === 'registrarAvances') {
    return (
      <div className={cn(
        'rounded-lg px-3 py-2 text-sm',
        output.success ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-muted'
      )}>
        <div className="flex items-center gap-2">
          {output.success ? <CheckCircle2 className="h-4 w-4" /> : null}
          <span>{output.message}</span>
        </div>
      </div>
    )
  }

  if (toolName === 'consultarAvances' && output.avances) {
    if (output.avances.length === 0) {
      return (
        <div className="bg-muted rounded-lg px-3 py-2 text-sm">
          No se encontraron avances.
        </div>
      )
    }
    return (
      <div className="bg-muted rounded-lg px-3 py-2 text-sm space-y-2">
        <div className="font-medium">{output.message}</div>
        <div className="space-y-1">
          {output.avances.slice(0, 10).map((a, i) => (
            <div key={i} className="text-xs border-l-2 border-primary/30 pl-2">
              <span className="text-muted-foreground">{a.fecha}</span> - <span className="font-medium">{a.sector}</span> / {a.rubro}: {a.descripcion}
            </div>
          ))}
          {output.avances.length > 10 && (
            <div className="text-xs text-muted-foreground">...y {output.avances.length - 10} mas</div>
          )}
        </div>
      </div>
    )
  }

  if (toolName === 'listarSectores' && output.sectores) {
    return (
      <div className="bg-muted rounded-lg px-3 py-2 text-sm">
        <div className="font-medium mb-1">Sectores disponibles:</div>
        <ul className="space-y-0.5">
          {output.sectores.map((s) => (
            <li key={s.id} className="text-xs">- {s.nombre} ({s.tipo})</li>
          ))}
        </ul>
      </div>
    )
  }

  if (toolName === 'listarRubros' && output.rubros) {
    return (
      <div className="bg-muted rounded-lg px-3 py-2 text-sm">
        <div className="font-medium mb-1">Rubros disponibles:</div>
        <ul className="space-y-0.5">
          {output.rubros.map((r) => (
            <li key={r.id} className="text-xs">- {r.nombre}</li>
          ))}
        </ul>
      </div>
    )
  }

  // Fallback for other tools
  return (
    <div className="bg-muted rounded-lg px-3 py-2 text-sm">
      {output.message || 'Operacion completada'}
    </div>
  )
}

export function ChatMessage({ message }: ChatMessageProps) {
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
            'rounded-lg px-4 py-2 text-sm whitespace-pre-wrap',
            isUser 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted'
          )}>
            {text}
          </div>
        )}
        {toolCalls.map((tool) => (
          <ToolCallDisplay key={tool.toolCallId} tool={tool} />
        ))}
      </div>
    </div>
  )
}
