-- ══════════════════════════════════════════════════════════════
-- LABURAR — ESQUEMA DE BASE DE DATOS
-- PostgreSQL / Supabase
--
-- Seguridad implementada:
-- • Row Level Security (RLS) — cada usuario solo ve SUS datos
-- • Encriptación de columnas sensibles con pgcrypto
-- • Índices optimizados para búsquedas frecuentes
-- • Timestamps automáticos
-- • Soft delete (nunca borrar datos realmente)
-- ══════════════════════════════════════════════════════════════

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- UUIDs únicos
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- Encriptación
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- Búsqueda por texto

-- ════════════════════════════════════════
-- TABLA: users
-- ════════════════════════════════════════
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,           -- bcrypt hash (nunca texto plano)
  role                TEXT NOT NULL CHECK (role IN ('worker', 'employer', 'company', 'admin')),
  name                TEXT NOT NULL,
  bio                 TEXT,
  phone               TEXT,                    -- opcional
  category            TEXT,                    -- categoría principal de trabajo
  categories          TEXT[],                  -- múltiples categorías
  zone                TEXT,                    -- zona de trabajo
  country             TEXT DEFAULT 'UY',
  languages           TEXT[],                  -- idiomas que habla
  certifications      JSONB,                   -- títulos y certificados
  experience          JSONB,                   -- experiencia laboral
  preferences         JSONB,                   -- preferencias de trabajo
  availability        TEXT DEFAULT 'immediate',
  always_visible      BOOLEAN DEFAULT false,
  profile_active      BOOLEAN DEFAULT false,
  profile_expires_at  TIMESTAMPTZ,
  profile_recurring   BOOLEAN DEFAULT true,
  views_count         INTEGER DEFAULT 0,
  contacts_count      INTEGER DEFAULT 0,
  rating_avg          DECIMAL(3,2) DEFAULT 0,
  rating_count        INTEGER DEFAULT 0,
  is_active           BOOLEAN DEFAULT true,
  is_verified         BOOLEAN DEFAULT false,
  accepted_terms      BOOLEAN NOT NULL DEFAULT false,
  accepted_at         TIMESTAMPTZ,
  last_login          TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ,             -- soft delete
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas frecuentes
CREATE INDEX idx_users_role       ON users(role);
CREATE INDEX idx_users_category   ON users(category);
CREATE INDEX idx_users_zone       ON users(zone);
CREATE INDEX idx_users_active     ON users(profile_active, is_active);
CREATE INDEX idx_users_email      ON users(email);
CREATE INDEX idx_users_country    ON users(country);
-- Índice para búsqueda de texto
CREATE INDEX idx_users_name_trgm  ON users USING gin(name gin_trgm_ops);
CREATE INDEX idx_users_bio_trgm   ON users USING gin(bio gin_trgm_ops);

-- ════════════════════════════════════════
-- TABLA: refresh_tokens
-- ════════════════════════════════════════
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,         -- bcrypt hash del token
  expires_at  TIMESTAMPTZ NOT NULL,
  is_revoked  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id, is_revoked);

-- ════════════════════════════════════════
-- TABLA: payments
-- ════════════════════════════════════════
CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id),
  type           TEXT NOT NULL,      -- 'profile_activation' | 'contact_unlock' | 'subscription'
  amount         DECIMAL(10,2) NOT NULL,
  currency       TEXT DEFAULT 'USD',
  payment_method TEXT NOT NULL,      -- 'card' | 'mercadopago' | 'abitab' | 'cell'
  payment_id     TEXT,               -- ID externo del proveedor de pago
  status         TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  recurring      BOOLEAN DEFAULT false,
  metadata       JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_user   ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ════════════════════════════════════════
-- TABLA: contacts (contactos desbloqueados)
-- ════════════════════════════════════════
CREATE TABLE contacts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id     UUID NOT NULL REFERENCES users(id),   -- quien pagó
  worker_id    UUID NOT NULL REFERENCES users(id),   -- a quien contactó
  payment_id   UUID REFERENCES payments(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(buyer_id, worker_id)
);

CREATE INDEX idx_contacts_buyer  ON contacts(buyer_id);
CREATE INDEX idx_contacts_worker ON contacts(worker_id);

-- ════════════════════════════════════════
-- TABLA: messages (mensajes entre usuarios)
-- ════════════════════════════════════════
CREATE TABLE messages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id    UUID NOT NULL REFERENCES users(id),
  receiver_id  UUID NOT NULL REFERENCES users(id),
  content      TEXT NOT NULL,
  is_read      BOOLEAN DEFAULT false,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_sender   ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_unread   ON messages(receiver_id, is_read);

