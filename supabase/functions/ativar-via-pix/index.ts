import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Recibe la señal del Google Apps Script cuando detecta un pago PIX ────────
// Secreto compartido: PIX_WEBHOOK_SECRET en Supabase Secrets
// ────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  const PIX_SECRET   = Deno.env.get("PIX_WEBHOOK_SECRET") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verificar el secreto compartido con el Apps Script
  const incomingSecret = req.headers.get("x-pix-secret") ?? "";
  if (PIX_SECRET && incomingSecret !== PIX_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { ref_label } = await req.json();
    if (!ref_label || ref_label.length < 8) {
      return new Response(JSON.stringify({ error: "ref_label invalido" }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Buscar usuario por los primeros 8 chars del ref_label (= primeros 8 del UUID sin guiones)
    const prefijo = ref_label.slice(0, 8).toLowerCase();
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nombre, perfil_activo")
      .filter("id::text", "ilike", `${prefijo.slice(0, 4)}-${prefijo.slice(4)}%`)
      .limit(5);

    if (!profiles || profiles.length === 0) {
      console.error("Usuario no encontrado para ref_label:", ref_label);
      return new Response(JSON.stringify({ error: "Usuario no encontrado" }), { status: 404 });
    }

    const perfil = profiles[0];

    if (perfil.perfil_activo) {
      return new Response(JSON.stringify({ ok: true, ya_activo: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Activar perfil por 60 días
    const hasta = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("profiles").update({
      perfil_activo:       true,
      perfil_activo_hasta: hasta,
    }).eq("id", perfil.id);

    // Registrar pago
    await supabase.from("pagos").insert({
      user_id:            perfil.id,
      monto:              15,
      moneda:             "BRL",
      estado:             "aprobado",
      metodo:             "pix_rendimento",
      referencia_externa: ref_label,
    }).catch(() => {});

    // Generar comprobante (silencioso)
    supabase.functions.invoke("generar-comprobante", {
      body: {
        employer_id:        perfil.id,
        monto:              15,
        moneda:             "BRL",
        metodo:             "pix_rendimento",
        referencia_externa: ref_label,
        concepto:           "Ativacao perfil trabalhador Nexu - 60 dias",
      },
    }).catch(() => {});

    console.log("Perfil activado via PIX:", perfil.nombre, "ref:", ref_label);

    return new Response(JSON.stringify({ ok: true, usuario: perfil.nombre, hasta }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("ativar-via-pix error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});
