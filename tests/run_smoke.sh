#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
#  SMOKE TESTS de la base de datos Konexu — flujos críticos
#
#  CERO RIESGO: cada test corre dentro de una transacción que se REVIERTE
#  (BEGIN...ROLLBACK). Lee y prueba, pero NO modifica ningún dato.
#
#  Detecta si se rompió: el registro, la seguridad (plata/perfil),
#  el descuento de visualizaciones, el rating o la verificación de email.
#
#  Uso:   bash tests/run_smoke.sh
#  (Requiere el supabase CLI linkeado, igual que el resto del proyecto.)
#  Cuando exista un Supabase de staging, conviene apuntarlo ahí.
# ════════════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"
PASS=0; FAIL=0
trap 'rm -rf "$TMP"' EXIT

clean(){ grep -vE "Initialising|warning|A new version|We recommend|boundary|^[[:space:]]*$"; }
runsql(){ supabase db query --linked -f "$1" 2>&1 | clean; }

# Espera el marcador TESTPASS en la salida
expect_pass(){
  local nombre="$1" archivo="$2" out
  out="$(runsql "$archivo")"
  if echo "$out" | grep -q "TESTPASS"; then
    echo "  ✅ PASS  — $nombre"; PASS=$((PASS+1))
  else
    echo "  ❌ FAIL  — $nombre"; echo "$out" | head -3 | sed 's/^/        /'; FAIL=$((FAIL+1))
  fi
}

# Espera que la operación sea BLOQUEADA con un mensaje del guardián
expect_block(){
  local nombre="$1" archivo="$2" texto="$3" out
  out="$(runsql "$archivo")"
  if echo "$out" | grep -qi "$texto"; then
    echo "  ✅ PASS  — $nombre"; PASS=$((PASS+1))
  else
    echo "  ❌ FAIL  — $nombre (NO se bloqueó)"; echo "$out" | head -3 | sed 's/^/        /'; FAIL=$((FAIL+1))
  fi
}

echo "═══ SMOKE TESTS Konexu (transacciones revertidas, sin tocar datos) ═══"
echo ""
echo "REGISTRO Y CUENTAS"

# 1) Registro: el insert del perfil debe crear el perfil con prueba activa y código.
#    (Esto es lo que se rompió hoy por el guardián vs trigger.)
cat > "$TMP/t1.sql" <<'EOF'
begin;
select set_config('test.uid', gen_random_uuid()::text, true);
select set_config('request.jwt.claims', json_build_object('role','authenticated','sub',current_setting('test.uid'))::text, true);
set local role authenticated;
insert into profiles(id,nombre,apellido1,apellido2,rol,fecha_nac)
  values(current_setting('test.uid')::uuid,'Test','Test','','worker','01/01/2000');
select 'TESTPASS' as r from profiles
  where id=current_setting('test.uid')::uuid
    and perfil_activo=true and perfil_activo_hasta is not null
    and codigo_referido is not null and fecha_activacion is not null;
rollback;
EOF
expect_pass "Registro crea perfil con prueba de 10 días + código de referido" "$TMP/t1.sql"

# 2) Los usuarios nuevos quedan sin verificar (gate de email obligatorio).
cat > "$TMP/t2.sql" <<'EOF'
select 'TESTPASS' as r from information_schema.columns
  where table_schema='public' and table_name='profiles'
    and column_name='email_verificado' and column_default='false';
EOF
expect_pass "Email nuevo arranca sin verificar (gate activo)" "$TMP/t2.sql"

echo ""
echo "SEGURIDAD — PLATA Y ESTADO"

# 3) El cliente NO puede regalarse visualizaciones (plata).
cat > "$TMP/t3.sql" <<'EOF'
begin;
select set_config('test.uid', (select id::text from profiles order by id limit 1), true);
select set_config('request.jwt.claims', json_build_object('role','authenticated','sub',current_setting('test.uid'))::text, true);
set local role authenticated;
update profiles set visualizaciones_disponibles = 9999 where id = current_setting('test.uid')::uuid;
rollback;
EOF
expect_block "Cliente NO puede auto-darse visualizaciones" "$TMP/t3.sql" "No autorizado"

