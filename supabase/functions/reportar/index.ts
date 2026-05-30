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

  const { reported_id, motivo, detalle } = await req.json();
  if (!reported_id || !motivo) return fail("Datos incompletos");
  if (reported_id === user.id) return fail("No podés reportarte a vos mismo");

  // Verificar si ya reportó a este usuario
  const { data: existing } = await db.from("reportes")
    .select("id").eq("reporter_id", user.id).eq("reported_id", reported_id).maybeSingle();
  if (existing) return ok({ ok: false, ya_reportado: true });

  // Insertar reporte
  const { error: insErr } = await db.from("reportes").insert({
    reporter_id: user.id,
    reported_id,
    motivo,
    detalle: detalle?.trim() || null,
    estado: "pendiente",
  });
  if (insErr) return fail(insErr.message);

  // Contar reportes activos contra este usuario
  const { count } = await db.from("reportes")
    .select("*", { count: "exact", head: true })
    .eq("reported_id", reported_id)
    .eq("estado", "pendiente");
  const total = count ?? 0;

  // Actualizar total_reportes en profiles
  await db.from("profiles").update({ total_reportes: total }).eq("id", reported_id);

  // Auto-suspender a partir de 3 denuncias
  if (total >= 3) {
    await db.from("profiles").update({
      suspendido: true,
      suspendido_motivo: `Auto-suspendido: ${total} denuncias`,
      suspendido_at: new Date().toISOString(),
      perfil_activo: false,
    }).eq("id", reported_id).eq("suspendido", false); // evitar sobreescribir si ya estaba suspendido
  }

  return ok({ ok: true, total_reportes: total, suspendido: total >= 3 });
});
