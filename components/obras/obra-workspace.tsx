'use client'

import { MessageSquare, ClipboardList } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ChatInterface } from '@/components/chat/chat-interface'
import { ManualEntryForm } from '@/components/manual/manual-entry-form'
import type { Sector, Rubro, Tarea } from '@/lib/types'

interface ObraWorkspaceProps {
  obraId: string
  sectores: Sector[]
  rubros: Rubro[]
  tareas: Tarea[]
}

export function ObraWorkspace({ obraId, sectores, rubros, tareas }: ObraWorkspaceProps) {
  return (
    <Tabs defaultValue="chat" className="flex flex-col h-full gap-0">
      <div className="border-b px-4 py-2 bg-card">
        <TabsList>
          <TabsTrigger value="chat">
            <MessageSquare className="size-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="manual">
            <ClipboardList className="size-4" />
            Carga Manual
          </TabsTrigger>
        </TabsList>
      </div>

      {/* forceMount keeps the chat mounted so its state/history isn't lost on tab switch */}
      <TabsContent value="chat" forceMount className="flex-1 overflow-hidden data-[state=inactive]:hidden">
        <ChatInterface
          obraId={obraId}
          sectores={sectores}
          rubros={rubros}
          tareas={tareas}
        />
      </TabsContent>

      <TabsContent value="manual" className="flex-1 overflow-hidden">
        <ManualEntryForm
          obraId={obraId}
          sectores={sectores}
          rubros={rubros}
          tareas={tareas}
        />
      </TabsContent>
    </Tabs>
  )
}
