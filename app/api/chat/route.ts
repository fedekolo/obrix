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

REGLAS:

1. SI ENTIENDES CLARAMENTE el rubro y el sector:
   - Registra el avance DIRECTAMENTE llamando a registrarAvances con confirmar=true
   - Informa al usuario lo que guardaste, por ejemplo: "Listo, se registro el avance de Pintura en UF 502."
   - El usuario corregira si hay algun error

2. SI NO RECONOCES el rubro mencionado:
   - NO registres nada
   - PREGUNTA: "No reconozco ese rubro. ¿A cual de estos se refiere?" y lista los rubros disponibles
   - Espera la aclaracion del usuario antes de registrar

3. SI NO RECONOCES el sector mencionado:
   - NO registres nada  
   - PREGUNTA cual es el sector correcto
   - Espera la aclaracion del usuario antes de registrar

4. SOBRE MULTIPLES REGISTROS:
   - "pintura lista en UF 1, 2 y 3" → registra 3 avances (uno por cada UF)
   - "termine electricidad y pintura en el hall" → registra 2 avances (uno por cada rubro)
   - Informa el resumen de todo lo que guardaste

5. CONSULTAS:
   - Cuando el usuario pregunte por avances, usa consultarAvances
   - Cuando pregunte que sectores o rubros hay, usa listarSectores o listarRubros

Responde SIEMPRE en espanol, se conciso y directo.`

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      registrarAvances: tool({
        description: 'Registra uno o mas avances de obra. Usa esta herramienta SOLO cuando entiendas claramente el sector y rubro.',
        inputSchema: z.object({
          avances: z.array(z.object({
            sector_id: z.string().describe('ID del sector'),
            rubro_id: z.string().describe('ID del rubro'),
            descripcion: z.string().describe('Descripcion del avance realizado'),
          })).describe('Lista de avances a registrar'),
        }),
        execute: async ({ avances }) => {
          // Build summary for response
          const resumen = avances.map((a) => {
            const sector = sectores.find((s: { id: string }) => s.id === a.sector_id)
            const rubro = rubros.find((r: { id: string }) => r.id === a.rubro_id)
            return `${rubro?.nombre || 'Rubro'} en ${sector?.nombre || 'Sector'}`
          })

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
            message: data.length === 1 
              ? `Registrado: ${resumen[0]}.`
              : `Se registraron ${data.length} avances: ${resumen.join(', ')}.`,
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