# 4) El cliente NO puede auto-activarse el perfil (false->true).
cat > "$TMP/t4.sql" <<'EOF'
begin;
select set_config('test.uid', (select id::text from profiles order by id limit 1), true);
update profiles set perfil_activo=false where id=current_setting('test.uid')::uuid;
select set_config('request.jwt.claims', json_build_object('role','authenticated','sub',current_setting('test.uid'))::text, true);
set local role authenticated;
update profiles set perfil_activo=true where id=current_setting('test.uid')::uuid;
rollback;
EOF
expect_block "Cliente NO puede auto-activarse el perfil" "$TMP/t4.sql" "No autorizado"

# 5) El servidor SÍ puede acreditar visualizaciones (webhook de pago).
cat > "$TMP/t5.sql" <<'EOF'
begin;
create temp table _t as select id, coalesce(visualizaciones_disponibles,0) as v from profiles order by id limit 1;
select sumar_visualizaciones((select id from _t), 5);
select 'TESTPASS' as r from profiles
  where id=(select id from _t)
    and coalesce(visualizaciones_disponibles,0) = (select v from _t) + 5;
rollback;
EOF
expect_pass "Servidor acredita visualizaciones tras pago (RPC)" "$TMP/t5.sql"

# 5b) PRIVACIDAD: un usuario NO puede leer el perfil (telefono/datos privados) de OTRO.
cat > "$TMP/t5b.sql" <<'EOF'
begin;
select set_config('test.yo',  (select id::text from profiles order by id limit 1), true);
select set_config('test.otro',(select id::text from profiles order by id desc limit 1), true);
select set_config('request.jwt.claims', json_build_object('role','authenticated','sub',current_setting('test.yo'))::text, true);
set local role authenticated;
select 'TESTPASS' as r
where (select count(*) from profiles where id=current_setting('test.otro')::uuid) = 0
  and (select count(*) from profiles where id=current_setting('test.yo')::uuid)   = 1
  and (select count(*) from perfiles_publicos) > 0;
rollback;
EOF
expect_pass "Privacidad: un usuario NO lee datos privados de otro (4B)" "$TMP/t5b.sql"

echo ""
echo "FLUJOS DE PLATA Y MÉTRICAS"

# 6) Descontar una visualización funciona y es idempotente (bug de plata de hoy).
cat > "$TMP/t6.sql" <<'EOF'
begin;
select set_config('test.eid',(select id::text from profiles order by id limit 1),true);
select set_config('test.wid',(select id::text from profiles order by id desc limit 1),true);
update profiles set visualizaciones_disponibles=3 where id=current_setting('test.eid')::uuid;
select set_config('request.jwt.claims', json_build_object('role','authenticated','sub',current_setting('test.eid'))::text, true);
set local role authenticated;
select consumir_visualizacion(current_setting('test.wid')::uuid);
select consumir_visualizacion(current_setting('test.wid')::uuid);
select 'TESTPASS' as r from profiles
  where id=current_setting('test.eid')::uuid and visualizaciones_disponibles = 2;
rollback;
EOF
expect_pass "Ver un perfil descuenta 1 visualización (y no cobra dos veces)" "$TMP/t6.sql"

# 7) Calificar recalcula el rating del trabajador (server-side).
cat > "$TMP/t7.sql" <<'EOF'
begin;
select set_config('test.wid',(select id::text from profiles order by id limit 1),true);
select set_config('test.eid',(select id::text from profiles where id<>current_setting('test.wid')::uuid order by id limit 1),true);
insert into calificaciones(propuesta_id,calificador_id,calificado_id,rol_calificador,factor_comunicacion,factor_cumplimiento,factor_recomendacion,promedio)
  values(null,current_setting('test.eid')::uuid,current_setting('test.wid')::uuid,'employer',5,5,5,5.0);
select 'TESTPASS' as r from profiles
  where id=current_setting('test.wid')::uuid and rating is not null and total_valoraciones>0;
rollback;
EOF
expect_pass "Calificar recalcula el rating del trabajador" "$TMP/t7.sql"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  RESULTADO:  $PASS pasaron,  $FAIL fallaron"
echo "════════════════════════════════════════════════════════"
[ "$FAIL" -eq 0 ] && echo "  ✅ Todos los flujos críticos OK." || echo "  ❌ Hay flujos rotos — revisar arriba ANTES de publicar."
exit "$FAIL"
