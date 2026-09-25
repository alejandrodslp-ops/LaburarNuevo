import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// nudge-deseo — envía UN correo delicado a usuarios de waitlist cuya búsqueda es
// demasiado vaga o un "deseo", pidiéndoles el oficio concreto (lo único que el
// matcher usa) + invitándolos a completar su perfil. Función AISLADA: NO toca el
// sistema de alertas.
//
// Seguridad: envía SOLO a la lista APROBADOS revisada a mano (no re-corre ningún
// detector sobre toda la base). Idempotente: marca waitlist.nudge_deseo_at y no
// reenvía. Modo {test:true} manda solo al dueño para revisar el render.
// ─────────────────────────────────────────────────────────────────────────────

const APROBADOS = [
  // Lote 1 (2026-08-16) — ya enviados, quedan marcados (no se reenvían):
  "tamarabaigorriasosa@gmail.com",
  "anibaltmendez@gmail.com",
  // Lote 2 (2026-08-17):
  "esuarezvanessag@gmail.com",   // Perú — buscó "Trabajo"
  "sandrattl@outlook.com",       // México — psicología forense + inventario
];
const TEST_EMAIL = "alejandrodslp@gmail.com";

function langDePais(pais: string | null): "es" | "pt" {
  return /brasil|brazil/i.test(pais ?? "") ? "pt" : "es";
}
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function correo(nombre: string | null, busqueda: string | null, lang: "es" | "pt") {
  const n = (nombre ?? "").trim().split(/\s+/)[0] || "";
  const q = (busqueda ?? "").trim();
  if (lang === "pt") {
    return {
      subject: "Ajude a gente a encontrar o trabalho certo pra você",
      html: cuerpo({
        hola: n ? `Olá, ${esc(n)}!` : "Olá!",
        p0: q ? `Vimos que na sua busca você escreveu: <b>"${esc(q)}"</b>.` : "",
        p1: "Com isso ainda não conseguimos encontrar vagas que realmente sirvam pra você. Precisamos que você nos diga com clareza o <b>cargo ou profissão concreta</b> que procura (ex: recepcionista, vendedora, psicóloga, enfermeira, operário). Essa é a única forma de te encontrarmos algo que valha a pena.",
        cta: "Dizer minha profissão →",
        p2: "E, se puder, <b>complete seu perfil</b> (profissão, experiência, disponibilidade) — assim as vagas que chegam ficam mais a sua cara.",
        p3: "Enquanto isso, não vamos encher sua caixa com vagas que não têm a ver com você.",
        firma: "Um abraço, konexu",
      }),
    };
  }
  return {
    subject: "Ayudanos a encontrarte el trabajo indicado",
    html: cuerpo({
      hola: n ? `Hola, ${esc(n)}!` : "Hola!",
      p0: q ? `Vimos que en tu búsqueda pusiste: <b>"${esc(q)}"</b>.` : "",
      p1: "Con eso todavía no logramos encontrarte avisos que de verdad te sirvan. Necesitamos que nos digas con claridad el <b>puesto u oficio concreto</b> que buscás (ej: recepcionista, vendedora, psicóloga, enfermera, operario). Esa es la única forma de que te encontremos algo que valga la pena.",
      cta: "Decir mi oficio →",
      p2: "Y si podés, <b>completá tu perfil</b> (profesión, experiencia, disponibilidad) — así los avisos que te lleguen van a estar más a tu medida.",
      p3: "Mientras tanto, no vamos a llenarte la casilla con avisos que no van con vos.",
      firma: "Un abrazo, konexu",
    }),
  };
}

function cuerpo(t: Record<string, string>) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1A1020">
    <div style="font-size:26px;font-weight:800;color:#E8785A;margin-bottom:4px">konexu</div>
    <p style="font-size:16px;font-weight:700;margin:18px 0 10px">${t.hola}</p>
    ${t.p0 ? `<p style="font-size:14px;line-height:1.6;color:#6B5D4F;margin:0 0 12px">${t.p0}</p>` : ""}
    <p style="font-size:14px;line-height:1.6;color:#3A2E28;margin:0 0 20px">${t.p1}</p>
    <a href="https://konexu.app" style="display:inline-block;background:#E8785A;color:#fff;text-decoration:none;border-radius:10px;padding:13px 26px;font-size:14px;font-weight:800">${t.cta}</a>
    <p style="font-size:14px;line-height:1.6;color:#3A2E28;margin:20px 0 0">${t.p2}</p>
    <p style="font-size:13px;line-height:1.6;color:#6B5D4F;margin:14px 0 0">${t.p3}</p>
    <p style="font-size:13px;color:#8c8492;margin:22px 0 0">${t.firma}</p>
  </div>`;
}

async function enviar(resendKey: string, to: string, nombre: string | null, busqueda: string | null, lang: "es" | "pt") {
  const { subject, html } = correo(nombre, busqueda, lang);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Konexu <noreply@konexu.app>",
      to: [to],
      subject,
      html,
      headers: { "List-Unsubscribe": "<mailto:hola@konexu.app?subject=Baja%20de%20alertas>" },
    }),
    signal: AbortSignal.timeout(10000),
  });
  return res.status;
}

serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!RESEND_KEY) return new Response(JSON.stringify({ error: "sin RESEND_API_KEY" }), { status: 500 });

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // MODO PRUEBA — solo al dueño, no marca nada. Usa una búsqueda de ejemplo.
  if (body.test === true) {
    const status = await enviar(RESEND_KEY, TEST_EMAIL, "Vanessa (prueba)", "Trabajo", "es");
    return new Response(JSON.stringify({ modo: "test", to: TEST_EMAIL, resend_status: status }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // MODO REAL — solo la lista APROBADOS, una vez cada uno
  const resultados: any[] = [];
  for (const email of APROBADOS) {
    const { data: row } = await supabase
      .from("waitlist").select("nombre,pais,busqueda,nudge_deseo_at")
      .eq("email", email).maybeSingle();
    if (!row) { resultados.push({ email, estado: "no encontrado" }); continue; }
    if (row.nudge_deseo_at) { resultados.push({ email, estado: "ya enviado" }); continue; }
    const status = await enviar(RESEND_KEY, email, row.nombre, row.busqueda, langDePais(row.pais));
    if (status >= 200 && status < 300) {
      await supabase.from("waitlist").update({ nudge_deseo_at: new Date().toISOString() }).eq("email", email);
      resultados.push({ email, estado: "enviado", resend_status: status });
    } else {
      resultados.push({ email, estado: "error_resend", resend_status: status });
    }
  }
  return new Response(JSON.stringify({ modo: "real", resultados }), {
    headers: { "Content-Type": "application/json" },
  });
});
