import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { InvitacionesList } from '@/components/invitaciones/invitaciones-list'

export default async function InvitacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get pending invitations for this user's email
  const { data: invitaciones } = await supabase
    .from('obra_colaboradores')
    .select(`
      *,
      obras (nombre, direccion)
    `)
    .eq('email_invitado', user.email)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Invitaciones"
        description="Gestiona las invitaciones a colaborar en obras"
      />
      <div className="flex-1 p-6">
        <InvitacionesList invitaciones={invitaciones || []} />
      </div>
    </div>
  )
}
