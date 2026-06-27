import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// monitor-crons: revisa si algún cron job falló en las últimas 24h y, si sí, manda
// un email de alerta vía Resend. Aditivo: solo lee. Pensado para correr 1-2 veces al día.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL   = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@konexu.app";
const ALERT_EMAIL  = "alejandrodslp@gmail.com";

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: fallidos, error } = await supabase.rpc("crons_fallidos_24h");
    if (error) throw error;

    if (!fallidos || fallidos.length === 0) {
      return json({ ok: true, fallos: 0, mensaje: "Todos los crons OK" });
    }

    // Hay fallos → alertar por email
    const filas = fallidos.map((f: { jobname: string; fallos: number; ultimo_error: string }) =>
      `<tr><td style="padding:6px 12px;border:1px solid #eee"><b>${f.jobname}</b></td>
       <td style="padding:6px 12px;border:1px solid #eee;text-align:center">${f.fallos}</td>
       <td style="padding:6px 12px;border:1px solid #eee;color:#b91c1c;font-size:12px">${f.ultimo_error}</td></tr>`
    ).join("");

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#b91c1c">⚠️ Konexu — cron(s) con fallos</h2>
        <p>En las últimas 24 horas, estos cron jobs fallaron. Revisalos:</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <tr style="background:#f8f8f8"><th style="padding:6px 12px;border:1px solid #eee;text-align:left">Cron</th>
          <th style="padding:6px 12px;border:1px solid #eee">Fallos</th>
          <th style="padding:6px 12px;border:1px solid #eee;text-align:left">Último error</th></tr>
          ${filas}
        </table>
        <p style="color:#888;font-size:12px;margin-top:20px">Alerta automática de Konexu (monitor-crons).</p>
      </div>`;

    if (RESEND_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL, to: ALERT_EMAIL,
          subject: `⚠️ Konexu: ${fallidos.length} cron(s) con fallos`,
          html,
        }),
      });
    }
    return json({ ok: true, fallos: fallidos.length, alertado: !!RESEND_KEY, detalle: fallidos });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
