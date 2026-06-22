import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NEXU_ID      = "43a7baf9-f88e-463b-8e4c-385bd3fb8151"; // cuenta sistema Konexu
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") ?? "";

const MENSAJE_WORKER = "¡Bienvenido a Konexu! 🎉\n\nA partir de este momento trabajaremos para ayudarte a expandir tus posibilidades laborales.\n\nCompletá tu perfil para que podamos encontrar las oportunidades que mejor se adaptan a vos — cuanto más completo esté, más ofertas recibirás y mayor será el rango de concursos a los que podrás aplicar.\n\n¡Mucho éxito! 🚀";
const MENSAJE_EMPLOYER = "¡Bienvenido a Konexu! 🎉\n\nTu próximo trabajador ya está aquí.\n\nHay personas en tu zona con las habilidades que buscas, disponibles y esperando una propuesta. Solo falta dar inicio a la búsqueda.\n\n¡Éxito en tu búsqueda! 🚀";
const MENSAJE_COMPANY = "¡Bienvenida a Konexu! 🎉\n\nLas personas para el equipo que tu empresa necesita ya están aquí.\n\nProfesionales y servicios, listos para sumarse a un proyecto como el tuyo. Solo falta animarlos a ser parte con tu oferta laboral.\n\n¡Mucho éxito! 🚀";

async function enviarA(db: any, receiverId: string, rol?: string): Promise<boolean> {
  const { data: existing } = await db
    .from("mensajes").select("id")
    .eq("sender_id", NEXU_ID).eq("receiver_id", receiverId).limit(1);
  if (existing && existing.length > 0) return true; // ya enviado
  const mensaje = rol === "employer" ? MENSAJE_EMPLOYER : rol === "company" ? MENSAJE_COMPANY : MENSAJE_WORKER;
  const { error } = await db.from("mensajes").insert({
    sender_id: NEXU_ID,
    receiver_id: receiverId,
    texto: mensaje,
    leido: false,
    created_at: new Date().toISOString(),
  });
  return !error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const body = await req.json().catch(() => ({}));

  // ── Modo usuario: el propio usuario recién registrado solicita su bienvenida ──
  // No requiere admin_secret — se autentica con su propio JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader && body?.user_id && !body?.admin_secret) {
    const verifier = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error } = await verifier.auth.getUser(authHeader.replace("Bearer ", ""));
    // Solo puede enviarse a sí mismo
    if (!error && user && user.id === body.user_id) {
      const ok = await enviarA(db, body.user_id, body?.rol);
      return new Response(JSON.stringify({ ok }), { headers: CORS });
    }
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: CORS });
  }

  // ── Modo admin: enviar a usuario específico ───────────────────
  if (ADMIN_SECRET && body?.admin_secret === ADMIN_SECRET && body?.user_id) {
    const ok = await enviarA(db, body.user_id, body?.rol);
    return new Response(JSON.stringify({ ok }), { headers: CORS });
  }

  // ── Modo masivo: enviar a todos los usuarios ──────────────────
  if (body?.admin_secret === ADMIN_SECRET && body?.masivo === true) {
    const { data: profiles, error: profErr } = await db
      .from("profiles")
      .select("id,rol")
      .neq("id", NEXU_ID);

    if (profErr) return new Response(JSON.stringify({ error: profErr.message }), { status: 500, headers: CORS });

    const { data: yaEnviados } = await db
      .from("mensajes")
      .select("receiver_id")
      .eq("sender_id", NEXU_ID);

    const enviados = new Set((yaEnviados || []).map((m: any) => m.receiver_id));
    const pendientes = (profiles || []).filter((p: any) => !enviados.has(p.id));

    let ok = 0, fail = 0;
    for (const p of pendientes) {
      const sent = await enviarA(db, p.id, p.rol);
      if (sent) ok++; else fail++;
    }

    return new Response(JSON.stringify({ ok: true, enviados: ok, fallidos: fail, omitidos: enviados.size }), { headers: CORS });
  }

  // ── Modo individual: enviar al usuario autenticado ────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: CORS });

  const { data: { user }, error: authErr } = await db.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: CORS });

  const { data: profile } = await db.from("profiles").select("rol").eq("id", user.id).single();
  const ok = await enviarA(db, user.id, profile?.rol);
  return new Response(JSON.stringify({ ok }), { headers: CORS });
});
