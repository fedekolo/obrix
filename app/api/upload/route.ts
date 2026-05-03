import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const obraId = formData.get('obraId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const timestamp = Date.now()
    const filename = obraId ? `obras/${obraId}/${timestamp}-${file.name}` : `uploads/${timestamp}-${file.name}`

    const blob = await put(filename, file, {
      access: 'private',
    })

    // Return URL that goes through our file serving API
    const url = `/api/file?pathname=${encodeURIComponent(blob.pathname)}`

    return NextResponse.json({ url, pathname: blob.pathname })
  } catch (error) {
    console.error('[v0] Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
