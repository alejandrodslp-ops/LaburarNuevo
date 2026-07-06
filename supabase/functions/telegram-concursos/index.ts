import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// telegram-concursos: publica los concursos NUEVOS de un país en un canal de
// Telegram, con link a la web. 100% aditivo: solo LEE concursos y escribe en su
// propia tabla de dedupe (telegram_publicados). No toca scraper, matching ni web.
//
// Dedupe por (fuente, fuente_id, canal) — NO por uuid: los concursos se borran y
// reinsertan con uuid nuevo (visto 2026-07-05: 400+ filas UY recreadas en un día),
// pero fuente_id es estable. Así el canal nunca repite un llamado.
//
// Primer uso: llamar con {"seed":true} para marcar todo lo existente como ya
// publicado SIN postearlo (evita inundar el canal con 400+ mensajes el día 1).
//
// Secrets requeridos: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_UY (ver CONFIGURAR.md)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN    = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const CHAT_UY      = Deno.env.get("TELEGRAM_CHAT_UY") ?? "";
const SITE         = "https://www.konexu.app";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: CORS });

type Concurso = {
  id: string; fuente: string; fuente_id: string;
  titulo?: string; cargo?: string; organismo?: string; lugar?: string;
  puestos?: number; fecha_cierre?: string; pais?: string; descripcion?: string;
};

const BANDERA: Record<string, string> = { UY: "🇺🇾", AR: "🇦🇷", BR: "🇧🇷", MX: "🇲🇽" };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// "Departamento de Montevideo." → "Montevideo"
function limpiarLugar(lugar: string) {
  return lugar.replace(/^departamento de\s+/i, "").replace(/\.+\s*$/, "").trim();
}

// El sueldo es lo que más atrae el ojo: se extrae de la descripción (formato del
// scraper UY: "Retribución: $63.958,86 nominales a valores de Enero 2026.")
function extraerSueldo(descripcion?: string) {
  const linea = descripcion?.match(/Retribución:\s*([^\n]+)/)?.[1]?.trim();
  if (!linea) return null;
  const corta = linea.replace(/\s+a valores de.*$/i, "").replace(/\.+\s*$/, "").slice(0, 70);
  // Monto en negrita, resto normal: "$63.958,86 nominales" → "<b>$63.958,86</b> nominales"
  return esc(corta).replace(/(\$\s?[\d.,]+)/, "<b>$1</b>");
}

function lineaCierre(iso: string) {
  const cierre = new Date(iso);
  if (isNaN(cierre.getTime())) return null;
  const fecha = cierre.toLocaleDateString("es-UY", {
    weekday: "long", day: "2-digit", month: "2-digit",
    timeZone: "America/Montevideo",
  });
  const dias = Math.ceil((cierre.getTime() - Date.now()) / 86400000);
  const urgencia = dias === 1 ? " — queda 1 día" : dias > 1 && dias <= 15 ? ` — quedan ${dias} días` : "";
  return `⏳ Cierra el <b>${fecha}</b>${urgencia}`;
}

