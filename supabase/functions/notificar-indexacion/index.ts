import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// notificar-indexacion: avisa a Google Indexing API los concursos nuevos para que
// se indexen en minutos (en vez de días). 100% aditivo: solo LEE concursos y llama
// a una API externa. No toca el scraper ni la web. Si falla, el sitio sigue igual
// (Google indexa por sitemap de todas formas).
//
// Requiere el secret GOOGLE_INDEXING_SA_KEY (JSON de una service account de Google
// con la Indexing API habilitada y agregada como Owner en Search Console).
// Ver supabase/functions/notificar-indexacion/CONFIGURAR.md

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SA_KEY       = Deno.env.get("GOOGLE_INDEXING_SA_KEY") ?? "";
const SITE         = "https://www.konexu.app";
// IndexNow (Bing, DuckDuckGo, Yandex…). La clave es pública: vive en /<clave>.txt.
const INDEXNOW_KEY = "653888ae6c12bb31735da813cba61aeb";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: CORS });

// Replicado EXACTO de web/src/lib/utils.js → la URL debe coincidir con la página real.
function toSlug(c: { cargo?: string; titulo?: string; pais?: string; id: string }) {
  const parte = (c.cargo || c.titulo || "empleo")
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-").slice(0, 50);
  const pais = (c.pais || "latam").toLowerCase().replace(/[^a-z]/g, "");
  return `${parte}-${pais}-${c.id}`;
}

function b64url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const strB64url = (s: string) => b64url(new TextEncoder().encode(s));

async function importKey(pem: string) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8", der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
}

async function getAccessToken(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = strB64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = strB64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/indexing",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const key = await importKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("No se pudo autenticar con Google: " + JSON.stringify(data));
  return data.access_token as string;
}

async function notify(token: string, url: string) {
  const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, type: "URL_UPDATED" }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!SA_KEY) return json({ error: "Falta el secret GOOGLE_INDEXING_SA_KEY (ver CONFIGURAR.md)" }, 400);
    const sa = JSON.parse(SA_KEY);

    const body = await req.json().catch(() => ({}));
    const horas  = Number(body.horas)  || 24;
    const limite = Math.min(Number(body.limite) || 150, 180); // cuota Indexing API: 200/día

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const desde = new Date(Date.now() - horas * 3600 * 1000).toISOString();
    const { data: concursos, error } = await supabase
      .from("concursos")
      .select("id, cargo, titulo, pais")
      .eq("activo", true)
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw error;

    const token = await getAccessToken(sa);
    let ok = 0, fail = 0;
    const urls: string[] = [];
    for (const c of concursos ?? []) {
      const url = `${SITE}/empleos/${toSlug(c)}`;
      urls.push(url);
      (await notify(token, url)) ? ok++ : fail++;
    }

    // IndexNow: mismas URLs a Bing/DuckDuckGo/Yandex. Aislado: si falla, Google ya se notificó.
    let indexnow = "skip";
    try {
      if (urls.length > 0) {
        const r = await fetch("https://api.indexnow.org/indexnow", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            host: "www.konexu.app",
            key: INDEXNOW_KEY,
            keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
            urlList: urls,
          }),
        });
        indexnow = String(r.status);
      }
    } catch (e) {
      indexnow = "error: " + (e as Error).message.slice(0, 60);
    }

    return json({ ok: true, notificados: ok, fallidos: fail, total: concursos?.length ?? 0, indexnow });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
