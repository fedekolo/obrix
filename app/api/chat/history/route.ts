import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Load chat history for a user in an obra
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const obraId = searchParams.get('obraId')

  if (!obraId) {
    return NextResponse.json({ error: 'obraId required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('obra_id', obraId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(100) // Last 100 messages

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ messages })
}

// POST - Save a new message
export async function POST(req: NextRequest) {
  const { obraId, role, content, metadata } = await req.json()

  if (!obraId || !role || !content) {
    return NextResponse.json({ error: 'obraId, role, and content required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      obra_id: obraId,
      user_id: user.id,
      role,
      content,
      metadata: metadata || {},
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: data })
}
