require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// KONEXU BACKEND — Node.js/Express
// Carpeta de MIGRACIÓN de Supabase Edge Functions
// NO está en producción. NO afecta la app actual.
// Ver README.md para instrucciones de migración y deploy a Hetzner.
// ─────────────────────────────────────────────────────────────────────────────

// ── Email / Notificaciones ───────────────────────────────────────────────────
app.use('/enviar-soporte',       require('./routes/enviar-soporte'));       // ✅ lógica migrada
app.use('/enviar-encuestas',     require('./routes/enviar-encuestas'));     // ✅ lógica migrada
app.use('/mensaje-bienvenida',   require('./routes/mensaje-bienvenida'));   // ✅ lógica migrada
app.use('/notificar-propuesta',  require('./routes/notificar-propuesta'));  // ✅ lógica migrada
app.use('/notificar-matches',    require('./routes/notificar-matches'));    // ✅ lógica migrada
app.use('/send-apk-link',        require('./routes/send-apk-link'));        // ✅ lógica migrada

// ── Verificaciones ───────────────────────────────────────────────────────────
app.use('/verificar-email',      require('./routes/verificar-email'));      // ✅ lógica migrada
app.use('/verificar-telefono',   require('./routes/verificar-telefono'));   // ✅ lógica migrada
app.use('/verificar-imagen',     require('./routes/verificar-imagen'));     // ✅ lógica migrada

// ── Usuarios ─────────────────────────────────────────────────────────────────
app.use('/reportar',             require('./routes/reportar'));             // ✅ lógica migrada
app.use('/simular-visitas',      require('./routes/simular-visitas'));      // ✅ lógica migrada

// ── Waitlist ─────────────────────────────────────────────────────────────────
app.use('/waitlist',             require('./routes/waitlist'));             // ✅ lógica migrada
app.use('/waitlist-autorizador', require('./routes/waitlist-autorizador')); // ✅ lógica migrada

// ── Matching y búsqueda ──────────────────────────────────────────────────────
app.use('/match-concursos',      require('./routes/match-concursos'));      // ✅ lógica migrada
app.use('/busqueda-diaria',      require('./routes/busqueda-diaria'));      // ✅ lógica migrada (dep: scraper.js)

// ── CV y perfil ──────────────────────────────────────────────────────────────
app.use('/cv-audio',             require('./routes/cv-audio'));             // ✅ lógica migrada (dep: multer + Groq)

// ── Admin ────────────────────────────────────────────────────────────────────
app.use('/admin-data',           require('./routes/admin-data'));           // ✅ lógica migrada

// ── Comprobantes ─────────────────────────────────────────────────────────────
app.use('/generar-comprobante',  require('./routes/generar-comprobante')); // ✅ lógica migrada

// ── Pagos MercadoPago ────────────────────────────────────────────────────────
app.use('/crear-pago',           require('./routes/crear-pago'));           // ✅ lógica migrada
app.use('/webhook-pago',         require('./routes/webhook-pago'));         // ✅ lógica migrada (HMAC MP)

// ── Pagos Stripe ─────────────────────────────────────────────────────────────
app.use('/crear-pago-stripe',    require('./routes/crear-pago-stripe'));    // ✅ lógica migrada

// ── Pagos PIX (Banco Rendimento — pendiente activación) ──────────────────────
app.use('/gerar-pix',            require('./routes/gerar-pix'));            // ✅ lógica migrada
app.use('/criar-pago-pix',       require('./routes/criar-pago-pix'));       // ✅ lógica migrada
app.use('/ativar-via-pix',       require('./routes/ativar-via-pix'));       // ✅ lógica migrada
app.use('/whatsapp-pix-bot',     require('./routes/whatsapp-pix-bot'));     // ✅ lógica migrada

// ── Scrapers ─────────────────────────────────────────────────────────────────
app.use('/scraper-concursos',    require('./routes/scraper-concursos'));    // ✅ lógica migrada (33 países)
app.use('/scraper-mercado',      require('./routes/scraper-mercado'));      // ✅ lógica migrada
app.use('/vigilante-scraper',    require('./routes/vigilante-scraper'));    // ✅ lógica migrada

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[konexu-backend] corriendo en :${PORT}`));
