import { supabase } from './supabase';
import { rescheduleTrialExpiry } from './notifications';

function generarCodigo() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function registrar({ email, password, nombre, apellido1, apellido2, rol }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (data.user) {
    const { error: insertError } = await supabase.from('profiles').insert({
      id: data.user.id,
      nombre,
      apellido1,
      apellido2: apellido2||'',
      rol,
      codigo_referido: generarCodigo(),
    });
    if (insertError) {
      // Rollback: cerrar sesión para no dejar al usuario en estado inconsistente
      await supabase.auth.signOut().catch(() => {});
      throw new Error('Error al crear el perfil. Intentá registrarte de nuevo.');
    }
  }
  return data;
}

// Acredita 5 días extra al usuario que compartió el link, máximo 3 veces.
// nuevoUserId: id del usuario recién registrado (para registrar su referido_por).
export async function acreditarReferido(codigoReferido, nuevoUserId) {
  if (!codigoReferido) return;
  try {
    // Buscar al referente por su código
    const { data: referente } = await supabase
      .from('profiles')
      .select('id, perfil_activo_hasta, periodo_gratis_hasta')
      .eq('codigo_referido', codigoReferido)
      .single();

    if (!referente) return;

    // Contar cuántos ya se registraron con este referente
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('referido_por', referente.id);

    if ((count || 0) >= 3) return;

    // Registrar el referido_por en el perfil del nuevo usuario
    if (nuevoUserId) {
      await supabase
        .from('profiles')
        .update({ referido_por: referente.id })
        .eq('id', nuevoUserId);
    }

    // Suma 5 días desde la fecha de vencimiento actual del referente
    const baseActivo = referente.perfil_activo_hasta
      ? new Date(Math.max(new Date(referente.perfil_activo_hasta).getTime(), Date.now()))
      : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const nuevaFechaActivo = new Date(baseActivo.getTime() + 5 * 24 * 60 * 60 * 1000);

    const baseGratis = referente.periodo_gratis_hasta
      ? new Date(Math.max(new Date(referente.periodo_gratis_hasta).getTime(), Date.now()))
      : baseActivo;
    const nuevaFechaGratis = new Date(baseGratis.getTime() + 5 * 24 * 60 * 60 * 1000);

    const activoISO = nuevaFechaActivo.toISOString();
    const gratisISO = nuevaFechaGratis.toISOString();

    await supabase
      .from('profiles')
      .update({
        perfil_activo_hasta: activoISO,
        periodo_gratis_hasta: gratisISO,
        perfil_activo: true,
      })
      .eq('id', referente.id);

    await rescheduleTrialExpiry(activoISO);
  } catch (e) {}
}

export async function login({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'others' });
  return data;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getPerfil(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePerfil(userId, datos) {
  const { data, error } = await supabase
    .from('profiles')
    .update(datos)
    .eq('id', userId);
  if (error) throw error;
  return data;
}

export async function buscarTrabajadores({ categoria, zona }) {
  let query = supabase
    .from('profiles')
    .select('id, nombre, servicios, profesiones, rating, total_valoraciones, ciudad, disponibilidad')
    .eq('perfil_activo', true)
    .eq('rol', 'worker');
  if (categoria) query = query.contains('servicios', [categoria]);
  if (zona) query = query.ilike('ciudad', zona);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
