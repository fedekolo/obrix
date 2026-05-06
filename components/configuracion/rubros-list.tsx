'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Wrench, ChevronDown, ChevronRight, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_RUBROS_TAREAS } from '@/lib/default-rubros'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { Rubro, Tarea } from '@/lib/types'

interface RubrosListProps {
  obraId: string
  initialRubros: Rubro[]
  initialTareas: Tarea[]
}

export function RubrosList({ obraId, initialRubros, initialTareas }: RubrosListProps) {
  const [rubros, setRubros] = useState(initialRubros)
  const [tareas, setTareas] = useState(initialTareas)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deletingTarea, setDeletingTarea] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [tareaDialog, setTareaDialog] = useState<{ rubroId: string; open: boolean } | null>(null)
  const [nombreTarea, setNombreTarea] = useState('')
  const [addingTarea, setAddingTarea] = useState(false)
  const [expandedRubros, setExpandedRubros] = useState<Set<string>>(new Set())
  const [loadingDefaults, setLoadingDefaults] = useState(false)
  const router = useRouter()

  const toggleRubro = (id: string) => {
    setExpandedRubros(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getTareasForRubro = (rubroId: string) => tareas.filter(t => t.rubro_id === rubroId)

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
      setTareas(tareas.filter((t) => t.rubro_id !== id))
    }
    setDeleting(null)
    router.refresh()
  }

  const handleAddTarea = async (rubroId: string) => {
    if (!nombreTarea.trim()) return
    setAddingTarea(true)

    const supabase = createClient()
    const rubroTareas = getTareasForRubro(rubroId)
    const { data, error } = await supabase
      .from('tareas')
      .insert({
        rubro_id: rubroId,
        nombre: nombreTarea.trim(),
        orden: rubroTareas.length,
      })
      .select()
      .single()

    if (!error && data) {
      setTareas([...tareas, data])
      setNombreTarea('')
      setTareaDialog(null)
      setExpandedRubros(prev => new Set(prev).add(rubroId))
    }
    setAddingTarea(false)
    router.refresh()
  }

  const handleDeleteTarea = async (tareaId: string) => {
    setDeletingTarea(tareaId)
    const supabase = createClient()
    const { error } = await supabase
      .from('tareas')
      .delete()
      .eq('id', tareaId)

    if (!error) {
      setTareas(tareas.filter((t) => t.id !== tareaId))
    }
    setDeletingTarea(null)
    router.refresh()
  }

  const handleLoadDefaults = async () => {
    setLoadingDefaults(true)
    const supabase = createClient()

    try {
      // Insert all rubros first
      const rubrosToInsert = DEFAULT_RUBROS_TAREAS.map((r, i) => ({
        obra_id: obraId,
        nombre: r.nombre,
        orden: rubros.length + i,
      }))

      const { data: newRubros, error: rubrosError } = await supabase
        .from('rubros')
        .insert(rubrosToInsert)
        .select()

      if (rubrosError || !newRubros) {
        console.error('Error inserting rubros:', rubrosError)
        setLoadingDefaults(false)
        return
      }

      // Now insert tareas for each rubro
      const tareasToInsert: { rubro_id: string; nombre: string; orden: number }[] = []
      
      DEFAULT_RUBROS_TAREAS.forEach((defaultRubro, index) => {
        const insertedRubro = newRubros[index]
        if (insertedRubro) {
          defaultRubro.tareas.forEach((tareaNombre, tareaIndex) => {
            tareasToInsert.push({
              rubro_id: insertedRubro.id,
              nombre: tareaNombre,
              orden: tareaIndex,
            })
          })
        }
      })

      const { data: newTareas, error: tareasError } = await supabase
        .from('tareas')
        .insert(tareasToInsert)
        .select()

      if (tareasError) {
        console.error('Error inserting tareas:', tareasError)
      }

      // Update local state
      setRubros([...rubros, ...newRubros])
      if (newTareas) {
        setTareas([...tareas, ...newTareas])
      }
      
      router.refresh()
    } catch (err) {
      console.error('Error loading defaults:', err)
    }

    setLoadingDefaults(false)
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
          <div className="text-center py-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              No hay rubros definidos.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button 
                variant="outline" 
                onClick={handleLoadDefaults}
                disabled={loadingDefaults}
              >
                {loadingDefaults ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Download className="size-4 mr-2" />
                )}
                Cargar rubros predefinidos
              </Button>
              <span className="text-xs text-muted-foreground">o</span>
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="size-4 mr-2" />
                Crear rubro personalizado
              </Button>
            </div>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Los rubros predefinidos incluyen categorías comunes de construcción como Electricidad, Pintura, Carpinterías, etc. con sus tareas correspondientes.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rubros.map((rubro) => {
              const rubroTareas = getTareasForRubro(rubro.id)
              const isExpanded = expandedRubros.has(rubro.id)
              
              return (
                <Collapsible key={rubro.id} open={isExpanded} onOpenChange={() => toggleRubro(rubro.id)}>
                  <div className="rounded-lg border bg-card">
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3 flex-1">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-1 h-auto">
                            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <div className="rounded-md bg-muted p-2">
                          <Wrench className="size-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{rubro.nombre}</p>
                            {rubroTareas.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {rubroTareas.length} tarea{rubroTareas.length !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                          {rubro.descripcion && (
                            <p className="text-sm text-muted-foreground">{rubro.descripcion}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTareaDialog({ rubroId: rubro.id, open: true })}
                        >
                          <Plus className="size-4 mr-1" />
                          Tarea
                        </Button>
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
                    </div>
                    <CollapsibleContent>
                      <div className="border-t px-3 py-2 bg-muted/30">
                        {rubroTareas.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            Sin tareas definidas
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {rubroTareas.map((tarea) => (
                              <div key={tarea.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                                <span className="text-sm">{tarea.nombre}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-6"
                                  onClick={() => handleDeleteTarea(tarea.id)}
                                  disabled={deletingTarea === tarea.id}
                                >
                                  {deletingTarea === tarea.id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="size-3 text-destructive" />
                                  )}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })}
          </div>
        )}

        {/* Dialog para agregar tarea */}
        <Dialog open={tareaDialog?.open} onOpenChange={(open) => !open && setTareaDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Tarea</DialogTitle>
              <DialogDescription>
                Agrega una tarea específica a este rubro
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nombreTarea">Nombre de la tarea</Label>
                <Input
                  id="nombreTarea"
                  placeholder="Ej: Instalacion de luminarias, Pintura de techos"
                  value={nombreTarea}
                  onChange={(e) => setNombreTarea(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tareaDialog) {
                      handleAddTarea(tareaDialog.rubroId)
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTareaDialog(null)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => tareaDialog && handleAddTarea(tareaDialog.rubroId)} 
                disabled={addingTarea || !nombreTarea.trim()}
              >
                {addingTarea ? <Loader2 className="size-4 animate-spin" /> : 'Agregar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
