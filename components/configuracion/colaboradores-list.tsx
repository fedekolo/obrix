'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Users, Mail, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { ObraColaborador } from '@/lib/types'

interface ColaboradoresListProps {
  obraId: string
  initialColaboradores: ObraColaborador[]
}

const estadoConfig = {
  pendiente: { label: 'Pendiente', icon: Clock, variant: 'secondary' as const },
  aceptada: { label: 'Aceptada', icon: CheckCircle2, variant: 'default' as const },
  rechazada: { label: 'Rechazada', icon: XCircle, variant: 'destructive' as const },
}

export function ColaboradoresList({ obraId, initialColaboradores }: ColaboradoresListProps) {
  const [colaboradores, setColaboradores] = useState(initialColaboradores)
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<'editor' | 'viewer'>('editor')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleInvite = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('Debes estar autenticado')
      setLoading(false)
      return
    }

    // Check if already invited
    const existing = colaboradores.find(
      (c) => c.email_invitado.toLowerCase() === email.trim().toLowerCase()
    )
    if (existing) {
      setError('Este email ya fue invitado')
      setLoading(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('obra_colaboradores')
      .insert({
        obra_id: obraId,
        email_invitado: email.trim().toLowerCase(),
        rol,
        invitado_por: user.id,
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    if (data) {
      setColaboradores([data, ...colaboradores])
      setEmail('')
      setRol('editor')
      setOpen(false)
    }
    setLoading(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase
      .from('obra_colaboradores')
      .delete()
      .eq('id', id)

    if (!error) {
      setColaboradores(colaboradores.filter((c) => c.id !== id))
    }
    setDeleting(null)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Colaboradores</CardTitle>
            <CardDescription>
              Invita a otros usuarios a colaborar en esta obra
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4 mr-2" />
                Invitar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invitar Colaborador</DialogTitle>
                <DialogDescription>
                  Envía una invitación por email para colaborar en esta obra
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colaborador@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rol">Rol</Label>
                  <Select value={rol} onValueChange={(v) => setRol(v as 'editor' | 'viewer')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">Editor - Puede agregar avances</SelectItem>
                      <SelectItem value="viewer">Viewer - Solo lectura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleInvite} disabled={loading || !email.trim()}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : 'Enviar Invitación'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {colaboradores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay colaboradores. Invita a alguien para trabajar juntos en esta obra.
          </p>
        ) : (
          <div className="space-y-2">
            {colaboradores.map((colab) => {
              const config = estadoConfig[colab.estado]
              const StatusIcon = config.icon
              return (
                <div
                  key={colab.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-muted p-2">
                      <Mail className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{colab.email_invitado}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs capitalize">
                          {colab.rol}
                        </Badge>
                        <Badge variant={config.variant} className="text-xs">
                          <StatusIcon className="size-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(colab.id)}
                    disabled={deleting === colab.id}
                  >
                    {deleting === colab.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4 text-destructive" />
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
