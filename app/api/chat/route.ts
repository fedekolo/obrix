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

REGLAS CRITICAS DE ANALISIS - DEBES SEGUIRLAS ESTRICTAMENTE:

1. ANALISIS RIGUROSO ANTES DE REGISTRAR:
   - Lee cuidadosamente el mensaje del usuario
   - Identifica EXACTAMENTE que trabajo menciona
   - Busca una tarea que coincida EXACTAMENTE o muy claramente con lo mencionado
   - Si hay CUALQUIER duda sobre cual tarea corresponde, NO registres y PREGUNTA primero

2. COINCIDENCIA EXACTA REQUERIDA:
   - Solo registra si estas 100% seguro de la tarea correcta
   - "pintura de paredes" → solo va a tareas que mencionen "paredes" o "muros" en Pintura
   - "colocacion de porcelanato" → solo va a tareas de pisos/revestimientos
   - "instalacion de luces" → solo va a tareas de iluminacion en Electricidad
   - NO asumas ni generalices

3. CUANDO HAY DUDA (OBLIGATORIO):
   - Pregunta: "Mencionas '[trabajo del usuario]'. ¿A cual de estas tareas corresponde?"
   - Lista las 2-3 tareas mas cercanas como opciones
   - Agrega: "O si prefieres, puedo crear una nueva tarea en el rubro [rubro sugerido]"
   - ESPERA la respuesta del usuario antes de registrar

4. SI NO EXISTE TAREA ADECUADA:
   - Di: "No encontre una tarea para '[trabajo]'. ¿Queres que cree la tarea '[nombre sugerido]' en el rubro [rubro]?"
   - Si el usuario confirma → usa crearTarea y luego registrarAvance
   - Si el usuario sugiere otro nombre → usa ese nombre

5. SOLO UN AVANCE ACTIVO por tarea+sector:
   - Al registrar, los avances anteriores se archivan automaticamente
   - Al consultar, solo muestras el avance actual (no archivado)

6. MULTIPLES REGISTROS:
   - "pintura en 501, 502 y 503" → pregunta confirmacion y luego registra 3 avances
   - Siempre confirma antes de registros multiples

7. FORMATO DE RESPUESTA AL REGISTRAR:
   Cuando registres exitosamente, responde:
   "Registrado en [SECTOR]:
   Rubro: [NOMBRE DEL RUBRO]
   Tarea: [NOMBRE DE LA TAREA]"

IMPORTANTE: Es preferible preguntar de mas que registrar en la tarea equivocada. Ante la minima duda, consulta al usuario.

Responde en espanol, conciso y directo.`

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      registrarAvance: tool({
        description: 'Registra UN avance de obra. REQUIERE tarea_id. Archiva automaticamente avances anteriores de la misma tarea+sector.',
        inputSchema: z.object({
          sector_id: z.string().describe('ID del sector'),
          tarea_id: z.string().describe('ID de la tarea (OBLIGATORIO)'),
          descripcion: z.string().describe('Descripcion del avance'),
        }),
        execute: async ({ sector_id, tarea_id, descripcion }) => {
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
            avance: { id: data.id, tarea: tarea.nombre, rubro: rubro?.nombre, sector: sector.nombre },
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

          // Add to local tareas array for immediate use
          tareas.push(data)

          return {
            success: true,
            message: `Tarea "${nombre}" creada en ${rubro.nombre}.`,
            tarea: { id: data.id, nombre: data.nombre, rubro_id },
          }
        },
      }),

      consultarAvances: tool({
        description: 'Consulta los avances ACTIVOS (no archivados). Muestra solo el ultimo avance de cada tarea+sector.',
        inputSchema: z.object({
          sector_ids: z.array(z.string()).optional().describe('Filtrar por sectores'),
          tarea_ids: z.array(z.string()).optional().describe('Filtrar por tareas'),
        }),
        execute: async ({ sector_ids, tarea_ids }) => {
          let query = supabase
            .from('avances')
            .select(`*, sectores (nombre), rubros (nombre), tareas (nombre)`)
            .eq('obra_id', obraId)
            .eq('archivado', false)
            .order('created_at', { ascending: false })

          if (sector_ids?.length) query = query.in('sector_id', sector_ids)
          if (tarea_ids?.length) query = query.in('tarea_id', tarea_ids)

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
        },
      }),

      consultarHistorial: tool({
        description: 'Consulta el HISTORIAL completo de una tarea+sector, incluyendo avances archivados. Usa solo cuando el usuario pida explicitamente "historial" o "avances anteriores".',
        inputSchema: z.object({
          sector_id: z.string().describe('ID del sector'),
          tarea_id: z.string().describe('ID de la tarea'),
        }),
        execute: async ({ sector_id, tarea_id }) => {
          const { data, error } = await supabase
            .from('avances')
            .select(`*, sectores (nombre), tareas (nombre)`)
            .eq('obra_id', obraId)
            .eq('sector_id', sector_id)
            .eq('tarea_id', tarea_id)
            .order('created_at', { ascending: false })

          if (error) return { success: false, message: `Error: ${error.message}` }
          if (!data?.length) return { success: true, message: 'No hay historial.', historial: [] }

          const sector = sectores.find(s => s.id === sector_id)
          const tarea = tareas?.find(t => t.id === tarea_id)

          interface AvanceRow {
            created_at: string
            descripcion: string
            archivado: boolean
          }

          return {
            success: true,
            message: `Historial de ${tarea?.nombre} en ${sector?.nombre}:`,
            historial: (data as AvanceRow[]).map((a) => ({
              fecha: new Date(a.created_at).toLocaleDateString('es-AR'),
              descripcion: a.descripcion,
              estado: a.archivado ? 'archivado' : 'actual',
            })),
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
