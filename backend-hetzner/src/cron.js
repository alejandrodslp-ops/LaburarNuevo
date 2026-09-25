const cron = require('node-cron');

// Scheduler propio — reemplaza a pg_cron + net.http_post de Supabase.
// Mismo horario y mismo body que los cron jobs reales (verificados el 2026-09-09
// vía `select jobname, schedule, command from cron.job`). Cada entrada dispara
// una llamada HTTP interna a esta misma app (self-call), igual que hoy Supabase
// le pega a la URL pública de la function.
//
// NO se activa solo con tener este archivo: index.js decide si lo arranca
// (ver ACTIVAR_CRON_INTERNO más abajo). Mientras el backend siga apuntando a la
// base de Supabase de producción y esos pg_cron jobs sigan activos, NO prender
// esto — dispararía cada tarea DOS VECES (una vez desde Supabase, otra desde aquí).
// Prender recién cuando: (a) se corte pg_cron en Supabase, o (b) la base ya
// migró a un Postgres propio sin esos jobs.

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;

const JOBS = [
  // ── Alertas / waitlist ──────────────────────────────────────────────────
  { name: 'alertas-waitlist-diaria',      schedule: '* * * * *',    route: '/alertas-waitlist',     body: {} },
  { name: 'waitlist-autorizador-15min',   schedule: '*/15 * * * *', route: '/waitlist-autorizador', body: {} },

  // ── Búsqueda / mercado ───────────────────────────────────────────────────
  { name: 'busqueda-diaria-workers',      schedule: '0 7 * * *',    route: '/busqueda-diaria',      body: {} },
  { name: 'scraper-mercado-diario',       schedule: '0 10 * * *',   route: '/scraper-mercado',      body: {} },

  // ── Monitoreo ────────────────────────────────────────────────────────────
  { name: 'monitor-crons',                schedule: '0 8,20 * * *', route: '/monitor-crons',        body: {} },
  { name: 'notificar-indexacion-google',  schedule: '0 */6 * * *',  route: '/notificar-indexacion', body: { horas: 8, limite: 45 } },
  { name: 'vigilante-6am',                schedule: '0 9 * * *',    route: '/vigilante-scraper',    body: {} },
  { name: 'vigilante-10am',               schedule: '0 13 * * *',  route: '/vigilante-scraper',    body: {} },
  { name: 'vigilante-2pm',                schedule: '0 17 * * *',  route: '/vigilante-scraper',    body: {} },
  { name: 'vigilante-6pm',                schedule: '0 21 * * *',  route: '/vigilante-scraper',    body: {} },
  { name: 'vigilante-10pm',               schedule: '0 1 * * *',   route: '/vigilante-scraper',    body: {} },

  // ── Telegram ─────────────────────────────────────────────────────────────
  { name: 'telegram-concursos-uy',        schedule: '20 * * * *',  route: '/telegram-concursos',   body: { pais: 'UY', max: 12, horas: 48 } },

  // ── Scrapers (por país/tanda, mismo body que Supabase) ─────────────────
  { name: 'scraper-resumen-diario',       schedule: '0 9 * * *',   route: '/scraper-concursos', body: { modo: 'resumen' } },
  { name: 'scraper-brasil-exclusivo',     schedule: '0 5 * * *',   route: '/scraper-concursos', body: { pais: 'BR' } },
  { name: 'scraper-europa-1',             schedule: '0 6 * * *',   route: '/scraper-concursos', body: { paises: ['FR', 'IT', 'CH'] } },
  { name: 'scraper-europa-2',             schedule: '20 6 * * *',  route: '/scraper-concursos', body: { paises: ['DE', 'SE', 'NO'] } },
  { name: 'scraper-jp-india',             schedule: '40 6 * * *',  route: '/scraper-concursos', body: { paises: ['JP', 'IN'] } },
  { name: 'scraper-centroamerica',        schedule: '0 7 * * *',   route: '/scraper-concursos', body: { paises: ['CU', 'SV', 'HN', 'NI', 'PA', 'DO'] } },
  { name: 'scraper-us-solo',              schedule: '20 7 * * *',  route: '/scraper-concursos', body: { paises: ['US'] } },
  { name: 'scraper-concursos-mediodia',   schedule: '0 15 * * *',  route: '/scraper-concursos', body: { paises: ['UY', 'AR', 'BR'] } },
  { name: 'scraper-brasil-tarde',         schedule: '0 17 * * *',  route: '/scraper-concursos', body: { pais: 'BR' } },
  { name: 'scraper-concursos-noche',      schedule: '0 23 * * *',  route: '/scraper-concursos', body: { paises: ['CL', 'CO', 'PE', 'PY', 'BO', 'EC', 'MX', 'VE', 'CR', 'GT', 'ES', 'PT'] } },
];

function iniciarCronInterno() {
  for (const job of JOBS) {
    cron.schedule(job.schedule, async () => {
      const t0 = Date.now();
      try {
        const r = await fetch(`${BASE}${job.route}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(job.body),
        });
        console.log(`[cron] ${job.name} -> ${job.route} HTTP ${r.status} (${Date.now() - t0}ms)`);
      } catch (e) {
        console.log(`[cron] ${job.name} -> ${job.route} ERROR: ${e.message}`);
      }
    });
  }
  console.log(`[cron] scheduler interno activo — ${JOBS.length} jobs registrados`);
}

module.exports = { iniciarCronInterno, JOBS };
