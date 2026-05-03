import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Plus, MapPin, Users } from 'lucide-react'
import type { Obra } from '@/lib/types'

export default async function ObrasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Obras propias
  const { data: obrasPropia } = await supabase
    .from('obras')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  // Obras compartidas (colaborador aceptado)
  const { data: colaboraciones } = await supabase
    .from('obra_colaboradores')
    .select('obra_id, rol, obras(*)')
    .eq('user_id', user!.id)
    .eq('estado', 'aceptada')

  const obrasCompartidas = (colaboraciones || []).map((c: any) => ({
    ...c.obras,
    es_propietario: false,
    rol: c.rol,
  }))

  const todasObras: (Obra & { es_propietario: boolean; rol?: string })[] = [
    ...(obrasPropia || []).map(o => ({ ...o, es_propietario: true })),
    ...obrasCompartidas,
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mis Obras</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {todasObras.length === 0
              ? 'Todavia no tenes obras'
              : `${todasObras.length} obra${todasObras.length !== 1 ? 's' : ''} en total`}
          </p>
        </div>
        <Button asChild>
          <Link href="/obras/nueva">
            <Plus className="w-4 h-4 mr-2" />
            Nueva obra
          </Link>
        </Button>
      </div>

      {todasObras.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">Sin obras todavia</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Crea tu primera obra para empezar a registrar avances con el asistente IA.
          </p>
          <Button asChild>
            <Link href="/obras/nueva">
              <Plus className="w-4 h-4 mr-2" />
              Crear primera obra
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {todasObras.map(obra => (
            <Link key={obra.id} href={`/obras/${obra.id}`} className="block group">
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    {obra.es_propietario ? (
                      <Badge variant="secondary" className="text-xs shrink-0">Propietario</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs shrink-0">
                        <Users className="w-3 h-3 mr-1" />
                        {obra.rol === 'viewer' ? 'Lector' : 'Editor'}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base mt-2 group-hover:text-primary transition-colors">
                    {obra.nombre}
                  </CardTitle>
                  {obra.descripcion && (
                    <CardDescription className="text-xs line-clamp-2">{obra.descripcion}</CardDescription>
                  )}
                </CardHeader>
                {obra.direccion && (
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{obra.direccion}</span>
                    </div>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
