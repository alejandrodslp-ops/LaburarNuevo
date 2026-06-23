-- ============================================================
-- KONEXU — Schema completo exportado desde Supabase
-- Generado automáticamente. NO editar manualmente.
-- ============================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS "calificaciones" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "propuesta_id" uuid,
  "calificador_id" uuid NOT NULL,
  "calificado_id" uuid NOT NULL,
  "rol_calificador" text NOT NULL,
  "factor_comunicacion" smallint NOT NULL,
  "factor_cumplimiento" smallint NOT NULL,
  "factor_recomendacion" smallint NOT NULL,
  "promedio" numeric(3,2) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "comprobantes" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "employer_id" uuid NOT NULL,
  "numero" text NOT NULL,
  "fecha" timestamp with time zone DEFAULT now(),
  "monto" numeric(10,2) NOT NULL,
  "moneda" text DEFAULT 'USD'::text,
  "metodo" text NOT NULL,
  "referencia_externa" text,
  "razon_social" text,
  "rut_nit" text,
  "email" text,
  "concepto" text DEFAULT 'Suscripción Konexu'::text,
  "estado" text DEFAULT 'emitido'::text,
  "html_url" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "concurso_matches" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "concurso_id" uuid,
  "worker_id" uuid,
  "score" integer DEFAULT 0,
  "cumple" boolean DEFAULT false,
  "keywords_match" text[],
  "notificado" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "concursos" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "fuente_id" text NOT NULL,
  "fuente" text NOT NULL,
  "pais" text NOT NULL DEFAULT 'UY'::text,
  "numero_llamado" text,
  "titulo" text NOT NULL,
  "cargo" text,
  "organismo" text,
  "descripcion" text,
  "requisitos" text,
  "tipo_tarea" text,
  "tipo_vinculo" text,
  "lugar" text,
  "fecha_inicio" timestamp with time zone,
  "fecha_cierre" timestamp with time zone,
  "puestos" integer DEFAULT 1,
  "url_detalle" text,
  "url_postulacion" text,
  "keywords" text[],
  "activo" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "config" (
  "clave" text NOT NULL,
  "valor" text NOT NULL,
  "descripcion" text
);

