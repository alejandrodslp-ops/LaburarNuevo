import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DIAS_ESPERA = 7;

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const cutoff = new Date(Date.now() - DIAS_ESPERA * 86400000).toISOString();

  const { data: pendientes, error } = await supabase
    .from("propuestas")
    .select("id, worker_id, employer_id, employer_nombre, respondida_at")
    .eq("estado", "aceptada")
    .eq("encuesta_worker_sent", false)
    .not("respondida_at", "is", null)
    .lt("respondida_at", cutoff);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!pendientes?.length) {
    return new Response(JSON.stringify({ ok: true, enviados: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Traer todos los perfiles necesarios en una sola query (antes: 2 queries por propuesta)
  const allIds = [...new Set(pendientes.flatMap(p => [p.worker_id, p.employer_id]))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, push_token, nombre")
    .in("id", allIds);

  const profileMap: Record<string, { push_token: string | null; nombre: string }> =
    Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

  let enviados = 0;

  for (const p of pendientes) {
    const worker   = profileMap[p.worker_id];
    const employer = profileMap[p.employer_id];
    const pushJobs: Promise<Response>[] = [];

    if (worker?.push_token) {
      pushJobs.push(
        fetch("https://exp.host/--/api/v2/push/send", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to:    worker.push_token,
            title: "¿Cómo fue tu experiencia? ⭐",
            body:  `Contanos cómo fue trabajar con ${p.employer_nombre || employer?.nombre || "el empleador"}.`,
            data:  { tipo: "encuesta", pantalla: "Mensajes" },
          }),
        })
      );
    }

    if (employer?.push_token) {
      pushJobs.push(
        fetch("https://exp.host/--/api/v2/push/send", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to:    employer.push_token,
            title: "¿Cómo fue el trabajador? ⭐",
            body:  `Calificá tu experiencia con ${worker?.nombre || "el trabajador"}.`,
            data:  { tipo: "encuesta", pantalla: "Mensajes" },
          }),
        })
      );
    }

    await Promise.allSettled(pushJobs);

    await supabase
      .from("propuestas")
      .update({ encuesta_worker_sent: true, encuesta_employer_sent: true })
      .eq("id", p.id);

    enviados++;
  }

  return new Response(JSON.stringify({ ok: true, enviados }), {
    headers: { "Content-Type": "application/json" },
  });
});
