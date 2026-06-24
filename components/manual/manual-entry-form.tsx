'use client'

import { useState, useRef, useMemo } from 'react'
import { Loader2, Camera, Image as ImageIcon, ImagePlus, X, CheckCircle2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Sector, Rubro, Tarea } from '@/lib/types'

interface ManualEntryFormProps {
  obraId: string
  sectores: Sector[]
  rubros: Rubro[]
  tareas: Tarea[]
}

interface UploadedImage {
  pathname: string
  url: string
  nombre: string
}

export function ManualEntryForm({ obraId, sectores, rubros, tareas }: ManualEntryFormProps) {
  const [selectedSectores, setSelectedSectores] = useState<Set<string>>(new Set())
  const [rubroId, setRubroId] = useState<string>('')
  const [selectedTareas, setSelectedTareas] = useState<Set<string>>(new Set())
  const [observacion, setObservacion] = useState('')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Tareas filtradas por el rubro seleccionado
  const tareasFiltradas = useMemo(
    () => tareas.filter((t) => t.rubro_id === rubroId),
    [tareas, rubroId]
  )

  // Agrupa las unidades por piso, calculado a partir del numero de unidad:
  // 501 -> piso 5, 1204 -> piso 12. Las unidades sin numero reconocible van a "Otros".
  const pisos = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; orden: number; sectores: Sector[] }>()
    for (const sector of sectores) {
      const match = sector.nombre.match(/\d+/)
      let key: string
      let label: string
      let orden: number
      if (match) {
        const num = parseInt(match[0], 10)
        const piso = Math.floor(num / 100)
        if (piso > 0) {
          key = String(piso)
          label = `Piso ${piso}`
          orden = piso
        } else {
          key = 'otros'
          label = 'Otros'
          orden = Number.MAX_SAFE_INTEGER
        }
      } else {
        key = 'otros'
        label = 'Otros'
        orden = Number.MAX_SAFE_INTEGER
      }
      if (!groups.has(key)) {
        groups.set(key, { key, label, orden, sectores: [] })
      }
      groups.get(key)!.sectores.push(sector)
    }
    // Ordena los pisos y las unidades dentro de cada piso
    const result = Array.from(groups.values()).sort((a, b) => a.orden - b.orden)
    for (const g of result) {
      g.sectores.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true }))
    }
    return result
  }, [sectores])

  // Pisos colapsados (por defecto todos expandidos)
  const [collapsedPisos, setCollapsedPisos] = useState<Set<string>>(new Set())

  const togglePisoCollapsed = (key: string) => {
    setCollapsedPisos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSelectAllPiso = (pisoSectores: Sector[]) => {
    setSuccess(null)
    const ids = pisoSectores.map((s) => s.id)
    const allSelected = ids.every((id) => selectedSectores.has(id))
    setSelectedSectores((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        ids.forEach((id) => next.delete(id))
      } else {
        ids.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const toggleSector = (id: string) => {
    setSuccess(null)
    setSelectedSectores((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleRubroChange = (value: string) => {
    setRubroId(value)
    setSelectedTareas(new Set()) // Reset tareas al cambiar de rubro
    setSuccess(null)
  }

  const toggleTarea = (id: string) => {
    setSuccess(null)
    setSelectedTareas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setError(null)
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('obraId', obraId)
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (res.ok) {
          const { url, pathname } = await res.json()
          setImages((prev) => [...prev, { url, pathname, nombre: file.name }])
        }
      } catch {
        // Upload failed for this file
      }
    }
    setIsUploading(false)
    e.target.value = ''
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)

    // Validaciones
    if (selectedSectores.size === 0) {
      setError('Selecciona al menos una unidad.')
      return
    }
    if (!rubroId) {
      setError('Selecciona un rubro.')
      return
    }
    if (selectedTareas.size === 0) {
      setError('Selecciona al menos una tarea.')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/avances/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obraId,
          sectorIds: Array.from(selectedSectores),
          tareaIds: Array.from(selectedTareas),
          observacion,
          imagenes: images.map((img) => ({ pathname: img.pathname, nombre: img.nombre })),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'No se pudieron registrar los avances.')
        return
      }

      const data = await res.json()
      const n = data.creados ?? 0
      setSuccess(
        n === 1
          ? 'Se registró correctamente 1 avance.'
          : `Se registraron correctamente ${n} avances.`
      )

      // Reset completo del formulario (mantiene solo el mensaje de éxito)
      setSelectedSectores(new Set())
      setRubroId('')
      setSelectedTareas(new Set())
      setObservacion('')
      setImages([])
    } catch {
      setError('Ocurrió un error al registrar los avances.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Unidades */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Unidades <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Tocá las unidades donde querés registrar el avance. Podés seleccionar varias.
          </p>
          {sectores.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay unidades configuradas. Configurá los sectores primero.
            </p>
          ) : (
            <div className="space-y-2 pt-1">
              {pisos.map((piso) => {
                const isCollapsed = collapsedPisos.has(piso.key)
                const selectedCount = piso.sectores.filter((s) =>
                  selectedSectores.has(s.id)
                ).length
                const allSelected =
                  selectedCount === piso.sectores.length && piso.sectores.length > 0
                return (
                  <div key={piso.key} className="rounded-lg border overflow-hidden">
                    <div className="flex items-center justify-between bg-muted/50 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => togglePisoCollapsed(piso.key)}
                        aria-expanded={!isCollapsed}
                        className="flex items-center gap-2 text-sm font-medium"
                      >
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 transition-transform',
                            isCollapsed && '-rotate-90'
                          )}
                        />
                        {piso.label}
                        {selectedCount > 0 && (
                          <span className="text-xs font-normal text-muted-foreground">
                            ({selectedCount}/{piso.sectores.length})
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSelectAllPiso(piso.sectores)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {allSelected ? 'Deseleccionar piso' : 'Seleccionar todo el piso'}
                      </button>
                    </div>
                    {!isCollapsed && (
                      <div className="flex flex-wrap gap-2 p-3">
                        {piso.sectores.map((sector) => {
                          const isSelected = selectedSectores.has(sector.id)
                          return (
                            <button
                              key={sector.id}
                              type="button"
                              onClick={() => toggleSector(sector.id)}
                              aria-pressed={isSelected}
                              className={cn(
                                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                                isSelected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background text-foreground border-input hover:bg-muted'
                              )}
                            >
                              {sector.nombre}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {selectedSectores.size > 0 && (
            <p className="text-xs text-muted-foreground pt-1">
              {selectedSectores.size} unidad(es) seleccionada(s)
            </p>
          )}
        </div>

        {/* Rubro */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Rubro <span className="text-destructive">*</span>
          </Label>
          <Select value={rubroId} onValueChange={handleRubroChange}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccioná un rubro" />
            </SelectTrigger>
            <SelectContent>
              {rubros.map((rubro) => (
                <SelectItem key={rubro.id} value={rubro.id}>
                  {rubro.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tareas */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Tareas <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            {rubroId
              ? 'Tocá las tareas que querés registrar. Podés seleccionar varias.'
              : 'Primero elegí un rubro.'}
          </p>
          {rubroId && tareasFiltradas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay tareas para este rubro.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {tareasFiltradas.map((tarea) => {
                const isSelected = selectedTareas.has(tarea.id)
                return (
                  <button
                    key={tarea.id}
                    type="button"
                    onClick={() => toggleTarea(tarea.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-input hover:bg-muted'
                    )}
                  >
                    {tarea.nombre}
                  </button>
                )
              })}
            </div>
          )}
          {selectedTareas.size > 0 && (
            <p className="text-xs text-muted-foreground pt-1">
              {selectedTareas.size} tarea(s) seleccionada(s)
            </p>
          )}
        </div>

        {/* Observación */}
        <div className="space-y-2">
          <Label className="text-sm font-medium" htmlFor="observacion">
            Observación
          </Label>
          <Textarea
            id="observacion"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            placeholder="Ej: Terminado, pendiente remate junto a carpintería, faltan detalles..."
            rows={3}
          />
        </div>

        {/* Imágenes */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Imágenes</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageUpload}
          />
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={isUploading}>
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ImagePlus className="w-4 h-4 mr-2" />
                  )}
                  Agregar imágenes
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => cameraInputRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-2" />
                  Sacar foto
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Elegir de galería
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {images.map((img, i) => (
                <div key={i} className="relative shrink-0">
                  <img
                    src={img.url || '/placeholder.svg'}
                    alt={img.nombre}
                    className="h-20 w-20 object-cover rounded-md border"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center"
                    aria-label={`Quitar imagen ${i + 1}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error / Éxito */}
        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-md bg-green-600/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Guardar */}
        <div className="pb-4">
          <Button onClick={handleSubmit} disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Registrando...
              </>
            ) : (
              'Registrar avances'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
