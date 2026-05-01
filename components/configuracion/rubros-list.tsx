'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { Rubro } from '@/lib/types'

interface RubrosListProps {
  obraId: string
  initialRubros: Rubro[]
}

export function RubrosList({ obraId, initialRubros }: RubrosListProps) {
  const [rubros, setRubros] = useState(initialRubros)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleAdd = async () => {
    if (!nombre.trim()) return
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('rubros')
      .insert({
        obra_id: obraId,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        orden: rubros.length,
      })
      .select()
      .single()

    if (!error && data) {
      setRubros([...rubros, data])
      setNombre('')
      setDescripcion('')
      setOpen(false)
    }
    setLoading(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase
      .from('rubros')
      .delete()
      .eq('id', id)

    if (!error) {
      setRubros(rubros.filter((r) => r.id !== id))
    }
    setDeleting(null)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Rubros</CardTitle>
            <CardDescription>
              Define las categorías de trabajo (Electricidad, Pintura, Plomería, etc.)
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
                <DialogTitle>Nuevo Rubro</DialogTitle>
                <DialogDescription>
                  Agrega una nueva categoría de trabajo
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    placeholder="Ej: Electricidad, Pintura, Pisos"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descripcion">Descripción (opcional)</Label>
                  <Textarea
                    id="descripcion"
                    placeholder="Descripción del rubro"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={2}
                  />
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
        {rubros.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay rubros definidos. Agrega el primer rubro para comenzar.
          </p>
        ) : (
          <div className="space-y-2">
            {rubros.map((rubro) => (
              <div
                key={rubro.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <Wrench className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{rubro.nombre}</p>
                    {rubro.descripcion && (
                      <p className="text-sm text-muted-foreground">{rubro.descripcion}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(rubro.id)}
                  disabled={deleting === rubro.id}
                >
                  {deleting === rubro.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4 text-destructive" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
