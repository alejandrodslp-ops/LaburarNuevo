import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CONFIGURAR CUANDO RENDIMENTO APRUEBE ────────────────────────────────────
// Agregar en Supabase Secrets:
//   PIX_KEY_RENDIMENTO = clave PIX de Rendimento (email, CPF, o telefono)
// ────────────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIX_MERCHANT_NAME = "Nexu";
const PIX_MERCHANT_CITY = "Montevideo";
const MONTO_BRL         = "15.00";

// CRC16/CCITT — obligatorio en el estándar PIX EMVCo
function crc16(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
}

function campo(id: string, valor: string): string {
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`;
}

// Genera el código Copia e Cola EMVCo con el ID del usuario en el referenceLabel
function gerarPixCopiaCola(pixKey: string, userId: string): string {
  const refLabel       = userId.replace(/-/g, "").slice(0, 25); // max 25 chars
  const merchantAcct   = campo("00", "br.gov.bcb.pix") + campo("01", pixKey);
  const additionalData = campo("05", refLabel);

  const payload = [
    campo("00", "01"),
    campo("01", "12"),                                // 12 = QR estático
    campo("26", merchantAcct),
    campo("52", "0000"),
    campo("53", "986"),                               // BRL
    campo("54", MONTO_BRL),
    campo("58", "BR"),
    campo("59", PIX_MERCHANT_NAME.slice(0, 25)),
    campo("60", PIX_MERCHANT_CITY.slice(0, 15)),
    campo("62", additionalData),
    "6304",
  ].join("");

  return payload + crc16(payload);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const PIX_KEY      = Deno.env.get("PIX_KEY_RENDIMENTO") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: CORS });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return new Response(JSON.stringify({ error: "Token invalido" }), { status: 401, headers: CORS });

    if (!PIX_KEY) {
      return new Response(JSON.stringify({
        error: "PIX_KEY_RENDIMENTO no configurada — cuenta Rendimento pendiente de aprobacion",
      }), { status: 503, headers: CORS });
    }

    const pixCode = gerarPixCopiaCola(PIX_KEY, user.id);
    const refLabel = user.id.replace(/-/g, "").slice(0, 25);

    return new Response(JSON.stringify({
      ok:        true,
      pix_code:  pixCode,
      monto_brl: MONTO_BRL,
      ref_label: refLabel,
      instrucao: "Copie o código e cole no campo PIX Copia e Cola do seu banco",
    }), { headers: { "Content-Type": "application/json", ...CORS } });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS });
  }
});
