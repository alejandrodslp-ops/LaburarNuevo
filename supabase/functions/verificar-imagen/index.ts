import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VISION_KEY    = Deno.env.get("GOOGLE_VISION_KEY") ?? "";
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BLOQUEADO     = ["LIKELY", "VERY_LIKELY"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Verificar JWT — solo usuarios autenticados pueden moderar imágenes
  const authHeader = req.headers.get("Authorization") ?? "";
  const token      = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: CORS });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: CORS });
  }

  const { base64 } = await req.json().catch(() => ({}));
  if (!base64) {
    return new Response(JSON.stringify({ error: "base64 requerido" }), { status: 400, headers: CORS });
  }

  if (!VISION_KEY) {
    // Si no hay key configurada, dejar pasar (modo desarrollo)
    return new Response(JSON.stringify({ segura: true, sin_key: true }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  try {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ requests: [{ image: { content: base64 }, features: [{ type: "SAFE_SEARCH_DETECTION" }] }] }),
        signal:  AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      console.error("Vision API error:", res.status);
      return new Response(JSON.stringify({ segura: true, api_error: true }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const data  = await res.json();
    const safe  = data.responses?.[0]?.safeSearchAnnotation;
    const segura = !BLOQUEADO.includes(safe?.adult)
                && !BLOQUEADO.includes(safe?.violence)
                && !BLOQUEADO.includes(safe?.racy);

    return new Response(JSON.stringify({ segura }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });

  } catch (e) {
    console.error("verificar-imagen error:", (e as Error).message);
    // En caso de error, dejar pasar para no bloquear al usuario
    return new Response(JSON.stringify({ segura: true, error: true }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
