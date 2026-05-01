import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { ConfigTabs } from '@/components/configuracion/config-tabs'

interface ConfiguracionPageProps {
  params: Promise<{ obraId: string }>
}

export default async function ConfiguracionPage({ params }: ConfiguracionPageProps) {
  const { obraId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  // Check if user owns the obra
  const { data: obra } = await supabase
    .from('obras')
    .select('*')
    .eq('id', obraId)
    .single()

  const isOwner = obra?.user_id === user.id

  // Check if user is a collaborator
  let hasAccess = isOwner
  if (!isOwner) {
    const { data: collaboration } = await supabase
      .from('obra_colaboradores')
      .select('*')
      .eq('obra_id', obraId)
      .eq('user_id', user.id)
      .eq('estado', 'aceptada')
      .single()

    hasAccess = !!collaboration
  }

  if (!obra || !hasAccess) {
    notFound()
  }

  // Get sectores, rubros, and colaboradores
  const [{ data: sectores }, { data: rubros }, { data: colaboradores }] = await Promise.all([
    supabase
      .from('sectores')
      .select('*')
      .eq('obra_id', obraId)
      .order('orden', { ascending: true }),
    supabase
      .from('rubros')
      .select('*')
      .eq('obra_id', obraId)
      .order('orden', { ascending: true }),
    supabase
      .from('obra_colaboradores')
      .select('*')
      .eq('obra_id', obraId)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Configuración"
        description={obra.nombre}
      />
      <div className="flex-1 p-6 overflow-auto">
        <ConfigTabs
          obraId={obraId}
          sectores={sectores || []}
          rubros={rubros || []}
          colaboradores={colaboradores || []}
          isOwner={isOwner}
        />
      </div>
    </div>
  )
}
