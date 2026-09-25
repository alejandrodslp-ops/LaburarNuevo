const { Router } = require('express');
const crypto = require('crypto');
const { db } = require('../lib/supabase');
const router = Router();

// Avisa a Google Indexing API (+ IndexNow para Bing/DDG/Yandex) los concursos
// nuevos para que se indexen en minutos. Requiere GOOGLE_INDEXING_SA_KEY (JSON
// de una service account de Google con la Indexing API habilitada).
const SA_KEY = process.env.GOOGLE_INDEXING_SA_KEY || '';
const SITE   = 'https://www.konexu.app';
const INDEXNOW_KEY = '653888ae6c12bb31735da813cba61aeb';

function toSlug(c) {
  const parte = (c.cargo || c.titulo || 'empleo')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-').slice(0, 50);
  const pais = (c.pais || 'latam').toLowerCase().replace(/[^a-z]/g, '');
  return `${parte}-${pais}-${c.id}`;
}

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })));
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const sig = b64url(signer.sign(sa.private_key));
  const jwt = `${unsigned}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No se pudo autenticar con Google: ' + JSON.stringify(data));
  return data.access_token;
}

async function notify(token, url) {
  const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, type: 'URL_UPDATED' }),
  });
  return res.ok;
}

router.post('/', async (req, res) => {
  try {
    if (!SA_KEY) return res.status(400).json({ error: 'Falta el env GOOGLE_INDEXING_SA_KEY' });
    const sa = JSON.parse(SA_KEY);

    const body = req.body ?? {};
    const horas  = Number(body.horas) || 24;
    const limite = Math.min(Number(body.limite) || 150, 180);

    const desde = new Date(Date.now() - horas * 3600 * 1000).toISOString();
    const { data: concursos, error } = await db
      .from('concursos').select('id, cargo, titulo, pais')
      .eq('activo', true).gte('created_at', desde)
      .order('created_at', { ascending: false }).limit(limite);
    if (error) throw error;

    const token = await getAccessToken(sa);
    let ok = 0, fail = 0;
    const urls = [];
    for (const c of concursos ?? []) {
      const url = `${SITE}/empleos/${toSlug(c)}`;
      urls.push(url);
      (await notify(token, url)) ? ok++ : fail++;
    }

    let indexnow = 'skip';
    try {
      if (urls.length > 0) {
        const r = await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ host: 'www.konexu.app', key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList: urls }),
        });
        indexnow = String(r.status);
      }
    } catch (e) {
      indexnow = 'error: ' + e.message.slice(0, 60);
    }

    return res.json({ ok: true, notificados: ok, fallidos: fail, total: concursos?.length ?? 0, indexnow });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
