const { Router } = require('express');
const multer = require('multer');
const { db } = require('../lib/supabase');
const router = Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

async function transcribir(audioBuffer, mimeType, filename) {
  const form = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType ?? 'audio/webm' });
  form.append('file', blob, filename ?? 'audio.webm');
  form.append('model', 'whisper-large-v3');
  form.append('language', 'es');
  const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: form,
  });
  const r = await resp.json();
  return r.text ?? '';
}

async function extraerPerfil(transcripcion) {
  const prompt = `Eres un asistente que extrae información de perfil laboral de una transcripción de audio.
Extrae los siguientes campos en JSON: nombre, edad, ciudad, pais, servicios (array), habilidades (array), experiencia, educacion, idiomas (array).
Si un campo no se menciona, devuelve null para strings y [] para arrays.
Transcripción: "${transcripcion}"
Responde SOLO con JSON válido.`;

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }),
  });
  const r = await resp.json();
  const txt = r.choices?.[0]?.message?.content ?? '{}';
  try { return JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] ?? '{}'); } catch { return {}; }
}

async function generarCV(analisis, datos) {
  const prompt = `Genera un CV profesional en español con los siguientes datos: ${JSON.stringify({ ...analisis, ...datos })}. Formato: texto estructurado listo para leer.`;
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });
  const r = await resp.json();
  return r.choices?.[0]?.message?.content ?? '';
}

router.post('/', upload.single('audio'), async (req, res) => {
  try {
    const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();
    const { data: { user }, error: authErr } = await db.auth.getUser(auth);
    if (authErr || !user) return res.status(401).json({ error: 'No autorizado' });

    // action=generate_cv → body JSON, sin archivo
    if (req.body?.action === 'generate_cv') {
      const { analisis, datos } = req.body;
      const cv = await generarCV(
        typeof analisis === 'string' ? JSON.parse(analisis) : analisis,
        typeof datos    === 'string' ? JSON.parse(datos)    : datos
      );

      // Matching de empleos en 3 capas: keywords array, cargo ilike, titulo ilike
      const keywords = [
        ...((typeof analisis === 'string' ? JSON.parse(analisis) : analisis)?.servicios  ?? []),
        ...((typeof analisis === 'string' ? JSON.parse(analisis) : analisis)?.habilidades ?? []),
      ];
      let matches = [];
      if (keywords.length) {
        const [m1, m2, m3] = await Promise.all([
          db.from('concursos').select('id,titulo,cargo,organizacion,pais').eq('activo', true)
            .overlaps('keywords', keywords).limit(10),
          db.from('concursos').select('id,titulo,cargo,organizacion,pais').eq('activo', true)
            .ilike('cargo', `%${keywords[0]}%`).limit(5),
          db.from('concursos').select('id,titulo,cargo,organizacion,pais').eq('activo', true)
            .ilike('titulo', `%${keywords[0]}%`).limit(5),
        ]);
        const seen = new Set();
        for (const c of [...(m1.data ?? []), ...(m2.data ?? []), ...(m3.data ?? [])]) {
          if (!seen.has(c.id)) { seen.add(c.id); matches.push(c); }
        }
        matches = matches.slice(0, 15);
      }
      return res.json({ cv, matches });
    }

    // Transcripción de audio via Whisper
    if (!req.file) return res.status(400).json({ error: 'Audio requerido' });
    const transcripcion = await transcribir(req.file.buffer, req.file.mimetype, req.file.originalname);
    const analisis      = await extraerPerfil(transcripcion);
    return res.json({ transcripcion, analisis });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
