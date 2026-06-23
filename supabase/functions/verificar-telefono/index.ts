import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@konexu.app";

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

  const { accion, telefono, codigo } = await req.json();

  if (accion === "enviar_otp") {
    if (!telefono || telefono.trim().length < 6) return fail("Teléfono inválido");

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: updateErr } = await db.from("profiles").update({
      telefono: telefono.trim(),
      telefono_otp: otp,
      telefono_otp_expiry: expiry,
      telefono_verificado: false,
    }).eq("id", user.id);

    if (updateErr) {
      console.error("Error guardando OTP:", updateErr);
      return fail("Error interno al guardar el código. Verificá que las columnas existen en profiles.");
    }

    if (!RESEND_KEY) {
      // Modo desarrollo: devuelve el OTP directamente
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
        subject: "Tu código de verificación — Konexu",
        html: `
          <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px">
            <h2 style="color:#E8785A;margin-bottom:8px">Verificación de teléfono</h2>
            <p style="color:#5A4E6A;margin-bottom:24px">Tu código de verificación es:</p>
            <div style="background:#FBF8F4;border:2px solid #E8785A;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
              <span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#1A1020">${otp}</span>
            </div>
            <p style="color:#A898B8;font-size:13px">Válido por 10 minutos. Si no solicitaste esto, ignorá este email.</p>
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
      .select("telefono_otp, telefono_otp_expiry")
      .eq("id", user.id)
      .single();

    if (!perfil?.telefono_otp || perfil.telefono_otp !== codigo) {
      return ok({ ok: false, error: "Código incorrecto" });
    }
    if (!perfil.telefono_otp_expiry || new Date(perfil.telefono_otp_expiry) < new Date()) {
      return ok({ ok: false, error: "El código venció. Pedí uno nuevo." });
    }

    await db.from("profiles").update({
      telefono_verificado: true,
      telefono_otp: null,
      telefono_otp_expiry: null,
    }).eq("id", user.id);

    return ok({ ok: true });
  }

  return fail("Acción no válida");
});
