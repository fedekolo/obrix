import { createClient } from '@/lib/supabase/server'
import { ObrasList } from '@/components/obras/obras-list'
import { PageHeader } from '@/components/layout/page-header'
import type { ObraWithAccess } from '@/lib/types'

export default async function ObrasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Get owned obras
  const { data: ownedObras } = await supabase
    .from('obras')
    .select('*')
    .order('created_at', { ascending: false })
  
  // Get shared obras through collaborations
  const { data: collaborations } = await supabase
    .from('obra_colaboradores')
    .select(`
      obra_id,
      obras (*)
    `)
    .eq('estado', 'aceptada')
  
  const owned: ObraWithAccess[] = (ownedObras || []).map((obra) => ({
    ...obra,
    es_propietario: true,
  }))
  
  const shared: ObraWithAccess[] = (collaborations || [])
    .filter((c) => c.obras)
    .map((c) => ({
      ...(c.obras as unknown as ObraWithAccess),
      es_propietario: false,
    }))
  
  const allObras = [...owned, ...shared]

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Mis Obras"
        description="Gestiona tus proyectos de construcción"
        actionLabel="Nueva Obra"
        actionHref="/obras/nueva"
      />
      <div className="flex-1 p-6">
        <ObrasList obras={allObras} currentUserId={user?.id || ''} />
      </div>
    </div>
  )
}
