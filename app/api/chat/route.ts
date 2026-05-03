import { streamText, tool, convertToModelMessages } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(req: Request) {
  const { messages, obraId, sectores, rubros } = await req.json()

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
    ? sectores.map((s: { id: string; nombre: string; tipo: string }) => `- ${s.nombre} (ID: ${s.id}, Tipo: ${s.tipo})`).join('\n')
    : '(No hay sectores configurados. Pide al usuario que los configure primero.)'
    
  const rubrosList = rubros.length > 0
    ? rubros.map((r: { id: string; nombre: string }) => `- ${r.nombre} (ID: ${r.id})`).join('\n')
    : '(No hay rubros configurados. Pide al usuario que los configure primero.)'

  const systemPrompt = `Eres un asistente especializado en gestión de avance de obra para la construcción.
Tu objetivo es ayudar a los usuarios a registrar y consultar el progreso de trabajos en una obra llamada "${obra.nombre}".

INFORMACIÓN DE LA OBRA:
- Nombre: ${obra.nombre}
- Dirección: ${obra.direccion || 'No especificada'}

SECTORES DISPONIBLES (usa SOLO estos IDs):
${sectoresList}

RUBROS DISPONIBLES (usa SOLO estos IDs):
${rubrosList}

REGLAS CRÍTICAS:
1. NUNCA registres un avance sin antes CONFIRMAR con el usuario mediante un mensaje de texto.
2. Si el usuario menciona un trabajo que NO coincide claramente con ningún rubro de la lista, DEBES PREGUNTAR: "No reconozco ese rubro. ¿A cuál de estos se refiere?" y listar los rubros disponibles.
3. Si el usuario menciona un sector que NO existe en la lista, PREGUNTA cuál sector es el correcto.
4. SIEMPRE responde con un mensaje de texto ANTES de llamar a cualquier herramienta para confirmar qué vas a hacer.

FLUJO CORRECTO PARA REGISTRAR:
1. El usuario dice algo como "terminé la pintura en la UF 502"
2. TÚ RESPONDES CON TEXTO: "Entendido. Voy a registrar: Pintura completada en UF 502. ¿Confirmo el registro?"
3. El usuario dice "sí" o "confirmar"
4. RECIÉN AHÍ llamas a registrarAvances con confirmar=true

FLUJO CUANDO NO ENTIENDES:
1. Usuario: "instalé las tomas en la 502"
2. Si "tomas" no coincide claramente con un rubro → TÚ PREGUNTAS: "¿A qué rubro corresponde 'tomas'? Los rubros disponibles son: [lista]"
3. Usuario aclara: "electricidad"
4. TÚ CONFIRMAS: "Perfecto, voy a registrar avance de Electricidad (instalación de tomas) en UF 502. ¿Confirmo?"
5. Usuario: "sí"
6. Llamas a registrarAvances

SOBRE MÚLTIPLES REGISTROS:
- "pintura lista en UF 1, 2 y 3" → 3 registros, uno por cada UF
- "terminé electricidad y pintura en el hall" → 2 registros, uno por cada rubro
- SIEMPRE confirma el resumen completo antes de guardar

Responde SIEMPRE en español, sé conciso pero amable. NUNCA llames a herramientas sin antes enviar un mensaje de confirmación al usuario.`

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      registrarAvances: tool({
        description: 'Registra uno o más avances de obra. Puede registrar el mismo avance en múltiples sectores o múltiples rubros.',
        inputSchema: z.object({
          avances: z.array(z.object({
            sector_id: z.string().describe('ID del sector'),
            rubro_id: z.string().describe('ID del rubro'),
            descripcion: z.string().describe('Descripción del avance realizado'),
          })).describe('Lista de avances a registrar'),
          confirmar: z.boolean().describe('True para guardar, false para solo mostrar resumen'),
        }),
        execute: async ({ avances, confirmar }) => {
          if (!confirmar) {
            // Return summary for confirmation
            const resumen = avances.map((a) => {
              const sector = sectores.find((s: { id: string }) => s.id === a.sector_id)
              const rubro = rubros.find((r: { id: string }) => r.id === a.rubro_id)
              return `- ${sector?.nombre || 'Sector desconocido'} / ${rubro?.nombre || 'Rubro desconocido'}: ${a.descripcion}`
            })
            return {
              success: false,
              message: `Se van a registrar ${avances.length} avance(s):\n${resumen.join('\n')}\n\n¿Confirmas el registro?`,
              pendingCount: avances.length,
            }
          }

          // Insert all avances
          const { data, error } = await supabase
            .from('avances')
            .insert(
              avances.map((a) => ({
                obra_id: obraId,
                sector_id: a.sector_id,
                rubro_id: a.rubro_id,
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
            message: `Se registraron ${data.length} avance(s) correctamente.`,
            count: data.length,
          }
        },
      }),

      consultarAvances: tool({
        description: 'Consulta los avances registrados con filtros opcionales',
        inputSchema: z.object({
          sector_ids: z.array(z.string()).optional().describe('IDs de sectores a filtrar'),
          rubro_ids: z.array(z.string()).optional().describe('IDs de rubros a filtrar'),
          fecha_desde: z.string().optional().describe('Fecha desde (YYYY-MM-DD)'),
          fecha_hasta: z.string().optional().describe('Fecha hasta (YYYY-MM-DD)'),
          limite: z.number().optional().default(20).describe('Cantidad máxima de resultados'),
        }),
        execute: async ({ sector_ids, rubro_ids, fecha_desde, fecha_hasta, limite }) => {
          let query = supabase
            .from('avances')
            .select(`
              *,
              sectores (nombre, tipo),
              rubros (nombre)
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
            return { success: false, message: `Error al consultar: ${error.message}` }
          }

          if (!data || data.length === 0) {
            return { success: true, message: 'No se encontraron avances con los filtros especificados.', avances: [] }
          }

          const formatted = data.map((a) => ({
            fecha: new Date(a.created_at).toLocaleDateString('es-AR'),
            sector: a.sectores?.nombre || 'Desconocido',
            rubro: a.rubros?.nombre || 'Desconocido',
            descripcion: a.descripcion,
          }))

          return {
            success: true,
            message: `Se encontraron ${data.length} avance(s).`,
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
