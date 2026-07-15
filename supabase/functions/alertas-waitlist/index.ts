// alertas-waitlist — envía por email los concursos NUEVOS que coinciden con
// lo que busca cada persona de la waitlist. Reusa el matching por keyword.
// NO toca la app. Corre por cron (net.http_post).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL         = Deno.env.get("SUPABASE_URL")!;
const KEY         = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY  = Deno.env.get("RESEND_API_KEY") ?? "";
const SITE        = "https://konexu.app";

// nombre de país (con o sin emoji) -> código de la tabla concursos
const PAIS_COD: Record<string, string> = {
  uruguay: "UY", argentina: "AR", brasil: "BR", brazil: "BR", chile: "CL",
  colombia: "CO", mexico: "MX", peru: "PE", ecuador: "EC", bolivia: "BO",
  paraguay: "PY", venezuela: "VE", espana: "ES", "estados unidos": "US",
  portugal: "PT", italia: "IT", francia: "FR", alemania: "DE",
  "reino unido": "GB", canada: "CA", australia: "AU",
  guatemala: "GT", honduras: "HN", nicaragua: "NI", "costa rica": "CR",
  panama: "PA", cuba: "CU", "rep dominicana": "DO", "el salvador": "SV",
  suecia: "SE", noruega: "NO", suiza: "CH", japon: "JP", india: "IN",
};
function codPais(s: string | null): string | null {
  if (!s) return null;
  // NFD + quitar tildes: "Panamá"/"México"/"Japón" deben resolver igual que sus claves
  const n = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\s]/gu, "").trim().toLowerCase();
  return PAIS_COD[n] ?? null;
}
function esc(t: unknown): string {
  return String(t ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
}

function plantilla(nombre: string | null, busqueda: string, matches: any[]): string {
  const saludo = nombre ? `Hola ${esc(nombre)},` : "Hola,";
  const items = matches.map((c) => {
    const titulo = esc(c.cargo || c.titulo);
    const org    = esc(c.organismo || "");
    const lugar  = esc(c.lugar || c.pais || "");
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #EDE8E2">
      <div style="font-size:15px;font-weight:700;color:#1A1020">${titulo}</div>
      <div style="font-size:13px;color:#8c8492;margin-top:2px">${org}${org && lugar ? " · " : ""}${lugar}</div>
    </td></tr>`;
  }).join("");
  const link = `${SITE}/empleos?q=${encodeURIComponent(busqueda)}`;
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#FBF8F4">
    <div style="background:#0D1117;padding:24px 32px"><img src="https://www.konexu.app/logo-email.png" alt="Konexu" width="98" height="40" style="display:block;border:0"></div>
    <div style="padding:28px 32px">
      <p style="font-size:15px;color:#1A1020">${saludo}</p>
      <h2 style="color:#1A1020;font-size:20px;margin:8px 0 4px">Aparecieron ${matches.length} empleo${matches.length > 1 ? "s" : ""} de "${esc(busqueda)}"</h2>
      <p style="font-size:13px;color:#8c8492;margin:0 0 16px">Justo lo que buscabas. Estos son los nuevos:</p>
      <table style="width:100%;border-collapse:collapse">${items}</table>
      <a href="${link}" style="display:inline-block;margin-top:22px;background:#C2502F;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:800;font-size:15px">Ver todos →</a>
      <p style="font-size:12px;color:#a99fb5;margin-top:24px">Te llega esto porque activaste alertas gratis en Konexu. Si no querés recibir más, respondé este correo.</p>
    </div>
  </div>`;
}

serve(async () => {
  const db = createClient(URL, KEY);
  const { data: leads } = await db
    .from("waitlist")
    .select("id,email,nombre,pais,busqueda,ultima_alerta_at,created_at")
    .not("busqueda", "is", null)
    .limit(1000);

  let enviados = 0, conMatch = 0;
  const errores: string[] = [];
  // Resumen para el admin: UN solo email por ciclo con todo lo enviado
  // (reemplaza a la copia espejo bcc por usuario, que llenaba la casilla).
  const resumen: { email: string; busqueda: string; pais: string; avisos: string[] }[] = [];

  for (const l of (leads ?? []) as any[]) {
    try {
      const email = String(l.email ?? "");
      if (!email.includes("@") || email.includes("example.com")) continue;

      // Primera alerta: mirar 30 días hacia atrás para que el usuario nuevo
      // arranque con los avisos que YA existen (caso real: 30 gerentes en NI
      // invisibles). El dedupe por contenido evita cualquier repetición futura.
      const desde = l.ultima_alerta_at ||
        new Date(Date.now() - 30 * 86400000).toISOString();
      // La gente escribe varios oficios separados por comas ("niñera, limpieza, cocina"):
      // se matchea cada término por separado — la frase literal completa no existe en ningún aviso.
      // Y dentro de cada término, por PALABRAS sin importar el orden: "higiene y seguridad"
      // debe encontrar "Seguridad e Higiene" (caso real: 4 de 6 avisos NI invertían el orden).
      const STOP = new Set(["y","e","o","u","de","del","la","el","los","las","en","para","con","por"]);
      const terminos = String(l.busqueda)
        .split(/[,;/]/)
        .map((t) => t.replace(/[%_'"\\;()]/g, "").trim().slice(0, 40))
        .filter((t) => t.length >= 3)
        .slice(0, 5);
      if (terminos.length === 0) continue;
      const cod = codPais(l.pais);
      let matches: any[] | null = null;

      if (cod) {
        // Con país: RPC insensible a tildes ("tecnico" encuentra "Técnico").
        // Caso real: "tecnico en hemoterapia" sin tilde recibió 0 alertas
        // teniendo 2 llamados exactos activos (2026-07-14).
        const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const terminosNorm = terminos.map((t) =>
          t.split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase())).slice(0, 4).map(norm).join(" ")
        ).filter((s) => s.length > 0);
        if (terminosNorm.length === 0) continue;
        const { data } = await db.rpc("buscar_concursos_alerta", {
          p_pais: cod, p_desde: desde, p_terminos: terminosNorm,
        });
        matches = data;
      } else {
        // Sin país: filtro ilike clásico. El RPC recorta el barrido global a las
        // 20k filas más recientes y perdería avisos viejos (regresión verificada).
        const filtroOr = terminos.flatMap((t) => {
          const palabras = t.split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase())).slice(0, 4);
          if (palabras.length === 0) return [];
          if (palabras.length === 1) return [`titulo.ilike.%${palabras[0]}%`, `cargo.ilike.%${palabras[0]}%`];
          const en = (col: string) => `and(${palabras.map((w) => `${col}.ilike.%${w}%`).join(",")})`;
          return [en("titulo"), en("cargo")];
        }).join(",");
        if (!filtroOr) continue;
        const { data } = await db.from("concursos")
          .select("id,titulo,cargo,organismo,pais,lugar")
          .eq("activo", true)
          .gt("created_at", desde)
          .or(filtroOr)
          .order("created_at", { ascending: false })
          .limit(8);
        matches = data;
      }
      if (!matches || matches.length === 0) continue;

      // Dedupe por CONTENIDO por persona: las fuentes borran y reinsertan los
      // mismos avisos a diario (created_at nuevo), y "creados desde tu última
      // alerta" repetía el mismo email todos los días (caso real: Leyssi recibió
      // los mismos 2 avisos el 09 y el 10/07). La clave es cargo|organismo|pais.
      const claveDe = (c: any) =>
        [String((c.cargo ?? "").trim() || c.titulo || "").trim().toLowerCase(),
         String(c.organismo ?? "").trim().toLowerCase(),
         String(c.pais ?? "")].join("|");
      const claves = matches.map(claveDe);
      const { data: yaEnviadas } = await db
        .from("alertas_enviadas")
        .select("clave")
        .eq("waitlist_id", l.id)
        .in("clave", claves);
      const yaSet = new Set((yaEnviadas ?? []).map((r: any) => r.clave));
      const nuevos = matches.filter((c: any) => !yaSet.has(claveDe(c)));
      if (nuevos.length === 0) continue;
      conMatch++;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Konexu <noreply@konexu.app>",
          to: [email],
          // Entregabilidad: sin emoji en el asunto (penaliza en remitentes nuevos)
          // y con List-Unsubscribe (Gmail lo premia; sin él castiga a bulk senders).
          headers: { "List-Unsubscribe": "<mailto:hola@konexu.app?subject=Baja%20de%20alertas>" },
          subject: `${nuevos.length} nuevo${nuevos.length > 1 ? "s" : ""} empleo${nuevos.length > 1 ? "s" : ""} de "${l.busqueda}" para ti`,
          html: plantilla(l.nombre, l.busqueda, nuevos),
        }),
      });

      if (res.ok) {
        enviados++;
        resumen.push({
          email,
          busqueda: String(l.busqueda ?? ""),
          pais: String(l.pais ?? "—"),
          avisos: nuevos.map((c: any) => String(c.cargo || c.titulo || "")),
        });
        await db.from("waitlist").update({ ultima_alerta_at: new Date().toISOString() }).eq("id", l.id);
        await db.from("alertas_enviadas").upsert(
          nuevos.map((c: any) => ({ waitlist_id: l.id, clave: claveDe(c) })),
          { onConflict: "waitlist_id,clave", ignoreDuplicates: true },
        );
      } else {
        errores.push(`${email}: Resend ${res.status}`);
      }
    } catch (e) {
      errores.push(`${l.email}: ${(e as Error).message.slice(0, 60)}`);
    }
  }

  // Un solo email al admin con todo lo del ciclo (auditoría: los avisos fuente
  // rotan a diario y el contenido no es reconstruible después).
  if (resumen.length > 0) {
    const totalAvisos = resumen.reduce((n, r) => n + r.avisos.length, 0);
    const bloques = resumen.map((r) => `
      <tr><td style="padding:10px 0;border-bottom:1px solid #EDE8E2">
        <div style="font-size:14px;font-weight:700;color:#1A1020">${esc(r.email)} · ${esc(r.pais)}</div>
        <div style="font-size:12px;color:#8c8492">buscaba: "${esc(r.busqueda)}"</div>
        <ul style="margin:6px 0 0;padding-left:18px;font-size:12px;color:#1A1020">
          ${r.avisos.map((a) => `<li>${esc(a)}</li>`).join("")}
        </ul>
      </td></tr>`).join("");
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Konexu <noreply@konexu.app>",
        to: ["alejandrodslp@gmail.com"],
        subject: `Resumen alertas: ${enviados} email${enviados > 1 ? "s" : ""}, ${totalAvisos} aviso${totalAvisos > 1 ? "s" : ""}${errores.length ? `, ${errores.length} errores` : ""}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px">
          <h3>Ciclo de alertas — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</h3>
          <table style="width:100%;border-collapse:collapse">${bloques}</table>
          ${errores.length ? `<p style="color:#C2502F;font-size:12px">Errores: ${esc(errores.join(" | "))}</p>` : ""}
        </div>`,
      }),
    }).catch(() => {});
  }

  return new Response(
    JSON.stringify({ ok: true, procesados: (leads ?? []).length, con_match: conMatch, enviados, errores }),
    { headers: { "Content-Type": "application/json" } },
  );
});
