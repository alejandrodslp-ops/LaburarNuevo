const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

// Publica los concursos NUEVOS de un país en un canal de Telegram, con link a la web.
// Dedupe por (fuente, fuente_id, canal) — NO por uuid (los concursos se borran/reinsertan).
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_UY   = process.env.TELEGRAM_CHAT_UY || '';

const BANDERA = { UY: '🇺🇾', AR: '🇦🇷', BR: '🇧🇷', MX: '🇲🇽' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function limpiarLugar(lugar) {
  return lugar.replace(/^departamento de\s+/i, '').replace(/\.+\s*$/, '').trim();
}

function extraerSueldo(descripcion) {
  const linea = descripcion?.match(/Retribución:\s*([^\n]+)/)?.[1]?.trim();
  if (!linea) return null;
  const corta = linea.replace(/\s+a valores de.*$/i, '').replace(/\.+\s*$/, '').slice(0, 70);
  return esc(corta).replace(/(\$\s?[\d.,]+)/, '<b>$1</b>');
}

function lineaCierre(iso) {
  const cierre = new Date(iso);
  if (isNaN(cierre.getTime())) return null;
  const fecha = cierre.toLocaleDateString('es-UY', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Montevideo' });
  const dias = Math.ceil((cierre.getTime() - Date.now()) / 86400000);
  const urgencia = dias === 1 ? ' — queda 1 día' : dias > 1 && dias <= 15 ? ` — quedan ${dias} días` : '';
  return `⏳ Cierra el <b>${fecha}</b>${urgencia}`;
}

const hashtag = (s) =>
  '#' + s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '').trim()
    .split(/\s+/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join('');

function armarMensaje(c) {
  const pais = (c.pais || '').toUpperCase();
  const lugar = c.lugar ? limpiarLugar(c.lugar) : '';
  const encabezado = `${BANDERA[pais] ?? '📢'} <b>CONCURSO PÚBLICO</b>${lugar ? ` · ${esc(lugar)}` : ''}`;

  const partes = [encabezado, ''];
  partes.push(`<b>${esc((c.cargo || c.titulo || 'Llamado público').trim())}</b>`);
  if (c.organismo) partes.push(`<i>${esc(c.organismo)}</i>`);
  partes.push('');
  const sueldo = extraerSueldo(c.descripcion);
  if (sueldo) partes.push(`💰 ${sueldo}`);
  if ((c.puestos ?? 1) > 1) partes.push(`👥 ${c.puestos} puestos`);
  if (c.fecha_cierre) {
    const cierre = lineaCierre(c.fecha_cierre);
    if (cierre) partes.push(cierre);
  }
  partes.push('', `🔗 konexu.app/e/${pais.toLowerCase()}-${c.fuente_id}`);
  const tags = [lugar && hashtag(lugar), '#EmpleoPúblico'].filter(Boolean).join(' ');
  partes.push('', tags);
  return partes.filter((p, i, a) => p !== '' || a[i - 1] !== '').join('\n');
}

router.post('/', async (req, res) => {
  try {
    const body  = req.body ?? {};
    const pais  = String(body.pais || 'UY');
    const canal = pais === 'UY' ? CHAT_UY : ''; // multi-país: agregar env TELEGRAM_CHAT_<PAIS>
    const max   = Math.min(Number(body.max) || 12, 18);
    const horas = Number(body.horas) || 48;

    if (!BOT_TOKEN || !canal) {
      return res.status(400).json({ error: 'Faltan env TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_UY' });
    }

    if (body.seed === true) {
      const { data: todos, error } = await db
        .from('concursos').select('fuente, fuente_id')
        .eq('pais', pais).eq('activo', true).limit(3000);
      if (error) throw error;
      const filas = (todos ?? []).map((c) => ({ fuente: c.fuente, fuente_id: c.fuente_id, canal }));
      if (filas.length > 0) {
        const { error: e2 } = await db.from('telegram_publicados')
          .upsert(filas, { onConflict: 'fuente,fuente_id,canal', ignoreDuplicates: true });
        if (e2) throw e2;
      }
      return res.json({ ok: true, seeded: filas.length });
    }

    const desde = new Date(Date.now() - horas * 3600 * 1000).toISOString();
    const { data: concursos, error } = await db
      .from('concursos')
      .select('id, fuente, fuente_id, titulo, cargo, organismo, lugar, puestos, fecha_cierre, pais, descripcion')
      .eq('pais', pais).eq('activo', true)
      .gt('fecha_cierre', new Date().toISOString())
      .gte('created_at', desde)
      .order('created_at', { ascending: true })
      .limit(300);
    if (error) throw error;

    const ids = (concursos ?? []).map((c) => c.fuente_id);
    if (ids.length === 0) return res.json({ ok: true, publicados: 0, pendientes: 0 });

    const { data: pub, error: ePub } = await db
      .from('telegram_publicados').select('fuente, fuente_id')
      .eq('canal', canal).in('fuente_id', ids);
    if (ePub) throw ePub;
    const yaPublicado = new Set((pub ?? []).map((p) => `${p.fuente}|${p.fuente_id}`));

    const nuevos = (concursos ?? []).filter((c) => !yaPublicado.has(`${c.fuente}|${c.fuente_id}`));
    const tanda = nuevos.slice(0, max);

    let publicados = 0, fallidos = 0;
    const errores = [];
    for (const c of tanda) {
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: canal,
          text: armarMensaje(c),
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          disable_notification: body.silencioso === true,
        }),
      });
      if (r.ok) {
        publicados++;
        const { error: eIns } = await db.from('telegram_publicados').insert({ fuente: c.fuente, fuente_id: c.fuente_id, canal });
        if (eIns) errores.push('dedupe: ' + eIns.message.slice(0, 80));
      } else {
        fallidos++;
        errores.push(`telegram ${r.status}: ` + (await r.text()).slice(0, 120));
        if (r.status === 429) break;
      }
      await new Promise((resolve) => setTimeout(resolve, 3100));
    }

    return res.json({ ok: true, publicados, fallidos, pendientes: Math.max(nuevos.length - tanda.length, 0), errores: errores.slice(0, 5) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
