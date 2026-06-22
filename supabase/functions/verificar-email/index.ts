import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

function ok(d: unknown) {
  return new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json", ...CORS } });
}
function fail(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json", ...CORS } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return fail("No autorizado", 401);

  const db = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data: { user }, error: authErr } = await db.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return fail("No autorizado", 401);

  const { accion, codigo } = await req.json();

  if (accion === "enviar_otp") {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: updateErr } = await db.from("profiles").update({
      email_otp: otp,
      email_otp_expiry: expiry,
      email_verificado: false,
    }).eq("id", user.id);

    if (updateErr) return fail("Error interno al guardar el código.");

    if (!RESEND_KEY) {
      return ok({ ok: true, dev_otp: otp });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: user.email,
        subject: "Verificá tu cuenta en Konexu",
        html: `
          <div style="font-family:sans-serif;max-width:440px;margin:0 auto;padding:40px 32px;background:#FBF8F4;border-radius:16px">
            <div style="text-align:center;margin-bottom:28px">
              <span style="font-size:48px">✉️</span>
            </div>
            <h2 style="color:#1A1020;font-size:22px;font-weight:900;text-align:center;margin-bottom:8px">Verificá tu email</h2>
            <p style="color:#5A4E6A;text-align:center;margin-bottom:28px;font-size:15px">Tu código de verificación para Konexu es:</p>
            <div style="background:#FFFFFF;border:2.5px solid #E8785A;border-radius:16px;padding:24px;text-align:center;margin-bottom:28px">
              <span style="font-size:44px;font-weight:900;letter-spacing:12px;color:#1A1020;display:inline-block;padding:8px 0">${otp}</span>
            </div>
            <p style="color:#A898B8;font-size:13px;text-align:center;line-height:20px">Válido por 10 minutos.<br>Si no creaste una cuenta en Konexu, ignorá este email.</p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const body = await emailRes.text();
      console.error("Resend error:", body);
      return fail("Error enviando email");
    }

    return ok({ ok: true });
  }

  if (accion === "verificar") {
    if (!codigo || codigo.length !== 6) return fail("Código inválido");

    const { data: perfil } = await db.from("profiles")
      .select("email_otp, email_otp_expiry")
      .eq("id", user.id)
      .single();

    if (!perfil?.email_otp || perfil.email_otp !== codigo) {
      return ok({ ok: false, error: "Código incorrecto" });
    }
    if (!perfil.email_otp_expiry || new Date(perfil.email_otp_expiry) < new Date()) {
      return ok({ ok: false, error: "El código venció. Pedí uno nuevo." });
    }

    await db.from("profiles").update({
      email_verificado: true,
      email_otp: null,
      email_otp_expiry: null,
    }).eq("id", user.id);

    return ok({ ok: true });
  }

  return fail("Acción no válida");
});
