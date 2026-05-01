'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Building, Home, MapPin } from 'lucide-react'
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
import type { Sector } from '@/lib/types'

interface SectoresListProps {
  obraId: string
  initialSectores: Sector[]
}

const tipoLabels = {
  unidad_funcional: 'Unidad Funcional',
  area_comun: 'Área Común',
  otro: 'Otro',
}

const tipoIcons = {
  unidad_funcional: Home,
  area_comun: Building,
  otro: MapPin,
}

export function SectoresList({ obraId, initialSectores }: SectoresListProps) {
  const [sectores, setSectores] = useState(initialSectores)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<Sector['tipo']>('unidad_funcional')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleAdd = async () => {
    if (!nombre.trim()) return
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('sectores')
      .insert({
        obra_id: obraId,
        nombre: nombre.trim(),
        tipo,
        orden: sectores.length,
      })
      .select()
      .single()

    if (!error && data) {
      setSectores([...sectores, data])
      setNombre('')
      setTipo('unidad_funcional')
      setOpen(false)
    }
    setLoading(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase
      .from('sectores')
      .delete()
      .eq('id', id)

    if (!error) {
      setSectores(sectores.filter((s) => s.id !== id))
    }
    setDeleting(null)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sectores</CardTitle>
            <CardDescription>
              Define las unidades funcionales, áreas comunes u otros sectores de la obra
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4 mr-2" />
                Agregar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo Sector</DialogTitle>
                <DialogDescription>
                  Agrega un nuevo sector a la obra
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    placeholder="Ej: UF 1, Hall PB, Terraza"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as Sector['tipo'])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unidad_funcional">Unidad Funcional</SelectItem>
                      <SelectItem value="area_comun">Área Común</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAdd} disabled={loading || !nombre.trim()}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : 'Agregar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {sectores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay sectores definidos. Agrega el primer sector para comenzar.
          </p>
        ) : (
          <div className="space-y-2">
            {sectores.map((sector) => {
              const Icon = tipoIcons[sector.tipo]
              return (
                <div
                  key={sector.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-muted p-2">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{sector.nombre}</p>
                      <Badge variant="outline" className="text-xs">
                        {tipoLabels[sector.tipo]}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(sector.id)}
                    disabled={deleting === sector.id}
                  >
                    {deleting === sector.id ? (
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
