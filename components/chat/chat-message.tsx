'use client'

import type { UIMessage } from 'ai'
import { Bot, User } from 'lucide-react'
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

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const text = getMessageText(message)

  // Get images from parts
  const images = message.parts?.filter(
    (p): p is { type: 'file'; mimeType: string; url: string } => 
      p.type === 'file' && p.mimeType?.startsWith('image/')
  ) || []

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
      </div>
    </div>
  )
}
