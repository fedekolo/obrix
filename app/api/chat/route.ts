import { streamText, tool, convertToModelMessages } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

// Type definitions for the request data
interface SectorData {
  id: string
  nombre: string
  tipo: string
}

interface TareaData {
  id: string
  nombre: string
  rubro_id: string
}

interface RubroData {
  id: string
  nombre: string
  tareas?: TareaData[]
}

export async function POST(req: Request) {
  console.log('[v0] Chat API called')
  
  const { messages, obraId, sectores, rubros, tareas } = await req.json() as {
    messages: unknown[]
    obraId: string
    sectores: SectorData[]
    rubros: RubroData[]
    tareas: TareaData[]
  }

  console.log('[v0] obraId:', obraId, 'messages:', messages?.length)
  console.log('[v0] GROQ_API_KEY exists:', !!process.env.GROQ_API_KEY)

  const supabase = await createClient()
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  console.log('[v0] Auth check - user:', !!user, 'error:', authError?.message)
  
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Verify user has access to this obra
  const { data: obra } = await supabase
    .from('obras')
    .select('*')
    .eq('id', obraId)
    .single()

  if (!obra) {
    return new Response('Obra not found', { status: 404 })
  }

  const sectoresList = sectores.length > 0 
    ? sectores.map((s) => `- ${s.nombre} (ID: ${s.id}, Tipo: ${s.tipo})`).join('\n')
    : '(No hay sectores configurados. Pide al usuario que los configure primero.)'
  
  // Build rubros list with their tareas
  const rubrosWithTareas = rubros.map((r) => {
    const rubroTareas = tareas?.filter((t) => t.rubro_id === r.id) || []
    const tareasStr = rubroTareas.length > 0 
      ? ` [Tareas: ${rubroTareas.map(t => `${t.nombre} (ID: ${t.id})`).join(', ')}]`
      : ''
    return `- ${r.nombre} (ID: ${r.id})${tareasStr}`
  })
    
  const rubrosList = rubros.length > 0
    ? rubrosWithTareas.join('\n')
    : '(No hay rubros configurados. Pide al usuario que los configure primero.)'

  const systemPrompt = `Eres un asistente de obra que registra avances de construccion. Obra: "${obra.nombre}".

SECTORES DISPONIBLES:
${sectoresList}

RUBROS Y TAREAS DISPONIBLES:
${rubrosList}

=== INSTRUCCIONES ===

1. CUANDO EL USUARIO MENCIONA TRABAJOS:
   - Si menciona UNA tarea que coincide EXACTAMENTE con una tarea existente → registra directo
   - Si menciona MULTIPLES trabajos (ej: "mesada y alzadas") → procesa UNO a la vez, preguntando por cada uno
   - Si menciona algo que NO coincide exactamente → PREGUNTA antes de registrar

2. EJEMPLOS DE COINCIDENCIA EXACTA (registrar directo):
   - "Instalamos Mesada bajo pileta" → coincide con tarea "Mesada bajo pileta"
   - "Colocamos el Bajo mesada" → coincide con tarea "Bajo mesada"

3. EJEMPLOS QUE REQUIEREN CONFIRMACION (preguntar primero):
   - "Instalamos mesada y alzadas" → preguntar: "Encontre la tarea 'Mesada bajo pileta'. ¿La registro? Para 'alzadas' no encontre tarea, ¿queres que la cree?"
   - "Hicimos muebles de cocina" → preguntar cual tarea especifica del rubro
   - "Pusimos alzadas" → no existe, preguntar si crear nueva tarea

4. FORMATO AL REGISTRAR:
   "Registrado en [SECTOR]:
   Rubro: [RUBRO]
   Tarea: [TAREA]"

Responde en espanol, conciso y directo. Ante la duda, PREGUNTA.`

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      registrarAvance: tool({
        description: 'Registra UN avance de obra. SOLO usar cuando el nombre de la tarea coincide EXACTAMENTE con lo que dijo el usuario, o cuando el usuario confirmo la tarea.',
        inputSchema: z.object({
          sector_id: z.string().describe('ID del sector'),
          tarea_id: z.string().describe('ID de la tarea'),
          descripcion: z.string().describe('Descripcion breve del avance'),
        }),
        execute: async ({ sector_id, tarea_id, descripcion }) => {
          try {
            const sector = sectores.find((s) => s.id === sector_id)
            const tarea = tareas?.find((t) => t.id === tarea_id)
            const rubro = tarea ? rubros.find((r) => r.id === tarea.rubro_id) : null

            if (!sector || !tarea) {
              return { success: false, message: 'Sector o tarea no encontrados.' }
            }

            // Archive existing avances for this tarea+sector
            await supabase
              .from('avances')
              .update({ archivado: true })
              .eq('tarea_id', tarea_id)
              .eq('sector_id', sector_id)
              .eq('archivado', false)

            // Insert new avance
            const { data, error } = await supabase
              .from('avances')
              .insert({
                obra_id: obraId,
                sector_id,
                rubro_id: tarea.rubro_id,
                tarea_id,
                user_id: user.id,
                descripcion,
                archivado: false,
              })
              .select()
              .single()

            if (error) {
              return { success: false, message: `Error: ${error.message}` }
            }

            return {
              success: true,
              message: `Registrado en ${sector.nombre}:\nRubro: ${rubro?.nombre || 'Sin rubro'}\nTarea: ${tarea.nombre}`,
            }
          } catch (err) {
            return { success: false, message: `Error inesperado: ${err}` }
          }
        },
      }),

      crearTarea: tool({
        description: 'Crea una nueva tarea en un rubro. Usa cuando el usuario acepta crear una tarea que no existe.',
        inputSchema: z.object({
          rubro_id: z.string().describe('ID del rubro donde crear la tarea'),
          nombre: z.string().describe('Nombre de la nueva tarea'),
        }),
        execute: async ({ rubro_id, nombre }) => {
          try {
            const rubro = rubros.find((r) => r.id === rubro_id)
            if (!rubro) {
              return { success: false, message: 'Rubro no encontrado.' }
            }

            const { data, error } = await supabase
              .from('tareas')
              .insert({ rubro_id, nombre, orden: 0 })
              .select()
              .single()

            if (error) {
              return { success: false, message: `Error: ${error.message}` }
            }

            tareas.push(data)
            return {
              success: true,
              message: `Tarea "${nombre}" creada en ${rubro.nombre}. Ahora puedes registrar el avance.`,
              tarea_id: data.id,
            }
          } catch (err) {
            return { success: false, message: `Error inesperado: ${err}` }
          }
        },
      }),

      consultarAvances: tool({
        description: 'Consulta los avances ACTIVOS (no archivados). Permite filtrar por uno o varios sectores.',
        inputSchema: z.object({
          sector_ids: z.array(z.string()).optional().describe('IDs de sectores para filtrar. Puede ser uno o varios.'),
        }),
        execute: async ({ sector_ids }) => {
          try {
            let query = supabase
              .from('avances')
              .select(`*, sectores (nombre), rubros (nombre), tareas (nombre)`)
              .eq('obra_id', obraId)
              .eq('archivado', false)
              .order('created_at', { ascending: false })

            if (sector_ids && sector_ids.length > 0) {
              query = query.in('sector_id', sector_ids)
            }

            const { data, error } = await query
            if (error) return { success: false, message: `Error: ${error.message}` }
            if (!data?.length) return { success: true, message: 'No hay avances registrados.', avances: [] }

            interface AvanceRow {
              created_at: string
              descripcion: string
              sectores?: { nombre: string } | null
              rubros?: { nombre: string } | null
              tareas?: { nombre: string } | null
            }

            return {
              success: true,
              message: `${data.length} avance(s) activo(s).`,
              avances: (data as AvanceRow[]).map((a) => ({
                fecha: new Date(a.created_at).toLocaleDateString('es-AR'),
                sector: a.sectores?.nombre,
                tarea: a.tareas?.nombre,
                rubro: a.rubros?.nombre,
                descripcion: a.descripcion,
              })),
            }
          } catch (err) {
            return { success: false, message: `Error inesperado: ${err}` }
          }
        },
      }),

      listarTareasDeRubro: tool({
        description: 'Lista las tareas de un rubro especifico. Usa cuando necesites mostrar opciones al usuario.',
        inputSchema: z.object({
          rubro_nombre: z.string().describe('Nombre del rubro (ej: Muebles cocina, Electricidad)'),
        }),
        execute: async ({ rubro_nombre }) => {
          const rubro = rubros.find(r => r.nombre.toLowerCase().includes(rubro_nombre.toLowerCase()))
          if (!rubro) {
            return { 
              success: false, 
              message: `Rubro "${rubro_nombre}" no encontrado.`,
              rubros_disponibles: rubros.map(r => r.nombre)
            }
          }
          
          const tareasDelRubro = tareas?.filter(t => t.rubro_id === rubro.id) || []
          return {
            success: true,
            rubro: rubro.nombre,
            rubro_id: rubro.id,
            tareas: tareasDelRubro.map(t => ({ id: t.id, nombre: t.nombre }))
          }
        },
      }),
    },
    maxSteps: 5,
  })

  return result.toUIMessageStreamResponse()
}
