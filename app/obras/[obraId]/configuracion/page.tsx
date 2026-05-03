import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConfigTabs } from '@/components/configuracion/config-tabs'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface ConfiguracionPageProps {
  params: Promise<{ obraId: string }>
}

export default async function ConfiguracionPage({ params }: ConfiguracionPageProps) {
  const { obraId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/auth/login')

  const { data: obra } = await supabase
    .from('obras')
    .select('*')
    .eq('id', obraId)
    .single()

  if (!obra) notFound()

  const esPropietario = obra.user_id === user.id

  const [{ data: sectores }, { data: rubros }, { data: colaboradores }] = await Promise.all([
    supabase.from('sectores').select('*').eq('obra_id', obraId).order('orden'),
    supabase.from('rubros').select('*').eq('obra_id', obraId).order('orden'),
    supabase.from('obra_colaboradores').select('*').eq('obra_id', obraId),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href={`/obras/${obraId}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al chat
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Configuracion</h1>
        <p className="text-sm text-muted-foreground mt-1">{obra.nombre}</p>
      </div>
      
      <ConfigTabs 
        obraId={obraId}
        sectores={sectores || []}
        rubros={rubros || []}
        colaboradores={colaboradores || []}
        esPropietario={esPropietario}
        currentUserEmail={user.email || ''}
      />
    </div>
  )
}
