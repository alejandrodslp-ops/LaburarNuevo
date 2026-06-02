import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Variables le&iacute;das dentro del handler (no en module scope en Deno Deploy)

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Genera el n&uacute;mero correlativo del comprobante: NEXU-2026-000001
async function generarNumero(sb: ReturnType<typeof createClient>): Promise<string> {
  const { count } = await sb
    .from("comprobantes")
    .select("*", { count: "exact", head: true });
  const n = String((count ?? 0) + 1).padStart(6, "0");
  return `NEXU-${new Date().getFullYear()}-${n}`;
}

// HTML del comprobante &mdash; dise&ntilde;o profesional imprimible
function generarHTML(data: {
  numero: string;
  fecha: string;
  razon_social: string;
  rut_nit: string;
  email: string;
  concepto: string;
  monto: number;
  moneda: string;
  metodo: string;
  referencia: string;
}): string {
  // Formateadores 100% ASCII para evitar caracteres no-ASCII en el HTML
  const MESES = ["enero","febrero","marzo","abril","mayo","junio",
                 "julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const d = new Date(data.fecha);
  const fecha = `${String(d.getUTCDate()).padStart(2,"0")} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  // Formato de monto sin Intl (evita non-breaking space U+00A0)
  const montoFmt = `${data.moneda === "USD" ? "USD" : data.moneda} ${data.monto.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",")}`;
  const metodoLabel: Record<string, string> = {
    mercadopago: "MercadoPago", card: "Tarjeta de cr&eacute;dito/d&eacute;bito",
    abitab: "Abitab / RedPagos", cell: "Saldo celular", stripe: "Tarjeta",
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Comprobante ${data.numero} &mdash; Nexu</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; color: #1A1020; background: #fff; padding: 40px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; border-bottom:3px solid #E8785A; padding-bottom:24px; }
  .logo { font-size:32px; font-weight:900; color:#E8785A; letter-spacing:-1px; }
  .logo-sub { font-size:12px; color:#888; margin-top:2px; }
  .comp-num { text-align:right; }
  .comp-num h2 { font-size:14px; color:#888; font-weight:600; letter-spacing:1px; text-transform:uppercase; }
  .comp-num h1 { font-size:22px; font-weight:900; color:#1A1020; }
  .comp-num p { font-size:13px; color:#666; margin-top:4px; }
  .section { margin-bottom:28px; }
  .section h3 { font-size:11px; color:#888; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:10px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .info-item label { font-size:11px; color:#999; display:block; margin-bottom:2px; }
  .info-item p { font-size:14px; color:#1A1020; font-weight:600; }
  table { width:100%; border-collapse:collapse; margin-bottom:24px; }
  thead th { background:#F5F0EB; padding:10px 16px; text-align:left; font-size:12px; color:#666; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
  tbody td { padding:14px 16px; border-bottom:1px solid #EDE8E2; font-size:14px; }
  .total-row { background:#FFF8F5; }
  .total-row td { font-weight:900; font-size:18px; color:#E8785A; border-bottom:none; }
  .footer { margin-top:40px; padding-top:20px; border-top:1px solid #EDE8E2; font-size:11px; color:#999; line-height:1.8; }
  .stamp { display:inline-block; border:2px solid #22C55E; color:#22C55E; padding:6px 18px; border-radius:6px; font-size:13px; font-weight:800; letter-spacing:1px; margin-bottom:16px; }
  @media print { body { padding:20px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Nexu</div>
      <div class="logo-sub">nexu.app &middot; Plataforma de empleo</div>
    </div>
    <div class="comp-num">
      <h2>Comprobante de pago</h2>
      <h1>${data.numero}</h1>
      <p>${fecha}</p>
    </div>
  </div>

  <div class="section">
    <div class="stamp">&#x2713; PAGADO</div>
    <div class="info-grid">
      <div class="info-item">
        <label>Emisor</label>
        <p>Nexu &mdash; Plataforma de empleo</p>
      </div>
      <div class="info-item">
        <label>Receptor</label>
        <p>${data.razon_social || "&mdash;"}</p>
      </div>
      ${data.rut_nit ? `<div class="info-item"><label>RUT / NIT / CUIT</label><p>${data.rut_nit}</p></div>` : ""}
      <div class="info-item">
        <label>Email</label>
        <p>${data.email}</p>
      </div>
    </div>
  </div>

  <div class="section">
    <h3>Detalle del servicio</h3>
    <table>
      <thead>
        <tr>
          <th>Concepto</th>
          <th style="text-align:right">Importe</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${data.concepto}</td>
          <td style="text-align:right">${montoFmt}</td>
        </tr>
        <tr class="total-row">
          <td>TOTAL</td>
          <td style="text-align:right">${montoFmt}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="info-grid">
      <div class="info-item">
        <label>M&eacute;todo de pago</label>
        <p>${metodoLabel[data.metodo] ?? data.metodo}</p>
      </div>
      <div class="info-item">
        <label>Referencia de transacci&oacute;n</label>
        <p style="font-family:monospace; font-size:12px">${data.referencia}</p>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>Este documento es un comprobante de pago v&aacute;lido emitido por Nexu.</p>
    <p>Para consultas: soporte@nexu.app &middot; nexu.app</p>
    <p style="margin-top:8px; color:#ccc">${data.numero} &middot; Generado autom&aacute;ticamente el ${fecha}</p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Inicializar dentro del handler &mdash; variables de entorno disponibles en runtime
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  // Usar NEXU_SERVICE_KEY (clave personalizada) o SUPABASE_SERVICE_ROLE_KEY como fallback
  const SERVICE_KEY  = Deno.env.get("NEXU_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
  const supabase     = createClient(SUPABASE_URL, SERVICE_KEY);

  // Funci&oacute;n interna &mdash; validaci&oacute;n de employer_id contra la DB

  const {
    employer_id,
    monto,
    moneda = "USD",
    metodo,
    referencia_externa,
    concepto = "Suscripci&oacute;n Nexu &mdash; Visualizaciones de perfiles",
  } = await req.json();

  if (!employer_id || !monto || !metodo) {
    return new Response(JSON.stringify({ error: "Faltan datos requeridos" }), { status: 400, headers: CORS });
  }

  // Obtener datos del empleador (perfil + email de auth.users)
  const [{ data: perfil }, { data: authUser }] = await Promise.all([
    supabase.from("profiles").select("nombre, apellido1, pais, ciudad").eq("id", employer_id).single(),
    supabase.auth.admin.getUserById(employer_id),
  ]);

  if (!perfil) {
    return new Response(JSON.stringify({ error: "Empleador no encontrado" }), { status: 404, headers: CORS });
  }

  const numero   = await generarNumero(supabase);
  const fecha    = new Date().toISOString();
  const razon_social = `${perfil.nombre ?? ""} ${(perfil as any).apellido1 ?? ""}`.trim() || "Cliente";
  const email    = authUser?.user?.email ?? "";

  // Generar HTML del comprobante
  const html = generarHTML({
    numero, fecha, razon_social, email,
    rut_nit: "",
    concepto, monto, moneda, metodo,
    referencia: referencia_externa ?? "&mdash;",
  });

  // Guardar HTML en Supabase Storage
  const fileName  = `${employer_id}/${numero}.html`;
  const { error: storageErr } = await supabase.storage
    .from("comprobantes")
    .upload(fileName, new Blob([new TextEncoder().encode(html)], { type: "text/html; charset=utf-8" }), { upsert: true });

  let htmlUrl: string | null = null;
  if (!storageErr) {
    const { data: urlData } = supabase.storage.from("comprobantes").getPublicUrl(fileName);
    htmlUrl = urlData?.publicUrl ?? null;
  }

  // Registrar en la tabla comprobantes
  const { data: comp, error: dbErr } = await supabase
    .from("comprobantes")
    .insert({
      employer_id, numero, fecha, monto, moneda, metodo,
      referencia_externa, razon_social, email, concepto, html_url: htmlUrl,
    })
    .select("id, numero")
    .single();

  if (dbErr) {
    console.error("Error al guardar comprobante:", dbErr.message);
    return new Response(JSON.stringify({ error: dbErr.message }), { status: 500, headers: CORS });
  }

  // Enviar por email si hay Resend configurado
  if (RESEND_KEY && email) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from:    "Nexu <onboarding@resend.dev>",
        to:      [email],
        subject: ` Comprobante de pago ${numero} &mdash; Nexu`,
        html:    html,
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});
  }

  return new Response(JSON.stringify({
    ok:      true,
    numero,
    html_url: htmlUrl,
    id:      comp.id,
  }), { headers: { "Content-Type": "application/json", ...CORS } });
});
