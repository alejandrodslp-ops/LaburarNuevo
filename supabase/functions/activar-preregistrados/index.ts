import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Se dispara A MANO el día del lanzamiento (nunca por cron). Busca las
// cuentas creadas desde el bloque opcional "reservar cuenta" del formulario
// web (waitlist/index.ts) que todavía no activaron su período gratis, les
// pone los 25 días desde HOY (no desde que se anotaron — por eso quedó en
// NULL hasta ahora) y les manda el link para poner su contraseña.
//
// Uso: POST con { admin_secret, dias_gratis?, dry_run? }
// dry_run=true → solo cuenta y lista emails, no manda nada ni escribe nada.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const URL         = Deno.env.get("SUPABASE_URL")!;
const KEY         = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY  = Deno.env.get("RESEND_API_KEY") ?? "";
// Secreto propio (no el ADMIN_SECRET compartido con otras funciones) para no
// arriesgar tocar algo de lo que ya depende mensaje-bienvenida en producción.
const ADMIN_SECRET = Deno.env.get("ACTIVAR_PREREGISTRADOS_SECRET") ?? "";
const SITE = "https://www.konexu.app";
const NEXU_SISTEMA_ID = "43a7baf9-f88e-463b-8e4c-385bd3fb8151"; // cuenta sistema (mensaje-bienvenida) — nunca un candidato real

function plantilla(nombre: string | null, linkActivacion: string, dias: number): string {
  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#FBF8F4">
    <div style="background:#0D1117;padding:24px 32px"><img src="https://www.konexu.app/logo-email.png" alt="Konexu" width="98" height="40" style="display:block;border:0"></div>
    <div style="padding:28px 32px">
      <p style="font-size:15px;color:#1A1020">${saludo}</p>
      <h2 style="color:#1A1020;font-size:20px;margin:8px 0 4px">¡Konexu ya está en marcha! 🎉</h2>
      <p style="font-size:14px;color:#5A4E6A;line-height:1.6">Reservaste tu perfil antes del lanzamiento — como agradecimiento, tu cuenta ya tiene <strong>${dias} días gratis</strong> esperándote.</p>
      <p style="font-size:14px;color:#5A4E6A;line-height:1.6">Solo falta un paso: poné tu contraseña para entrar.</p>
      <a href="${linkActivacion}" style="display:inline-block;margin-top:16px;background:#C2502F;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:800;font-size:15px">Activar mi cuenta →</a>
      <p style="font-size:12px;color:#a99fb5;margin-top:24px">Recibís esto porque dejaste tus datos en konexu.app antes del lanzamiento.</p>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    if (!ADMIN_SECRET || body?.admin_secret !== ADMIN_SECRET) {
      return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401, headers: CORS });
    }
    const dias = Number(body?.dias_gratis ?? 25);
    const dryRun = body?.dry_run === true;

    const db = createClient(URL, KEY, { auth: { persistSession: false } });

    // Candidatos: NO se puede filtrar por periodo_gratis_hasta IS NULL —
    // hay un trigger (trigger_perfil_gratis / activar_perfil_gratis()) que le
    // pone 10 días fijos a CUALQUIER insert en profiles, sin condición. No
    // rompe nada (nadie puede entrar sin contraseña), pero significa que el
    // único indicador confiable de "pre-registrado, nunca activó" es
    // auth.users.last_sign_in_at IS NULL — eso sí lo mantiene Supabase.
    let candidatos: { id: string; nombre: string | null; email: string }[] = [];
    let page = 1;
    while (true) {
      const { data: pageData, error: listErr } = await db.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr) throw listErr;
      const nuncaEntro = (pageData.users ?? []).filter((u) => !u.last_sign_in_at);
      if (nuncaEntro.length > 0) {
        const ids = nuncaEntro.map((u) => u.id);
        const { data: perfiles } = await db.from("profiles").select("id, nombre, rol").in("id", ids);
        for (const u of nuncaEntro) {
          const p = perfiles?.find((x) => x.id === u.id);
          if (p && p.rol === "worker" && u.email && u.id !== NEXU_SISTEMA_ID) candidatos.push({ id: u.id, nombre: p.nombre, email: u.email });
        }
      }
      if (!pageData.users || pageData.users.length < 200) break;
      page++;
    }
    if (candidatos.length === 0) {
      return new Response(JSON.stringify({ ok: true, procesados: 0, enviados: 0 }), { headers: CORS });
    }

    let enviados = 0;
    const errores: string[] = [];
    const emailsDryRun: string[] = [];
    const gratisHasta = new Date(Date.now() + dias * 86400000).toISOString();

    for (const c of candidatos) {
      try {
        const email = c.email;
        if (dryRun) { emailsDryRun.push(email); continue; }

        const { error: updErr } = await db.from("profiles")
          .update({ periodo_gratis_hasta: gratisHasta, perfil_activo: true, perfil_activo_hasta: gratisHasta })
          .eq("id", c.id);
        if (updErr) { errores.push(`${email}: ${updErr.message}`); continue; }

        const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
          type: "recovery", email, options: { redirectTo: `${SITE}/recuperar` },
        });
        if (linkErr || !linkData?.properties?.action_link) {
          errores.push(`${email}: sin link — ${linkErr?.message ?? "desconocido"}`);
          continue;
        }

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Konexu <noreply@konexu.app>",
            to: [email],
            subject: `Tu cuenta de Konexu ya está lista — ${dias} días gratis`,
            html: plantilla(c.nombre, linkData.properties.action_link, dias),
          }),
        });
        if (res.ok) enviados++; else errores.push(`${email}: Resend ${res.status}`);
      } catch (e: any) {
        errores.push(`${c.id}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({
      ok: true, procesados: candidatos.length, enviados, errores,
      ...(dryRun ? { dry_run: true, emails: emailsDryRun } : {}),
    }), { headers: { "Content-Type": "application/json", ...CORS } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
});
