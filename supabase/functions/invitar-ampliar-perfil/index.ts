import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Envío ÚNICO, disparado a mano (nunca por cron), para invitar a quienes ya
// están en la waitlist con el formulario corto (sin cuenta real todavía) a
// completar el bloque opcional "Ampliá tu perfil laboral" en konexu.app.
// No crea nada ni cambia nada en la waitlist — solo manda el email.
//
// Uso: POST con { admin_secret, dry_run? }
// dry_run=true → solo cuenta y lista emails, no manda nada.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const URL          = Deno.env.get("SUPABASE_URL")!;
const KEY          = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const ADMIN_SECRET = Deno.env.get("ACTIVAR_PREREGISTRADOS_SECRET") ?? "";
const SITE = "https://www.konexu.app";

function plantilla(nombre: string | null): string {
  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#FBF8F4">
    <div style="background:#0D1117;padding:24px 32px"><img src="https://www.konexu.app/logo-email.png" alt="Konexu" width="98" height="40" style="display:block;border:0"></div>
    <div style="padding:28px 32px">
      <p style="font-size:15px;color:#1A1020">${saludo}</p>
      <h2 style="color:#1A1020;font-size:20px;margin:8px 0 4px">Sumá más datos a tu perfil y mejorá tus alertas</h2>
      <p style="font-size:14px;color:#5A4E6A;line-height:1.6">Te anotaste en Konexu para recibir alertas de trabajo. Ahora podés ampliar tu perfil con más información (experiencia, oficio, disponibilidad, etc.) — así podemos ayudarte a ampliar tus posibilidades de coincidir con los trabajos en los que estás dispuesto a desempeñarte.</p>
      <p style="font-size:14px;color:#5A4E6A;line-height:1.6">Es opcional: si preferís seguir recibiendo solo las alertas como hasta ahora, no tenés que hacer nada.</p>
      <a href="${SITE}" style="display:inline-block;margin-top:16px;background:#C2502F;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:800;font-size:15px">Ampliar mi perfil →</a>
      <p style="font-size:12px;color:#a99fb5;margin-top:24px">Esta información es parte de tu perfil y no es accesible para empresas ni otros usuarios.</p>
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
    const dryRun = body?.dry_run === true;

    const db = createClient(URL, KEY, { auth: { persistSession: false } });

    // Candidatos: en waitlist, pero SIN cuenta real todavía (no aparecen en
    // auth.users). Son quienes se anotaron con el formulario corto y nunca
    // llenaron el bloque opcional.
    const { data: usuarios, error: usersErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersErr) throw usersErr;
    const emailsConCuenta = new Set((usuarios?.users ?? []).map((u) => (u.email ?? "").toLowerCase()));

    const { data: waitlist, error: wlErr } = await db.from("waitlist").select("email, nombre");
    if (wlErr) throw wlErr;

    const candidatos = (waitlist ?? []).filter((w) => !emailsConCuenta.has((w.email ?? "").toLowerCase()));

    if (dryRun) {
      return new Response(JSON.stringify({
        ok: true, dry_run: true, total: candidatos.length,
        emails: candidatos.map((c) => c.email),
      }), { headers: { "Content-Type": "application/json", ...CORS } });
    }

    let enviados = 0;
    const errores: string[] = [];
    for (const c of candidatos) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Konexu <noreply@konexu.app>",
            to: [c.email],
            subject: "Sumá más datos a tu perfil y mejorá tus alertas",
            html: plantilla(c.nombre),
          }),
        });
        if (res.ok) enviados++; else errores.push(`${c.email}: Resend ${res.status}`);
      } catch (e: any) {
        errores.push(`${c.email}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, procesados: candidatos.length, enviados, errores }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
});
