'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectoresList } from './sectores-list'
import { RubrosList } from './rubros-list'
import { ColaboradoresList } from './colaboradores-list'
import type { Sector, Rubro, ObraColaborador } from '@/lib/types'

interface ConfigTabsProps {
  obraId: string
  sectores: Sector[]
  rubros: Rubro[]
  colaboradores: ObraColaborador[]
  isOwner: boolean
}

export function ConfigTabs({
  obraId,
  sectores,
  rubros,
  colaboradores,
  isOwner,
}: ConfigTabsProps) {
  return (
    <Tabs defaultValue="sectores" className="space-y-4">
      <TabsList>
        <TabsTrigger value="sectores">Sectores</TabsTrigger>
        <TabsTrigger value="rubros">Rubros</TabsTrigger>
        {isOwner && <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>}
      </TabsList>
      
      <TabsContent value="sectores" className="space-y-4">
        <SectoresList obraId={obraId} initialSectores={sectores} />
      </TabsContent>
      
      <TabsContent value="rubros" className="space-y-4">
        <RubrosList obraId={obraId} initialRubros={rubros} />
      </TabsContent>
      
      {isOwner && (
        <TabsContent value="colaboradores" className="space-y-4">
          <ColaboradoresList obraId={obraId} initialColaboradores={colaboradores} />
        </TabsContent>
      )}
    </Tabs>
  )
}
