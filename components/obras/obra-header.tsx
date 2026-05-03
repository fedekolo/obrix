'use client'

import Link from 'next/link'
import { Settings, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import type { Obra } from '@/lib/types'

interface ObraHeaderProps {
  obra: Obra
  esPropietario: boolean
}

export function ObraHeader({ obra, esPropietario }: ObraHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 bg-card">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center justify-between min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold truncate">{obra.nombre}</h1>
              <Badge variant={esPropietario ? 'default' : 'secondary'} className="shrink-0 text-xs">
                {esPropietario ? 'Propietario' : 'Colaborador'}
              </Badge>
            </div>
            {obra.direccion && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <MapPin className="size-3 shrink-0" />
                {obra.direccion}
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/obras/${obra.id}/configuracion`}>
            <Settings className="size-4 mr-2" />
            Configurar
          </Link>
        </Button>
      </div>
    </header>
  )
}
