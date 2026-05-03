import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ObraHeader } from '@/components/obras/obra-header'
import { ChatInterface } from '@/components/chat/chat-interface'

interface ObraPageProps {
  params: Promise<{ obraId: string }>
}

export default async function ObraPage({ params }: ObraPageProps) {
  const { obraId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/auth/login')

  // Verificar acceso a la obra
  const { data: obra } = await supabase
    .from('obras')
    .select('*')
    .eq('id', obraId)
    .single()

  if (!obra) {
    // Verificar si es colaborador
    const { data: colaboracion } = await supabase
      .from('obra_colaboradores')
      .select('*, obras(*)')
      .eq('obra_id', obraId)
      .eq('user_id', user.id)
      .eq('estado', 'aceptada')
      .single()
    
    if (!colaboracion || !colaboracion.obras) notFound()
  }

  const obraData = obra || null
  const esPropietario = obraData?.user_id === user.id

  // Cargar sectores y rubros para el chat
  const [{ data: sectores }, { data: rubros }] = await Promise.all([
    supabase.from('sectores').select('*').eq('obra_id', obraId).order('orden'),
    supabase.from('rubros').select('*').eq('obra_id', obraId).order('orden'),
  ])

  return (
    <div className="flex flex-col h-full">
      <ObraHeader 
        obra={obraData!} 
        esPropietario={esPropietario} 
      />
      <div className="flex-1 overflow-hidden">
        <ChatInterface 
          obraId={obraId}
          sectores={sectores || []}
          rubros={rubros || []}
          userId={user.id}
        />
      </div>
    </div>
  )
}