CREATE TABLE IF NOT EXISTS "llamados" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "pais" text NOT NULL,
  "organismo" text,
  "cargo" text NOT NULL,
  "descripcion" text,
  "requisitos" text[],
  "idiomas" text[],
  "escolaridad" text,
  "fecha_apertura" date,
  "fecha_cierre" date,
  "url_original" text,
  "activo" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "mensajes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "sender_id" uuid,
  "receiver_id" uuid,
  "texto" text NOT NULL,
  "leido" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "sender_display_name" text,
  "updated_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "mercado_rubros" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "fecha" date NOT NULL,
  "pais" varchar(2) NOT NULL,
  "rubro" varchar(50) NOT NULL,
  "total_empleos" integer NOT NULL,
  "actualizado_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "mercado_stats" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "fecha" date NOT NULL DEFAULT CURRENT_DATE,
  "pais" text NOT NULL,
  "total_empleos" bigint NOT NULL,
  "actualizado_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ofertas" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "employer_id" uuid,
  "titulo" text NOT NULL,
  "descripcion" text,
  "empleo" text,
  "sueldo_min" numeric,
  "sueldo_max" numeric,
  "sueldo_tipo" text DEFAULT 'a_acordar'::text,
  "lugar" text,
  "carga_horaria" text,
  "idiomas" text[],
  "escolaridad" text,
  "habilidades" text[],
  "ciudad" text,
  "pais" text,
  "activa" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "keywords" text[] DEFAULT '{}'::text[],
  "experiencia_min" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "pagos" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "monto" numeric NOT NULL,
  "moneda" text DEFAULT 'USD'::text,
  "estado" text DEFAULT 'pendiente'::text,
  "metodo" text,
  "referencia_externa" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "postulaciones" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "oferta_id" uuid,
  "trabajador_id" uuid,
  "mensaje" text,
  "estado" text DEFAULT 'pendiente'::text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "profiles" (
  "id" uuid NOT NULL,
  "nombre" text,
  "nombre2" text,
  "apellido1" text,
  "apellido2" text,
  "fecha_nac" text,
  "sexo" text,
  "estado_civil" text,
  "nacionalidad" text,
  "telefono" text,
  "bio" text,
  "pais" text,
  "ciudad" text,
  "barrio" text,
  "servicios" text[],
  "profesiones" text[],
  "especialidades" text[],
  "disponibilidad" text,
  "tipos_empleo" text[],
  "idiomas" text[],
  "referencias" boolean DEFAULT false,
  "perfil_visible" boolean DEFAULT false,
  "perfil_activo" boolean DEFAULT false,
  "perfil_activo_hasta" timestamp with time zone,
  "rating" numeric DEFAULT 0,
  "total_valoraciones" integer DEFAULT 0,
  "vistas" integer DEFAULT 0,
  "contactos" integer DEFAULT 0,
  "rol" text DEFAULT 'worker'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "empleo_buscado" text,
  "direccion" text,
  "modo_activo" text DEFAULT 'worker'::text,
  "es_trabajador" boolean DEFAULT true,
  "es_empleador" boolean DEFAULT false,
  "avatar_url" text,
  "fecha_activacion" timestamp with time zone,
  "es_empresa" boolean DEFAULT false,
  "rubro" text,
  "rut" text,
  "suscripcion_activa" boolean DEFAULT false,
  "suscripcion_plan" text,
  "suscripcion_fecha" timestamp with time zone,
  "visualizaciones_disponibles" integer DEFAULT 0,
  "anios_experiencia" integer,
  "sueldo_pretension_min" numeric,
  "sueldo_pretension_max" numeric,
  "sueldo_moneda" text DEFAULT 'USD'::text,
  "codigo_referido" text,
  "referido_por" text,
  "dias_extra" integer DEFAULT 0,
  "periodo_gratis_hasta" timestamp with time zone,
  "membresia_hasta" timestamp with time zone,
  "push_token" text,
  "suspendido" boolean DEFAULT false,
  "suspendido_motivo" text,
  "suspendido_at" timestamp with time zone,
  "total_reportes" integer DEFAULT 0,
  "telefono_verificado" boolean DEFAULT false,
  "telefono_otp" text,
  "telefono_otp_expiry" timestamp with time zone,
  "tecnicaturas" text[] DEFAULT '{}'::text[],
  "email_verificado" boolean DEFAULT false,
  "email_otp" text,
  "email_otp_expiry" timestamp with time zone,
  "nomada_digital" boolean DEFAULT false,
  "idiomas_trabajo" text[] DEFAULT '{}'::text[],
  "expo_push_token" text,
  "estrellas" numeric(3,2) DEFAULT NULL::numeric,
  "total_calificaciones" integer DEFAULT 0,
  "identidad_estado" text,
  "identidad_url" text,
  "identidad_motivo_rechazo" text,
  "descripcion_libre" text,
  "busqueda_diaria_on" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS "propuestas" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "employer_id" uuid NOT NULL,
  "worker_id" uuid NOT NULL,
  "employer_nombre" text,
  "oferta" jsonb,
  "estado" text NOT NULL DEFAULT 'pendiente'::text,
  "motivo_rechazo" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "respondida_at" timestamp with time zone,
  "encuesta_worker_sent" boolean DEFAULT false,
  "encuesta_employer_sent" boolean DEFAULT false,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "reportes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "reportado_id" uuid,
  "reportado_por" uuid,
  "motivo" text NOT NULL,
  "detalle" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "revisado" boolean DEFAULT false,
  "revisado_at" timestamp with time zone,
  "accion_tomada" text
);

