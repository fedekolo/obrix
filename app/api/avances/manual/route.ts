import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ImagenInput {
  pathname: string
  nombre?: string | null
}

interface ManualAvanceBody {
  obraId: string
  sectorIds: string[]
  tareaId: string
  observacion?: string
  imagenes?: ImagenInput[]
}

// POST - Registra avances de forma manual.
// Genera UN avance independiente por cada unidad (sector) seleccionada,
// reutilizando exactamente la misma logica que usa el chat:
// archiva avances previos de esa tarea+sector, inserta el nuevo avance en
// la tabla `avances`, y asocia las imagenes en la tabla `archivos`.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ManualAvanceBody
    const { obraId, sectorIds, tareaId, observacion, imagenes } = body

    // Validaciones
    if (!obraId) {
      return NextResponse.json({ error: 'obraId requerido' }, { status: 400 })
    }
    if (!sectorIds || sectorIds.length === 0) {
      return NextResponse.json({ error: 'Debe seleccionar al menos una unidad' }, { status: 400 })
    }
    if (!tareaId) {
      return NextResponse.json({ error: 'Debe seleccionar una tarea' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Obtener la tarea para conocer su rubro_id
    const { data: tarea, error: tareaError } = await supabase
      .from('tareas')
      .select('id, rubro_id')
      .eq('id', tareaId)
      .single()

    if (tareaError || !tarea) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    }

    const descripcion = (observacion || '').trim()
    const imagenesValidas = (imagenes || []).filter((img) => img.pathname)

    let creados = 0

    // Un avance independiente por unidad
    for (const sectorId of sectorIds) {
      // Archivar avances activos previos de esta tarea+sector
      await supabase
        .from('avances')
        .update({ archivado: true })
        .eq('tarea_id', tareaId)
        .eq('sector_id', sectorId)
        .eq('archivado', false)

      // Insertar el nuevo avance
      const { data: avance, error: insertError } = await supabase
        .from('avances')
        .insert({
          obra_id: obraId,
          sector_id: sectorId,
          rubro_id: tarea.rubro_id,
          tarea_id: tareaId,
          user_id: user.id,
          descripcion,
          archivado: false,
        })
        .select()
        .single()

      if (insertError || !avance) {
        console.log('[v0] manual avance insert error:', insertError?.message)
        continue
      }

      creados++

      // Asociar las imagenes a este avance (mismas tablas que el chat)
      if (imagenesValidas.length > 0) {
        const rows = imagenesValidas.map((img) => ({
          avance_id: avance.id,
          tipo: 'imagen' as const,
          blob_pathname: img.pathname,
          nombre_original: img.nombre || null,
        }))
        const { error: archError } = await supabase.from('archivos').insert(rows)
        if (archError) {
          console.log('[v0] manual archivos insert error:', archError.message)
        }
      }
    }

    return NextResponse.json({ success: true, creados })
  } catch (error) {
    console.log('[v0] manual avance error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Error al registrar avances' }, { status: 500 })
  }
}
