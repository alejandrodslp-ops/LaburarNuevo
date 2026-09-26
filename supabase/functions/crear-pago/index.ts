import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_ACCESS_TOKEN  = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
const PAYPAL_SECRET    = Deno.env.get("PAYPAL_SECRET") ?? "";
const PAYPAL_ENV       = Deno.env.get("PAYPAL_ENV") ?? "sandbox";
const PAYPAL_API_BASE  = PAYPAL_ENV === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

async function obtenerTokenPaypal(): Promise<string> {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("PayPal no devolvió access_token");
  return data.access_token;
}

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type":                 "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Verificar JWT — el user_id viene del token, no del body
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

    const body = await req.json();
    const { monto, descripcion, worker_id, cantidad_perfiles, tipo, plan_id } = body;

    // user_id siempre del token verificado — nunca del body
    const userId = user.id;

    // El precio (y, para creditos, la cantidad que se acredita) SIEMPRE los
    // decide el servidor a partir de una tabla fija — nunca lo que mande el
    // cliente en el body, sino cualquiera edita el request y paga lo que
    // quiera por lo que quiera (plan Premium por U$1, 10000 creditos por un
    // centavo, etc).
    const PRECIOS_SUSCRIPCION: Record<string, number> = {
      membresia_sa: 12,
      membresia_world: 24,
      membresia_premium: 50,
    };
    const PRECIO_ACTIVACION_WORKER = 1;
    // Precios reales de PagoScreen.js (mismo mapa duplicado ahi, mantener en
    // sync) — 2 cantidades x 3 tramos segun el pais del perfil. El monto NUNCA
    // se toma del body: se deriva 100% server-side a partir de profiles.pais,
    // que es la unica señal de pais que ya usa el resto de la app (bonus de
    // matching, etc.) — sin esto, cualquiera podia pedir el tramo mas barato
    // (pensado para paises con moneda muy devaluada) mandando el monto exacto
    // en el body, sin importar su pais real.
    const PRECIOS_VISUALIZACIONES: Record<number, Record<"sa" | "devaluado" | "world", number>> = {
      3:  { sa: 3.99,  world: 7.98,  devaluado: 1.50 },
      10: { sa: 9.99,  world: 19.99, devaluado: 4.99 },
    };
    // Mismos 32 paises que ofrece el selector de onboarding (EditarPerfilScreen.js /
    // EditarPerfilEmpleadorDatosScreen.js) — "Otro" y cualquier valor no reconocido
    // caen en "world" (el tramo mas caro), nunca en el mas barato, por seguridad.
    const PAISES_SA = new Set([
      "uruguay", "argentina", "brasil", "brazil", "chile", "paraguay", "bolivia",
      "peru", "colombia", "mexico", "ecuador", "venezuela", "cuba", "costa rica",
      "panama", "guatemala", "el salvador", "honduras", "nicaragua",
      "republica dominicana",
    ]);
    const PAISES_DEVALUADOS = new Set(["india"]);

    function normalizarPais(raw: string): string {
      return raw
        .replace(/^[^\p{L}]+/u, "").trim() // saca emoji/prefijo no-letra
        .normalize("NFD").replace(/[̀-ͯ]/g, "") // saca acentos
        .toLowerCase();
    }
    function tierDePais(raw: string | null | undefined): "sa" | "devaluado" | "world" {
      if (!raw) return "world";
      const n = normalizarPais(raw);
      if (PAISES_DEVALUADOS.has(n)) return "devaluado";
      if (PAISES_SA.has(n)) return "sa";
      return "world";
    }

    let montoFinal: number;
    let cantidadFinal: number;
    const tipoFinal = tipo || "employer_visualizaciones";

    // PayPal — activación recurrente del worker. Se maneja aparte del resto
    // porque no crea una preferencia de MercadoPago, sino una Subscription de
    // PayPal contra un plan ya creado de antemano (uno por tramo de precio,
    // guardado en config.paypal_plan_id_sa / paypal_plan_id_world). El monto
    // lo fija el plan (USD, no lo manda el cliente ni esta función).
    if (tipoFinal === "worker_activacion_paypal") {
      // La activación del worker es un monto plano (USD 1) para cualquier
      // país — a diferencia de employer_visualizaciones, NO tiene tramo
      // SA/Mundo (ver PRECIO_ACTIVACION_WORKER más abajo, mismo criterio).
      // paypal_plan_id_world quedó creado en config por si alguna vez se
      // decide diferenciar, pero hoy no se usa.
      const { data: configRows, error: configErr } = await supabase
        .from("config")
        .select("clave, valor")
        .eq("clave", "paypal_plan_id_sa");
      const planId = configRows?.[0]?.valor;
      if (!planId) {
        console.error("Plan de PayPal no configurado:", configErr?.message);
        return new Response(JSON.stringify({ error: "Plan de PayPal no configurado" }), {
          status: 500, headers: CORS,
        });
      }

      const ppToken = await obtenerTokenPaypal();
      const subRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ppToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: planId,
          custom_id: userId,
          application_context: {
            return_url: "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/pago-resultado?status=success",
            cancel_url: "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/pago-resultado?status=failure",
          },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!subRes.ok) {
        const errData = await subRes.json().catch(() => ({}));
        console.error("PayPal crear subscription error:", subRes.status, errData);
        return new Response(JSON.stringify({ error: "Error al crear suscripción de PayPal" }), {
          status: 502, headers: CORS,
        });
      }
      const sub = await subRes.json();
      const approveLink = (sub.links || []).find((l: { rel: string }) => l.rel === "approve")?.href;
      if (!approveLink) {
        return new Response(JSON.stringify({ error: "PayPal no devolvió link de aprobación" }), {
          status: 502, headers: CORS,
        });
      }
      return new Response(JSON.stringify({
        init_point: approveLink,
        preference_id: sub.id,
      }), { headers: CORS });
    }

    if (tipoFinal === "company_suscripcion") {
      const precio = PRECIOS_SUSCRIPCION[plan_id as string];
      if (!precio) {
        return new Response(JSON.stringify({ error: "plan_id inválido o ausente" }), {
          status: 400, headers: CORS,
        });
      }
      montoFinal = precio;
      cantidadFinal = 0;
    } else if (tipoFinal === "worker_activacion") {
      montoFinal = PRECIO_ACTIVACION_WORKER;
      cantidadFinal = 0;
    } else {
      const cantidad = Number(cantidad_perfiles);
      if (cantidad !== 3 && cantidad !== 10) {
        return new Response(JSON.stringify({ error: "Cantidad de perfiles inválida" }), {
          status: 400, headers: CORS,
        });
      }
      const { data: perfilPago } = await supabase.from("profiles").select("pais").eq("id", userId).single();
      const tier = tierDePais(perfilPago?.pais);
      montoFinal = PRECIOS_VISUALIZACIONES[cantidad][tier];
      cantidadFinal = cantidad;
    }

    const preference = {
      items: [{
        title:      descripcion || "Konexu - Ver perfiles completos",
        quantity:   1,
        unit_price: montoFinal,
        currency_id: "USD",
      }],
      external_reference: userId,
      metadata: {
        worker_id:          worker_id          || null,
        cantidad_perfiles:  cantidadFinal,
        tipo:               tipoFinal,
        plan_id:            plan_id            || null,
      },
      notification_url: "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/webhook-pago",
      back_urls: {
        success: "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/pago-resultado?status=success",
        failure: "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/pago-resultado?status=failure",
        pending: "https://waevdcqdkovqaxkonlvj.supabase.co/functions/v1/pago-resultado?status=pending",
      },
    };

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      body:    JSON.stringify(preference),
      signal:  AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error("MP crear preferencia error:", res.status, errData);
      return new Response(JSON.stringify({ error: "Error al crear preferencia de pago" }), {
        status: 502, headers: CORS,
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify({
      init_point:   data.init_point,
      preference_id: data.id,
    }), { headers: CORS });

  } catch (e) {
    console.error("crear-pago error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
});
