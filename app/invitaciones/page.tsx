import { createClient } from '@/lib/supabase/server'
import { InvitacionesList } from '@/components/invitaciones/invitaciones-list'

export default async function InvitacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: invitaciones } = await supabase
    .from('obra_colaboradores')
    .select('*, obras(*)')
    .eq('email_invitado', user!.email)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Invitaciones</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invitaciones pendientes para colaborar en obras
        </p>
      </div>
      <InvitacionesList invitaciones={invitaciones || []} />
    </div>
  )
}
