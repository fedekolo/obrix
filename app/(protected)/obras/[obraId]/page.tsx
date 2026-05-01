import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatInterface } from '@/components/chat/chat-interface'
import { ObraHeader } from '@/components/obras/obra-header'

interface ObraPageProps {
  params: Promise<{ obraId: string }>
}

export default async function ObraPage({ params }: ObraPageProps) {
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

  // Check if user is a collaborator
  let isOwner = obra?.user_id === user.id
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

  // Get sectores and rubros for the chat context
  const [{ data: sectores }, { data: rubros }] = await Promise.all([
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
  ])

  return (
    <div className="flex flex-col h-screen">
      <ObraHeader obra={obra} isOwner={isOwner} />
      <div className="flex-1 min-h-0">
        <ChatInterface
          obraId={obraId}
          obraNombre={obra.nombre}
          sectores={sectores || []}
          rubros={rubros || []}
          userId={user.id}
        />
      </div>
    </div>
  )
}
