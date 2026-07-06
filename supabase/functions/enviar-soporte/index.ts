import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { email, nombre, mensaje, categoria } = await req.json();

    if (!email || !mensaje?.trim()) {
      return new Response(JSON.stringify({ error: "email y mensaje requeridos" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SOPORTE_EMAIL = Deno.env.get("SOPORTE_EMAIL") ?? "soporte@konexu.app";
    // konexu.app es el dominio verificado en Resend — no-reply@nexu.app rebotaba
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Konexu <noreply@konexu.app>";

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY no configurada");

    const asunto = categoria
      ? `[Konexu Soporte] ${categoria} — ${nombre || email}`
      : `[Konexu Soporte] Mensaje de ${nombre || email}`;

    const htmlInterno = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#E8785A">📩 Nuevo mensaje de soporte</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;font-weight:bold;width:120px">Usuario</td><td style="padding:8px">${nombre || '—'}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px"><a href="mailto:${email}">${email}</a></td></tr>
          ${categoria ? `<tr><td style="padding:8px;font-weight:bold">Categoría</td><td style="padding:8px">${categoria}</td></tr>` : ''}
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;vertical-align:top">Mensaje</td><td style="padding:8px;white-space:pre-wrap">${mensaje.trim()}</td></tr>
        </table>
        <p style="color:#999;font-size:12px;margin-top:24px">Enviado desde Konexu app · ${new Date().toISOString()}</p>
      </div>
    `;

    const htmlConfirmacion = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#E8785A">✅ Recibimos tu mensaje</h2>
        <p>Hola ${nombre || 'usuario'},</p>
        <p>Recibimos tu consulta y te responderemos a la brevedad en este mismo email.</p>
        <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#666;font-size:14px;white-space:pre-wrap">${mensaje.trim()}</p>
        </div>
        <p style="color:#999;font-size:12px">Equipo Konexu</p>
      </div>
    `;

    // Enviar ambos emails en paralelo
    const [resInterno, resConfirm] = await Promise.all([
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [SOPORTE_EMAIL],
          reply_to: email,
          subject: asunto,
          html: htmlInterno,
        }),
      }),
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [email],
          subject: "Recibimos tu mensaje — Konexu Soporte",
          html: htmlConfirmacion,
        }),
      }),
    ]);

    const ok = resInterno.ok;
    console.log("soporte enviado:", ok, "confirm:", resConfirm.ok);

    return new Response(JSON.stringify({ ok }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    console.log("Error enviar-soporte:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