const hashtag = (s: string) =>
  "#" + s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "").trim()
    .split(/\s+/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join("");

function armarMensaje(c: Concurso) {
  const pais = (c.pais || "").toUpperCase();
  const lugar = c.lugar ? limpiarLugar(c.lugar) : "";
  const encabezado = `${BANDERA[pais] ?? "📢"} <b>CONCURSO PÚBLICO</b>${lugar ? ` · ${esc(lugar)}` : ""}`;

  const partes = [encabezado, ""];
  partes.push(`<b>${esc((c.cargo || c.titulo || "Llamado público").trim())}</b>`);
  if (c.organismo) partes.push(`<i>${esc(c.organismo)}</i>`);
  partes.push("");
  const sueldo = extraerSueldo(c.descripcion);
  if (sueldo) partes.push(`💰 ${sueldo}`);
  if ((c.puestos ?? 1) > 1) partes.push(`👥 ${c.puestos} puestos`);
  if (c.fecha_cierre) {
    const cierre = lineaCierre(c.fecha_cierre);
    if (cierre) partes.push(cierre);
  }

  // URL corta VISIBLE (vía /e/ de la web): Telegram abre las URLs visibles sin
  // popup de confirmación; los links con texto personalizado sí lo muestran.
  partes.push("", `🔗 konexu.app/e/${pais.toLowerCase()}-${c.fuente_id}`);

  const tags = [lugar && hashtag(lugar), "#EmpleoPúblico"].filter(Boolean).join(" ");
  partes.push("", tags);
  return partes.filter((p, i, a) => p !== "" || a[i - 1] !== "").join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body   = await req.json().catch(() => ({}));
    const pais   = String(body.pais || "UY");
    const canal  = pais === "UY" ? CHAT_UY : ""; // multi-país: agregar secrets TELEGRAM_CHAT_<PAIS>
    // Telegram limita ~20 mensajes/min por canal; se drena de a poco, el cron sigue.
    const max    = Math.min(Number(body.max) || 12, 18);
    const horas  = Number(body.horas) || 48;

    if (!BOT_TOKEN || !canal) {
      return json({ error: "Faltan secrets TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_UY (ver CONFIGURAR.md)" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Modo seed: marcar todo lo activo como ya publicado, sin postear nada.
    if (body.seed === true) {
      const { data: todos, error } = await supabase
        .from("concursos")
        .select("fuente, fuente_id")
        .eq("pais", pais).eq("activo", true)
        .limit(3000);
      if (error) throw error;
      const filas = (todos ?? []).map((c) => ({ fuente: c.fuente, fuente_id: c.fuente_id, canal }));
      if (filas.length > 0) {
        const { error: e2 } = await supabase
          .from("telegram_publicados")
          .upsert(filas, { onConflict: "fuente,fuente_id,canal", ignoreDuplicates: true });
        if (e2) throw e2;
      }
      return json({ ok: true, seeded: filas.length });
    }

    const desde = new Date(Date.now() - horas * 3600 * 1000).toISOString();
    const { data: concursos, error } = await supabase
      .from("concursos")
      .select("id, fuente, fuente_id, titulo, cargo, organismo, lugar, puestos, fecha_cierre, pais, descripcion")
      .eq("pais", pais).eq("activo", true)
      .gt("fecha_cierre", new Date().toISOString())
      .gte("created_at", desde)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) throw error;

    const ids = (concursos ?? []).map((c) => c.fuente_id);
    if (ids.length === 0) return json({ ok: true, publicados: 0, pendientes: 0 });

    const { data: pub, error: ePub } = await supabase
      .from("telegram_publicados")
      .select("fuente, fuente_id")
      .eq("canal", canal)
      .in("fuente_id", ids);
    if (ePub) throw ePub;
    const yaPublicado = new Set((pub ?? []).map((p) => `${p.fuente}|${p.fuente_id}`));

    const nuevos = (concursos ?? []).filter((c) => !yaPublicado.has(`${c.fuente}|${c.fuente_id}`));
    const tanda  = nuevos.slice(0, max);

    let publicados = 0, fallidos = 0;
    const errores: string[] = [];
    for (const c of tanda) {
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: canal,
          text: armarMensaje(c),
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          // silencioso=true para cargas masivas: publica sin sonar notificaciones
          disable_notification: body.silencioso === true,
        }),
      });
      if (r.ok) {
        publicados++;
        // Se marca DESPUÉS de publicar: si el insert falla, peor caso es un duplicado
        // en el canal (mejor que marcar antes y perder el concurso si Telegram falla).
        const { error: eIns } = await supabase
          .from("telegram_publicados")
          .insert({ fuente: c.fuente, fuente_id: c.fuente_id, canal });
        if (eIns) errores.push("dedupe: " + eIns.message.slice(0, 80));
      } else {
        fallidos++;
        errores.push(`telegram ${r.status}: ` + (await r.text()).slice(0, 120));
        if (r.status === 429) break; // rate limit: cortar acá, el próximo cron drena el resto
      }
      await new Promise((res) => setTimeout(res, 3100));
    }

    return json({
      ok: true, publicados, fallidos,
      pendientes: Math.max(nuevos.length - tanda.length, 0),
      errores: errores.slice(0, 5),
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
