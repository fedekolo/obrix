'use client'

import { useState, useRef, useMemo } from 'react'
import { Loader2, Camera, Image as ImageIcon, ImagePlus, X, CheckCircle2 } from 'lucide-react'
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
  const [tareaId, setTareaId] = useState<string>('')
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
    setTareaId('') // Reset tarea al cambiar de rubro
    setSuccess(null)
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
    if (!tareaId) {
      setError('Selecciona una tarea.')
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
          tareaId,
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

      // Reset del formulario (mantiene rubro/tarea para cargas repetidas rápidas)
      setSelectedSectores(new Set())
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
            <div className="flex flex-wrap gap-2 pt-1">
              {sectores.map((sector) => {
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

        {/* Tarea */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Tarea <span className="text-destructive">*</span>
          </Label>
          <Select value={tareaId} onValueChange={setTareaId} disabled={!rubroId}>
            <SelectTrigger>
              <SelectValue
                placeholder={rubroId ? 'Seleccioná una tarea' : 'Primero elegí un rubro'}
              />
            </SelectTrigger>
            <SelectContent>
              {tareasFiltradas.map((tarea) => (
                <SelectItem key={tarea.id} value={tarea.id}>
                  {tarea.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
