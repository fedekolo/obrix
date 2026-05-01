'use client'

import Link from 'next/link'
import { Building2, Users, MapPin, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ObraWithAccess } from '@/lib/types'

interface ObrasListProps {
  obras: ObraWithAccess[]
  currentUserId: string
}

export function ObrasList({ obras, currentUserId }: ObrasListProps) {
  if (obras.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Building2 className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No tienes obras</h3>
          <p className="text-muted-foreground text-center mb-4 max-w-sm">
            Crea tu primera obra para comenzar a registrar el avance de tu proyecto de construcción.
          </p>
          <Button asChild>
            <Link href="/obras/nueva">Crear primera obra</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {obras.map((obra) => (
        <Link key={obra.id} href={`/obras/${obra.id}`}>
          <Card className="h-full transition-colors hover:bg-muted/50 cursor-pointer group">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {obra.es_propietario ? (
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Building2 className="size-5 text-primary" />
                    </div>
                  ) : (
                    <div className="rounded-lg bg-accent/20 p-2">
                      <Users className="size-5 text-accent" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-base line-clamp-1">{obra.nombre}</CardTitle>
                    {obra.direccion && (
                      <CardDescription className="flex items-center gap-1 mt-0.5">
                        <MapPin className="size-3" />
                        <span className="line-clamp-1">{obra.direccion}</span>
                      </CardDescription>
                    )}
                  </div>
                </div>
                <Badge variant={obra.es_propietario ? 'default' : 'secondary'} className="shrink-0">
                  {obra.es_propietario ? 'Propietario' : 'Colaborador'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {obra.descripcion && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {obra.descripcion}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Creada el {new Date(obra.created_at).toLocaleDateString('es-AR')}
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
