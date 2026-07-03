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
};
function codPais(s: string | null): string | null {
  if (!s) return null;
  const n = s.replace(/[^\p{L}\s]/gu, "").trim().toLowerCase();
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
    <div style="background:#0D1117;padding:24px 32px"><span style="font-size:26px;font-weight:900;color:#E8785A">Konexu</span><span style="font-size:11px;vertical-align:sub;margin-left:-2px">🧩</span></div>
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

  for (const l of (leads ?? []) as any[]) {
    try {
      const email = String(l.email ?? "");
      if (!email.includes("@") || email.includes("example.com")) continue;

      const desde = l.ultima_alerta_at || l.created_at;
      const term  = String(l.busqueda).replace(/[%_'"\\;]/g, "").slice(0, 60).trim();
      if (!term) continue;

      let q = db.from("concursos")
        .select("id,titulo,cargo,organismo,pais,lugar")
        .eq("activo", true)
        .gt("created_at", desde)
        .or(`titulo.ilike.%${term}%,cargo.ilike.%${term}%`)
        .order("created_at", { ascending: false })
        .limit(8);

      const cod = codPais(l.pais);
      if (cod) q = q.eq("pais", cod);

      const { data: matches } = await q;
      if (!matches || matches.length === 0) continue;
      conMatch++;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Konexu <noreply@konexu.app>",
          to: [email],
          subject: `🔔 ${matches.length} nuevo${matches.length > 1 ? "s" : ""} empleo${matches.length > 1 ? "s" : ""} de "${l.busqueda}"`,
          html: plantilla(l.nombre, l.busqueda, matches),
        }),
      });

      if (res.ok) {
        enviados++;
        await db.from("waitlist").update({ ultima_alerta_at: new Date().toISOString() }).eq("id", l.id);
      } else {
        errores.push(`${email}: Resend ${res.status}`);
      }
    } catch (e) {
      errores.push(`${l.email}: ${(e as Error).message.slice(0, 60)}`);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, procesados: (leads ?? []).length, con_match: conMatch, enviados, errores }),
    { headers: { "Content-Type": "application/json" } },
  );
});
