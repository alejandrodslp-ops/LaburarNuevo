const { Router } = require('express');
const { execFile } = require('child_process');
const { db } = require('../lib/supabase');
const router = Router();

// Mantenimiento que en Supabase corría como SQL directo vía pg_cron —
// portado 2026-09-25 al migrar a self-host. Las 3 primeras van envueltas en
// función RPC (ver supabase/fix_mantenimiento_backend_hetzner.sql) porque
// PostgREST no ejecuta UPDATE con subquery+LIMIT directo. El VACUUM no puede
// ir en una función (Postgres lo prohíbe dentro de cualquier transacción) ni
// pasar por el pooler de conexiones (modo "transaction" lo rechaza) — se
// ejecuta directo contra el contenedor de la base, igual que el restore.
router.post('/desactivar-concursos-vencidos', async (req, res) => {
  const { error } = await db.rpc('desactivar_concursos_vencidos_job');
  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.json({ ok: true });
});

router.post('/desactivar-suscripciones-vencidas', async (req, res) => {
  const { error } = await db.rpc('desactivar_suscripciones_vencidas_job');
  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.json({ ok: true });
});

router.post('/actualizar-stats-concursos', async (req, res) => {
  const { error } = await db.rpc('actualizar_stats_concursos_job');
  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.json({ ok: true });
});

router.post('/refresh-stats-por-pais', async (req, res) => {
  const { error } = await db.rpc('refresh_stats_por_pais');
  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.json({ ok: true });
});

router.post('/vacuum-concursos', (req, res) => {
  execFile(
    'docker', ['compose', 'exec', '-T', 'db', 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-c', 'VACUUM (ANALYZE) concursos'],
    { cwd: '/root/supabase/docker', timeout: 600000 },
    (error, stdout, stderr) => {
      if (error) return res.status(500).json({ ok: false, error: stderr || error.message });
      res.json({ ok: true, salida: stdout.trim() });
    }
  );
});

module.exports = router;
