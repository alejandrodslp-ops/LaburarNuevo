// backend/server.js
// ══════════════════════════════════════════════════════════════
// SERVIDOR BACKEND COMPLETO — Node.js + Express
//
// Seguridad implementada:
// 1. Helmet — headers HTTP de seguridad
// 2. Rate limiting — máximo de peticiones por IP
// 3. CORS configurado — solo acepta la app autorizada
// 4. Sanitización de inputs — limpia datos peligrosos
// 5. JWT con expiración — tokens que vencen solos
// 6. Bcrypt — contraseñas nunca guardadas en texto plano
// 7. SSL/TLS — comunicación encriptada (configurado en hosting)
// 8. Variables de entorno — claves nunca en el código
// ══════════════════════════════════════════════════════════════

require('dotenv').config();
const express       = require('express');
const helmet        = require('helmet');
const cors          = require('cors');
const rateLimit     = require('express-rate-limit');
const bcrypt        = require('bcryptjs');
const jwt           = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const sanitize      = require('sanitize-html');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Supabase (base de datos + auth) ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// ════════════════════════════════════════
// MIDDLEWARES DE SEGURIDAD
// ════════════════════════════════════════

// Helmet: agrega ~14 headers HTTP de seguridad automáticamente
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'"],
      imgSrc:     ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge:            31536000, // 1 año
    includeSubDomains: true,
    preload:           true,
  },
}));

// CORS: solo acepta peticiones de la app Laburar
app.use(cors({
  origin: [
    'https://laburar.com',
    'exp://localhost:8081', // Expo en desarrollo
  ],
  methods:     ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Version', 'X-Platform', 'X-Request-ID'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' })); // Limitar tamaño del body

// Rate limiting global: máximo 100 peticiones por 15 minutos por IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message:  { error: 'Demasiadas peticiones. Intentá en unos minutos.' },
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use(globalLimiter);

// Rate limiting para autenticación: más estricto
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10, // Solo 10 intentos de login por 15 minutos
  message:  { error: 'Demasiados intentos. Esperá 15 minutos.' },
});

// ════════════════════════════════════════
// FUNCIONES DE SEGURIDAD
// ════════════════════════════════════════

// Generar JWT con expiración
function generateTokens(userId, role) {
  const sessionToken = jwt.sign(
    { userId, role, type: 'session' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' },
  );
  return { sessionToken, refreshToken };
}

// Verificar JWT
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// Middleware de autenticación
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const token   = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  req.user = decoded;
  next();
}

// Sanitizar texto del usuario
function sanitizeInput(text) {
  if (!text || typeof text !== 'string') return text;
  return sanitize(text, { allowedTags: [], allowedAttributes: {} }).trim();
}

// Sanitizar objeto completo
function sanitizeBody(obj) {
  if (!obj) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = typeof value === 'string' ? sanitizeInput(value) : value;
  }
  return result;
}

// ════════════════════════════════════════
// RUTAS DE AUTENTICACIÓN
// ════════════════════════════════════════