CREATE TABLE IF NOT EXISTS "scraper_alertas" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "pais" text NOT NULL,
  "llamados_antes" integer NOT NULL,
  "llamados_despues" integer NOT NULL,
  "pct_caida" integer NOT NULL,
  "mensaje" text NOT NULL,
  "resuelta" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "scraper_logs" (
  "id" bigint NOT NULL DEFAULT nextval('scraper_logs_id_seq'::regclass),
  "pais" text NOT NULL,
  "ejecutado_en" timestamp with time zone DEFAULT now(),
  "total_scrapeados" integer DEFAULT 0,
  "total_insertados" integer DEFAULT 0,
  "activos_antes" integer DEFAULT 0,
  "activos_despues" integer DEFAULT 0,
  "errores" text[] DEFAULT '{}'::text[],
  "ok" boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS "stats" (
  "key" text NOT NULL,
  "value" bigint NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "valoraciones" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "worker_id" uuid,
  "employer_id" uuid,
  "rating" integer,
  "comentario" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "visualizaciones" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "employer_id" uuid,
  "worker_id" uuid,
  "fecha" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "waitlist" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "email" text NOT NULL,
  "nombre" text,
  "posicion" integer NOT NULL DEFAULT nextval('waitlist_posicion_seq'::regclass),
  "push_token" text,
  "habilitado" boolean DEFAULT false,
  "habilitado_at" timestamp with time zone,
  "registrado" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "pais" text
);

CREATE TABLE IF NOT EXISTS "waitlist_config" (
  "id" integer NOT NULL DEFAULT 1,
  "activo" boolean DEFAULT true,
  "batch_size" integer DEFAULT 100,
  "max_cola_pendiente" integer DEFAULT 300,
  "umbral_activos_hora" integer DEFAULT 500,
  "intervalo_minutos" integer DEFAULT 60,
  "ultimo_lote_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "waitlist_lotes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cantidad" integer NOT NULL,
  "notificados" integer DEFAULT 0,
  "activos_hora" integer DEFAULT 0,
  "carga_pct" integer DEFAULT 0,
  "batch_size_usado" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_propuesta_id_fkey" FOREIGN KEY (propuesta_id) REFERENCES "propuestas" (id) ON DELETE CASCADE;
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_pkey" PRIMARY KEY (id);
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_propuesta_id_calificador_id_key" UNIQUE (propuesta_id, propuesta_id, calificador_id, calificador_id);
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_employer_id_fkey" FOREIGN KEY (employer_id) REFERENCES "profiles" (id) ON DELETE CASCADE;
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_pkey" PRIMARY KEY (id);
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_numero_key" UNIQUE (numero);
ALTER TABLE "concurso_matches" ADD CONSTRAINT "concurso_matches_concurso_id_fkey" FOREIGN KEY (concurso_id) REFERENCES "concursos" (id) ON DELETE CASCADE;
ALTER TABLE "concurso_matches" ADD CONSTRAINT "concurso_matches_worker_id_fkey" FOREIGN KEY (worker_id) REFERENCES "profiles" (id) ON DELETE CASCADE;
ALTER TABLE "concurso_matches" ADD CONSTRAINT "concurso_matches_pkey" PRIMARY KEY (id);
ALTER TABLE "concurso_matches" ADD CONSTRAINT "concurso_matches_concurso_id_worker_id_key" UNIQUE (concurso_id, concurso_id, worker_id, worker_id);
ALTER TABLE "concursos" ADD CONSTRAINT "concursos_pkey" PRIMARY KEY (id);
ALTER TABLE "concursos" ADD CONSTRAINT "concursos_fuente_fuente_id_key" UNIQUE (fuente, fuente, fuente_id, fuente_id);
ALTER TABLE "config" ADD CONSTRAINT "config_pkey" PRIMARY KEY (clave);
ALTER TABLE "llamados" ADD CONSTRAINT "llamados_pkey" PRIMARY KEY (id);
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES "None" (None);
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES "None" (None);
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_pkey" PRIMARY KEY (id);
ALTER TABLE "mercado_rubros" ADD CONSTRAINT "mercado_rubros_pkey" PRIMARY KEY (id);
ALTER TABLE "mercado_rubros" ADD CONSTRAINT "mercado_rubros_fecha_pais_rubro_key" UNIQUE (fecha, fecha, fecha, pais, pais, pais, rubro, rubro, rubro);
ALTER TABLE "mercado_stats" ADD CONSTRAINT "mercado_stats_pkey" PRIMARY KEY (id);
ALTER TABLE "mercado_stats" ADD CONSTRAINT "mercado_stats_fecha_pais_key" UNIQUE (fecha, fecha, pais, pais);
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_employer_id_fkey" FOREIGN KEY (employer_id) REFERENCES "None" (None);
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_pkey" PRIMARY KEY (id);
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "None" (None);
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pkey" PRIMARY KEY (id);
ALTER TABLE "postulaciones" ADD CONSTRAINT "postulaciones_oferta_id_fkey" FOREIGN KEY (oferta_id) REFERENCES "ofertas" (id) ON DELETE CASCADE;
ALTER TABLE "postulaciones" ADD CONSTRAINT "postulaciones_trabajador_id_fkey" FOREIGN KEY (trabajador_id) REFERENCES "profiles" (id) ON DELETE CASCADE;
ALTER TABLE "postulaciones" ADD CONSTRAINT "postulaciones_pkey" PRIMARY KEY (id);
ALTER TABLE "postulaciones" ADD CONSTRAINT "postulaciones_oferta_id_trabajador_id_key" UNIQUE (oferta_id, oferta_id, trabajador_id, trabajador_id);
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_codigo_referido_key" UNIQUE (codigo_referido);
ALTER TABLE "propuestas" ADD CONSTRAINT "propuestas_employer_id_fkey" FOREIGN KEY (employer_id) REFERENCES "profiles" (id) ON DELETE CASCADE;
ALTER TABLE "propuestas" ADD CONSTRAINT "propuestas_worker_id_fkey" FOREIGN KEY (worker_id) REFERENCES "profiles" (id) ON DELETE CASCADE;
ALTER TABLE "propuestas" ADD CONSTRAINT "propuestas_pkey" PRIMARY KEY (id);
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_reportado_id_fkey" FOREIGN KEY (reportado_id) REFERENCES "profiles" (id) ON DELETE CASCADE;
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_reportado_por_fkey" FOREIGN KEY (reportado_por) REFERENCES "profiles" (id) ON DELETE SET NULL;
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_pkey" PRIMARY KEY (id);
ALTER TABLE "scraper_alertas" ADD CONSTRAINT "scraper_alertas_pkey" PRIMARY KEY (id);
ALTER TABLE "scraper_logs" ADD CONSTRAINT "scraper_logs_pkey" PRIMARY KEY (id);
ALTER TABLE "stats" ADD CONSTRAINT "stats_pkey" PRIMARY KEY (key);
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_employer_id_fkey" FOREIGN KEY (employer_id) REFERENCES "None" (None);
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_worker_id_fkey" FOREIGN KEY (worker_id) REFERENCES "None" (None);
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_pkey" PRIMARY KEY (id);
ALTER TABLE "visualizaciones" ADD CONSTRAINT "visualizaciones_employer_id_fkey" FOREIGN KEY (employer_id) REFERENCES "profiles" (id);
ALTER TABLE "visualizaciones" ADD CONSTRAINT "visualizaciones_worker_id_fkey" FOREIGN KEY (worker_id) REFERENCES "profiles" (id);
ALTER TABLE "visualizaciones" ADD CONSTRAINT "visualizaciones_pkey" PRIMARY KEY (id);
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY (id);
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_email_key" UNIQUE (email);
ALTER TABLE "waitlist_config" ADD CONSTRAINT "waitlist_config_pkey" PRIMARY KEY (id);
ALTER TABLE "waitlist_lotes" ADD CONSTRAINT "waitlist_lotes_pkey" PRIMARY KEY (id);

CREATE INDEX idx_comprobantes_employer ON public.comprobantes USING btree (employer_id);
CREATE INDEX idx_comprobantes_numero ON public.comprobantes USING btree (numero);
CREATE INDEX idx_matches_pendientes_notif ON public.concurso_matches USING btree (cumple, notificado, score DESC) WHERE ((cumple = true) AND (notificado = false));
CREATE INDEX idx_matches_worker_cumple ON public.concurso_matches USING btree (worker_id, cumple);
CREATE INDEX idx_matches_worker_score ON public.concurso_matches USING btree (worker_id, score DESC);
CREATE INDEX idx_concursos_activo ON public.concursos USING btree (activo);
CREATE INDEX idx_concursos_activo_created ON public.concursos USING btree (created_at DESC) WHERE (activo = true);
CREATE INDEX idx_concursos_fecha_cierre ON public.concursos USING btree (fecha_cierre) WHERE (activo = true);
CREATE INDEX idx_concursos_keywords ON public.concursos USING gin (keywords);
CREATE INDEX idx_concursos_pais_activo ON public.concursos USING btree (pais, activo);
CREATE INDEX idx_concursos_pais_activo_created ON public.concursos USING btree (pais, activo, created_at DESC) WHERE (activo = true);
CREATE INDEX idx_mensajes_created ON public.mensajes USING btree (created_at);
CREATE INDEX idx_mensajes_receiver ON public.mensajes USING btree (receiver_id);
CREATE INDEX idx_mensajes_sender ON public.mensajes USING btree (sender_id);
CREATE INDEX idx_mercado_stats_fecha ON public.mercado_stats USING btree (fecha DESC);
CREATE INDEX idx_mercado_stats_pais_fecha ON public.mercado_stats USING btree (pais, fecha DESC);
CREATE INDEX ofertas_keywords_idx ON public.ofertas USING gin (keywords);
CREATE INDEX idx_pagos_estado ON public.pagos USING btree (estado);
CREATE INDEX idx_pagos_estado_created ON public.pagos USING btree (estado, created_at DESC);
CREATE UNIQUE INDEX idx_pagos_referencia_externa ON public.pagos USING btree (referencia_externa) WHERE (referencia_externa IS NOT NULL);
CREATE INDEX idx_pagos_user_id ON public.pagos USING btree (user_id);
CREATE INDEX idx_profiles_activo ON public.profiles USING btree (perfil_activo);
CREATE INDEX idx_profiles_activo_hasta ON public.profiles USING btree (perfil_activo, perfil_activo_hasta) WHERE (perfil_activo = true);
CREATE INDEX idx_profiles_busqueda_diaria ON public.profiles USING btree (busqueda_diaria_on) WHERE (busqueda_diaria_on = true);
CREATE INDEX idx_profiles_created ON public.profiles USING btree (created_at);
CREATE INDEX idx_profiles_desc_libre_trgm ON public.profiles USING gin (to_tsvector('simple'::regconfig, COALESCE(descripcion_libre, ''::text)));
CREATE INDEX idx_profiles_especialidades ON public.profiles USING gin (especialidades);
CREATE INDEX idx_profiles_pais ON public.profiles USING btree (pais);
CREATE INDEX idx_profiles_profesiones ON public.profiles USING gin (profesiones);
CREATE INDEX idx_profiles_push_token ON public.profiles USING btree (expo_push_token) WHERE (expo_push_token IS NOT NULL);
CREATE INDEX idx_profiles_servicios ON public.profiles USING gin (servicios);
CREATE INDEX idx_profiles_updated ON public.profiles USING btree (updated_at);
CREATE INDEX idx_propuestas_employer ON public.propuestas USING btree (employer_id);
CREATE INDEX idx_propuestas_worker ON public.propuestas USING btree (worker_id, estado);
CREATE INDEX idx_reportes_por_reportado ON public.reportes USING btree (reportado_por, reportado_id);
CREATE INDEX idx_reportes_reportado ON public.reportes USING btree (reportado_id);
CREATE INDEX idx_reportes_reportado_revisado ON public.reportes USING btree (reportado_id, revisado);
CREATE INDEX idx_reportes_revisado ON public.reportes USING btree (revisado);
CREATE INDEX idx_scraper_alertas_pais ON public.scraper_alertas USING btree (pais);
CREATE INDEX idx_scraper_alertas_resuelta ON public.scraper_alertas USING btree (resuelta, created_at DESC);
CREATE INDEX scraper_logs_pais_idx ON public.scraper_logs USING btree (pais, ejecutado_en DESC);
CREATE INDEX idx_waitlist_email ON public.waitlist USING btree (email);
CREATE INDEX idx_waitlist_habilitado ON public.waitlist USING btree (habilitado, registrado);
CREATE INDEX idx_waitlist_posicion ON public.waitlist USING btree (posicion);

-- Row Level Security
ALTER TABLE "calificaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "concurso_matches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "concursos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "llamados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mensajes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mercado_rubros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mercado_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ofertas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pagos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "postulaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "propuestas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reportes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scraper_alertas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scraper_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "valoraciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visualizaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waitlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waitlist_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waitlist_lotes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calificador_inserta" ON "calificaciones" FOR INSERT WITH CHECK ((auth.uid() = calificador_id));
CREATE POLICY "ver_propias" ON "calificaciones" FOR SELECT USING (((auth.uid() = calificado_id) OR (auth.uid() = calificador_id)));
CREATE POLICY "comprobantes_insert" ON "comprobantes" FOR INSERT WITH CHECK (true);
CREATE POLICY "comprobantes_own" ON "comprobantes" FOR SELECT USING ((auth.uid() = employer_id));
CREATE POLICY "comprobantes_update" ON "comprobantes" FOR UPDATE USING (true);
CREATE POLICY "matches_insert" ON "concurso_matches" FOR INSERT WITH CHECK (false);
CREATE POLICY "matches_select" ON "concurso_matches" FOR SELECT USING ((auth.uid() = worker_id));
CREATE POLICY "matches_update" ON "concurso_matches" FOR UPDATE USING (false);
CREATE POLICY "concursos_insert" ON "concursos" FOR INSERT WITH CHECK (false);
CREATE POLICY "concursos_select" ON "concursos" FOR SELECT USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "concursos_update" ON "concursos" FOR UPDATE USING (false);
CREATE POLICY "lectura publica concursos" ON "concursos" FOR SELECT TO anon USING ((activo = true));
CREATE POLICY "Users can insert own messages" ON "mensajes" FOR INSERT WITH CHECK ((auth.uid() = sender_id));
CREATE POLICY "Users can read own messages" ON "mensajes" FOR SELECT USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));
CREATE POLICY "Users can update own messages" ON "mensajes" FOR UPDATE USING ((auth.uid() = receiver_id));
CREATE POLICY "mensajes_propios" ON "mensajes" FOR ALL USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));
CREATE POLICY "mercado_stats_public_read" ON "mercado_stats" FOR SELECT USING (true);
CREATE POLICY "empleador_sus_ofertas" ON "ofertas" FOR ALL USING ((auth.uid() = employer_id)) WITH CHECK ((auth.uid() = employer_id));
CREATE POLICY "ofertas_modify" ON "ofertas" FOR ALL USING ((auth.uid() = employer_id)) WITH CHECK ((auth.uid() = employer_id));
CREATE POLICY "ofertas_select" ON "ofertas" FOR SELECT USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "ofertas_visibles" ON "ofertas" FOR SELECT USING ((activa = true));
CREATE POLICY "pagos_insert" ON "pagos" FOR INSERT WITH CHECK (false);
CREATE POLICY "pagos_propios" ON "pagos" FOR ALL USING ((auth.uid() = user_id));
CREATE POLICY "pagos_select" ON "pagos" FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY "postulaciones_empleador" ON "postulaciones" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ofertas
  WHERE ((ofertas.id = postulaciones.oferta_id) AND (ofertas.employer_id = auth.uid())))));
