-- Tabla de ofertas laborales publicadas por empleadores registrados
CREATE TABLE IF NOT EXISTS ofertas (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  titulo          TEXT        NOT NULL,
  descripcion     TEXT,
  requisitos      TEXT,
  cargo           TEXT,
  pais            CHAR(2),
  ciudad          TEXT,
  modalidad       TEXT        DEFAULT 'presencial',  -- presencial, remoto, hibrido
  tipo_contrato   TEXT,                              -- full_time, part_time, contrato, freelance
  salario_min     NUMERIC,
  salario_max     NUMERIC,
  moneda          TEXT        DEFAULT 'USD',
  activa          BOOLEAN     DEFAULT true,
  vistas          INTEGER     DEFAULT 0,
  postulaciones   INTEGER     DEFAULT 0,
  fecha_cierre    DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ofertas_pais_idx      ON ofertas(pais);
CREATE INDEX IF NOT EXISTS ofertas_ciudad_idx    ON ofertas(ciudad);
CREATE INDEX IF NOT EXISTS ofertas_employer_idx  ON ofertas(employer_id);
CREATE INDEX IF NOT EXISTS ofertas_activa_idx    ON ofertas(activa);
CREATE INDEX IF NOT EXISTS ofertas_created_idx   ON ofertas(created_at DESC);

ALTER TABLE ofertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ofertas_employer_rw    ON ofertas;
DROP POLICY IF EXISTS ofertas_public_select  ON ofertas;

-- Empleadores pueden CRUD sus propias ofertas
CREATE POLICY ofertas_employer_rw ON ofertas
  USING (auth.uid() = employer_id)
  WITH CHECK (auth.uid() = employer_id);

-- Cualquiera puede ver ofertas activas
CREATE POLICY ofertas_public_select ON ofertas
  FOR SELECT USING (activa = true);
