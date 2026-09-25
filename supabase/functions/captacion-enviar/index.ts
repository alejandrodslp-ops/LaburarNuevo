// captacion-enviar — envía la campaña de captación de empresas por Resend.
// Body: { guard, contactos:[{empresa,email,puesto}], dry_to?, from?, reply_to? }
// Si dry_to está seteado, TODO va a esa dirección (modo prueba).
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const GUARD = "kx-capt-9f3a2b"; // guard simple para esta función privada

function plantillaPT(empresa: string, puesto: string) {
  return `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.62;color:#221A22;max-width:600px;margin:0 auto">
  <p style="color:#C2502F;font-weight:800;font-size:17px;margin:0 0 18px">Konexu</p>
  <p style="margin:0 0 16px">Prezada equipe da <strong>${empresa}</strong>:</p>
  <p style="margin:0 0 16px">Vimos que está com uma vaga aberta de <strong>${puesto}</strong> e por isso escrevemos da Konexu: pode publicá-la gratuitamente —e todas as que precisar—, e os candidatos entram em contato diretamente, no e-mail ou endereço indicado para o recebimento das candidaturas.</p>
  <p style="margin:0 0 24px">Já há trabalhadores da sua região em busca de emprego. Publicar uma vaga leva cerca de 2 minutos.</p>
  <p style="margin:0 0 24px"><a href="https://www.konexu.app/empleador/login" style="display:inline-block;background:#E8785A;color:#fff;padding:14px 28px;border-radius:10px;font-weight:800;text-decoration:none">Publicar uma vaga &nbsp;→</a></p>
  <p style="margin:0 0 22px;color:#6E6670;font-size:14px">Se não for de seu interesse, é só ignorar este e-mail.</p>
  <p style="margin:0;border-top:1px solid #EFE9E2;padding-top:18px">Equipe da Konexu<br><span style="color:#8A8189;font-size:14px">konexu.app</span></p>
  <p style="margin:18px 0 0;font-size:11.5px;color:#A79FA6">Você recebeu este e-mail porque sua empresa publica vagas. Para não receber mais, responda "sair".</p>
</div>`;
}

function plantillaES(_empresa: string) {
  return `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.62;color:#221A22;max-width:600px;margin:0 auto">
  <p style="color:#C2502F;font-weight:800;font-size:17px;margin:0 0 18px">Konexu</p>
  <p style="margin:0 0 16px">Estimados:</p>
  <p style="margin:0 0 16px">Nos comunicamos de Konexu, una plataforma dedicada a facilitar la conexión entre las empresas y la mano de obra que requieren, simplificando y agilizando ese proceso de manera gratuita.</p>
  <p style="margin:0 0 16px">Cuando necesiten sumar personal, pueden publicar el puesto <strong>sin costo alguno</strong> y recibir los currículums de los candidatos que se ajusten al perfil requerido, en el correo o número que ustedes indiquen. Sin intermediarios.</p>
  <p style="margin:0 0 24px">Publicar una búsqueda lleva unos 2 minutos, y pueden hacerlo las veces que lo necesiten.</p>
  <p style="margin:0 0 24px"><a href="https://www.konexu.app/empleador/login" style="display:inline-block;background:#E8785A;color:#fff;padding:14px 28px;border-radius:10px;font-weight:800;text-decoration:none">Publicar un puesto &nbsp;→</a></p>
  <p style="margin:0 0 22px;color:#6E6670;font-size:14px">Si no es de su interés, pueden ignorar este correo.</p>
  <p style="margin:0;border-top:1px solid #EFE9E2;padding-top:18px">Equipo de Konexu<br><span style="color:#8A8189;font-size:14px">konexu.app</span></p>
  <p style="margin:18px 0 0;font-size:11.5px;color:#A79FA6">Recibió este correo porque su empresa figura en el registro público de empresas. Si prefiere no recibir más, responda con "baja".</p>
</div>`;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.guard !== GUARD) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    if (!RESEND_KEY) return new Response(JSON.stringify({ error: "sin RESEND_API_KEY" }), { status: 500 });

    const contactos = Array.isArray(body.contactos) ? body.contactos : [];
    const dry_to = body.dry_to || null;
    const from = body.from || "Konexu Parcerias <parcerias@konexu.app>";
    const reply_to = body.reply_to || "hola@konexu.app";
    const tpl = body.tpl || "pt";
    const asuntoFijo = body.asunto || null;

    const results: any[] = [];
    for (const c of contactos) {
      const asunto = asuntoFijo || (tpl === "es" ? "Publiquen sus vacantes gratis en Konexu" : `Sobre a sua vaga de ${c.puesto}`);
      const to = dry_to || c.email;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          reply_to,
          subject: (dry_to ? `[PRUEBA] ` : "") + asunto,
          html: tpl === "es" ? plantillaES(c.empresa) : plantillaPT(c.empresa, c.puesto),
          headers: { "List-Unsubscribe": '<mailto:hola@konexu.app?subject=Baja>' },
        }),
      });
      let id = null; let resp = null;
      try { resp = await res.json(); id = resp?.id ?? null; } catch { /* */ }
      const hdr = {
        limit: res.headers.get("ratelimit-limit"),
        remaining: res.headers.get("ratelimit-remaining"),
        reset: res.headers.get("ratelimit-reset"),
        retry_after: res.headers.get("retry-after"),
      };
      results.push({ empresa: c.empresa, to, status: res.status, id, resp, hdr });
      await new Promise((r) => setTimeout(r, 900)); // throttle
    }
    const ok = results.filter((r) => r.status === 200).length;
    return new Response(JSON.stringify({ enviados_ok: ok, total: results.length, modo: dry_to ? "PRUEBA" : "REAL", results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
