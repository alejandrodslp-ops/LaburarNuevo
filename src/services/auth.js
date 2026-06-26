import { supabase } from './supabase';

function generarCodigo() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function registrar({ email, password, nombre, apellido1, apellido2, rol, fecha_nac }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (data.user) {
    const esWorker = rol === 'worker';
    const gratis = esWorker
      ? new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error: insertError } = await supabase.from('profiles').insert({
      id: data.user.id,
      nombre,
      apellido1,
      apellido2: apellido2||'',
      rol,
      fecha_nac: fecha_nac || null,
      codigo_referido: generarCodigo(),
      periodo_gratis_hasta: gratis,
    });
    if (insertError) {
      // Rollback: cerrar sesión para no dejar al usuario en estado inconsistente
      await supabase.auth.signOut().catch(() => {});
      throw new Error('Error al crear el perfil. Intentá registrarte de nuevo.');
    }
  }
  return data;
}

// El sistema de referidos se acredita server-side en la edge function
// `acreditar-referido` (invocada desde RegisterScreen). Misma lógica de antes
// (+5 días, máximo 3), movida al servidor para poder escribir las columnas protegidas.

export async function login({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  supabase.auth.signOut({ scope: 'others' }).catch(() => {});
  return data;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Envía el correo de recuperación. El enlace aterriza en la página web
// konexu.app/recuperar donde el usuario crea su contraseña nueva.
export async function recuperarPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://www.konexu.app/recuperar',
  });
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
