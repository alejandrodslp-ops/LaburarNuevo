const { Router } = require('express');
const crypto = require('crypto');
const { db } = require('../lib/supabase');
const router = Router();

const ADMIN_EMAIL = 'alejandrodslp@gmail.com';
const ADMIN_PIN_LEGACY = process.env.ADMIN_PIN || ''; // fallback mientras no haya pin_hash guardado
const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

function hashPin(pin) {
  // sha256 hex — idéntico al Array.from(Uint8Array).map(hex).join('') de la versión Deno
  return crypto.createHash('sha256').update(pin, 'utf8').digest('hex');
}

router.post('/', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'No autorizado' });

  const { data: { user }, error: authErr } = await db.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' });

  const { accion, pin, pin_actual, pin_nuevo } = req.body ?? {};

  const { data: fila, error: selErr } = await db.from('admin_pin_seguridad').select('*').eq('id', 1).single();
  if (selErr) console.log('SELECT admin_pin_seguridad ERROR:', JSON.stringify(selErr));
  const ahora = new Date();

  if (fila?.bloqueado_hasta && new Date(fila.bloqueado_hasta) > ahora) {
    const minutosRestantes = Math.ceil((new Date(fila.bloqueado_hasta).getTime() - ahora.getTime()) / 60000);
    return res.json({ verificado: false, error: `Bloqueado por demasiados intentos. Probá de nuevo en ${minutosRestantes} min.` });
  }

  async function esCorrecto(candidato) {
    if (fila?.pin_hash) return hashPin(candidato) === fila.pin_hash;
    if (ADMIN_PIN_LEGACY) return candidato === ADMIN_PIN_LEGACY;
    return false;
  }

  async function registrarFallo() {
    const intentos = (fila?.intentos_fallidos ?? 0) + 1;
    const bloqueado = intentos >= MAX_INTENTOS;
    const { error: updErr } = await db.from('admin_pin_seguridad').update({
      intentos_fallidos: bloqueado ? 0 : intentos,
      bloqueado_hasta: bloqueado ? new Date(ahora.getTime() + BLOQUEO_MINUTOS * 60000).toISOString() : null,
      actualizado_at: ahora.toISOString(),
    }).eq('id', 1);
    if (updErr) console.log('registrarFallo UPDATE ERROR:', JSON.stringify(updErr));
    return bloqueado
      ? `PIN incorrecto. Bloqueado ${BLOQUEO_MINUTOS} minutos por demasiados intentos.`
      : `PIN incorrecto. Te quedan ${MAX_INTENTOS - intentos} intento(s).`;
  }

  async function registrarExito() {
    await db.from('admin_pin_seguridad').update({
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      actualizado_at: ahora.toISOString(),
    }).eq('id', 1);
  }

  if (accion === 'cambiar') {
    if (!pin_actual || !pin_nuevo) return res.status(400).json({ error: 'Faltan datos' });
    if (String(pin_nuevo).length < 4) return res.json({ verificado: false, error: 'El PIN nuevo debe tener al menos 4 caracteres.' });

    if (!(await esCorrecto(String(pin_actual).trim()))) {
      return res.json({ verificado: false, error: await registrarFallo() });
    }
    const nuevoHash = hashPin(String(pin_nuevo).trim());
    await db.from('admin_pin_seguridad').update({
      pin_hash: nuevoHash,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      actualizado_at: ahora.toISOString(),
    }).eq('id', 1);
    return res.json({ verificado: true, cambiado: true });
  }

  // accion "verificar" (default)
  if (!(await esCorrecto(String(pin ?? '').trim()))) {
    return res.json({ verificado: false, error: await registrarFallo() });
  }
  await registrarExito();
  return res.json({ verificado: true });
});

module.exports = router;
