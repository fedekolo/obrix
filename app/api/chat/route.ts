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
  const { messages, obraId, sectores, rubros, tareas } = await req.json() as {
    messages: unknown[]
    obraId: string
    sectores: SectorData[]
    rubros: RubroData[]
    tareas: TareaData[]
  }

  const supabase = await createClient()
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
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

SECTORES (usa estos IDs):
${sectoresList}

RUBROS Y TAREAS (usa estos IDs):
${rubrosList}

TOLERANCIA SEMANTICA - Interpreta terminos similares:
- "luces", "lamparas", "luminarias" → Iluminacion
- "tomas", "enchufes", "tomacorrientes" → Electricidad
- "canillas", "griferia", "llaves de paso" → Sanitarios
- "puertas", "ventanas", "aberturas" → Carpinteria
- "baldosas", "ceramicos", "porcelanato" → Pisos
- "yeso", "revoque", "enlucido" → Revestimientos
- Usa el contexto para inferir el rubro correcto

REGLAS:

1. SI ENTIENDES el rubro/tarea y sector:
   - Registra DIRECTAMENTE con registrarAvances
   - Responde: "Registrado: [tarea/rubro] en [sector]."
   - Si hay tarea especifica, usa tarea_id; si no, solo rubro_id

2. SI NO RECONOCES el termino:
   - PREGUNTA: "No reconozco [termino]. ¿Es [opcion1], [opcion2], u otro?"
   - Espera respuesta antes de registrar

3. MULTIPLES REGISTROS en un mensaje:
   - "pintura en 501, 502 y 503" → 3 registros
   - "termine electricidad y pintura en hall" → 2 registros
   - "en la 510 hice pisos, pintura y luces" → 3 registros

4. RANGOS:
   - "UF 1 a 5" o "501 al 505" → registra en cada unidad del rango

Responde en espanol, conciso y directo.`

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      registrarAvances: tool({
        description: 'Registra avances de obra. Usa cuando entiendas claramente sector y rubro/tarea.',
        inputSchema: z.object({
          avances: z.array(z.object({
            sector_id: z.string().describe('ID del sector'),
            rubro_id: z.string().describe('ID del rubro'),
            tarea_id: z.string().optional().describe('ID de la tarea especifica (opcional)'),
            descripcion: z.string().describe('Descripcion breve del avance'),
          })).describe('Lista de avances'),
        }),
        execute: async ({ avances }) => {
          // Build summary for response
          const resumen = avances.map((a) => {
            const sector = sectores.find((s) => s.id === a.sector_id)
            const rubro = rubros.find((r) => r.id === a.rubro_id)
            const tarea = a.tarea_id ? tareas?.find((t) => t.id === a.tarea_id) : null
            const trabajo = tarea ? `${tarea.nombre} (${rubro?.nombre})` : rubro?.nombre || 'Trabajo'
            return `${trabajo} en ${sector?.nombre || 'Sector'}`
          })

          // Insert all avances
          const { data, error } = await supabase
            .from('avances')
            .insert(
              avances.map((a) => ({
                obra_id: obraId,
                sector_id: a.sector_id,
                rubro_id: a.rubro_id,
                tarea_id: a.tarea_id || null,
                user_id: user.id,
                descripcion: a.descripcion,
              }))
            )
            .select()

          if (error) {
            return { success: false, message: `Error al guardar: ${error.message}` }
          }

          return {
            success: true,
            message: data.length === 1 
              ? `Registrado: ${resumen[0]}.`
              : `Registrados ${data.length} avances: ${resumen.join(', ')}.`,
            count: data.length,
          }
        },
      }),

      consultarAvances: tool({
        description: 'Consulta avances registrados con filtros opcionales',
        inputSchema: z.object({
          sector_ids: z.array(z.string()).optional().describe('IDs de sectores'),
          rubro_ids: z.array(z.string()).optional().describe('IDs de rubros'),
          fecha_desde: z.string().optional().describe('Fecha desde (YYYY-MM-DD)'),
          fecha_hasta: z.string().optional().describe('Fecha hasta (YYYY-MM-DD)'),
          limite: z.number().optional().default(20).describe('Max resultados'),
        }),
        execute: async ({ sector_ids, rubro_ids, fecha_desde, fecha_hasta, limite }) => {
          let query = supabase
            .from('avances')
            .select(`
              *,
              sectores (nombre, tipo),
              rubros (nombre),
              tareas (nombre)
            `)
            .eq('obra_id', obraId)
            .order('created_at', { ascending: false })
            .limit(limite || 20)

          if (sector_ids && sector_ids.length > 0) {
            query = query.in('sector_id', sector_ids)
          }
          if (rubro_ids && rubro_ids.length > 0) {
            query = query.in('rubro_id', rubro_ids)
          }
          if (fecha_desde) {
            query = query.gte('created_at', fecha_desde)
          }
          if (fecha_hasta) {
            query = query.lte('created_at', `${fecha_hasta}T23:59:59`)
          }

          const { data, error } = await query

          if (error) {
            return { success: false, message: `Error: ${error.message}` }
          }

          if (!data || data.length === 0) {
            return { success: true, message: 'No se encontraron avances.', avances: [] }
          }

          interface AvanceRow {
            created_at: string
            descripcion: string
            sectores?: { nombre: string } | null
            rubros?: { nombre: string } | null
            tareas?: { nombre: string } | null
          }

          const formatted = (data as AvanceRow[]).map((a) => ({
            fecha: new Date(a.created_at).toLocaleDateString('es-AR'),
            sector: a.sectores?.nombre || 'Desconocido',
            rubro: a.rubros?.nombre || 'Desconocido',
            tarea: a.tareas?.nombre || null,
            descripcion: a.descripcion,
          }))

          return {
            success: true,
            message: `${data.length} avance(s) encontrado(s).`,
            avances: formatted,
          }
        },
      }),

      listarSectores: tool({
        description: 'Lista todos los sectores disponibles en la obra',
        inputSchema: z.object({}),
        execute: async () => {
          return {
            success: true,
            sectores: sectores.map((s: { id: string; nombre: string; tipo: string }) => ({
              id: s.id,
              nombre: s.nombre,
              tipo: s.tipo,
            })),
          }
        },
      }),

      listarRubros: tool({
        description: 'Lista todos los rubros disponibles en la obra',
        inputSchema: z.object({}),
        execute: async () => {
          return {
            success: true,
            rubros: rubros.map((r: { id: string; nombre: string }) => ({
              id: r.id,
              nombre: r.nombre,
            })),
          }
        },
      }),
    },
    maxSteps: 5,
  })

  return result.toUIMessageStreamResponse()
}
