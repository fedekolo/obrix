'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, MapPin, Check, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface InvitacionWithObra {
  id: string
  obra_id: string
  rol: 'editor' | 'viewer'
  created_at: string
  obras: {
    nombre: string
    direccion: string | null
  } | null
}

interface InvitacionesListProps {
  invitaciones: InvitacionWithObra[]
}

export function InvitacionesList({ invitaciones }: InvitacionesListProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  const handleResponse = async (invitacionId: string, aceptar: boolean) => {
    setLoading(invitacionId)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    await supabase
      .from('obra_colaboradores')
      .update({
        estado: aceptar ? 'aceptada' : 'rechazada',
        user_id: aceptar ? user.id : null,
      })
      .eq('id', invitacionId)

    router.refresh()
    setLoading(null)
  }

  if (invitaciones.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Mail className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No tienes invitaciones</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Cuando alguien te invite a colaborar en una obra, aparecerá aquí.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {invitaciones.map((inv) => (
        <Card key={inv.id}>
          <CardHeader>
            <CardTitle className="text-base">
              {inv.obras?.nombre || 'Obra desconocida'}
            </CardTitle>
            {inv.obras?.direccion && (
              <CardDescription className="flex items-center gap-1">
                <MapPin className="size-3" />
                {inv.obras.direccion}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">
                Rol: <span className="font-medium capitalize">{inv.rol}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(inv.created_at).toLocaleDateString('es-AR')}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => handleResponse(inv.id, false)}
                disabled={loading === inv.id}
              >
                {loading === inv.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <X className="size-4 mr-1" />
                    Rechazar
                  </>
                )}
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => handleResponse(inv.id, true)}
                disabled={loading === inv.id}
              >
                {loading === inv.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Check className="size-4 mr-1" />
                    Aceptar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