// POST /auth/register
app.post('/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password_hash, role, name, accepted_terms, accepted_at } = sanitizeBody(req.body);

    // Validar campos requeridos
    if (!email || !password_hash || !role || !name) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    if (!accepted_terms) {
      return res.status(400).json({ error: 'Debés aceptar los términos y condiciones' });
    }
    if (!['worker', 'employer', 'company'].includes(role)) {
      return res.status(400).json({ error: 'Rol no válido' });
    }

    // Verificar si el email ya existe
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Este email ya está registrado' });
    }

    // El servidor TAMBIÉN hashea con bcrypt (el cliente ya hizo SHA256)
    // Así aunque intercepten la petición, no pueden usar el hash directamente
    const BCRYPT_ROUNDS = 12; // Mayor número = más seguro pero más lento
    const finalHash = await bcrypt.hash(password_hash, BCRYPT_ROUNDS);

    // Insertar usuario en la base de datos
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email:          email.toLowerCase(),
        password_hash:  finalHash,
        role,
        name,
        accepted_terms,
        accepted_at,
        is_active:      true,
        profile_active: false, // Se activa cuando paga
        created_at:     new Date().toISOString(),
      })
      .select('id, email, role, name, profile_active, created_at')
      .single();

    if (error) throw error;

    const tokens = generateTokens(newUser.id, newUser.role);

    // Guardar refresh token (hasheado) en la base de datos
    await supabase.from('refresh_tokens').insert({
      user_id:    newUser.id,
      token_hash: await bcrypt.hash(tokens.refreshToken, 10),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    res.status(201).json({
      user:          newUser,
      session_token: tokens.sessionToken,
      refresh_token: tokens.refreshToken,
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error al registrar. Intentá de nuevo.' });
  }
});

// POST /auth/login
app.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password_hash } = sanitizeBody(req.body);

    if (!email || !password_hash) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    // Buscar usuario
    const { data: user } = await supabase
      .from('users')
      .select('id, email, password_hash, role, name, profile_active, is_active')
      .eq('email', email.toLowerCase())
      .single();

    // Siempre comparar (aunque no exista) para evitar timing attacks
    const storedHash = user?.password_hash || '$2a$12$invalidhashtopreventtiming';
    const valid      = await bcrypt.compare(password_hash, storedHash);

    if (!user || !valid) {
      // Mensaje genérico — no revelar si el email existe o no
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Cuenta suspendida. Contactá soporte.' });
    }

    const tokens = generateTokens(user.id, user.role);

    // Actualizar último login
    await supabase.from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    const { password_hash: _, ...safeUser } = user;

    res.json({
      user:          safeUser,
      session_token: tokens.sessionToken,
      refresh_token: tokens.refreshToken,
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error al iniciar sesión. Intentá de nuevo.' });
  }
});

