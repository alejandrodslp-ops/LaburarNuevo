-- ============================================================
-- KONEXU — pg_dump REAL (verbatim), sacado con Docker en konexu-prod
-- Generado: 2026-09-25 | Reemplaza toda reconstrucción manual anterior
-- (la de 2026-09-09 nunca se commiteó y se perdió en un reset de esta sesión)
-- 33 tablas, 35 políticas RLS, 38 funciones — fuente de verdad real, no reconstruida.
-- ============================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "btree_gin" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."activar_perfil_gratis"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update profiles set
    perfil_activo        = true,
    periodo_gratis_hasta = now() + interval '10 days',
    perfil_activo_hasta  = now() + interval '10 days',
    fecha_activacion     = now()
  where id = new.id;
  return new;
end;
$$;


ALTER FUNCTION "public"."activar_perfil_gratis"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."buscar_concursos_alerta"("p_pais" "text", "p_desde" timestamp with time zone, "p_terminos" "text"[]) RETURNS TABLE("id" "uuid", "titulo" "text", "cargo" "text", "organismo" "text", "pais" "text", "lugar" "text", "url_detalle" "text")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
  v_or_parts     text[] := '{}';
  v_term         text;
  v_words        text[];
  v_word         text;
  v_word_esc     text;
  v_titulo_parts text[];
  v_cargo_parts  text[];
  v_where        text;
