import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function ok(d: unknown) {
  return new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json", ...CORS } });
}
function err(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const db = createClient(URL, KEY, { auth: { persistSession: false } });

  try {
    const { accion, email, nombre, push_token, pais, busqueda } = await req.json();

    // ── Estado global de la waitlist ──────────────────────────────────────────
    if (accion === "estado") {
      const { data: cfg } = await db.from("waitlist_config").select("activo, batch_size, intervalo_minutos").eq("id", 1).single();
      const { count: total }      = await db.from("waitlist").select("*", { count: "exact", head: true });
      const { count: pendientes } = await db.from("waitlist").select("*", { count: "exact", head: true }).eq("habilitado", true).eq("registrado", false);
      return ok({ activo: cfg?.activo ?? false, total_espera: total ?? 0, pendientes: pendientes ?? 0 });
    }

    if (!email || !email.includes("@")) return err("Email inválido");
    const emailLower = email.toLowerCase().trim();

    // ── Consultar posición de un email ────────────────────────────────────────
    if (accion === "consultar") {
      const { data: cfg }    = await db.from("waitlist_config").select("activo").eq("id", 1).single();
      const { data: entrada } = await db.from("waitlist").select("posicion,habilitado,registrado").eq("email", emailLower).maybeSingle();
      return ok({
        activo:     cfg?.activo    ?? false,
        en_lista:   !!entrada,
        habilitado: entrada?.habilitado ?? false,
        registrado: entrada?.registrado ?? false,
        posicion:   entrada?.posicion   ?? null,
      });
    }

    // ── Unirse a la waitlist ──────────────────────────────────────────────────
    if (accion === "unirse") {
      const { data: existente } = await db.from("waitlist").select("posicion,habilitado").eq("email", emailLower).maybeSingle();
      if (existente) return ok({ ya_estaba: true, posicion: existente.posicion, habilitado: existente.habilitado });

      const { data: nuevo, error: insErr } = await db.from("waitlist")
        .insert({ email: emailLower, nombre: nombre?.trim() ?? null, push_token: push_token ?? null, pais: pais ?? null, busqueda: busqueda?.trim()?.slice(0, 120) || null })
        .select("posicion")
        .single();

      if (insErr) return err(insErr.message);

      // Disparar autorizador en background (no esperamos respuesta)
      fetch(`${URL}/functions/v1/waitlist-autorizador`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});

      return ok({ posicion: nuevo.posicion, habilitado: false, ya_estaba: false });
    }

    // ── Marcar como registrado (llamar después del signUp exitoso) ────────────
    if (accion === "registrado") {
      await db.from("waitlist").update({ registrado: true }).eq("email", emailLower);
      return ok({ ok: true });
    }

    return err("acción desconocida");
  } catch (e: any) {
    return err(e.message);
  }
});
