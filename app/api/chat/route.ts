import { streamText, tool } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { findBestMatch, getMatchDecision } from '@/lib/semantic-matching'

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
  descripcion?: string | null
  aliases?: string[]
  keywords?: string[]
  ejemplos?: string[]
  rubro_id: string
}

interface RubroData {
  id: string
  nombre: string
  tareas?: TareaData[]
}

// Normalize messages to ensure they have the correct structure for AI SDK
function normalizeMessages(messages: unknown[]): { role: string; content: string }[] {
  return messages.map((msg: unknown) => {
    const m = msg as { role?: string; content?: string; parts?: { type: string; text?: string }[] }
    const role = m.role || 'user'
    
    // If content is already a string, use it directly
    if (typeof m.content === 'string' && m.content) {
      return { role, content: m.content }
    }
    
    // If there are parts, extract text from them
    if (Array.isArray(m.parts)) {
      const textContent = m.parts
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text)
        .join('')
      return { role, content: textContent || '' }
    }
    
    return { role, content: '' }
  }).filter(m => m.content) // Remove empty messages
}

export async function POST(req: Request) {
  const { messages: rawMessages, obraId, sectores, rubros, tareas } = await req.json() as {
    messages: unknown[]
    obraId: string
    sectores: SectorData[]
    rubros: RubroData[]
    tareas: TareaData[]
  }
  
  // Normalize messages to handle both history (content string) and streaming (parts) formats
  const messages = normalizeMessages(rawMessages)

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

  const systemPrompt = `Eres un asistente inteligente de obra que registra avances de construccion. Obra: "${obra.nombre}".
Debes comportarte como un capataz experimentado que entiende el lenguaje informal de obra.

SECTORES DISPONIBLES:
${sectoresList}

RUBROS Y TAREAS DISPONIBLES:
${rubrosList}

=== FLUJO DE TRABAJO OBLIGATORIO ===

PASO 1 - SIEMPRE usa "analizarTexto" primero cuando el usuario mencione trabajos
Esta herramienta analiza semanticamente el texto y te dice la accion a tomar.

PASO 2 - Segun el resultado de analizarTexto:
- Si dice "auto_save" (score >= 0.85): registra automaticamente con registrarAvance
- Si dice "confirm" (score 0.60-0.85): pregunta al usuario si es correcto antes de registrar
- Si dice "clarify" (score < 0.60): muestra las opciones y pregunta cual corresponde

PASO 3 - Al registrar, SIEMPRE guarda el texto ORIGINAL completo del usuario en la descripcion

=== IMPORTANTE ===
- NO inventes tareas
- NO registres sin usar analizarTexto primero
- SIEMPRE guarda el texto original del usuario como descripcion
- Entiende sinonimos: "enchufes" = "Teclas y tomas", "luces" = iluminacion
- Si el usuario menciona multiples trabajos, procesalos uno por uno

=== FORMATO AL REGISTRAR ===
"Registrado en [SECTOR]:
Rubro: [RUBRO]
Tarea: [TAREA]"

Responde en espanol, conciso y amigable.`

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: systemPrompt,
    messages: messages as { role: 'user' | 'assistant'; content: string }[],
    tools: {
      analizarTexto: tool({
        description: 'OBLIGATORIO: Usa esta herramienta PRIMERO cuando el usuario mencione un trabajo o avance. Analiza semanticamente el texto y determina la tarea mas probable.',
        inputSchema: z.object({
          texto_usuario: z.string().describe('El texto completo que escribio el usuario'),
        }),
        execute: async ({ texto_usuario }) => {
          try {
            const matches = findBestMatch(texto_usuario, tareas, rubros)
            const decision = getMatchDecision(matches)
            
            return {
              success: true,
              action: decision.action,
              topMatch: decision.topMatch ? {
                tarea_id: decision.topMatch.tarea.id,
                tarea_nombre: decision.topMatch.tarea.nombre,
                rubro_id: decision.topMatch.rubro?.id,
                rubro_nombre: decision.topMatch.rubro?.nombre,
                score: Math.round(decision.topMatch.score * 100),
                matchType: decision.topMatch.matchType,
              } : null,
              alternatives: decision.alternatives.map(m => ({
                tarea_id: m.tarea.id,
                tarea_nombre: m.tarea.nombre,
                rubro_nombre: m.rubro?.nombre,
                score: Math.round(m.score * 100),
              })),
              message: decision.message,
              texto_original: texto_usuario,
            }
          } catch (err) {
            return { success: false, message: `Error: ${err}` }
          }
        },
      }),

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