BEGIN
  IF p_pais IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_term IN ARRAY p_terminos LOOP
    v_words := regexp_split_to_array(trim(coalesce(v_term, '')), '\s+');
    v_titulo_parts := '{}';
    v_cargo_parts  := '{}';
    FOREACH v_word IN ARRAY v_words LOOP
      v_word := replace(replace(v_word, '%', ''), '_', '');
      IF v_word = '' THEN
        CONTINUE;
      END IF;
      -- Coincidencia por palabra COMPLETA o + plural simple (s/es), no por
      -- cualquier prefijo abierto: "vendedor" sigue encontrando "vendedores"
      -- (el caso bueno), pero "monitor" ya NO encuentra "monitorización"
      -- (2026-09-13: caso real, alerta a anmatesanz@gmail.com con match falso).
      -- \m = inicio de palabra, \M = fin de palabra (Postgres ARE).
      v_word_esc := regexp_replace(v_word, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g');
      v_titulo_parts := v_titulo_parts || format('public.f_unaccent(lower(c.titulo)) ~ %L', '\m' || v_word_esc || '(s|es)?\M');
      v_cargo_parts  := v_cargo_parts  || format('public.f_unaccent(lower(c.cargo)) ~ %L',  '\m' || v_word_esc || '(s|es)?\M');
    END LOOP;
    IF array_length(v_titulo_parts, 1) IS NULL THEN
      CONTINUE;
    END IF;
    v_or_parts := v_or_parts || ('(' || array_to_string(v_titulo_parts, ' AND ') ||
                  ' OR ' || array_to_string(v_cargo_parts, ' AND ') || ')');
  END LOOP;

  IF array_length(v_or_parts, 1) IS NULL THEN
    RETURN;
  END IF;

  v_where := array_to_string(v_or_parts, ' OR ');

  RETURN QUERY EXECUTE format($q$
    SELECT c.id, c.titulo, c.cargo, c.organismo, c.pais, c.lugar, c.url_detalle
    FROM concursos c
    WHERE c.activo = true
      AND c.pais = %L
      AND c.created_at > %L::timestamptz
      AND (%s)
    ORDER BY c.created_at DESC
    LIMIT 30
  $q$, p_pais, p_desde, v_where);
END
$_$;


ALTER FUNCTION "public"."buscar_concursos_alerta"("p_pais" "text", "p_desde" timestamp with time zone, "p_terminos" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."buscar_concursos_alerta_similitud"("p_pais" "text", "p_desde" timestamp with time zone, "p_frase" "text", "p_umbral" real DEFAULT 0.3) RETURNS TABLE("id" "uuid", "titulo" "text", "cargo" "text", "organismo" "text", "pais" "text", "lugar" "text", "url_detalle" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  IF p_pais IS NULL OR p_frase IS NULL OR trim(p_frase) = '' THEN
    RETURN;
  END IF;

  PERFORM public.set_limit(p_umbral);

  RETURN QUERY
  SELECT c.id, c.titulo, c.cargo, c.organismo, c.pais, c.lugar, c.url_detalle
  FROM concursos c
  WHERE c.activo = true
    AND c.pais = p_pais
    AND c.created_at > p_desde
    AND (
      public.f_unaccent(lower(c.titulo)) % public.f_unaccent(lower(p_frase))
      OR public.f_unaccent(lower(c.cargo)) % public.f_unaccent(lower(p_frase))
    )
  ORDER BY GREATEST(
    similarity(public.f_unaccent(lower(c.titulo)), public.f_unaccent(lower(p_frase))),
    similarity(public.f_unaccent(lower(c.cargo)),  public.f_unaccent(lower(p_frase)))
  ) DESC
  LIMIT 30;
END;
$$;


ALTER FUNCTION "public"."buscar_concursos_alerta_similitud"("p_pais" "text", "p_desde" timestamp with time zone, "p_frase" "text", "p_umbral" real) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcular_score_match"("p_worker_id" "uuid", "p_concurso_id" "uuid") RETURNS TABLE("score" integer, "cumple" boolean, "keywords_match" "text"[])
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."calcular_score_match"("p_worker_id" "uuid", "p_concurso_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consumir_visualizacion"("p_worker" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_employer uuid := auth.uid();
  v_saldo    int;
begin
  if v_employer is null then return 'no_auth'; end if;
  if p_worker is null then return 'sin_worker'; end if;

  if not exists (select 1 from ofertas where employer_id = v_employer and estado = 'aprobada') then
    return 'sin_oferta_aprobada';
  end if;

  if exists (select 1 from visualizaciones where employer_id = v_employer and worker_id = p_worker) then
    return 'ya_vista';
  end if;

  select coalesce(visualizaciones_disponibles, 0) into v_saldo from profiles where id = v_employer;
  if v_saldo <= 0 then return 'sin_saldo'; end if;

  insert into visualizaciones (employer_id, worker_id) values (v_employer, p_worker);
  update profiles set visualizaciones_disponibles = v_saldo - 1 where id = v_employer;

  return 'ok';
end;
$$;


ALTER FUNCTION "public"."consumir_visualizacion"("p_worker" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consumir_visualizacion_empresa"("p_worker" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_company uuid := auth.uid();
  v_rol text;
  v_sub boolean;
  v_plan text;
  v_hoy int;
  v_sem int;
  v_inicio_semana date;
  v_worker_pais text;
begin
  if v_company is null then return 'no_auth'; end if;
  if p_worker is null then return 'sin_worker'; end if;

  select rol into v_rol from public.profiles where id = v_company;
  if v_rol is distinct from 'company' then return 'no_autorizado'; end if;

  if not exists (select 1 from ofertas where employer_id = v_company and estado = 'aprobada') then
    return 'sin_oferta_aprobada';
  end if;

  if exists (select 1 from visualizaciones where employer_id = v_company and worker_id = p_worker) then
    return 'ya_vista';
  end if;

  select coalesce(p.suscripcion_activa,false) and coalesce(p.suscripcion_vence_at, 'epoch') > now(),
         p.suscripcion_plan
    into v_sub, v_plan from profiles p where p.id = v_company;

  if v_sub and v_plan = 'membresia_sa' then
    select pais into v_worker_pais from profiles where id = p_worker;
    if not es_pais_sudamerica(v_worker_pais) then
      return 'fuera_de_region';
    end if;
  end if;

  v_inicio_semana := (date_trunc('week', (now() at time zone 'America/Montevideo')))::date;

  select count(distinct worker_id) into v_hoy from visualizaciones
    where employer_id = v_company
      and (created_at at time zone 'America/Montevideo')::date = (now() at time zone 'America/Montevideo')::date;
  select count(distinct worker_id) into v_sem from visualizaciones
    where employer_id = v_company
      and (created_at at time zone 'America/Montevideo')::date >= v_inicio_semana;

  if v_sub and v_plan = 'membresia_premium' then
    null;
  elsif v_sub then
    if v_hoy >= 10 then return 'sin_cupo_diario'; end if;
  else
    if v_hoy >= 3 then return 'sin_cupo_diario'; end if;
    if v_sem >= 9 then return 'sin_cupo_semanal'; end if;
  end if;

  insert into visualizaciones (employer_id, worker_id) values (v_company, p_worker);
  return 'ok';
end;
$$;


ALTER FUNCTION "public"."consumir_visualizacion_empresa"("p_worker" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."contar_concursos_por_pais"() RETURNS TABLE("pais" "text", "total" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT pais, total FROM stats_por_pais ORDER BY total DESC;
$$;


ALTER FUNCTION "public"."contar_concursos_por_pais"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_concursos_activos"() RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$ SELECT value FROM stats WHERE key = 'concursos_activos' $$;


ALTER FUNCTION "public"."count_concursos_activos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_concursos_por_pais"() RETURNS TABLE("pais" "text", "total" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "statement_timeout" TO '30s'
    AS $$
  SELECT pais::text, COUNT(*)::bigint as total
  FROM concursos WHERE activo = true
  GROUP BY pais ORDER BY total DESC;
$$;


ALTER FUNCTION "public"."count_concursos_por_pais"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crons_fallidos_24h"() RETURNS TABLE("jobname" "text", "fallos" bigint, "ultimo_error" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'cron', 'public'
    AS $$
  select c.jobname::text,
         count(*) as fallos,
         max(left(coalesce(j.return_message,''), 200)) as ultimo_error
  from cron.job_run_details j
  join cron.job c on c.jobid = j.jobid
  where j.status = 'failed'
    and j.start_time > now() - interval '24 hours'
  group by c.jobname
  order by 2 desc;
$$;


ALTER FUNCTION "public"."crons_fallidos_24h"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cupo_empresa_restante"() RETURNS TABLE("suscripcion_activa" boolean, "vistas_hoy" integer, "vistas_semana" integer, "restante_hoy" integer, "restante_semana" integer, "restante_efectivo" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_company uuid := auth.uid();
  v_plan text;
  v_vigente boolean;
  v_hoy int;
  v_sem int;
  v_inicio_semana date;
begin
  select p.suscripcion_plan,
         coalesce(p.suscripcion_activa,false) and coalesce(p.suscripcion_vence_at, 'epoch') > now()
    into v_plan, v_vigente
    from profiles p where p.id = v_company;

  v_inicio_semana := (date_trunc('week', (now() at time zone 'America/Montevideo')))::date;

  select count(distinct worker_id) into v_hoy
    from visualizaciones
    where employer_id = v_company
      and (created_at at time zone 'America/Montevideo')::date = (now() at time zone 'America/Montevideo')::date;

  select count(distinct worker_id) into v_sem
    from visualizaciones
    where employer_id = v_company
      and (created_at at time zone 'America/Montevideo')::date >= v_inicio_semana;

  return query select
    coalesce(v_vigente, false),
    v_hoy,
    v_sem,
    case
      when v_vigente and v_plan = 'membresia_premium' then 999999
      when v_vigente then greatest(10 - v_hoy, 0)
      else greatest(3 - v_hoy, 0)
    end,
    case
      when v_vigente and v_plan = 'membresia_premium' then 999999
      when v_vigente then 999999
      else greatest(9 - v_sem, 0)
    end,
    case
      when v_vigente and v_plan = 'membresia_premium' then 999999
      when v_vigente then greatest(10 - v_hoy, 0)
      else least(greatest(3 - v_hoy, 0), greatest(9 - v_sem, 0))
    end;
end;
$$;


ALTER FUNCTION "public"."cupo_empresa_restante"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_cupo_propuestas"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_rol text;
  v_resultado text;
begin
  if current_user in ('service_role','postgres') then
    return NEW;
  end if;

  -- Sin esto, un worker podia forjar employer_id=<cualquier empresa> (la RLS de
  -- propuestas permite auth.uid()=worker_id tambien) y el trigger evaluaba el
  -- cupo de la victima en vez de rechazar directamente.
  if NEW.employer_id is distinct from auth.uid() then
    raise exception 'No autorizado: employer_id debe coincidir con el usuario autenticado';
  end if;

  v_rol := public.get_rol_ofertas_trigger(NEW.employer_id);

  if v_rol = 'company' then
    v_resultado := public.consumir_visualizacion_empresa(NEW.worker_id);
  else
    v_resultado := public.consumir_visualizacion(NEW.worker_id);
  end if;

  -- Lista de permitidos, no de bloqueados: cualquier codigo de retorno nuevo o
  -- inesperado de cualquiera de las 2 RPC falla CERRADO, no abierto.
  if v_resultado not in ('ok', 'ya_vista') then
    raise exception 'Sin cupo disponible para contactar este perfil (%)', v_resultado;
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."enforce_cupo_propuestas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_estado_ofertas"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if current_user in ('service_role', 'postgres') then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    NEW.estado := 'pendiente';
    NEW.motivo_rechazo := null;
    NEW.activa := true;
  elsif TG_OP = 'UPDATE' and (
    NEW.titulo is distinct from OLD.titulo
    or NEW.descripcion is distinct from OLD.descripcion
    or NEW.empleo is distinct from OLD.empleo
    or NEW.requisitos is distinct from OLD.requisitos
    or NEW.beneficios is distinct from OLD.beneficios
    or NEW.contacto_email is distinct from OLD.contacto_email
    or NEW.contacto_whatsapp is distinct from OLD.contacto_whatsapp
    or NEW.lugar is distinct from OLD.lugar
  ) then
    NEW.estado := 'pendiente';
    NEW.motivo_rechazo := null;
    NEW.activa := true;
  else
    NEW.estado := OLD.estado;
    NEW.motivo_rechazo := OLD.motivo_rechazo;
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."enforce_estado_ofertas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."es_pais_sudamerica"("pais_raw" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(
    lower(trim(f_unaccent(regexp_replace(pais_raw, '^[^[:alpha:]]+', '')))) in (
      'uruguay','argentina','brasil','brazil','chile','paraguay','bolivia',
      'peru','colombia','mexico','ecuador','venezuela','cuba','costa rica',
      'panama','guatemala','el salvador','honduras','nicaragua',
      'republica dominicana'
    ),
    false
  );
$$;


ALTER FUNCTION "public"."es_pais_sudamerica"("pais_raw" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."f_unaccent"("text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT PARALLEL SAFE
    AS $_$ SELECT extensions.unaccent($1) $_$;


ALTER FUNCTION "public"."f_unaccent"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generar_codigo_referido"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.codigo_referido := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  return new;
end;
$$;


ALTER FUNCTION "public"."generar_codigo_referido"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_rol_ofertas_trigger"("p_id" "uuid") RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select rol from public.profiles where id = p_id;
$$;


ALTER FUNCTION "public"."get_rol_ofertas_trigger"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."incrementar_contactos"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update profiles set contactos = coalesce(contactos, 0) + 1 where id = new.worker_id;
  return new;
end; $$;


ALTER FUNCTION "public"."incrementar_contactos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."incrementar_vistas"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update profiles set vistas = coalesce(vistas, 0) + 1 where id = new.worker_id;
  return new;
end; $$;


ALTER FUNCTION "public"."incrementar_vistas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."incrementar_vistas_simuladas"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."incrementar_vistas_simuladas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_concurso_vs_workers"("p_concurso_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."match_concurso_vs_workers"("p_concurso_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_worker_vs_concursos"("p_worker_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."match_worker_vs_concursos"("p_worker_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalizar_texto"("t" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."normalizar_texto"("t" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obtener_datos_aceptado"("p_worker" "uuid") RETURNS TABLE("educacion" "jsonb", "experiencia" "jsonb", "certificaciones" "jsonb", "email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then return; end if;

  if not exists (
    select 1 from propuestas
    where employer_id = v_caller and worker_id = p_worker and estado = 'aceptada'
  ) then
    return;
  end if;

  return query
    select p.educacion, p.experiencia, p.certificaciones, u.email::text
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = p_worker;
end;
$$;


ALTER FUNCTION "public"."obtener_datos_aceptado"("p_worker" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pais_a_iso"("pais" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."pais_a_iso"("pais" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."procesar_referido"("p_referido_por" "text", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."procesar_referido"("p_referido_por" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_columnas_sensibles_profiles"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if current_user in ('authenticated', 'anon') then
    -- Etapa 1 — plata
    if new.visualizaciones_disponibles is distinct from old.visualizaciones_disponibles then
      raise exception 'No autorizado: visualizaciones_disponibles solo se modifica desde el servidor';
    end if;
    -- Etapa 2 — estado del perfil
    if new.perfil_activo = true and coalesce(old.perfil_activo, false) = false then
      raise exception 'No autorizado: la activación del perfil se hace desde el servidor';
    end if;
    if new.perfil_activo_hasta is distinct from old.perfil_activo_hasta then
      raise exception 'No autorizado: perfil_activo_hasta solo se modifica desde el servidor';
    end if;
    -- Etapa 3 — métricas
    if new.estrellas is distinct from old.estrellas
       or new.rating is distinct from old.rating
       or new.total_calificaciones is distinct from old.total_calificaciones
       or new.total_valoraciones is distinct from old.total_valoraciones
       or new.vistas is distinct from old.vistas
       or new.contactos is distinct from old.contactos then
      raise exception 'No autorizado: las métricas (rating/vistas/contactos) solo se modifican desde el servidor';
    end if;
    -- Etapa 4 — referidos y período gratis
    if new.referido_por is distinct from old.referido_por
       or new.codigo_referido is distinct from old.codigo_referido
       or new.periodo_gratis_hasta is distinct from old.periodo_gratis_hasta then
      raise exception 'No autorizado: referidos y período gratis solo se modifican desde el servidor';
    end if;
    -- Etapa 5 — rol y suscripcion company (agregado: el trigger de moderacion de
    -- ofertas confia en profiles.rol; sin esto cualquiera se auto-cambiaba el rol
    -- o se regalaba una suscripcion paga via PATCH directo)
    if new.rol is distinct from old.rol then
      raise exception 'No autorizado: rol solo se modifica desde el servidor';
    end if;
    if new.suscripcion_activa is distinct from old.suscripcion_activa
       or new.suscripcion_vence_at is distinct from old.suscripcion_vence_at
       or new.suscripcion_plan is distinct from old.suscripcion_plan then
      raise exception 'No autorizado: la suscripcion solo se modifica desde el servidor';
    end if;
    -- Etapa 6 (2026-09-25) — activacion recurrente PayPal del worker: sin
    -- esto, cualquiera podia pisar worker_paypal_subscription_id con el id
    -- de otra persona y cancelarle la suscripcion via cancelar-renovacion-worker.
    if new.worker_paypal_subscription_id is distinct from old.worker_paypal_subscription_id
       or new.worker_renovacion_automatica is distinct from old.worker_renovacion_automatica
       or new.worker_intentos_cobro_fallido is distinct from old.worker_intentos_cobro_fallido then
      raise exception 'No autorizado: la renovación automática solo se modifica desde el servidor';
    end if;
    -- Etapa 4B (2026-09-25) — verificacion de telefono: sin esto, alguien
    -- podia escribirse su propio telefono_otp y "verificarse" sin recibir
    -- el SMS real. telefono (el numero en si) sigue editable.
    if new.telefono_verificado is distinct from old.telefono_verificado
       or new.telefono_otp is distinct from old.telefono_otp
       or new.telefono_otp_expiry is distinct from old.telefono_otp_expiry then
      raise exception 'No autorizado: la verificación de teléfono solo se modifica desde el servidor';
    end if;
    -- Mismo agujero, mismo dia: verificar-email tiene el mismo patron OTP.
    if new.email_verificado is distinct from old.email_verificado
       or new.email_otp is distinct from old.email_otp
       or new.email_otp_expiry is distinct from old.email_otp_expiry then
      raise exception 'No autorizado: la verificación de email solo se modifica desde el servidor';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."proteger_columnas_sensibles_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalcular_estrellas"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare v_avg numeric; v_n int;
begin
  select round(avg(promedio)::numeric, 2), count(*)
    into v_avg, v_n
    from calificaciones where calificado_id = new.calificado_id;
  update profiles set
    estrellas            = v_avg,
    rating               = v_avg,
    total_calificaciones = v_n,
    total_valoraciones   = v_n
  where id = new.calificado_id;
  return new;
end; $$;


ALTER FUNCTION "public"."recalcular_estrellas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_stats_por_pais"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  INSERT INTO stats_por_pais (pais, total, updated_at)
  SELECT pais, COUNT(*)::bigint, NOW()
  FROM concursos
  WHERE activo = true AND (fecha_cierre IS NULL OR fecha_cierre >= CURRENT_DATE)
  GROUP BY pais
  ON CONFLICT (pais) DO UPDATE SET total = EXCLUDED.total, updated_at = NOW();
$$;


ALTER FUNCTION "public"."refresh_stats_por_pais"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rematch_worker"("p_worker_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_count INT;
BEGIN
  SELECT match_worker_vs_concursos(p_worker_id) INTO v_count;
  RETURN json_build_object('ok', true, 'matches', v_count);
END;
$$;


ALTER FUNCTION "public"."rematch_worker"("p_worker_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
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
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staleness_alertas_waitlist"() RETURNS TABLE("problema" "text", "detalle" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    'alertas-waitlist sin enviar' as problema,
    format(
      'Última alerta real enviada hace %s horas (límite configurado: %s hs). El cron sigue marcando "éxito" — revisar la función alertas-waitlist directamente.',
      coalesce(round(extract(epoch from (now() - max(w.ultima_alerta_at)))/3600)::text, 'nunca'),
      coalesce((select valor from config where clave = 'monitor_staleness_horas'), '30')
    ) as detalle
  from waitlist w
  where w.busqueda is not null
    and coalesce((select valor from config where clave = 'monitor_staleness_enabled'), 'true') = 'true'
  having max(w.ultima_alerta_at) is null
      or max(w.ultima_alerta_at) < now() - (
           coalesce((select valor from config where clave = 'monitor_staleness_horas'), '30') || ' hours'
         )::interval;
$$;


ALTER FUNCTION "public"."staleness_alertas_waitlist"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sumar_visualizaciones"("employer_id" "uuid", "cantidad" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ BEGIN IF cantidad <= 0 OR cantidad > 10000 THEN RAISE EXCEPTION 'cantidad inválida: %', cantidad; END IF; UPDATE profiles SET visualizaciones_disponibles = COALESCE(visualizaciones_disponibles, 0) + cantidad WHERE id = employer_id; END; $$;


ALTER FUNCTION "public"."sumar_visualizaciones"("employer_id" "uuid", "cantidad" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_match_concurso_nuevo"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF current_setting('app.skip_match_trigger', true) = 'true' THEN
    RETURN NEW;
  END IF;
  PERFORM match_concurso_vs_workers(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_match_concurso_nuevo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_match_perfil_actualizado"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."trigger_match_perfil_actualizado"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_concursos_bulk"("p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql"
    SET "statement_timeout" TO '120s'
    AS $$
DECLARE v_count integer := 0;
BEGIN
  SET LOCAL app.skip_match_trigger = 'true';

  INSERT INTO concursos (
    fuente_id, fuente, pais, numero_llamado, titulo, cargo,
    organismo, descripcion, requisitos, tipo_tarea, tipo_vinculo, lugar,
    fecha_inicio, fecha_cierre, puestos, url_detalle, url_postulacion, keywords, activo
  )
  SELECT r->>'fuente_id', r->>'fuente', r->>'pais', r->>'numero_llamado',
    r->>'titulo', r->>'cargo', r->>'organismo', r->>'descripcion',
    r->>'requisitos', r->>'tipo_tarea', r->>'tipo_vinculo', r->>'lugar',
    (r->>'fecha_inicio')::timestamptz, (r->>'fecha_cierre')::timestamptz,
    coalesce((r->>'puestos')::integer, 1),
    r->>'url_detalle', r->>'url_postulacion',
    ARRAY(SELECT jsonb_array_elements_text(r->'keywords')),
    coalesce((r->>'activo')::boolean, true)
  FROM jsonb_array_elements(p_rows) AS r
  ON CONFLICT (fuente, fuente_id) DO UPDATE SET
    titulo=EXCLUDED.titulo, cargo=EXCLUDED.cargo, organismo=EXCLUDED.organismo,
    descripcion=EXCLUDED.descripcion, tipo_vinculo=EXCLUDED.tipo_vinculo,
    tipo_tarea=EXCLUDED.tipo_tarea, lugar=EXCLUDED.lugar,
    fecha_inicio=EXCLUDED.fecha_inicio, fecha_cierre=EXCLUDED.fecha_cierre,
    url_detalle=EXCLUDED.url_detalle, url_postulacion=EXCLUDED.url_postulacion,
    keywords=EXCLUDED.keywords, activo=EXCLUDED.activo;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."upsert_concursos_bulk"("p_rows" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_pin_seguridad" (
    "id" integer DEFAULT 1 NOT NULL,
    "intentos_fallidos" integer DEFAULT 0 NOT NULL,
    "bloqueado_hasta" timestamp with time zone,
    "actualizado_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pin_hash" "text",
    CONSTRAINT "admin_pin_seguridad_singleton" CHECK (("id" = 1))
);


ALTER TABLE "public"."admin_pin_seguridad" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alertas_ciclo_estado" (
    "id" integer DEFAULT 1 NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "run_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "offset_actual" integer DEFAULT 0 NOT NULL,
    "completado" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."alertas_ciclo_estado" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alertas_ciclo_resumen" (
    "id" bigint NOT NULL,
    "run_id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "pais" "text",
    "busqueda" "text",
    "avisos" "jsonb",
    "error_msg" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."alertas_ciclo_resumen" OWNER TO "postgres";


ALTER TABLE "public"."alertas_ciclo_resumen" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."alertas_ciclo_resumen_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."alertas_enviadas" (
    "waitlist_id" "uuid" NOT NULL,
    "clave" "text" NOT NULL,
    "enviado_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."alertas_enviadas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calificaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "propuesta_id" "uuid",
    "calificador_id" "uuid" NOT NULL,
    "calificado_id" "uuid" NOT NULL,
    "rol_calificador" "text" NOT NULL,
    "factor_comunicacion" smallint NOT NULL,
    "factor_cumplimiento" smallint NOT NULL,
    "factor_recomendacion" smallint NOT NULL,
    "promedio" numeric(3,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "calificaciones_factor_comunicacion_check" CHECK ((("factor_comunicacion" >= 1) AND ("factor_comunicacion" <= 5))),
    CONSTRAINT "calificaciones_factor_cumplimiento_check" CHECK ((("factor_cumplimiento" >= 1) AND ("factor_cumplimiento" <= 5))),
    CONSTRAINT "calificaciones_factor_recomendacion_check" CHECK ((("factor_recomendacion" >= 1) AND ("factor_recomendacion" <= 5))),
    CONSTRAINT "calificaciones_rol_calificador_check" CHECK (("rol_calificador" = ANY (ARRAY['worker'::"text", 'employer'::"text", 'company'::"text"])))
);


ALTER TABLE "public"."calificaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comprobantes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employer_id" "uuid" NOT NULL,
    "numero" "text" NOT NULL,
    "fecha" timestamp with time zone DEFAULT "now"(),
    "monto" numeric(10,2) NOT NULL,
    "moneda" "text" DEFAULT 'USD'::"text",
    "metodo" "text" NOT NULL,
    "referencia_externa" "text",
    "razon_social" "text",
    "rut_nit" "text",
    "email" "text",
    "concepto" "text" DEFAULT 'Suscripción Nexu'::"text",
    "estado" "text" DEFAULT 'emitido'::"text",
    "html_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comprobantes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."concurso_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "concurso_id" "uuid",
    "worker_id" "uuid",
    "score" integer DEFAULT 0,
    "cumple" boolean DEFAULT false,
    "keywords_match" "text"[],
    "notificado" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."concurso_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."concursos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fuente_id" "text" NOT NULL,
    "fuente" "text" NOT NULL,
    "pais" "text" DEFAULT 'UY'::"text" NOT NULL,
    "numero_llamado" "text",
    "titulo" "text" NOT NULL,
    "cargo" "text",
    "organismo" "text",
    "descripcion" "text",
    "requisitos" "text",
    "tipo_tarea" "text",
    "tipo_vinculo" "text",
    "lugar" "text",
    "fecha_inicio" timestamp with time zone,
    "fecha_cierre" timestamp with time zone,
    "puestos" integer DEFAULT 1,
    "url_detalle" "text",
    "url_postulacion" "text",
    "keywords" "text"[],
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
)
WITH ("autovacuum_vacuum_scale_factor"='0.01', "autovacuum_analyze_scale_factor"='0.005', "autovacuum_vacuum_cost_delay"='2', "autovacuum_enabled"='false');


ALTER TABLE "public"."concursos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."config" (
    "clave" "text" NOT NULL,
    "valor" "text" NOT NULL,
    "descripcion" "text"
);


ALTER TABLE "public"."config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."error_logs" (
    "id" bigint NOT NULL,
    "contexto" "text",
    "mensaje" "text",
    "user_id" "uuid",
    "plataforma" "text" DEFAULT 'app'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."error_logs" OWNER TO "postgres";


ALTER TABLE "public"."error_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."error_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."historial_totales" (
    "fecha" "date" NOT NULL,
    "total" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."historial_totales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."llamados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pais" "text" NOT NULL,
    "organismo" "text",
    "cargo" "text" NOT NULL,
    "descripcion" "text",
    "requisitos" "text"[],
    "idiomas" "text"[],
    "escolaridad" "text",
    "fecha_apertura" "date",
    "fecha_cierre" "date",
    "url_original" "text",
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."llamados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mensajes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid",
    "receiver_id" "uuid",
    "texto" "text" NOT NULL,
    "leido" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sender_display_name" "text",
    "updated_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."mensajes" REPLICA IDENTITY FULL;


ALTER TABLE "public"."mensajes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mercado_rubros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha" "date" NOT NULL,
    "pais" character varying(2) NOT NULL,
    "rubro" character varying(50) NOT NULL,
    "total_empleos" integer NOT NULL,
    "actualizado_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mercado_rubros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mercado_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "pais" "text" NOT NULL,
    "total_empleos" bigint NOT NULL,
    "actualizado_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mercado_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oferta_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "oferta_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "score" integer,
    "cumple" boolean DEFAULT true NOT NULL,
    "keywords_match" "text"[],
    "notificado" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."oferta_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ofertas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employer_id" "uuid",
    "titulo" "text" NOT NULL,
    "descripcion" "text",
    "empleo" "text",
    "sueldo_min" numeric,
    "sueldo_max" numeric,
    "sueldo_tipo" "text" DEFAULT 'a_acordar'::"text",
    "lugar" "text",
    "carga_horaria" "text",
    "idiomas" "text"[],
    "escolaridad" "text",
    "habilidades" "text"[],
    "ciudad" "text",
    "pais" "text",
    "activa" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "keywords" "text"[] DEFAULT '{}'::"text"[],
    "experiencia_min" integer DEFAULT 0,
    "rubro" "text",
    "moneda" "text",
    "tipo_contrato" "text",
    "fecha_cierre" "date",
    "requisitos" "text",
    "beneficios" "text",
    "modalidad" "text",
    "contacto_email" "text",
    "contacto_whatsapp" "text",
    "condiciones_aceptadas" boolean DEFAULT false,
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "motivo_rechazo" "text",
    CONSTRAINT "ofertas_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'aprobada'::"text", 'rechazada'::"text"])))
);


ALTER TABLE "public"."ofertas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "monto" numeric NOT NULL,
    "moneda" "text" DEFAULT 'USD'::"text",
    "estado" "text" DEFAULT 'pendiente'::"text",
    "metodo" "text",
    "referencia_externa" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pagos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nombre" "text",
    "nombre2" "text",
    "apellido1" "text",
    "apellido2" "text",
    "fecha_nac" "text",
    "sexo" "text",
    "estado_civil" "text",
    "nacionalidad" "text",
    "telefono" "text",
    "bio" "text",
    "pais" "text",
    "ciudad" "text",
    "barrio" "text",
    "servicios" "text"[],
    "profesiones" "text"[],
    "especialidades" "text"[],
    "disponibilidad" "text",
    "tipos_empleo" "text"[],
    "idiomas" "text"[],
    "referencias" boolean DEFAULT false,
    "perfil_visible" boolean DEFAULT false,
    "perfil_activo" boolean DEFAULT false,
    "perfil_activo_hasta" timestamp with time zone,
    "rating" numeric DEFAULT 0,
    "total_valoraciones" integer DEFAULT 0,
    "vistas" integer DEFAULT 0,
    "contactos" integer DEFAULT 0,
    "rol" "text" DEFAULT 'worker'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "empleo_buscado" "text",
    "direccion" "text",
    "modo_activo" "text" DEFAULT 'worker'::"text",
    "es_trabajador" boolean DEFAULT true,
    "es_empleador" boolean DEFAULT false,
    "avatar_url" "text",
    "fecha_activacion" timestamp with time zone,
    "es_empresa" boolean DEFAULT false,
    "rubro" "text",
    "rut" "text",
    "suscripcion_activa" boolean DEFAULT false,
    "suscripcion_plan" "text",
    "suscripcion_fecha" timestamp with time zone,
    "visualizaciones_disponibles" integer DEFAULT 0,
    "anios_experiencia" integer,
    "sueldo_pretension_min" numeric,
    "sueldo_pretension_max" numeric,
    "sueldo_moneda" "text" DEFAULT 'USD'::"text",
    "codigo_referido" "text",
    "referido_por" "text",
    "dias_extra" integer DEFAULT 0,
    "periodo_gratis_hasta" timestamp with time zone,
    "membresia_hasta" timestamp with time zone,
    "push_token" "text",
    "suspendido" boolean DEFAULT false,
    "suspendido_motivo" "text",
    "suspendido_at" timestamp with time zone,
    "total_reportes" integer DEFAULT 0,
    "telefono_verificado" boolean DEFAULT false,
    "telefono_otp" "text",
    "telefono_otp_expiry" timestamp with time zone,
    "tecnicaturas" "text"[] DEFAULT '{}'::"text"[],
    "email_verificado" boolean DEFAULT false,
    "email_otp" "text",
    "email_otp_expiry" timestamp with time zone,
    "nomada_digital" boolean DEFAULT false,
    "idiomas_trabajo" "text"[] DEFAULT '{}'::"text"[],
    "expo_push_token" "text",
    "estrellas" numeric(3,2) DEFAULT NULL::numeric,
    "total_calificaciones" integer DEFAULT 0,
    "identidad_estado" "text",
    "identidad_url" "text",
    "identidad_motivo_rechazo" "text",
    "descripcion_libre" "text",
    "busqueda_diaria_on" boolean DEFAULT false,
    "id_fiscal" "text",
    "sitio_web" "text",
    "verificacion_metodo" "text",
    "suscripcion_vence_at" timestamp with time zone,
    "educacion" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "experiencia" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "certificaciones" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notificaciones_activas" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."perfiles_publicos" AS
 SELECT "id",
    "nombre",
    "apellido1",
    "rol",
    "avatar_url",
    "servicios",
    "profesiones",
    "especialidades",
    "rating",
    "estrellas",
    "total_valoraciones",
    "total_calificaciones",
    "ciudad",
    "barrio",
    "pais",
    "disponibilidad",
    "referencias",
    "fecha_nac",
    "idiomas",
    "tipos_empleo",
    "bio",
    "anios_experiencia",
    "sueldo_pretension_min",
    "sueldo_pretension_max",
    "sueldo_moneda",
    "updated_at",
    "perfil_visible",
    "perfil_activo",
    "vistas",
    "contactos"
   FROM "public"."profiles";


ALTER VIEW "public"."perfiles_publicos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."postulaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "oferta_id" "uuid",
    "trabajador_id" "uuid",
    "mensaje" "text",
    "estado" "text" DEFAULT 'pendiente'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."postulaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."propuestas" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employer_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "employer_nombre" "text",
    "oferta" "jsonb",
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "motivo_rechazo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "respondida_at" timestamp with time zone,
    "encuesta_worker_sent" boolean DEFAULT false,
    "encuesta_employer_sent" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "propuestas_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'aceptada'::"text", 'rechazada'::"text"])))
);


ALTER TABLE "public"."propuestas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reportes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reportado_id" "uuid",
    "reportado_por" "uuid",
    "motivo" "text" NOT NULL,
    "detalle" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "revisado" boolean DEFAULT false,
    "revisado_at" timestamp with time zone,
    "accion_tomada" "text"
);


ALTER TABLE "public"."reportes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scraper_alertas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pais" "text" NOT NULL,
    "llamados_antes" integer NOT NULL,
    "llamados_despues" integer NOT NULL,
    "pct_caida" integer NOT NULL,
    "mensaje" "text" NOT NULL,
    "resuelta" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scraper_alertas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scraper_logs" (
    "id" bigint NOT NULL,
    "pais" "text" NOT NULL,
    "ejecutado_en" timestamp with time zone DEFAULT "now"(),
    "total_scrapeados" integer DEFAULT 0,
    "total_insertados" integer DEFAULT 0,
    "activos_antes" integer DEFAULT 0,
    "activos_despues" integer DEFAULT 0,
    "errores" "text"[] DEFAULT '{}'::"text"[],
    "ok" boolean DEFAULT true
);


ALTER TABLE "public"."scraper_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."scraper_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."scraper_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."scraper_logs_id_seq" OWNED BY "public"."scraper_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."stats" (
    "key" "text" NOT NULL,
    "value" bigint NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stats_por_pais" (
    "pais" "text" NOT NULL,
    "total" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stats_por_pais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telegram_publicados" (
    "fuente" "text" NOT NULL,
    "fuente_id" "text" NOT NULL,
    "canal" "text" NOT NULL,
    "publicado_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."telegram_publicados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."valoraciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "worker_id" "uuid",
    "employer_id" "uuid",
    "rating" integer,
    "comentario" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valoraciones_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."valoraciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visualizaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employer_id" "uuid",
    "worker_id" "uuid",
    "fecha" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."visualizaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "nombre" "text",
    "posicion" integer NOT NULL,
    "push_token" "text",
    "habilitado" boolean DEFAULT false,
    "habilitado_at" timestamp with time zone,
    "registrado" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "pais" "text",
    "busqueda" "text",
    "ultima_alerta_at" timestamp with time zone,
    "ciudad" "text",
    "rango_edad" "text",
    "nudge_deseo_at" timestamp with time zone,
    "recordatorio_incompleto_at" timestamp with time zone
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist_config" (
    "id" integer DEFAULT 1 NOT NULL,
    "activo" boolean DEFAULT true,
    "batch_size" integer DEFAULT 100,
    "max_cola_pendiente" integer DEFAULT 300,
    "umbral_activos_hora" integer DEFAULT 500,
    "intervalo_minutos" integer DEFAULT 60,
    "ultimo_lote_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "waitlist_config_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."waitlist_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist_lotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cantidad" integer NOT NULL,
    "notificados" integer DEFAULT 0,
    "activos_hora" integer DEFAULT 0,
    "carga_pct" integer DEFAULT 0,
    "batch_size_usado" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."waitlist_lotes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."waitlist_posicion_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."waitlist_posicion_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."waitlist_posicion_seq" OWNED BY "public"."waitlist"."posicion";



ALTER TABLE ONLY "public"."scraper_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."scraper_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."waitlist" ALTER COLUMN "posicion" SET DEFAULT "nextval"('"public"."waitlist_posicion_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_pin_seguridad"
    ADD CONSTRAINT "admin_pin_seguridad_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alertas_ciclo_estado"
    ADD CONSTRAINT "alertas_ciclo_estado_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alertas_ciclo_resumen"
    ADD CONSTRAINT "alertas_ciclo_resumen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alertas_enviadas"
    ADD CONSTRAINT "alertas_enviadas_pkey" PRIMARY KEY ("waitlist_id", "clave");



ALTER TABLE ONLY "public"."calificaciones"
    ADD CONSTRAINT "calificaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calificaciones"
    ADD CONSTRAINT "calificaciones_propuesta_id_calificador_id_key" UNIQUE ("propuesta_id", "calificador_id");



ALTER TABLE ONLY "public"."comprobantes"
    ADD CONSTRAINT "comprobantes_numero_key" UNIQUE ("numero");



ALTER TABLE ONLY "public"."comprobantes"
    ADD CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."concurso_matches"
    ADD CONSTRAINT "concurso_matches_concurso_id_worker_id_key" UNIQUE ("concurso_id", "worker_id");



ALTER TABLE ONLY "public"."concurso_matches"
    ADD CONSTRAINT "concurso_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."concursos"
    ADD CONSTRAINT "concursos_fuente_fuente_id_key" UNIQUE ("fuente", "fuente_id");



ALTER TABLE ONLY "public"."concursos"
    ADD CONSTRAINT "concursos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."config"
    ADD CONSTRAINT "config_pkey" PRIMARY KEY ("clave");



ALTER TABLE ONLY "public"."error_logs"
    ADD CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_totales"
    ADD CONSTRAINT "historial_totales_pkey" PRIMARY KEY ("fecha");



ALTER TABLE ONLY "public"."llamados"
    ADD CONSTRAINT "llamados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mensajes"
    ADD CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mercado_rubros"
    ADD CONSTRAINT "mercado_rubros_fecha_pais_rubro_key" UNIQUE ("fecha", "pais", "rubro");



ALTER TABLE ONLY "public"."mercado_rubros"
    ADD CONSTRAINT "mercado_rubros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mercado_stats"
    ADD CONSTRAINT "mercado_stats_fecha_pais_key" UNIQUE ("fecha", "pais");



ALTER TABLE ONLY "public"."mercado_stats"
    ADD CONSTRAINT "mercado_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oferta_matches"
    ADD CONSTRAINT "oferta_matches_oferta_id_worker_id_key" UNIQUE ("oferta_id", "worker_id");



ALTER TABLE ONLY "public"."oferta_matches"
    ADD CONSTRAINT "oferta_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ofertas"
    ADD CONSTRAINT "ofertas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_referencia_externa_key" UNIQUE ("referencia_externa");



ALTER TABLE ONLY "public"."postulaciones"
    ADD CONSTRAINT "postulaciones_oferta_id_trabajador_id_key" UNIQUE ("oferta_id", "trabajador_id");



ALTER TABLE ONLY "public"."postulaciones"
    ADD CONSTRAINT "postulaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_codigo_referido_key" UNIQUE ("codigo_referido");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."propuestas"
    ADD CONSTRAINT "propuestas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reportes"
    ADD CONSTRAINT "reportes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scraper_alertas"
    ADD CONSTRAINT "scraper_alertas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scraper_logs"
    ADD CONSTRAINT "scraper_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stats"
    ADD CONSTRAINT "stats_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."stats_por_pais"
    ADD CONSTRAINT "stats_por_pais_pkey" PRIMARY KEY ("pais");



ALTER TABLE ONLY "public"."telegram_publicados"
    ADD CONSTRAINT "telegram_publicados_pkey" PRIMARY KEY ("fuente", "fuente_id", "canal");



ALTER TABLE ONLY "public"."valoraciones"
    ADD CONSTRAINT "valoraciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visualizaciones"
    ADD CONSTRAINT "visualizaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist_config"
    ADD CONSTRAINT "waitlist_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."waitlist_lotes"
    ADD CONSTRAINT "waitlist_lotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_alertas_ciclo_resumen_run" ON "public"."alertas_ciclo_resumen" USING "btree" ("run_id");



CREATE INDEX "idx_comprobantes_employer" ON "public"."comprobantes" USING "btree" ("employer_id");



CREATE INDEX "idx_comprobantes_numero" ON "public"."comprobantes" USING "btree" ("numero");



CREATE INDEX "idx_concursos_activo" ON "public"."concursos" USING "btree" ("activo");



CREATE INDEX "idx_concursos_activo_created" ON "public"."concursos" USING "btree" ("created_at" DESC) WHERE ("activo" = true);



CREATE INDEX "idx_concursos_cargo_trgm" ON "public"."concursos" USING "gin" ("cargo" "public"."gin_trgm_ops");



CREATE INDEX "idx_concursos_fecha_cierre" ON "public"."concursos" USING "btree" ("fecha_cierre") WHERE ("activo" = true);



CREATE INDEX "idx_concursos_fuente_activo" ON "public"."concursos" USING "btree" ("fuente", "activo");



CREATE INDEX "idx_concursos_keywords" ON "public"."concursos" USING "gin" ("keywords");



CREATE INDEX "idx_concursos_organismo_trgm" ON "public"."concursos" USING "gin" ("organismo" "public"."gin_trgm_ops");



CREATE INDEX "idx_concursos_pais_activo" ON "public"."concursos" USING "btree" ("pais", "activo");



CREATE INDEX "idx_concursos_pais_cargo_norm_trgm" ON "public"."concursos" USING "gin" ("pais", "public"."f_unaccent"("lower"("cargo")) "public"."gin_trgm_ops") WHERE ("activo" = true);



CREATE INDEX "idx_concursos_pais_titulo_norm_trgm" ON "public"."concursos" USING "gin" ("pais", "public"."f_unaccent"("lower"("titulo")) "public"."gin_trgm_ops") WHERE ("activo" = true);



CREATE INDEX "idx_concursos_titulo_trgm" ON "public"."concursos" USING "gin" ("titulo" "public"."gin_trgm_ops");



CREATE INDEX "idx_error_logs_created" ON "public"."error_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_matches_pendientes_notif" ON "public"."concurso_matches" USING "btree" ("cumple", "notificado", "score" DESC) WHERE (("cumple" = true) AND ("notificado" = false));



CREATE INDEX "idx_matches_worker_cumple" ON "public"."concurso_matches" USING "btree" ("worker_id", "cumple");



CREATE INDEX "idx_matches_worker_score" ON "public"."concurso_matches" USING "btree" ("worker_id", "score" DESC);



CREATE INDEX "idx_mensajes_created" ON "public"."mensajes" USING "btree" ("created_at");



CREATE INDEX "idx_mensajes_receiver" ON "public"."mensajes" USING "btree" ("receiver_id");



CREATE INDEX "idx_mensajes_sender" ON "public"."mensajes" USING "btree" ("sender_id");



CREATE INDEX "idx_mercado_stats_fecha" ON "public"."mercado_stats" USING "btree" ("fecha" DESC);



CREATE INDEX "idx_mercado_stats_pais_fecha" ON "public"."mercado_stats" USING "btree" ("pais", "fecha" DESC);



CREATE INDEX "idx_pagos_estado" ON "public"."pagos" USING "btree" ("estado");



CREATE INDEX "idx_pagos_estado_created" ON "public"."pagos" USING "btree" ("estado", "created_at" DESC);



CREATE UNIQUE INDEX "idx_pagos_referencia_externa" ON "public"."pagos" USING "btree" ("referencia_externa") WHERE ("referencia_externa" IS NOT NULL);



CREATE INDEX "idx_pagos_user_id" ON "public"."pagos" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_activo" ON "public"."profiles" USING "btree" ("perfil_activo");



CREATE INDEX "idx_profiles_activo_hasta" ON "public"."profiles" USING "btree" ("perfil_activo", "perfil_activo_hasta") WHERE ("perfil_activo" = true);



CREATE INDEX "idx_profiles_busqueda_diaria" ON "public"."profiles" USING "btree" ("busqueda_diaria_on") WHERE ("busqueda_diaria_on" = true);



CREATE INDEX "idx_profiles_created" ON "public"."profiles" USING "btree" ("created_at");



CREATE INDEX "idx_profiles_desc_libre_trgm" ON "public"."profiles" USING "gin" ("to_tsvector"('"simple"'::"regconfig", COALESCE("descripcion_libre", ''::"text")));



CREATE INDEX "idx_profiles_especialidades" ON "public"."profiles" USING "gin" ("especialidades");



CREATE INDEX "idx_profiles_pais" ON "public"."profiles" USING "btree" ("pais");



CREATE INDEX "idx_profiles_profesiones" ON "public"."profiles" USING "gin" ("profesiones");



CREATE INDEX "idx_profiles_push_token" ON "public"."profiles" USING "btree" ("expo_push_token") WHERE ("expo_push_token" IS NOT NULL);



CREATE INDEX "idx_profiles_servicios" ON "public"."profiles" USING "gin" ("servicios");



CREATE INDEX "idx_profiles_updated" ON "public"."profiles" USING "btree" ("updated_at");



CREATE INDEX "idx_propuestas_employer" ON "public"."propuestas" USING "btree" ("employer_id");



CREATE INDEX "idx_propuestas_worker" ON "public"."propuestas" USING "btree" ("worker_id", "estado");



CREATE INDEX "idx_reportes_por_reportado" ON "public"."reportes" USING "btree" ("reportado_por", "reportado_id");



CREATE INDEX "idx_reportes_reportado" ON "public"."reportes" USING "btree" ("reportado_id");



CREATE INDEX "idx_reportes_reportado_revisado" ON "public"."reportes" USING "btree" ("reportado_id", "revisado");



CREATE INDEX "idx_reportes_revisado" ON "public"."reportes" USING "btree" ("revisado");



CREATE INDEX "idx_scraper_alertas_pais" ON "public"."scraper_alertas" USING "btree" ("pais");



CREATE INDEX "idx_scraper_alertas_resuelta" ON "public"."scraper_alertas" USING "btree" ("resuelta", "created_at" DESC);



CREATE INDEX "idx_waitlist_email" ON "public"."waitlist" USING "btree" ("email");



CREATE INDEX "idx_waitlist_habilitado" ON "public"."waitlist" USING "btree" ("habilitado", "registrado");



CREATE INDEX "idx_waitlist_posicion" ON "public"."waitlist" USING "btree" ("posicion");



CREATE INDEX "oferta_matches_pendientes_idx" ON "public"."oferta_matches" USING "btree" ("cumple", "notificado") WHERE ("notificado" = false);



CREATE INDEX "ofertas_keywords_idx" ON "public"."ofertas" USING "gin" ("keywords");



CREATE INDEX "scraper_logs_pais_idx" ON "public"."scraper_logs" USING "btree" ("pais", "ejecutado_en" DESC);



CREATE OR REPLACE TRIGGER "on_calificacion_insert" AFTER INSERT ON "public"."calificaciones" FOR EACH ROW EXECUTE FUNCTION "public"."recalcular_estrellas"();



CREATE OR REPLACE TRIGGER "on_concurso_nuevo" AFTER INSERT ON "public"."concursos" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_match_concurso_nuevo"();



CREATE OR REPLACE TRIGGER "on_perfil_actualizado" AFTER UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_match_perfil_actualizado"();



CREATE OR REPLACE TRIGGER "on_propuesta_insert" AFTER INSERT ON "public"."propuestas" FOR EACH ROW EXECUTE FUNCTION "public"."incrementar_contactos"();



CREATE OR REPLACE TRIGGER "on_visualizacion_insert" AFTER INSERT ON "public"."visualizaciones" FOR EACH ROW EXECUTE FUNCTION "public"."incrementar_vistas"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_concursos_updated_at" BEFORE UPDATE ON "public"."concursos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_matches_updated_at" BEFORE UPDATE ON "public"."concurso_matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_mensajes_updated_at" BEFORE UPDATE ON "public"."mensajes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_propuestas_updated_at" BEFORE UPDATE ON "public"."propuestas" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_enforce_cupo_propuestas" BEFORE INSERT ON "public"."propuestas" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_cupo_propuestas"();



CREATE OR REPLACE TRIGGER "trg_enforce_estado_ofertas" BEFORE INSERT OR UPDATE ON "public"."ofertas" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_estado_ofertas"();



CREATE OR REPLACE TRIGGER "trg_proteger_profiles" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_columnas_sensibles_profiles"();



CREATE OR REPLACE TRIGGER "trigger_codigo_referido" BEFORE INSERT ON "public"."profiles" FOR EACH ROW WHEN (("new"."codigo_referido" IS NULL)) EXECUTE FUNCTION "public"."generar_codigo_referido"();



CREATE OR REPLACE TRIGGER "trigger_perfil_gratis" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."activar_perfil_gratis"();



ALTER TABLE ONLY "public"."calificaciones"
    ADD CONSTRAINT "calificaciones_propuesta_id_fkey" FOREIGN KEY ("propuesta_id") REFERENCES "public"."propuestas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comprobantes"
    ADD CONSTRAINT "comprobantes_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."concurso_matches"
    ADD CONSTRAINT "concurso_matches_concurso_id_fkey" FOREIGN KEY ("concurso_id") REFERENCES "public"."concursos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."concurso_matches"
    ADD CONSTRAINT "concurso_matches_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mensajes"
    ADD CONSTRAINT "mensajes_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."mensajes"
    ADD CONSTRAINT "mensajes_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."oferta_matches"
    ADD CONSTRAINT "oferta_matches_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "public"."ofertas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oferta_matches"
    ADD CONSTRAINT "oferta_matches_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ofertas"
    ADD CONSTRAINT "ofertas_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."postulaciones"
    ADD CONSTRAINT "postulaciones_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "public"."ofertas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."postulaciones"
    ADD CONSTRAINT "postulaciones_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."propuestas"
    ADD CONSTRAINT "propuestas_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."propuestas"
    ADD CONSTRAINT "propuestas_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reportes"
    ADD CONSTRAINT "reportes_reportado_id_fkey" FOREIGN KEY ("reportado_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reportes"
    ADD CONSTRAINT "reportes_reportado_por_fkey" FOREIGN KEY ("reportado_por") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."valoraciones"
    ADD CONSTRAINT "valoraciones_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."valoraciones"
    ADD CONSTRAINT "valoraciones_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."visualizaciones"
    ADD CONSTRAINT "visualizaciones_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."visualizaciones"
    ADD CONSTRAINT "visualizaciones_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "Users can insert own messages" ON "public"."mensajes" FOR INSERT WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can read own messages" ON "public"."mensajes" FOR SELECT USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



CREATE POLICY "Users can update own messages" ON "public"."mensajes" FOR UPDATE USING (("auth"."uid"() = "receiver_id"));



ALTER TABLE "public"."admin_pin_seguridad" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alertas_ciclo_estado" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alertas_ciclo_resumen" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alertas_enviadas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calificaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calificador_inserta" ON "public"."calificaciones" FOR INSERT WITH CHECK (("auth"."uid"() = "calificador_id"));



ALTER TABLE "public"."comprobantes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comprobantes_insert" ON "public"."comprobantes" FOR INSERT WITH CHECK (false);



CREATE POLICY "comprobantes_own" ON "public"."comprobantes" FOR SELECT USING (("auth"."uid"() = "employer_id"));



CREATE POLICY "comprobantes_update" ON "public"."comprobantes" FOR UPDATE USING (false);



ALTER TABLE "public"."concurso_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."concursos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "concursos_insert" ON "public"."concursos" FOR INSERT WITH CHECK (false);



CREATE POLICY "concursos_select" ON "public"."concursos" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "concursos_update" ON "public"."concursos" FOR UPDATE USING (false);



ALTER TABLE "public"."config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "empleador_sus_ofertas" ON "public"."ofertas" USING (("auth"."uid"() = "employer_id")) WITH CHECK (("auth"."uid"() = "employer_id"));



CREATE POLICY "employers_insert_own" ON "public"."visualizaciones" FOR INSERT WITH CHECK (("employer_id" = "auth"."uid"()));



CREATE POLICY "employers_select_own" ON "public"."visualizaciones" FOR SELECT USING (("employer_id" = "auth"."uid"()));



ALTER TABLE "public"."error_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "error_logs_insert" ON "public"."error_logs" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



ALTER TABLE "public"."historial_totales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lectura publica concursos" ON "public"."concursos" FOR SELECT TO "anon" USING (("activo" = true));



ALTER TABLE "public"."llamados" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matches_insert" ON "public"."concurso_matches" FOR INSERT WITH CHECK (false);



CREATE POLICY "matches_select" ON "public"."concurso_matches" FOR SELECT USING (("auth"."uid"() = "worker_id"));



CREATE POLICY "matches_update" ON "public"."concurso_matches" FOR UPDATE USING (false);



ALTER TABLE "public"."mensajes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mensajes_propios" ON "public"."mensajes" USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



ALTER TABLE "public"."mercado_rubros" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mercado_stats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mercado_stats_public_read" ON "public"."mercado_stats" FOR SELECT USING (true);



ALTER TABLE "public"."oferta_matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "oferta_matches_select_empresa" ON "public"."oferta_matches" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ofertas" "o"
  WHERE (("o"."id" = "oferta_matches"."oferta_id") AND ("o"."employer_id" = "auth"."uid"())))));



ALTER TABLE "public"."ofertas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ofertas_modify" ON "public"."ofertas" USING (("auth"."uid"() = "employer_id")) WITH CHECK (("auth"."uid"() = "employer_id"));



CREATE POLICY "ofertas_select" ON "public"."ofertas" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") AND ("activa" = true) AND ("estado" = 'aprobada'::"text")));



CREATE POLICY "ofertas_visibles" ON "public"."ofertas" FOR SELECT USING ((("activa" = true) AND ("estado" = 'aprobada'::"text")));



ALTER TABLE "public"."pagos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pagos_insert" ON "public"."pagos" FOR INSERT WITH CHECK (false);



CREATE POLICY "pagos_propios" ON "public"."pagos" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "pagos_select" ON "public"."pagos" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."postulaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "postulaciones_empleador" ON "public"."postulaciones" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ofertas"
  WHERE (("ofertas"."id" = "postulaciones"."oferta_id") AND ("ofertas"."employer_id" = "auth"."uid"())))));



CREATE POLICY "postulaciones_trabajador" ON "public"."postulaciones" USING (("auth"."uid"() = "trabajador_id")) WITH CHECK (("auth"."uid"() = "trabajador_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete" ON "public"."profiles" FOR DELETE USING (false);



CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."propuestas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "propuestas_own" ON "public"."propuestas" USING ((("auth"."uid"() = "employer_id") OR ("auth"."uid"() = "worker_id")));



ALTER TABLE "public"."reportes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scraper_alertas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scraper_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stats_por_pais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telegram_publicados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."valoraciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ver_propias" ON "public"."calificaciones" FOR SELECT USING ((("auth"."uid"() = "calificado_id") OR ("auth"."uid"() = "calificador_id")));



ALTER TABLE "public"."visualizaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist_lotes" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."mensajes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."propuestas";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";























































































































































































REVOKE ALL ON FUNCTION "public"."consumir_visualizacion"("p_worker" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consumir_visualizacion"("p_worker" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."consumir_visualizacion_empresa"("p_worker" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consumir_visualizacion_empresa"("p_worker" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."count_concursos_activos"() TO "anon";
GRANT ALL ON FUNCTION "public"."count_concursos_activos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_concursos_activos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."count_concursos_por_pais"() TO "anon";
GRANT ALL ON FUNCTION "public"."count_concursos_por_pais"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."crons_fallidos_24h"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."crons_fallidos_24h"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cupo_empresa_restante"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cupo_empresa_restante"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."gin_btree_consistent"("internal", smallint, "anyelement", integer, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_btree_consistent"("internal", smallint, "anyelement", integer, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_btree_consistent"("internal", smallint, "anyelement", integer, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_btree_consistent"("internal", smallint, "anyelement", integer, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_anyenum"("anyenum", "anyenum", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_anyenum"("anyenum", "anyenum", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_anyenum"("anyenum", "anyenum", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_anyenum"("anyenum", "anyenum", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bit"(bit, bit, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bit"(bit, bit, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bit"(bit, bit, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bit"(bit, bit, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bool"(boolean, boolean, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bool"(boolean, boolean, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bool"(boolean, boolean, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bool"(boolean, boolean, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bpchar"(character, character, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bpchar"(character, character, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bpchar"(character, character, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bpchar"(character, character, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bytea"("bytea", "bytea", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bytea"("bytea", "bytea", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bytea"("bytea", "bytea", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bytea"("bytea", "bytea", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_char"("char", "char", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_char"("char", "char", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_char"("char", "char", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_char"("char", "char", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_cidr"("cidr", "cidr", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_cidr"("cidr", "cidr", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_cidr"("cidr", "cidr", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_cidr"("cidr", "cidr", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_date"("date", "date", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_date"("date", "date", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_date"("date", "date", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_date"("date", "date", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float4"(real, real, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float4"(real, real, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float4"(real, real, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float4"(real, real, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float8"(double precision, double precision, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float8"(double precision, double precision, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float8"(double precision, double precision, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float8"(double precision, double precision, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_inet"("inet", "inet", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_inet"("inet", "inet", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_inet"("inet", "inet", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_inet"("inet", "inet", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int2"(smallint, smallint, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int2"(smallint, smallint, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int2"(smallint, smallint, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int2"(smallint, smallint, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int4"(integer, integer, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int4"(integer, integer, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int4"(integer, integer, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int4"(integer, integer, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int8"(bigint, bigint, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int8"(bigint, bigint, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int8"(bigint, bigint, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int8"(bigint, bigint, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_interval"(interval, interval, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_interval"(interval, interval, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_interval"(interval, interval, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_interval"(interval, interval, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr"("macaddr", "macaddr", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr"("macaddr", "macaddr", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr"("macaddr", "macaddr", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr"("macaddr", "macaddr", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr8"("macaddr8", "macaddr8", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr8"("macaddr8", "macaddr8", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr8"("macaddr8", "macaddr8", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr8"("macaddr8", "macaddr8", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_money"("money", "money", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_money"("money", "money", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_money"("money", "money", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_money"("money", "money", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_name"("name", "name", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_name"("name", "name", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_name"("name", "name", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_name"("name", "name", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_numeric"(numeric, numeric, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_numeric"(numeric, numeric, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_numeric"(numeric, numeric, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_numeric"(numeric, numeric, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_oid"("oid", "oid", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_oid"("oid", "oid", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_oid"("oid", "oid", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_oid"("oid", "oid", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_text"("text", "text", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_text"("text", "text", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_text"("text", "text", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_text"("text", "text", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_time"(time without time zone, time without time zone, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_time"(time without time zone, time without time zone, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_time"(time without time zone, time without time zone, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_time"(time without time zone, time without time zone, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamp"(timestamp without time zone, timestamp without time zone, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamp"(timestamp without time zone, timestamp without time zone, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamp"(timestamp without time zone, timestamp without time zone, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamp"(timestamp without time zone, timestamp without time zone, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamptz"(timestamp with time zone, timestamp with time zone, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamptz"(timestamp with time zone, timestamp with time zone, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamptz"(timestamp with time zone, timestamp with time zone, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamptz"(timestamp with time zone, timestamp with time zone, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timetz"(time with time zone, time with time zone, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timetz"(time with time zone, time with time zone, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timetz"(time with time zone, time with time zone, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timetz"(time with time zone, time with time zone, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_uuid"("uuid", "uuid", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_uuid"("uuid", "uuid", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_uuid"("uuid", "uuid", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_uuid"("uuid", "uuid", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_varbit"(bit varying, bit varying, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_varbit"(bit varying, bit varying, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_varbit"(bit varying, bit varying, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_varbit"(bit varying, bit varying, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_enum_cmp"("anyenum", "anyenum") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_enum_cmp"("anyenum", "anyenum") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_enum_cmp"("anyenum", "anyenum") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_enum_cmp"("anyenum", "anyenum") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_anyenum"("anyenum", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_anyenum"("anyenum", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_anyenum"("anyenum", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_anyenum"("anyenum", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_bit"(bit, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bit"(bit, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bit"(bit, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bit"(bit, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_bool"(boolean, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bool"(boolean, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bool"(boolean, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bool"(boolean, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_bpchar"(character, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bpchar"(character, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bpchar"(character, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bpchar"(character, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_bytea"("bytea", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bytea"("bytea", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bytea"("bytea", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bytea"("bytea", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_char"("char", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_char"("char", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_char"("char", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_char"("char", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_cidr"("cidr", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_cidr"("cidr", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_cidr"("cidr", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_cidr"("cidr", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_date"("date", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_date"("date", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_date"("date", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_date"("date", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_float4"(real, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float4"(real, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float4"(real, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float4"(real, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_float8"(double precision, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float8"(double precision, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float8"(double precision, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float8"(double precision, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_inet"("inet", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_inet"("inet", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_inet"("inet", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_inet"("inet", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_int2"(smallint, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int2"(smallint, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int2"(smallint, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int2"(smallint, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_int4"(integer, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int4"(integer, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int4"(integer, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int4"(integer, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_int8"(bigint, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int8"(bigint, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int8"(bigint, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int8"(bigint, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_interval"(interval, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_interval"(interval, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_interval"(interval, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_interval"(interval, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr"("macaddr", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr"("macaddr", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr"("macaddr", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr"("macaddr", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr8"("macaddr8", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr8"("macaddr8", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr8"("macaddr8", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr8"("macaddr8", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_money"("money", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_money"("money", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_money"("money", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_money"("money", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_name"("name", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_name"("name", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_name"("name", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_name"("name", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_numeric"(numeric, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_numeric"(numeric, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_numeric"(numeric, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_numeric"(numeric, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_oid"("oid", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_oid"("oid", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_oid"("oid", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_oid"("oid", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_text"("text", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_text"("text", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_text"("text", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_text"("text", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_time"(time without time zone, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_time"(time without time zone, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_time"(time without time zone, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_time"(time without time zone, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamp"(timestamp without time zone, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamp"(timestamp without time zone, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamp"(timestamp without time zone, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamp"(timestamp without time zone, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamptz"(timestamp with time zone, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamptz"(timestamp with time zone, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamptz"(timestamp with time zone, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamptz"(timestamp with time zone, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_timetz"(time with time zone, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timetz"(time with time zone, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timetz"(time with time zone, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timetz"(time with time zone, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_uuid"("uuid", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_uuid"("uuid", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_uuid"("uuid", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_uuid"("uuid", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_varbit"(bit varying, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_varbit"(bit varying, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_varbit"(bit varying, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_varbit"(bit varying, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_anyenum"("anyenum", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_anyenum"("anyenum", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_anyenum"("anyenum", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_anyenum"("anyenum", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_bit"(bit, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bit"(bit, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bit"(bit, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bit"(bit, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_bool"(boolean, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bool"(boolean, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bool"(boolean, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bool"(boolean, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_bpchar"(character, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bpchar"(character, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bpchar"(character, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bpchar"(character, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_bytea"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bytea"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bytea"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bytea"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_char"("char", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_char"("char", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_char"("char", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_char"("char", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_cidr"("cidr", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_cidr"("cidr", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_cidr"("cidr", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_cidr"("cidr", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_date"("date", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_date"("date", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_date"("date", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_date"("date", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_float4"(real, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float4"(real, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float4"(real, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float4"(real, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_float8"(double precision, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float8"(double precision, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float8"(double precision, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float8"(double precision, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_inet"("inet", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_inet"("inet", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_inet"("inet", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_inet"("inet", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_int2"(smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int2"(smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int2"(smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int2"(smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_int4"(integer, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int4"(integer, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int4"(integer, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int4"(integer, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_int8"(bigint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int8"(bigint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int8"(bigint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int8"(bigint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_interval"(interval, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_interval"(interval, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_interval"(interval, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_interval"(interval, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr"("macaddr", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr"("macaddr", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr"("macaddr", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr"("macaddr", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr8"("macaddr8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr8"("macaddr8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr8"("macaddr8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr8"("macaddr8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_money"("money", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_money"("money", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_money"("money", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_money"("money", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_name"("name", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_name"("name", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_name"("name", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_name"("name", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_numeric"(numeric, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_numeric"(numeric, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_numeric"(numeric, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_numeric"(numeric, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_oid"("oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_oid"("oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_oid"("oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_oid"("oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_text"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_text"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_text"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_text"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_time"(time without time zone, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_time"(time without time zone, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_time"(time without time zone, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_time"(time without time zone, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamp"(timestamp without time zone, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamp"(timestamp without time zone, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamp"(timestamp without time zone, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamp"(timestamp without time zone, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamptz"(timestamp with time zone, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamptz"(timestamp with time zone, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamptz"(timestamp with time zone, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamptz"(timestamp with time zone, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_timetz"(time with time zone, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timetz"(time with time zone, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timetz"(time with time zone, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timetz"(time with time zone, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_uuid"("uuid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_uuid"("uuid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_uuid"("uuid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_uuid"("uuid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_varbit"(bit varying, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_varbit"(bit varying, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_varbit"(bit varying, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_varbit"(bit varying, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_numeric_cmp"(numeric, numeric) TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_numeric_cmp"(numeric, numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."gin_numeric_cmp"(numeric, numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_numeric_cmp"(numeric, numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."incrementar_vistas_simuladas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rematch_worker"("p_worker_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staleness_alertas_waitlist"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staleness_alertas_waitlist"() TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sumar_visualizaciones"("employer_id" "uuid", "cantidad" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sumar_visualizaciones"("employer_id" "uuid", "cantidad" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_concursos_bulk"("p_rows" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";
























GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_pin_seguridad" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_pin_seguridad" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_pin_seguridad" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."alertas_ciclo_estado" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."alertas_ciclo_resumen" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."alertas_ciclo_resumen" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."alertas_ciclo_resumen" TO "service_role";



GRANT UPDATE ON SEQUENCE "public"."alertas_ciclo_resumen_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE "public"."alertas_ciclo_resumen_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."alertas_ciclo_resumen_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."alertas_enviadas" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."alertas_enviadas" TO "authenticated";
GRANT ALL ON TABLE "public"."alertas_enviadas" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."calificaciones" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."calificaciones" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."calificaciones" TO "service_role";



GRANT ALL ON TABLE "public"."comprobantes" TO "anon";
GRANT ALL ON TABLE "public"."comprobantes" TO "authenticated";
GRANT ALL ON TABLE "public"."comprobantes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."concurso_matches" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."concurso_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."concurso_matches" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."concursos" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."concursos" TO "authenticated";
GRANT ALL ON TABLE "public"."concursos" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."config" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."config" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."config" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."error_logs" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."error_logs" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."error_logs" TO "service_role";



GRANT UPDATE ON SEQUENCE "public"."error_logs_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE "public"."error_logs_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE "public"."error_logs_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."historial_totales" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."historial_totales" TO "authenticated";
GRANT ALL ON TABLE "public"."historial_totales" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."llamados" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."llamados" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."llamados" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mensajes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."mensajes" TO "authenticated";
GRANT ALL ON TABLE "public"."mensajes" TO "service_role";



GRANT ALL ON TABLE "public"."mercado_rubros" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mercado_rubros" TO "authenticated";
GRANT ALL ON TABLE "public"."mercado_rubros" TO "service_role";



GRANT ALL ON TABLE "public"."mercado_stats" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mercado_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."mercado_stats" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."oferta_matches" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."oferta_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."oferta_matches" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ofertas" TO "anon";
GRANT ALL ON TABLE "public"."ofertas" TO "authenticated";
GRANT ALL ON TABLE "public"."ofertas" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pagos" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pagos" TO "authenticated";
GRANT ALL ON TABLE "public"."pagos" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."perfiles_publicos" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."perfiles_publicos" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."perfiles_publicos" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."postulaciones" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."postulaciones" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."postulaciones" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."propuestas" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."propuestas" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."propuestas" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reportes" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reportes" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reportes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."scraper_alertas" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."scraper_alertas" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."scraper_alertas" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."scraper_logs" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."scraper_logs" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."scraper_logs" TO "service_role";



GRANT UPDATE ON SEQUENCE "public"."scraper_logs_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE "public"."scraper_logs_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE "public"."scraper_logs_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stats" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stats" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stats" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stats_por_pais" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stats_por_pais" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stats_por_pais" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."telegram_publicados" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."telegram_publicados" TO "authenticated";
GRANT ALL ON TABLE "public"."telegram_publicados" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."valoraciones" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."valoraciones" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."valoraciones" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."visualizaciones" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."visualizaciones" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."visualizaciones" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist_config" TO "anon";
GRANT ALL ON TABLE "public"."waitlist_config" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist_config" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist_lotes" TO "anon";
GRANT ALL ON TABLE "public"."waitlist_lotes" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist_lotes" TO "service_role";



GRANT UPDATE ON SEQUENCE "public"."waitlist_posicion_seq" TO "anon";
GRANT UPDATE ON SEQUENCE "public"."waitlist_posicion_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE "public"."waitlist_posicion_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";



































