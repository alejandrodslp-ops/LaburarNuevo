import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL = "alejandrodslp@gmail.com";
const ADMIN_PIN_LEGACY = Deno.env.get("ADMIN_PIN") || ""; // fallback mientras no haya pin_hash guardado
const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

function ok(d: unknown) {
  return new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json", ...CORS } });
}
function fail(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json", ...CORS } });
}

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return fail("No autorizado", 401);

  const db = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data: { user }, error: authErr } = await db.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user || user.email !== ADMIN_EMAIL) return fail("Acceso denegado", 403);

  const { accion, pin, pin_actual, pin_nuevo } = await req.json();

  const { data: fila, error: selErr } = await db.from("admin_pin_seguridad").select("*").eq("id", 1).single();
  if (selErr) console.log("SELECT admin_pin_seguridad ERROR:", JSON.stringify(selErr));
  const ahora = new Date();

  if (fila?.bloqueado_hasta && new Date(fila.bloqueado_hasta) > ahora) {
    const minutosRestantes = Math.ceil((new Date(fila.bloqueado_hasta).getTime() - ahora.getTime()) / 60000);
    return ok({ verificado: false, error: `Bloqueado por demasiados intentos. Probá de nuevo en ${minutosRestantes} min.` });
  }

  async function esCorrecto(candidato: string): Promise<boolean> {
    if (fila?.pin_hash) return (await hashPin(candidato)) === fila.pin_hash;
    if (ADMIN_PIN_LEGACY) return candidato === ADMIN_PIN_LEGACY; // migración: todavía no cambiaron el PIN desde la app
    return false;
  }

  async function registrarFallo() {
    const intentos = (fila?.intentos_fallidos ?? 0) + 1;
    const bloqueado = intentos >= MAX_INTENTOS;
    const { error: updErr } = await db.from("admin_pin_seguridad").update({
      intentos_fallidos: bloqueado ? 0 : intentos,
      bloqueado_hasta: bloqueado ? new Date(ahora.getTime() + BLOQUEO_MINUTOS * 60000).toISOString() : null,
      actualizado_at: ahora.toISOString(),
    }).eq("id", 1);
    if (updErr) console.log("registrarFallo UPDATE ERROR:", JSON.stringify(updErr));
    return bloqueado
      ? `PIN incorrecto. Bloqueado ${BLOQUEO_MINUTOS} minutos por demasiados intentos.`
      : `PIN incorrecto. Te quedan ${MAX_INTENTOS - intentos} intento(s).`;
  }

  async function registrarExito() {
    await db.from("admin_pin_seguridad").update({
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      actualizado_at: ahora.toISOString(),
    }).eq("id", 1);
  }

  if (accion === "cambiar") {
    if (!pin_actual || !pin_nuevo) return fail("Faltan datos", 400);
    if (String(pin_nuevo).length < 4) return ok({ verificado: false, error: "El PIN nuevo debe tener al menos 4 caracteres." });

    if (!(await esCorrecto(String(pin_actual).trim()))) {
      return ok({ verificado: false, error: await registrarFallo() });
    }
    const nuevoHash = await hashPin(String(pin_nuevo).trim());
    await db.from("admin_pin_seguridad").update({
      pin_hash: nuevoHash,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      actualizado_at: ahora.toISOString(),
    }).eq("id", 1);
    return ok({ verificado: true, cambiado: true });
  }

  // accion "verificar" (default)
  if (!(await esCorrecto(String(pin ?? "").trim()))) {
    return ok({ verificado: false, error: await registrarFallo() });
  }
  await registrarExito();
  return ok({ verificado: true });
});
