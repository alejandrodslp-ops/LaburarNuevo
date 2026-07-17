#!/bin/bash
# Auditoría externa completa de www.konexu.app — correr después de CADA deploy.
# Verifica lo que ven usuarios reales, Facebook y Google. Salida: PASS/FAIL por chequeo.
# Uso: bash web/scripts/auditar_web.sh

BASE="https://www.konexu.app"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS  $1"; }
fail() { FAIL=$((FAIL+1)); echo "FAIL  $1  ← $2"; }

check_contains() { # $1 desc, $2 haystack, $3 needle
  case "$2" in *"$3"*) ok "$1";; *) fail "$1" "no contiene: $3";; esac
}

# ── 1. Landings: HTTP, idioma del título, canonical, og:image (tag + archivo), formulario
declare -a LANGS=("/:Concursos Públicos" "/es-es:Ofertas recientes en España" "/pt:Pare de procurar|Vagas" "/en:Stop searching|straight to your email" "/fr:Arrêtez|travail" "/it:Smetti di cercare|lavoro" "/de:Hör auf|Arbeit" "/sv:Sluta leta|jobbet" "/no:Slutt å lete|jobben" "/ja:探すのをやめよう|仕事")
for entry in "${LANGS[@]}"; do
  path="${entry%%:*}"; needles="${entry#*:}"
  html=$(curl -s -L --max-time 20 "$BASE$path")
  code=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 20 "$BASE$path")
  [ "$code" = "200" ] && ok "GET $path → 200" || fail "GET $path" "HTTP $code"
  hit=0; IFS='|' read -ra ns <<< "$needles"
  for n in "${ns[@]}"; do case "$html" in *"$n"*) hit=1;; esac; done
  [ "$hit" = "1" ] && ok "$path en su idioma" || fail "$path idioma" "no aparece: $needles"
  canon=$(echo "$html" | grep -oE '<link rel="canonical" href="[^"]*"' | head -1)
  check_contains "$path canonical" "$canon" "www.konexu.app"
  case "$canon" in *supabase*) fail "$path canonical dominio" "apunta a supabase";; esac
  ogimg=$(echo "$html" | grep -oE '<meta property="og:image" content="[^"]*"' | head -1)
  check_contains "$path og:image tag" "$ogimg" "www.konexu.app/og-konexu"
  imgurl=$(echo "$ogimg" | grep -oE 'https://[^"]*')
  if [ -n "$imgurl" ]; then
    icode=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$imgurl")
    [ "$icode" = "200" ] && ok "$path og:image archivo 200" || fail "$path og:image archivo" "HTTP $icode"
  fi
done

# ── 2. Redirects de portada por idioma (usuarios reales)
for l in pt en fr it de sv no ja; do
  r=$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" --max-time 20 -H "Accept-Language: $l" "$BASE/")
  case "$r" in "307 $BASE/$l") ok "redirect $l → /$l";; *) fail "redirect $l" "$r";; esac
done
# España: es-ES redirige a /es-es
r=$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" --max-time 20 -H "Accept-Language: es-ES" "$BASE/")
case "$r" in "307 $BASE/es-es") ok "redirect es-ES → /es-es";; *) fail "redirect es-ES" "$r";; esac
# controles: español y bots NO redirigen; otras rutas intactas
r=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -H "Accept-Language: es-AR" "$BASE/")
[ "$r" = "200" ] && ok "es NO redirige" || fail "es NO redirige" "HTTP $r"
r=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -H "Accept-Language: pt-BR" -A "facebookexternalhit/1.1" "$BASE/")
[ "$r" = "200" ] && ok "bot Facebook NO redirige" || fail "bot Facebook" "HTTP $r"
r=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -H "Accept-Language: pt-BR" "$BASE/empleos")
[ "$r" = "200" ] && ok "/empleos NO redirige" || fail "/empleos redirect" "HTTP $r"

# ── 3. SEO: robots y sitemap sin dominio envenenado, con las 9 landings
robots=$(curl -s --max-time 20 "$BASE/robots.txt")
check_contains "robots.txt sitemap correcto" "$robots" "www.konexu.app/sitemap.xml"
smap=$(curl -s --max-time 30 "$BASE/sitemap.xml")
case "$smap" in *supabase*) fail "sitemap sin supabase" "contiene supabase.co";; *) ok "sitemap sin supabase";; esac
for l in pt en fr it de sv no ja; do
  check_contains "sitemap incluye /$l" "$smap" "www.konexu.app/$l</loc>"
done

# ── 3b. Calidad de datos: el buscador debe devolver resultados RELEVANTES
# (caso real 2026-07-17: "chofer" devolvía una tarjeta de "Abogado/a" porque
# la API de Uruguay Concursa pegaba el mismo cargo a 408 llamados)
if command -v supabase >/dev/null 2>&1 && [ -d "$(dirname "$0")/../../supabase" ]; then
  REP=$(cd "$(dirname "$0")/../.." && supabase db query --linked "SELECT count(*) FROM concursos WHERE activo AND fuente='uruguay_concursa' AND cargo IS NOT NULL AND position(lower(split_part(cargo,' ',1)) IN lower(titulo))=0" 2>/dev/null | grep -o '"count": [0-9]*' | grep -o '[0-9]*')
  if [ -n "$REP" ]; then
    [ "$REP" -lt 20 ] && ok "calidad UY: cargos coherentes ($REP cruzados)" || fail "calidad UY" "$REP llamados con cargo cruzado"
  fi
fi

# ── 4. Formulario de alertas: la API rechaza registros web incompletos
ANON=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY "$(dirname "$0")/../.env.local" 2>/dev/null | cut -d= -f2)
if [ -n "$ANON" ]; then
  resp=$(curl -s --max-time 20 -X POST "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/waitlist" \
    -H "Content-Type: application/json" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
    -d '{"accion":"unirse","origen":"web","email":"auditoria@konexu.app","pais":"🇦🇷 Argentina"}')
  check_contains "waitlist rechaza incompletos" "$resp" "obligatorio"
else
  echo "SKIP  waitlist (sin .env.local)"
fi

echo "────────────────────────────"
echo "RESULTADO: $PASS PASS · $FAIL FAIL"
[ "$FAIL" = "0" ] && echo "✅ TODO EN ORDEN" || echo "❌ HAY FALLAS — revisar arriba"
exit $FAIL
