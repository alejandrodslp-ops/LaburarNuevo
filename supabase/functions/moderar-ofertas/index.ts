import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Chequeo determinístico V1 — sin IA. Longitud mínima, sin URLs sueltas,
// sin términos de spam/discriminatorios. Se puede reforzar después sin
// cambiar el flujo (queda todo en esta única función).
// "bitcoin"/"cripto" sueltos se sacaron: pegan en puestos legítimos
// (cajero de casa de cambio, desarrollador blockchain, etc). Solo quedan
// frases que en conjunto son casi siempre estafa/pirámide.
const PALABRAS_PROHIBIDAS = [
  "dinero facil", "dinero gratis", "gratis dinero", "cripto invers", "inversion piramidal",
  "piramide", "esquema piramidal", "gana dinero rapido", "ganar dinero rapido",
  "solo hombres", "solo mujeres", "no discapacitados", "no mayores de",
  // portugues — Brasil es el mercado principal, sitio bilingue ES/PT
  "dinheiro facil", "dinheiro gratis", "ganhe dinheiro rapido", "ganhar dinheiro rapido",
  "esquema em piramide", "investimento piramidal",
  "so homens", "so mulheres", "nao maiores de",
];
const URL_REGEX = /https?:\/\/|www\./i;

function quitarAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function revisarContenido(oferta: { titulo: string; descripcion: string | null; empleo: string | null }): { ok: true } | { ok: false; motivo: string } {
  const textoOriginal = `${oferta.titulo} ${oferta.descripcion || ""} ${oferta.empleo || ""}`;
  const texto = quitarAcentos(textoOriginal.toLowerCase());

  if (oferta.titulo.trim().length < 5) {
    return { ok: false, motivo: "El título es demasiado corto para describir la búsqueda." };
  }
  if (URL_REGEX.test(textoOriginal)) {
    return { ok: false, motivo: "No se permiten links externos en la publicación." };
  }
  for (const p of PALABRAS_PROHIBIDAS) {
    if (texto.includes(quitarAcentos(p))) {
      return { ok: false, motivo: `El contenido no cumple con las normas de Konexu (frase detectada: "${p}").` };
    }
  }
  return { ok: true };
}

async function pushEmpresa(employerId: string, titulo: string, body: string, data: Record<string, unknown>) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("push_token")
    .eq("id", employerId)
    .single();
  if (!profile?.push_token) return;

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ to: profile.push_token, title: titulo, body, sound: "default", data }),
  }).catch(() => {});
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  try {
    const { data: pendientes, error } = await supabase
      .from("ofertas")
      .select("id, employer_id, titulo, descripcion, empleo, created_at")
      .eq("estado", "pendiente")
      .lte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;
    if (!pendientes?.length) {
      return new Response(JSON.stringify({ ok: true, revisadas: 0 }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    let aprobadas = 0, rechazadas = 0;

    for (const o of pendientes) {
      const resultado = revisarContenido(o);

      if (resultado.ok) {
        await supabase.from("ofertas").update({ estado: "aprobada", activa: true }).eq("id", o.id);
        aprobadas++;
        await pushEmpresa(
          o.employer_id,
          "Tu búsqueda ya está activa",
          `Tu búsqueda de ${o.empleo || o.titulo} ya está activa en Konexu.`,
          { pantalla: "MisOfertasEmpresa", oferta_id: o.id }
        );
        supabase.functions.invoke("match-ofertas", { body: { oferta_id: o.id } }).catch(() => {});
      } else if ("motivo" in resultado) {
        await supabase.from("ofertas").update({ estado: "rechazada", motivo_rechazo: resultado.motivo, activa: false }).eq("id", o.id);
        rechazadas++;
        await pushEmpresa(
          o.employer_id,
          "Tu búsqueda no pudo activarse",
          `Tu búsqueda de ${o.empleo || o.titulo} no pudo activarse: ${resultado.motivo} Podés editarla y volver a enviarla.`,
          { pantalla: "MisOfertasEmpresa", oferta_id: o.id }
        );
      }
    }

    return new Response(
      JSON.stringify({ ok: true, revisadas: pendientes.length, aprobadas, rechazadas }),
      { headers: { "Content-Type": "application/json", ...CORS } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
