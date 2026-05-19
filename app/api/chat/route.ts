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

=== FLUJO OBLIGATORIO EN 2 PASOS ===

PASO 1 - SIEMPRE usa "buscarTareaParaAvance" primero:
- Cuando el usuario mencione un trabajo, SIEMPRE llama a buscarTareaParaAvance
- Esta herramienta analiza el texto y te dice si hay coincidencia exacta o si debes preguntar
- NUNCA llames a registrarAvance directamente sin antes usar buscarTareaParaAvance

PASO 2 - Segun el resultado:
- Si buscarTareaParaAvance dice "coincidencia_exacta" → usa registrarAvance
- Si dice "requiere_confirmacion" → muestra las opciones al usuario y espera respuesta
- Si dice "sin_coincidencia" → ofrece crear tarea nueva

=== FORMATO DE RESPUESTA AL REGISTRAR ===
"Registrado en [SECTOR]:
Rubro: [NOMBRE DEL RUBRO]
Tarea: [NOMBRE DE LA TAREA]"

Responde en espanol, conciso y directo.`

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      buscarTareaParaAvance: tool({
        description: 'OBLIGATORIO: Usa esta herramienta ANTES de registrar cualquier avance. Analiza el texto del usuario y determina si hay una tarea exacta o si debes pedir confirmacion.',
        inputSchema: z.object({
          texto_usuario: z.string().describe('El texto exacto que escribio el usuario describiendo el trabajo'),
          sector_id: z.string().describe('ID del sector mencionado'),
        }),
        execute: async ({ texto_usuario, sector_id }) => {
          const textoLower = texto_usuario.toLowerCase()
          const sector = sectores.find((s) => s.id === sector_id)
          
          if (!sector) {
            return { 
              resultado: 'error', 
              mensaje: 'Sector no encontrado.' 
            }
          }

          // Check if user mentioned a rubro name (which means they need to specify task)
          const rubroMencionado = rubros.find(r => 
            textoLower.includes(r.nombre.toLowerCase())
          )

          if (rubroMencionado) {
            // User mentioned a rubro, not a specific task - need to ask
            const tareasDelRubro = tareas?.filter(t => t.rubro_id === rubroMencionado.id) || []
            
            if (tareasDelRubro.length > 1) {
              return {
                resultado: 'requiere_confirmacion',
                mensaje: `Mencionaste "${rubroMencionado.nombre}" que tiene varias tareas. ¿Cual corresponde?`,
                rubro: { id: rubroMencionado.id, nombre: rubroMencionado.nombre },
                opciones: tareasDelRubro.map(t => ({ id: t.id, nombre: t.nombre })),
                sector: { id: sector.id, nombre: sector.nombre },
                sugerencia_crear: `O puedo crear una tarea nueva en ${rubroMencionado.nombre}`
              }
            } else if (tareasDelRubro.length === 1) {
              // Only one task in this rubro - still ask to confirm
              return {
                resultado: 'requiere_confirmacion',
                mensaje: `En el rubro "${rubroMencionado.nombre}" solo hay una tarea: ${tareasDelRubro[0].nombre}. ¿Es correcta?`,
                rubro: { id: rubroMencionado.id, nombre: rubroMencionado.nombre },
                opciones: tareasDelRubro.map(t => ({ id: t.id, nombre: t.nombre })),
                sector: { id: sector.id, nombre: sector.nombre },
              }
            }
          }

          // Check for exact task name match
          const tareaExacta = tareas?.find(t => 
            textoLower.includes(t.nombre.toLowerCase())
          )

          if (tareaExacta) {
            const rubroDeTarea = rubros.find(r => r.id === tareaExacta.rubro_id)
            return {
              resultado: 'coincidencia_exacta',
              mensaje: `Encontre coincidencia exacta con la tarea "${tareaExacta.nombre}"`,
              tarea: { id: tareaExacta.id, nombre: tareaExacta.nombre },
              rubro: rubroDeTarea ? { id: rubroDeTarea.id, nombre: rubroDeTarea.nombre } : null,
              sector: { id: sector.id, nombre: sector.nombre },
            }
          }

          // No match found - suggest possible rubros based on keywords
          const sugerencias: { rubro: string; rubroId: string; tareas: { id: string; nombre: string }[] }[] = []
          
          // Simple keyword matching for common terms
          const keywords: Record<string, string[]> = {
            'mueble': ['Muebles cocina'],
            'cocina': ['Muebles cocina', 'Mesadas de cocina'],
            'mesada': ['Mesadas de cocina', 'Mesadas de baño'],
            'alacena': ['Muebles cocina'],
            'bajo': ['Muebles cocina'],
            'electri': ['Electricidad'],
            'luz': ['Electricidad'],
            'toma': ['Electricidad'],
            'enchufe': ['Electricidad'],
            'pintura': ['Pintura'],
            'pintar': ['Pintura'],
            'pared': ['Pintura', 'Yesería'],
            'techo': ['Pintura', 'Yesería'],
            'yeso': ['Yesería'],
            'revoque': ['Yesería'],
            'piso': ['Colocación'],
            'ceramico': ['Colocación'],
            'porcelanato': ['Colocación'],
            'sanitari': ['Sanitaria'],
            'canilla': ['Sanitaria'],
            'griferia': ['Sanitaria'],
            'inodoro': ['Sanitaria'],
            'puerta': ['Carpinterías'],
            'ventana': ['Carpinterías'],
            'carpinter': ['Carpinterías'],
          }

          for (const [keyword, rubroNames] of Object.entries(keywords)) {
            if (textoLower.includes(keyword)) {
              for (const rubroName of rubroNames) {
                const rubro = rubros.find(r => r.nombre.toLowerCase() === rubroName.toLowerCase())
                if (rubro && !sugerencias.find(s => s.rubroId === rubro.id)) {
                  const tareasRubro = tareas?.filter(t => t.rubro_id === rubro.id) || []
                  sugerencias.push({
                    rubro: rubro.nombre,
                    rubroId: rubro.id,
                    tareas: tareasRubro.map(t => ({ id: t.id, nombre: t.nombre }))
                  })
                }
              }
            }
          }

          if (sugerencias.length > 0) {
            return {
              resultado: 'requiere_confirmacion',
              mensaje: `No encontre tarea exacta para "${texto_usuario}". Estas son las opciones mas cercanas:`,
              sugerencias,
              sector: { id: sector.id, nombre: sector.nombre },
              sugerencia_crear: 'O puedo crear una tarea nueva si ninguna aplica'
            }
          }

          // No suggestions found
          return {
            resultado: 'sin_coincidencia',
            mensaje: `No encontre ninguna tarea ni rubro relacionado con "${texto_usuario}". ¿Queres que cree una tarea nueva? Decime en que rubro deberia ir.`,
            rubros_disponibles: rubros.map(r => ({ id: r.id, nombre: r.nombre })),
            sector: { id: sector.id, nombre: sector.nombre },
          }
        },
      }),

      registrarAvance: tool({
        description: 'Registra UN avance de obra. SOLO usar despues de buscarTareaParaAvance cuando hay coincidencia_exacta o el usuario confirmo la tarea.',
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
