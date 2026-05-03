'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function NuevaObraPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: '', direccion: '', descripcion: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data, error } = await supabase
      .from('obras')
      .insert({ ...form, user_id: user.id })
      .select()
      .single()

    if (error) {
      setError('Error al crear la obra. Intenta de nuevo.')
      setLoading(false)
    } else {
      router.push(`/obras/${data.id}`)
      router.refresh()
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
          <Link href="/obras">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Nueva obra</h1>
        <p className="text-sm text-muted-foreground mt-1">Completa los datos del proyecto</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la obra</CardTitle>
          <CardDescription>Podes editar esta informacion mas adelante</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre de la obra <span className="text-destructive">*</span></Label>
              <Input
                id="nombre"
                placeholder="Ej: Edificio Mitre 1240"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="direccion">Direccion</Label>
              <Input
                id="direccion"
                placeholder="Ej: Av. Mitre 1240, Buenos Aires"
                value={form.direccion}
                onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripcion</Label>
              <Textarea
                id="descripcion"
                placeholder="Descripcion breve del proyecto..."
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                rows={3}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creando...</> : 'Crear obra'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/obras">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
