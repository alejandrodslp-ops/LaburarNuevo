import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function ok(d: unknown) {
  return new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json", ...CORS } });
}
function err(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
}

async function enviarPush(tokens: string[]) {
  if (!tokens.length) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(tokens.map(to => ({
        to,
        title: "🎉 ¡Tu lugar en Nexu está listo!",
        body: "Ya podés registrarte. Abrí la app y completá tu perfil.",
        sound: "default",
        data: { pantalla: "Register" },
      }))),
    });
  } catch { /* push no crítico */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    // ── 1. Leer configuración ──────────────────────────────────────────────────
    const { data: cfg } = await db.from("waitlist_config").select("*").eq("id", 1).single();
    if (!cfg?.activo) return ok({ skip: "waitlist_inactiva" });

    // ── 2. Respetar intervalo mínimo entre lotes ───────────────────────────────
    if (cfg.ultimo_lote_at) {
      const minutos = (Date.now() - new Date(cfg.ultimo_lote_at).getTime()) / 60000;
      if (minutos < cfg.intervalo_minutos) {
        return ok({ skip: "muy_reciente", proxima_en_minutos: Math.round(cfg.intervalo_minutos - minutos) });
      }
    }

    // ── 3. Medir carga actual (proxy: perfiles actualizados en última hora) ────
    const hace1h = new Date(Date.now() - 3_600_000).toISOString();
    const { count: activosHora } = await db
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("updated_at", hace1h);

    const cargaPct = (activosHora ?? 0) / cfg.umbral_activos_hora;

    if (cargaPct >= 1) {
      return ok({ skip: "carga_alta", activos: activosHora, umbral: cfg.umbral_activos_hora });
    }

    // ── 4. Lock optimista — marcar inicio de proceso para bloquear runs concurrentes
    //    Si dos crons arrancan al mismo tiempo, el segundo verá "muy_reciente" al revalidar
    const lockTime = new Date().toISOString();
    await db.from("waitlist_config").update({ ultimo_lote_at: lockTime }).eq("id", 1);

    // ── 5. Verificar cola pendiente (habilitados sin registrar) ───────────────
    const { count: colaPendiente } = await db
      .from("waitlist")
      .select("*", { count: "exact", head: true })
      .eq("habilitado", true)
      .eq("registrado", false);

    if ((colaPendiente ?? 0) >= cfg.max_cola_pendiente) {
      return ok({ skip: "cola_llena", pendientes: colaPendiente, maximo: cfg.max_cola_pendiente });
    }

    // ── 6. Calcular tamaño dinámico del lote según la carga ───────────────────
    // Carga baja  (< 50%): batch completo
    // Carga media (50-70%): 60% del batch
    // Carga alta  (70-99%): 30% del batch
    let batchSize = cfg.batch_size;
    if      (cargaPct > 0.7) batchSize = Math.max(10, Math.floor(batchSize * 0.3));
    else if (cargaPct > 0.5) batchSize = Math.max(10, Math.floor(batchSize * 0.6));

    // ── 6. Tomar los próximos de la cola (orden de llegada) ───────────────────
    const { data: proximos } = await db
      .from("waitlist")
      .select("id, email, nombre, push_token")
      .eq("habilitado", false)
      .order("posicion", { ascending: true })
      .limit(batchSize);

    if (!proximos?.length) return ok({ skip: "lista_vacia" });

    const ids = proximos.map((u: any) => u.id);
    const now = new Date().toISOString();

    // ── 7. Habilitar el lote ──────────────────────────────────────────────────
    const { error: updateErr } = await db
      .from("waitlist")
      .update({ habilitado: true, habilitado_at: now })
      .in("id", ids);

    if (updateErr) return err(updateErr.message);

    // ── 8. Notificar por push a quienes tienen token ──────────────────────────
    const tokens = (proximos as any[]).map((u: any) => u.push_token).filter(Boolean);
    await enviarPush(tokens);

    // ── 9. Crecer el batch size para el próximo lote (máx 5000) ──────────────
    // Si el sistema aguantó bien, habilitamos más gente la próxima vez
    const nuevoBatch = Math.min(Math.floor(cfg.batch_size * 1.5), 5000);
    await db.from("waitlist_config").update({ ultimo_lote_at: now, batch_size: nuevoBatch }).eq("id", 1);

    // ── 10. Guardar log del lote ──────────────────────────────────────────────
    await db.from("waitlist_lotes").insert({
      cantidad:         ids.length,
      notificados:      tokens.length,
      activos_hora:     activosHora ?? 0,
      carga_pct:        Math.round(cargaPct * 100),
      batch_size_usado: batchSize,
    }).catch(() => {});

    return ok({
      ok:                   true,
      habilitados:          ids.length,
      notificados_push:     tokens.length,
      activos_ultima_hora:  activosHora ?? 0,
      carga_pct:            Math.round(cargaPct * 100),
      nuevo_batch_size:     nuevoBatch,
    });

  } catch (e: any) {
    return err(e.message);
  }
});
