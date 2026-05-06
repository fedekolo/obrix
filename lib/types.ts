export interface Obra {
  id: string
  user_id: string
  nombre: string
  direccion: string | null
  descripcion: string | null
  created_at: string
  updated_at: string
  es_propietario?: boolean
  propietario_email?: string
}

export interface Sector {
  id: string
  obra_id: string
  nombre: string
  tipo: 'unidad_funcional' | 'area_comun' | 'otro'
  orden: number
  created_at: string
}

export interface Rubro {
  id: string
  obra_id: string
  nombre: string
  descripcion: string | null
  orden: number
  created_at: string
  tareas?: Tarea[]
}

export interface Tarea {
  id: string
  rubro_id: string
  nombre: string
  orden: number
  created_at: string
  rubro?: Rubro
}

export interface Avance {
  id: string
  obra_id: string
  sector_id: string
  rubro_id: string
  tarea_id: string | null
  user_id: string
  descripcion: string
  created_at: string
  sector?: Sector
  rubro?: Rubro
  tarea?: Tarea
  archivos?: Archivo[]
}

export interface Archivo {
  id: string
  avance_id: string
  tipo: 'imagen' | 'audio'
  blob_pathname: string
  nombre_original: string | null
  transcripcion: string | null
  created_at: string
}

export interface ObraColaborador {
  id: string
  obra_id: string
  user_id: string | null
  rol: 'editor' | 'viewer'
  invitado_por: string
  email_invitado: string
  estado: 'pendiente' | 'aceptada' | 'rechazada'
  created_at: string
  obra?: Obra
}

export interface ObraWithAccess extends Obra {
  es_propietario: boolean
  propietario_email?: string
}
