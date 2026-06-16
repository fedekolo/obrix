import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 20

// GET - Load chat history for a user in an obra (paginated, newest first)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const obraId = searchParams.get('obraId')
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  if (!obraId) {
    return NextResponse.json({ error: 'obraId required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch one extra row (PAGE_SIZE + 1) to know if there are more to load
  const { data: rows, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('obra_id', obraId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const hasMore = (rows?.length || 0) > PAGE_SIZE
  // Drop the extra row used for the hasMore check
  const pageRows = hasMore ? rows!.slice(0, PAGE_SIZE) : (rows || [])
  // Return in chronological order (oldest first) for rendering
  const messages = pageRows.slice().reverse()

  return NextResponse.json({ messages, hasMore })
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
