import { streamText, tool, stepCountIs } from 'ai'
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

interface ImagenPendiente {
  id: string
  pathname: string
  nombre?: string
}

export async function POST(req: Request) {
  const { messages: rawMessages, obraId, sectores, rubros, tareas, imagenesPendientes } = await req.json() as {
    messages: unknown[]
    obraId: string
    sectores: SectorData[]
    rubros: RubroData[]
    tareas: TareaData[]
    imagenesPendientes?: ImagenPendiente[]
  }
  
  // Normalize messages to handle both history (content string) and streaming (parts) formats
  const messages = normalizeMessages(rawMessages)
  const pendingImages: ImagenPendiente[] = Array.isArray(imagenesPendientes) ? imagenesPendientes : []
  console.log("[v0] POST /api/chat - pendingImages recibidas:", JSON.stringify(pendingImages))
  // Mutable pool of images not yet associated during this request (avoids
  // double-attaching the same image across multiple registrarAvance calls).
  const imagenesDisponibles: ImagenPendiente[] = [...pendingImages]

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

  // Build pending images context
  const imagenesContext = pendingImages.length > 0
    ? `\n\nIMAGENES ADJUNTADAS EN ESTE MENSAJE (${pendingImages.length}):\n${pendingImages.map((img, i) => `- Imagen ${i + 1} (ID: ${img.id})${img.nombre ? ` "${img.nombre}"` : ''}`).join('\n')}`
    : ''

  const systemPrompt = `Eres un asistente inteligente de obra que registra avances de construccion. Obra: "${obra.nombre}".
Debes comportarte como un capataz experimentado que entiende el lenguaje informal de obra.

SECTORES DISPONIBLES:
${sectoresList}

RUBROS Y TAREAS DISPONIBLES:
${rubrosList}${imagenesContext}

=== MANEJO DE IMAGENES ===
Cuando el usuario adjunta imagenes (ver "IMAGENES ADJUNTADAS EN ESTE MENSAJE"):
- Las imagenes se asocian a un avance usando el parametro "imagen_ids" de registrarAvance.
- Si el usuario reporta UN SOLO avance junto con la/las imagen/es: asocia TODAS las imagenes a ese avance automaticamente (pasa todos los IDs en imagen_ids).
- Si el usuario reporta MULTIPLES avances y hay imagenes: NO adivines. PREGUNTA al usuario a cual avance corresponde cada imagen, refiriendote a ellas como "Imagen 1", "Imagen 2", etc. Recien cuando el usuario aclare, registra cada avance con su imagen_ids correspondiente.
- Si hay imagenes adjuntas pero el usuario NO menciono ningun trabajo/avance: preguntale a que avance queres asociar la/las imagen/es.
- NUNCA descartes una imagen adjunta sin asociarla o sin preguntar.

=== FLUJO DE TRABAJO OBLIGATORIO ===

PRIMERO - Identifica la intencion del mensaje del usuario:
- Si MENCIONA UN TRABAJO/AVANCE realizado: sigue el flujo de registro (PASO 1 en adelante)
- Si PIDE CONSULTAR avances (ej: "mostrame la 502", "como va la unidad 301"): usa consultarAvances y responde con el formato agrupado
- Si es un SALUDO o pregunta general: responde amigablemente y explica que podes ayudarlo a registrar y consultar avances
- Si NO ENTENDES el mensaje o es ambiguo: PREGUNTALE al usuario para que aclare

PASO 1 - Cuando el usuario mencione trabajos, SIEMPRE usa "analizarTexto" primero
Esta herramienta analiza semanticamente el texto y te dice la accion a tomar.

PASO 2 - Segun el resultado de analizarTexto:
- Si dice "auto_save" (score >= 0.85): registra automaticamente con registrarAvance
- Si dice "confirm" (score 0.60-0.85): pregunta al usuario si es correcto antes de registrar
- Si dice "clarify" (score < 0.60): muestra las opciones y pregunta cual corresponde

PASO 3 - Al registrar, determina la descripcion segun estas reglas:
- Si el usuario indica que la tarea esta TERMINADA/FINALIZADA/COMPLETA sin observaciones: guarda "finalizada"
- Si tiene observaciones o comentarios: guarda el comentario QUITANDO el nombre de la tarea si lo menciono
  Ejemplo: "el tablero de la 502 le falta el disyuntor" -> descripcion: "le falta el disyuntor nada mas"
  Ejemplo: "terminamos la pintura interior en la 502" -> descripcion: "finalizada"
  Ejemplo: "la yeseria del cielorraso quedo con una mancha" -> descripcion: "quedo con una mancha"

=== MUY IMPORTANTE ===
- SIEMPRE debes responder con texto a CADA mensaje del usuario, sin excepcion
- SIEMPRE debes responder con texto DESPUES de usar cualquier herramienta
- Si NO entiendes que quiso decir el usuario, o el mensaje es ambiguo, PREGUNTALE para aclarar (ej: "No estoy seguro de a que unidad te referis, me lo aclaras?")
- Si el mensaje no esta relacionado con avances de obra, responde igual de forma amigable y orienta al usuario sobre que podes hacer
- NUNCA dejes un mensaje del usuario sin respuesta
- NO inventes tareas
- NO registres sin usar analizarTexto primero
- Entiende sinonimos: "enchufes" = "Teclas y tomas", "luces" = iluminacion
- Si el usuario menciona multiples trabajos, procesalos uno por uno

=== FORMATO AL MOSTRAR AVANCES ===
Agrupa los avances primero por UNIDAD, luego por RUBRO, luego lista las TAREAS.
NO repitas el nombre de la unidad en cada linea. Formato:

**Unidad: [NOMBRE]**
[RUBRO]:
- [tarea]: [descripcion o "finalizada ✓"]
- [tarea]: [descripcion o "finalizada ✓"]

[OTRO RUBRO]:
- [tarea]: [descripcion o "finalizada ✓"]

Ejemplo:
**Unidad: 501**
Yeseria:
- paredes: finalizada ✓
- cielorraso: falta una parte cerca de la ventana

Electricidad:
- tableros: finalizada ✓
- tomas y teclas: se montaron dos nada mas

NO incluyas fecha/hora a menos que el usuario la pida especificamente.
NO incluyas enlaces ni URLs de imagenes en tu texto: la interfaz muestra automaticamente un enlace "Imagen asociada" debajo del avance correspondiente. Solo podes mencionar en palabras que un avance tiene una foto si es relevante.

=== FORMATO AL REGISTRAR ===
"Registrado en [SECTOR]:
Rubro: [RUBRO]
Tarea: [TAREA]"

Responde en espanol, conciso y amigable. NUNCA termines sin dar una respuesta de texto al usuario.`

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
        description: 'Registra UN avance de obra. SOLO usar cuando el nombre de la tarea coincide EXACTAMENTE con lo que dijo el usuario, o cuando el usuario confirmo la tarea. Si hay imagenes adjuntas que corresponden a este avance, pasa sus IDs en imagen_ids.',
        inputSchema: z.object({
          sector_id: z.string().describe('ID del sector'),
          tarea_id: z.string().describe('ID de la tarea'),
          descripcion: z.string().describe('Descripcion breve del avance'),
          imagen_ids: z.array(z.string()).optional().describe('IDs de las imagenes adjuntas que corresponden a este avance (de la lista IMAGENES ADJUNTADAS)'),
        }),
        execute: async ({ sector_id, tarea_id, descripcion, imagen_ids }) => {
          try {
            console.log("[v0] registrarAvance - imagen_ids del modelo:", JSON.stringify(imagen_ids), "| pendingImages disponibles:", JSON.stringify(pendingImages.map(p => p.id)))
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

            // Associate pending images with this avance.
            // Prefer the IDs the model selected; if it registered an avance
            // without specifying images but there are pending ones available,
            // fall back to attaching all remaining images so they are never lost.
            let imagenesAsociadas = 0
            const idsAsociados: string[] = []
            if (data && imagenesDisponibles.length > 0) {
              let toAssociate: ImagenPendiente[]
              if (imagen_ids && imagen_ids.length > 0) {
                toAssociate = imagenesDisponibles.filter((img) => imagen_ids.includes(img.id))
              } else {
                // Fallback: model didn't pass IDs, attach all remaining images
                toAssociate = [...imagenesDisponibles]
              }
              console.log("[v0] registrarAvance - imagenes a asociar:", JSON.stringify(toAssociate.map(i => i.id)))
              if (toAssociate.length > 0) {
                const rows = toAssociate.map((img) => ({
                  avance_id: data.id,
                  tipo: 'imagen' as const,
                  blob_pathname: img.pathname,
                  nombre_original: img.nombre || null,
                }))
                const { error: archErr } = await supabase.from('archivos').insert(rows)
                if (archErr) {
                  console.log("[v0] registrarAvance - error insertando archivos:", archErr.message)
                } else {
                  imagenesAsociadas = toAssociate.length
                  idsAsociados.push(...toAssociate.map((img) => img.id))
                  // Remove associated images from the available pool
                  for (const img of toAssociate) {
                    const idx = imagenesDisponibles.findIndex((p) => p.id === img.id)
                    if (idx !== -1) imagenesDisponibles.splice(idx, 1)
                  }
                }
              }
            }

            const imgMsg = imagenesAsociadas > 0
              ? `\n${imagenesAsociadas} imagen(es) asociada(s).`
              : ''

            return {
              success: true,
              message: `Registrado en ${sector.nombre}:\nRubro: ${rubro?.nombre || 'Sin rubro'}\nTarea: ${tarea.nombre}${imgMsg}`,
              // IDs the client should clear from its pending images list
              imagenes_asociadas: idsAsociados,
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
              .select(`*, sectores (nombre), rubros (nombre), tareas (nombre), archivos (id, tipo, blob_pathname, nombre_original)`)
              .eq('obra_id', obraId)
              .eq('archivado', false)
              .order('created_at', { ascending: false })

            if (sector_ids && sector_ids.length > 0) {
              query = query.in('sector_id', sector_ids)
            }

            const { data, error } = await query
            if (error) return { success: false, message: `Error: ${error.message}` }
            if (!data?.length) return { success: true, message: 'No hay avances registrados.', avances: [] }

            interface ArchivoRow {
              id: string
              tipo: string
              blob_pathname: string
              nombre_original: string | null
            }
            interface AvanceRow {
              created_at: string
              descripcion: string
              sectores?: { nombre: string } | null
              rubros?: { nombre: string } | null
              tareas?: { nombre: string } | null
              archivos?: ArchivoRow[] | null
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
                imagenes: (a.archivos || [])
                  .filter((f) => f.tipo === 'imagen')
                  .map((f) => ({
                    url: `/api/file?pathname=${encodeURIComponent(f.blob_pathname)}`,
                    nombre: f.nombre_original,
                  })),
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
    // AI SDK v6: enable multi-step so the model generates a text response after tool calls
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse()
}
