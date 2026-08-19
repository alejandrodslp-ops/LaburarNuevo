import { db } from './supabase'

// Nombre público de empresa por id de empleador. SOLO server (usa la service key
// de `db`): lee profiles server-side y devuelve únicamente el nombre a mostrar —
// ningún dato sensible ni la clave llegan al cliente. Sin cambios de esquema.
export async function empresaNombres(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))]
  if (!uniq.length) return {}
  // El nombre de la empresa se guarda en profiles.nombre (para empleadores, el
  // registro lo llena con el nombre/razón social). No existe columna nombre_empresa.
  const { data } = await db.from('profiles').select('id,nombre').in('id', uniq)
  const map = {}
  for (const p of data ?? []) map[p.id] = p.nombre || null
  return map
}
