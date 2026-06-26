import { supabase } from './supabase';

// Registro centralizado de errores.
// - En desarrollo: imprime en consola de forma estructurada.
// - En producción: inserta en la tabla `error_logs` para verlos desde el admin.
//
// Es fire-and-forget y a prueba de fallos: si la tabla no existe o la red falla,
// NO lanza ni rompe el flujo del usuario (igual de seguro que el viejo console.log).
//
// Uso:  catch(e){ logError('PantallaX.accion', e); }
export function logError(contexto, error) {
  const mensaje = (error && error.message) ? error.message : String(error);

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[${contexto}]`, mensaje);
  }

  // No await: no bloquea ni propaga errores al caller.
  (async () => {
    try {
      let userId = null;
      try {
        const { data } = await supabase.auth.getSession(); // local, sin request de red
        userId = data?.session?.user?.id || null;
      } catch (_) {}

      await supabase.from('error_logs').insert({
        contexto,
        mensaje: String(mensaje).slice(0, 1000),
        user_id: userId,
        plataforma: 'app',
      });
    } catch (_) {
      // Silencioso a propósito: registrar un error nunca debe causar otro.
    }
  })();
}
