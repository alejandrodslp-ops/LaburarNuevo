// enviar-email-admin: utilidad para enviar un email puntual desde Konexu
// (noreply@konexu.app via Resend). Solo acepta la service role key como
// Authorization — mismo patrón de guardia que vigilante-scraper.
const RESEND_KEY  = Deno.env.get("RESEND_API_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  try {
    // La firma del JWT ya la validó el gateway (verify_jwt). Acá se exige rol
    // service_role: el anon key público queda afuera. Igualdad directa con la
    // service key también vale (por si verify_jwt se desactivara algún día).
    const auth = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
    let rol = "";
    try { rol = JSON.parse(atob(auth.split(".")[1] ?? "")).role ?? ""; } catch { /* no-jwt */ }
    if (!auth || (auth !== SERVICE_KEY && rol !== "service_role")) {
      return new Response(JSON.stringify({ error: "no autorizado" }), { status: 403 });
    }
    const { to, subject, html, reply_to } = await req.json();
    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: "faltan campos to/subject/html" }), { status: 400 });
    }
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Konexu <noreply@konexu.app>",
        to: [to],
        bcc: ["alejandrodslp@gmail.com"],
        ...(reply_to ? { reply_to } : {}),
        subject, html,
      }),
    });
    return new Response(JSON.stringify({ ok: r.ok, status: r.status }), {
      status: r.ok ? 200 : 500, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});
