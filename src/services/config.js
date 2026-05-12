import { supabase } from './supabase';

export async function getConfig() {
  const { data, error } = await supabase
    .from('config')
    .select('clave, valor');
  if (error) return null;
  const config = {};
  (data || []).forEach(row => { config[row.clave] = row.valor; });
  return config;
}

export async function esPeriodoPrueba() {
  const config = await getConfig();
  if (!config) return true; // Si falla, asumir prueba
  return config.periodo_prueba === 'true';
}

export async function usuarioEnPeriodoPrueba(userId) {
  // Verificar si periodo_prueba global esta activo
  const prueba = await esPeriodoPrueba();
  if (!prueba) return false;

  // Verificar si el usuario esta dentro de su mes gratis
  const { data, error } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .single();
  
  if (error || !data) return false;

  const fechaRegistro = new Date(data.created_at);
  const hoy = new Date();
  const diasDesdeRegistro = Math.floor((hoy - fechaRegistro) / (1000 * 60 * 60 * 24));
  
  return diasDesdeRegistro <= 10;
}

export async function getPrecio(codigoPais) {
  const config = await getConfig();
  const paisesSA = ["AR","BO","BR","CL","CO","EC","PY","PE","UY","VE"];
  if (paisesPA.includes(codigoPais)) {
    return parseFloat(config?.precio_sa || '1');
  }
  return parseFloat(config?.precio_mundo || '2');
}
