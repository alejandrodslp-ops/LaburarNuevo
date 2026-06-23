const { db } = require('./supabase');

// Verifica el JWT de Supabase Auth y adjunta el user al request
// Compatible con el mismo token que usa la app hoy — no necesita migrar Auth
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No autorizado' });

  const token = header.replace('Bearer ', '');
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'No autorizado' });

  req.user = user;
  next();
}

module.exports = { requireAuth };