// POST /auth/refresh
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(401).json({ error: 'Refresh token requerido' });
    }

    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Buscar y verificar el token en la base de datos
    const { data: storedTokens } = await supabase
      .from('refresh_tokens')
      .select('token_hash, expires_at, is_revoked')
      .eq('user_id', decoded.userId)
      .eq('is_revoked', false)
      .gt('expires_at', new Date().toISOString());

    let validToken = null;
    for (const stored of (storedTokens || [])) {
      if (await bcrypt.compare(refresh_token, stored.token_hash)) {
        validToken = stored;
        break;
      }
    }

    if (!validToken) {
      return res.status(401).json({ error: 'Token expirado o inválido' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, role, is_active')
      .eq('id', decoded.userId)
      .single();

    if (!user?.is_active) {
      return res.status(403).json({ error: 'Cuenta suspendida' });
    }

    const newTokens = generateTokens(user.id, user.role);
    res.json({
      session_token: newTokens.sessionToken,
      refresh_token: newTokens.refreshToken,
    });

  } catch (error) {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
});

// POST /auth/logout
app.post('/auth/logout', authenticate, async (req, res) => {
  try {
    // Revocar todos los refresh tokens del usuario
    await supabase.from('refresh_tokens')
      .update({ is_revoked: true })
      .eq('user_id', req.user.userId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

// ════════════════════════════════════════
// RUTAS DE USUARIO
// ════════════════════════════════════════

// GET /users/me — Perfil propio
app.get('/users/me', authenticate, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id, email, role, name, bio, category, zone,
        availability, preferences, profile_active,
        profile_expires_at, views_count, contacts_count,
        always_visible, rating_avg, rating_count,
        created_at, last_login
      `)
      .eq('id', req.user.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// PUT /users/me — Actualizar perfil
app.put('/users/me', authenticate, async (req, res) => {
  try {
    // Campos que el usuario PUEDE modificar (whitelist)
    const ALLOWED_FIELDS = [
      'name', 'bio', 'category', 'zone', 'availability',
      'preferences', 'always_visible', 'languages',
      'certifications', 'experience',
    ];

    const body    = sanitizeBody(req.body);
    const updates = {};

    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.userId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// ════════════════════════════════════════
// RUTAS DE BÚSQUEDA
// ════════════════════════════════════════

// GET /search — Buscar trabajadores
app.get('/search', authenticate, async (req, res) => {
  try {
    const { category, zone, available, min_rating, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('users')
      .select(`
        id, name, bio, category, zone, availability,
        rating_avg, rating_count, always_visible, profile_active
      `)
      .eq('role', 'worker')
      .eq('profile_active', true)
      .eq('is_active', true)
      .range(offset, offset + parseInt(limit) - 1);

    if (category) query = query.eq('category', sanitizeInput(category));
    if (zone)     query = query.ilike('zone', `%${sanitizeInput(zone)}%`);
    if (min_rating) query = query.gte('rating_avg', parseFloat(min_rating));

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ results: data, total: count, page, limit });
  } catch (error) {
    res.status(500).json({ error: 'Error en la búsqueda' });
  }
});

// ════════════════════════════════════════
// RUTAS DE PAGOS
// ════════════════════════════════════════

// POST /payments/activate — Activar perfil del trabajador
app.post('/payments/activate', authenticate, async (req, res) => {
  try {
    const { payment_method, payment_id, recurring } = sanitizeBody(req.body);

    if (!payment_method || !payment_id) {
      return res.status(400).json({ error: 'Datos de pago incompletos' });
    }

    // Calcular fecha de vencimiento (2 meses desde hoy)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 2);

    // Registrar el pago
    const { data: payment, error: payError } = await supabase
      .from('payments')
      .insert({
        user_id:        req.user.userId,
        type:           'profile_activation',
        amount:         1.00,
        currency:       'USD',
        payment_method,
        payment_id,
        status:         'completed',
        recurring,
        created_at:     new Date().toISOString(),
      })
      .select()
      .single();

    if (payError) throw payError;

    // Activar el perfil
    await supabase.from('users')
      .update({
        profile_active:     true,
        profile_expires_at: expiresAt.toISOString(),
        profile_recurring:  recurring,
        updated_at:         new Date().toISOString(),
      })
      .eq('id', req.user.userId);

    res.json({
      success:    true,
      expires_at: expiresAt.toISOString(),
      payment_id: payment.id,
    });

  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ error: 'Error al procesar el pago' });
  }
});

// ════════════════════════════════════════
// RUTAS DE DENUNCIAS
// ════════════════════════════════════════

// POST /reports — Crear denuncia
app.post('/reports', authenticate, async (req, res) => {
  try {
    const { reported_user_id, reason, details } = sanitizeBody(req.body);

    if (!reported_user_id || !reason) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // No puede denunciarse a sí mismo
    if (reported_user_id === req.user.userId) {
      return res.status(400).json({ error: 'No podés denunciarte a vos mismo' });
    }

    const VALID_REASONS = ['fake_profile', 'scam', 'inappropriate', 'abuse', 'harassment', 'other'];
    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ error: 'Motivo no válido' });
    }

    await supabase.from('reports').insert({
      reporter_id:      req.user.userId,
      reported_user_id,
      reason,
      details: details?.substring(0, 500), // Limitar longitud
      status:           'pending',
      created_at:       new Date().toISOString(),
    });

    res.json({ success: true, message: 'Denuncia recibida. La revisaremos a la brevedad.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al enviar la denuncia' });
  }
});

// ════════════════════════════════════════
// RUTAS DE FEATURE FLAGS
// ════════════════════════════════════════

// POST /config/flags — Obtener flags según contexto
app.post('/config/flags', async (req, res) => {
  try {
    const { country, role, app_version } = req.body || {};

    // Flags base
    const flags = {
      worker_profile:       true,
      search_basic:         true,
      payment_card:         true,
      payment_mercadopago:  true,
      payment_abitab:       true,
      concursa:             true,
      messages:             true,
      biometrics:           true,
      share_app:            true,
      report_system:        true,
      ratings:              true,
      multilanguage:        true,
      recurring_activation: true,

      // Saldo celular: solo en países soportados
      payment_cell: ['UY', 'AR', 'CL', 'MX', 'CO', 'PE'].includes(country?.toUpperCase()),

      // Features en desarrollo
      company_portal:      false,
      admin_panel:         role === 'admin',
      push_notifications:  false,
      analytics_dashboard: role === 'admin',
    };

    res.json(flags);
  } catch (error) {
    res.status(500).json({});
  }
});

// ════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    version:   process.env.APP_VERSION || '1.0.0',
  });
});

// ════════════════════════════════════════
// MANEJO DE ERRORES GLOBAL
// ════════════════════════════════════════

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  // Nunca exponer detalles del error al cliente
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Iniciar servidor ──
app.listen(PORT, () => {
  console.log(`Laburar API corriendo en puerto ${PORT}`);
});

module.exports = app;