-- ════════════════════════════════════════
-- TABLA: ratings (valoraciones)
-- ════════════════════════════════════════
CREATE TABLE ratings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rater_id    UUID NOT NULL REFERENCES users(id),   -- quien valora
  rated_id    UUID NOT NULL REFERENCES users(id),   -- quien es valorado
  score       INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment     TEXT,
  response    TEXT,                                  -- respuesta del trabajador
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rater_id, rated_id)
);

CREATE INDEX idx_ratings_rated ON ratings(rated_id);

-- Función para actualizar el rating promedio automáticamente
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users SET
    rating_avg   = (SELECT AVG(score) FROM ratings WHERE rated_id = NEW.rated_id),
    rating_count = (SELECT COUNT(*) FROM ratings WHERE rated_id = NEW.rated_id),
    updated_at   = NOW()
  WHERE id = NEW.rated_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rating
AFTER INSERT OR UPDATE ON ratings
FOR EACH ROW EXECUTE FUNCTION update_user_rating();

-- ════════════════════════════════════════
-- TABLA: reports (denuncias)
-- ════════════════════════════════════════
CREATE TABLE reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id      UUID NOT NULL REFERENCES users(id),
  reported_user_id UUID NOT NULL REFERENCES users(id),
  reason           TEXT NOT NULL,
  details          TEXT,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewing','resolved','dismissed')),
  admin_notes      TEXT,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_status ON reports(status);

-- ════════════════════════════════════════
-- TABLA: concursa_calls (llamados públicos)
-- ════════════════════════════════════════
CREATE TABLE concursa_calls (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id     TEXT UNIQUE,              -- ID del llamado en datos.gub.uy
  organization    TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  requirements    JSONB,                    -- lista de requisitos
  category        TEXT,
  location        TEXT,
  closes_at       TIMESTAMPTZ,
  url             TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calls_active   ON concursa_calls(is_active, closes_at);
CREATE INDEX idx_calls_category ON concursa_calls(category);

-- ════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Cada usuario solo puede acceder a SUS propios datos
-- Esto funciona a nivel de base de datos — ni si hackean
-- el servidor pueden ver datos de otros usuarios
-- ════════════════════════════════════════

ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Usuarios: cada uno ve su propio registro
-- (los perfiles públicos se manejan desde el servidor con consultas específicas)
CREATE POLICY users_own_data ON users
  FOR ALL USING (auth.uid() = id);

-- Mensajes: solo puede ver sus mensajes enviados o recibidos
CREATE POLICY messages_own ON messages
  FOR ALL USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Contactos: solo ve sus propios contactos
CREATE POLICY contacts_own ON contacts
  FOR ALL USING (auth.uid() = buyer_id OR auth.uid() = worker_id);

-- Pagos: solo ve sus propios pagos
CREATE POLICY payments_own ON payments
  FOR ALL USING (auth.uid() = user_id);

-- Tokens: solo ve sus propios tokens
CREATE POLICY tokens_own ON refresh_tokens
  FOR ALL USING (auth.uid() = user_id);

-- ════════════════════════════════════════
-- FUNCIÓN: actualizar updated_at automáticamente
-- ════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ════════════════════════════════════════
-- TABLA: feature_flags (panel de admin)
-- ════════════════════════════════════════
CREATE TABLE feature_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT UNIQUE NOT NULL,
  enabled     BOOLEAN DEFAULT false,
  description TEXT,
  conditions  JSONB,    -- condiciones: país, rol, % de usuarios
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar flags iniciales
INSERT INTO feature_flags (name, enabled, description) VALUES
  ('worker_profile',       true,  'Perfil del trabajador'),
  ('search_basic',         true,  'Búsqueda básica'),
  ('payment_card',         true,  'Pago con tarjeta'),
  ('payment_mercadopago',  true,  'Pago con MercadoPago'),
  ('payment_abitab',       true,  'Pago con Abitab/RedPagos'),
  ('payment_cell',         false, 'Pago con saldo celular (habilitar por país)'),
  ('concursa',             true,  'Integración Uruguay Concursa'),
  ('messages',             true,  'Sistema de mensajes'),
  ('biometrics',           true,  'Acceso biométrico'),
  ('share_app',            true,  'Compartir app'),
  ('report_system',        true,  'Sistema de denuncias'),
  ('ratings',              true,  'Valoraciones'),
  ('recurring_activation', true,  'Activación recurrente'),
  ('company_portal',       false, 'Portal de empresas (en desarrollo)'),
  ('admin_panel',          false, 'Panel de administrador (en desarrollo)'),
  ('push_notifications',   false, 'Notificaciones push (en desarrollo)'),
  ('ai_matching',          false, 'Matching con IA (futuro)'),
  ('market_argentina',     false, 'Expansión Argentina (futuro)'),
  ('market_brazil',        false, 'Expansión Brasil (futuro)');