CREATE POLICY "postulaciones_trabajador" ON "postulaciones" FOR ALL USING ((auth.uid() = trabajador_id)) WITH CHECK ((auth.uid() = trabajador_id));
CREATE POLICY "profiles_delete" ON "profiles" FOR DELETE USING (false);
CREATE POLICY "profiles_insert" ON "profiles" FOR INSERT WITH CHECK ((auth.uid() = id));
CREATE POLICY "profiles_select" ON "profiles" FOR SELECT USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "profiles_update" ON "profiles" FOR UPDATE USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "propuestas_own" ON "propuestas" FOR ALL USING (((auth.uid() = employer_id) OR (auth.uid() = worker_id)));
CREATE POLICY "employers_insert_own" ON "visualizaciones" FOR INSERT WITH CHECK ((employer_id = auth.uid()));
CREATE POLICY "employers_select_own" ON "visualizaciones" FOR SELECT USING ((employer_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.activar_perfil_gratis()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE profiles 
  SET 
    perfil_activo = true,
    periodo_gratis_hasta = NOW() + INTERVAL '10 days',
    perfil_activo_hasta = NOW() + INTERVAL '10 days'
  WHERE id = NEW.id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_score_match(p_worker_id uuid, p_concurso_id uuid)
 RETURNS TABLE(score integer, cumple boolean, keywords_match text[])
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_pais_iso    TEXT;
  v_ciudad      TEXT;
  v_keywords    TEXT[];
  v_c_keywords  TEXT[];
  v_c_pais      TEXT;
  v_c_lugar     TEXT;
  v_matched     TEXT[];
  v_score       INT := 0;
  kw            TEXT;
  ckw           TEXT;
BEGIN
  -- Datos del worker
  SELECT
    pais_a_iso(p.pais),
    p.ciudad,
    array_cat(
      array_cat(
        coalesce(p.servicios, '{}'),
        coalesce(p.profesiones, '{}')
      ),
      coalesce(p.especialidades, '{}')
    )
  INTO v_pais_iso, v_ciudad, v_keywords
  FROM profiles p WHERE p.id = p_worker_id;

  -- Datos del concurso
  SELECT c.keywords, c.pais, c.lugar
  INTO v_c_keywords, v_c_pais, v_c_lugar
  FROM concursos c WHERE c.id = p_concurso_id;

  -- Sin keywords = score 0
  IF coalesce(array_length(v_keywords, 1), 0) = 0
     OR coalesce(array_length(v_c_keywords, 1), 0) = 0 THEN
    RETURN QUERY SELECT 0::INT, false, '{}'::TEXT[];
    RETURN;
  END IF;

  -- Match keyword a keyword (normalizado, substring bidireccional)
  v_matched := '{}';
  FOREACH kw IN ARRAY v_keywords LOOP
    FOREACH ckw IN ARRAY v_c_keywords LOOP
      IF normalizar_texto(ckw) = normalizar_texto(kw)
         OR normalizar_texto(ckw) LIKE '%' || normalizar_texto(kw) || '%'
         OR normalizar_texto(kw)  LIKE '%' || normalizar_texto(ckw) || '%'
      THEN
        IF NOT (normalizar_texto(kw) = ANY(v_matched)) THEN
          v_matched := array_append(v_matched, kw);
        END IF;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  -- Score base (0-80)
  v_score := round(
    (cardinality(v_matched)::FLOAT / array_length(v_keywords, 1)::FLOAT) * 80
  )::INT;

  -- Bonus pa√≠s (+15)
  IF v_pais_iso = v_c_pais THEN v_score := v_score + 15; END IF;

  -- Bonus ciudad (+5)
  IF v_ciudad IS NOT NULL AND v_c_lugar IS NOT NULL THEN
    IF normalizar_texto(v_c_lugar) LIKE '%' || normalizar_texto(v_ciudad) || '%'
       OR normalizar_texto(v_ciudad) LIKE '%' || normalizar_texto(v_c_lugar) || '%'
    THEN v_score := v_score + 5; END IF;
  END IF;

  v_score := LEAST(v_score, 100);

  RETURN QUERY SELECT v_score, v_score >= 40, v_matched;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.contar_concursos_por_pais()
 RETURNS TABLE(pais text, total bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT pais, COUNT(*)::bigint as total FROM concursos WHERE activo=true AND (fecha_cierre IS NULL OR fecha_cierre >= CURRENT_DATE) GROUP BY pais ORDER BY COUNT(*) DESC; $function$
;

CREATE OR REPLACE FUNCTION public.count_concursos_activos()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$ SELECT value FROM stats WHERE key = 'concursos_activos' $function$
;

CREATE OR REPLACE FUNCTION public.count_concursos_por_pais()
 RETURNS TABLE(pais text, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT pais::text, COUNT(*)::bigint as total
  FROM concursos
  WHERE activo = true
  GROUP BY pais
  ORDER BY total DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.generar_codigo_referido()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.codigo_referido := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.incrementar_vistas_simuladas()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  total_actualizados integer;
BEGIN
  UPDATE profiles
  SET vistas = COALESCE(vistas, 0) +
    CASE
      WHEN (NOW() - COALESCE(created_at, NOW())) < INTERVAL '14 days'
        THEN (2 + floor(random() * 3))::int   -- 2, 3 o 4
      WHEN (NOW() - COALESCE(created_at, NOW())) < INTERVAL '31 days'
        THEN (3 + floor(random() * 4))::int   -- 3, 4, 5 o 6
      ELSE
        (4 + floor(random() * 5))::int        -- 4, 5, 6, 7 u 8
    END
  WHERE rol = 'worker'
    AND (suspendido IS NULL OR suspendido = false);

  GET DIAGNOSTICS total_actualizados = ROW_COUNT;
  RETURN jsonb_build_object('actualizados', total_actualizados);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.match_concurso_vs_workers(p_concurso_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_pais        TEXT;
  v_keywords    TEXT[];
  v_count       INT := 0;
  r             RECORD;
  v_score       INT;
  v_cumple      BOOL;
  v_matched     TEXT[];
BEGIN
  SELECT pais, keywords INTO v_pais, v_keywords
  FROM concursos WHERE id = p_concurso_id;

  IF v_keywords IS NULL OR array_length(v_keywords, 1) = 0 THEN RETURN 0; END IF;

  -- Filtrar solo workers del mismo pa√≠s cuyas keywords tengan overlap
  -- El operador && usa el GIN index ‚Üí rapid√≠simo aunque haya 200M workers
  FOR r IN
    SELECT p.id
    FROM profiles p
    WHERE p.rol = 'worker'
      AND p.perfil_activo = true
      AND pais_a_iso(p.pais) = v_pais
      AND (
        coalesce(p.servicios, '{}')      && v_keywords OR
        coalesce(p.profesiones, '{}')    && v_keywords OR
        coalesce(p.especialidades, '{}') && v_keywords
      )
  LOOP
    SELECT s, c, km INTO v_score, v_cumple, v_matched
    FROM calcular_score_match(r.id, p_concurso_id) AS t(s INT, c BOOL, km TEXT[]);

    INSERT INTO concurso_matches
      (concurso_id, worker_id, score, cumple, keywords_match, notificado)
    VALUES
      (p_concurso_id, r.id, v_score, v_cumple, v_matched, false)
    ON CONFLICT (concurso_id, worker_id) DO UPDATE
      SET score = EXCLUDED.score,
          cumple = EXCLUDED.cumple,
          keywords_match = EXCLUDED.keywords_match,
          updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.match_worker_vs_concursos(p_worker_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_pais_iso    TEXT;
  v_keywords    TEXT[];
  v_count       INT := 0;
  r             RECORD;
  v_score       INT;
  v_cumple      BOOL;
  v_matched     TEXT[];
  hoy           DATE := CURRENT_DATE;
BEGIN
  SELECT
    pais_a_iso(p.pais),
    array_cat(array_cat(
      coalesce(p.servicios, '{}'),
      coalesce(p.profesiones, '{}')),
      coalesce(p.especialidades, '{}')
    )
  INTO v_pais_iso, v_keywords
  FROM profiles p WHERE p.id = p_worker_id AND p.rol = 'worker';

  IF v_keywords IS NULL OR array_length(v_keywords, 1) = 0 THEN RETURN 0; END IF;

  -- Solo concursos activos del mismo pa√≠s con keywords que coincidan
  FOR r IN
    SELECT c.id
    FROM concursos c
    WHERE c.activo = true
      AND c.pais = v_pais_iso
      AND (c.fecha_cierre IS NULL OR c.fecha_cierre >= hoy)
      AND c.keywords && v_keywords  -- GIN index
  LOOP
    SELECT s, c2, km INTO v_score, v_cumple, v_matched
    FROM calcular_score_match(p_worker_id, r.id) AS t(s INT, c2 BOOL, km TEXT[]);

    INSERT INTO concurso_matches
      (concurso_id, worker_id, score, cumple, keywords_match, notificado)
    VALUES
      (r.id, p_worker_id, v_score, v_cumple, v_matched, false)
    ON CONFLICT (concurso_id, worker_id) DO UPDATE
      SET score = EXCLUDED.score,
          cumple = EXCLUDED.cumple,
          keywords_match = EXCLUDED.keywords_match,
          notificado = false,
          updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.normalizar_texto(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT lower(
    regexp_replace(
      translate(
        coalesce(t, ''),
        '√°√†√§√¢√£√©√®√´√™√≠√¨√Ø√Æ√≥√≤√∂√¥√µ√∫√π√º√ª√±√Å√Ä√Ñ√Ç√É√â√à√ã√ä√ç√å√è√é√ì√í√ñ√î√ï√ö√ô√ú√õ√ë',
        'aaaaaeeeeiiiioooooouuuunAAAAAEEEEIIIIOOOOOUUUUN'
      ),
      '[^a-zA-Z0-9 ]', ' ', 'g'
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.pais_a_iso(pais text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE lower(trim(coalesce(pais, '')))
    WHEN 'uruguay'   THEN 'UY'
    WHEN 'argentina' THEN 'AR'
    WHEN 'chile'     THEN 'CL'
    WHEN 'colombia'  THEN 'CO'
    WHEN 'peru'      THEN 'PE'
    WHEN 'per√∫'      THEN 'PE'
    WHEN 'brasil'    THEN 'BR'
    WHEN 'brazil'    THEN 'BR'
    WHEN 'paraguay'  THEN 'PY'
    WHEN 'bolivia'   THEN 'BO'
    WHEN 'ecuador'   THEN 'EC'
    WHEN 'venezuela' THEN 'VE'
    ELSE upper(substring(trim(pais), 1, 2))
  END;
$function$
;

CREATE OR REPLACE FUNCTION public.procesar_referido(p_referido_por text, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_referidor_id uuid;
begin
  -- Buscar quien invito
  select id into v_referidor_id from profiles where codigo_referido = p_referido_por;
  
  if v_referidor_id is not null then
    -- Guardar quien refirió al nuevo usuario
    update profiles set referido_por = p_referido_por where id = p_user_id;
    -- Extender 5 días al referidor
    update profiles set dias_extra = coalesce(dias_extra, 0) + 5 where id = v_referidor_id;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recalcular_estrellas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE profiles
  SET
    estrellas = (SELECT ROUND(AVG(promedio)::numeric, 2) FROM calificaciones WHERE calificado_id = NEW.calificado_id),
    total_calificaciones = (SELECT COUNT(*) FROM calificaciones WHERE calificado_id = NEW.calificado_id)
  WHERE id = NEW.calificado_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rematch_worker(p_worker_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_count INT;
BEGIN
  SELECT match_worker_vs_concursos(p_worker_id) INTO v_count;
  RETURN json_build_object('ok', true, 'matches', v_count);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sumar_visualizaciones(employer_id uuid, cantidad integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ BEGIN IF cantidad <= 0 OR cantidad > 10000 THEN RAISE EXCEPTION 'cantidad inválida: %', cantidad; END IF; UPDATE profiles SET visualizaciones_disponibles = COALESCE(visualizaciones_disponibles, 0) + cantidad WHERE id = employer_id; END; $function$
;

CREATE OR REPLACE FUNCTION public.trigger_match_concurso_nuevo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- No bloquear el insert ‚Äî lanzar en background
  PERFORM match_concurso_vs_workers(NEW.id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_match_perfil_actualizado()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.rol = 'worker' AND (
    NEW.servicios      IS DISTINCT FROM OLD.servicios OR
    NEW.profesiones    IS DISTINCT FROM OLD.profesiones OR
    NEW.especialidades IS DISTINCT FROM OLD.especialidades OR
    NEW.pais           IS DISTINCT FROM OLD.pais
  ) THEN
    PERFORM match_worker_vs_concursos(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $function$
;
