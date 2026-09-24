// alertas-waitlist — envía por email los concursos NUEVOS que coinciden con
// lo que busca cada persona de la waitlist. Reusa el matching por keyword.
// NO toca la app. Corre por cron (net.http_post).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL         = Deno.env.get("SUPABASE_URL")!;
const KEY         = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY  = Deno.env.get("RESEND_API_KEY") ?? "";
const SITE        = "https://konexu.app";

// nombre de país (con o sin emoji) -> código de la tabla concursos
const PAIS_COD: Record<string, string> = {
  uruguay: "UY", argentina: "AR", brasil: "BR", brazil: "BR", chile: "CL",
  colombia: "CO", mexico: "MX", peru: "PE", ecuador: "EC", bolivia: "BO",
  paraguay: "PY", venezuela: "VE", espana: "ES", "estados unidos": "US",
  portugal: "PT", italia: "IT", francia: "FR", alemania: "DE",
  "reino unido": "GB", canada: "CA", australia: "AU",
  guatemala: "GT", honduras: "HN", nicaragua: "NI", "costa rica": "CR",
  panama: "PA", cuba: "CU", "rep dominicana": "DO", "el salvador": "SV",
  suecia: "SE", noruega: "NO", suiza: "CH", japon: "JP", india: "IN",
};
function codPais(s: string | null): string | null {
  if (!s) return null;
  // NFD + quitar tildes: "Panamá"/"México"/"Japón" deben resolver igual que sus claves
  const n = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\s]/gu, "").trim().toLowerCase();
  return PAIS_COD[n] ?? null;
}
function esc(t: unknown): string {
  return String(t ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
}

// Idioma del email según el país del usuario (fallback: español)
const LANG_POR_PAIS: Record<string, string> = {
  BR: "pt", PT: "pt",
  US: "en", GB: "en", CA: "en", AU: "en", IN: "en",
  FR: "fr", IT: "it", DE: "de", CH: "de", SE: "sv", NO: "no", JP: "ja",
};
const T: Record<string, Record<string, string | undefined>> = {
  es: {
    zona_si: `Estos son de {c}, tu zona:`, zona_no: `En tu zona ({c}) todavía no encontramos nada — pero si te interesan otras ciudades, aparecieron estos:`,
    wa_msg: `👋 Encontré una página que te avisa por email cuando sale un trabajo de lo tuyo. Gratis: https://konexu.app`, wa_btn: `Compartir por WhatsApp`,
    hola: "Hola", aparecieron: "Aparecieron {n} empleo{s} de", s: "s",
    justo: "Justo lo que buscabas. Estos son los nuevos:", ver: "Ver todos →",
    comparte: 'Compartila con quien creas que la puede necesitar — puede ser parte de un cambio en su vida. Gracias por ayudarnos a ayudar. <a href="https://konexu.app" style="color:#C2502F;font-weight:700;text-decoration:none">konexu.app</a>',
    util: "¿Te sirvió esta página?",
    pie: "Te llega esto porque activaste alertas gratis en Konexu. Si no querés recibir más, respondé este correo.",
    asunto: '{n} nuevo{s} empleo{s} de "{q}" para ti',
    aprox_leyenda: "No encontramos coincidencias exactas — pero como tu búsqueda o el aviso no tienen suficiente detalle para acotar más, te dejamos estos por si te sirven. Esto no es un error del sistema: es falta de información.",
    leyenda_computrabajo: "En nuestra búsqueda encontramos una plataforma o página que tiene ofertas que coinciden con tu búsqueda. Es probable que te pidan crear un usuario gratuito para ver toda la información. Como nuestra promesa es buscarte todas las ofertas, también te la hacemos llegar. Esperamos que te sea útil.",
  },
  pt: {
    zona_si: `Estas são de {c}, sua região:`, zona_no: `Na sua região ({c}) ainda não encontramos nada — mas se outras cidades te interessam, apareceram estas:`,
    wa_msg: `👋 Achei um site que te avisa por email quando aparece vaga da sua área. Grátis: https://konexu.app/pt`, wa_btn: `Compartilhar no WhatsApp`,
    hola: "Olá", aparecieron: "Apareceram {n} vaga{s} de", s: "s",
    justo: "Exatamente o que você procurava. Estas são as novas:", ver: "Ver todas →",
    comparte: 'Compartilhe <a href="https://konexu.app/pt" style="color:#C2502F;font-weight:700;text-decoration:none">konexu.app/pt</a> com alguém que esteja procurando trabalho — pode mudar a semana dessa pessoa.',
    util: "Foi útil pra você?",
    pie: "Você recebe isto porque ativou alertas grátis na Konexu. Se não quiser mais receber, responda este email.",
    asunto: '{n} nova{s} vaga{s} de "{q}" para você',
    leyenda_computrabajo: "Na nossa busca encontramos uma plataforma ou site que tem vagas que coincidem com a sua busca. É provável que peçam para você criar um cadastro gratuito para ver todas as informações. Como nossa promessa é buscar todas as vagas para você, também trazemos essa aqui. Esperamos que seja útil.",
    aprox_leyenda: "Não encontramos coincidências exatas — mas como sua busca ou o anúncio não têm detalhe suficiente para refinar mais, deixamos estes caso te sirvam. Isto não é um erro do sistema: é falta de informação.",
  },
  en: {
    zona_si: `These are in {c}, your area:`, zona_no: `Nothing in your area ({c}) yet — but if other cities work for you, these just showed up:`,
    wa_msg: `👋 Found a site that emails you when a job matching your trade shows up. Free: https://konexu.app/en`, wa_btn: `Share on WhatsApp`,
    hola: "Hi", aparecieron: "{n} new job{s} matching", s: "s",
    justo: "Just what you were looking for. Here are the new ones:", ver: "See all →",
    comparte: 'Share <a href="https://konexu.app/en" style="color:#C2502F;font-weight:700;text-decoration:none">konexu.app/en</a> with someone looking for work — it might change their week.',
    util: "Was this useful?",
    pie: "You get this because you set up free alerts on Konexu. Reply to this email to unsubscribe.",
    asunto: '{n} new job{s} matching "{q}"',
    aprox_leyenda: "We didn't find exact matches — but since your search or the listing doesn't have enough detail to narrow it down further, here are a few that might still be relevant. This isn't a system error: it's just missing detail.",
  },
  fr: {
    zona_si: `Celles-ci sont à {c}, votre zone :`, zona_no: `Rien dans votre zone ({c}) pour l'instant — mais si d'autres villes vous intéressent, voici ce qui vient de sortir :`,
    wa_msg: `👋 J'ai trouvé un site qui vous prévient par email des offres de votre métier. Gratuit : https://konexu.app/fr`, wa_btn: `Partager sur WhatsApp`,
    hola: "Bonjour", aparecieron: "{n} nouvelle{s} offre{s} pour", s: "s",
    justo: "Exactement ce que vous cherchiez. Voici les nouvelles :", ver: "Tout voir →",
    comparte: 'Partagez <a href="https://konexu.app/fr" style="color:#C2502F;font-weight:700;text-decoration:none">konexu.app/fr</a> avec quelqu’un qui cherche du travail.',
    util: "Cela vous a été utile ?",
    pie: "Vous recevez ceci car vous avez activé les alertes gratuites Konexu. Répondez à cet email pour vous désabonner.",
    asunto: '{n} nouvelle{s} offre{s} pour « {q} »',
    aprox_leyenda: "Nous n'avons pas trouvé de correspondance exacte — mais comme votre recherche ou l'offre manque de détails pour affiner davantage, voici quelques résultats qui pourraient vous intéresser. Ce n'est pas une erreur du système : il manque simplement des informations.",
  },
  it: {
    zona_si: `Queste sono a {c}, la tua zona:`, zona_no: `Nella tua zona ({c}) ancora niente — ma se ti interessano altre città, sono uscite queste:`,
    wa_msg: `👋 Ho trovato un sito che ti avvisa via email delle offerte del tuo mestiere. Gratis: https://konexu.app/it`, wa_btn: `Condividi su WhatsApp`,
    hola: "Ciao", aparecieron: "{n} nuove offerte di", aparecieron1: "1 nuova offerta di", s: "",
    justo: "Proprio quello che cercavi. Ecco le novità:", ver: "Vedi tutte →",
    comparte: 'Condividi <a href="https://konexu.app/it" style="color:#C2502F;font-weight:700;text-decoration:none">konexu.app/it</a> con qualcuno che cerca lavoro.',
    util: "Ti è stato utile?",
    pie: "Ricevi questa email perché hai attivato gli avvisi gratuiti su Konexu. Rispondi per annullare l’iscrizione.",
    asunto: '{n} nuove offerte di "{q}" per te', asunto1: '1 nuova offerta di "{q}" per te',
    aprox_leyenda: "Non abbiamo trovato corrispondenze esatte — ma poiché la tua ricerca o l'annuncio non hanno abbastanza dettagli per restringere di più, ecco alcuni che potrebbero interessarti comunque. Non è un errore del sistema: mancano solo informazioni.",
  },
  de: {
    zona_si: `Diese sind in {c}, deiner Gegend:`, zona_no: `In deiner Gegend ({c}) noch nichts — aber falls andere Städte infrage kommen, sind diese erschienen:`,
    wa_msg: `👋 Diese Seite mailt dir neue Stellen für deinen Beruf. Kostenlos: https://konexu.app/de`, wa_btn: `Auf WhatsApp teilen`,
    hola: "Hallo", aparecieron: "{n} neue Stelle{s} für", s: "n",
    justo: "Genau das, was du gesucht hast. Hier die neuen:", ver: "Alle ansehen →",
    comparte: 'Teile <a href="https://konexu.app/de" style="color:#C2502F;font-weight:700;text-decoration:none">konexu.app/de</a> mit jemandem, der Arbeit sucht.',
    util: "War das hilfreich?",
    pie: "Du erhältst diese E-Mail, weil du kostenlose Alarme bei Konexu aktiviert hast. Antworte zum Abbestellen.",
    asunto: '{n} neue Stelle{s} für "{q}"',
    aprox_leyenda: "Wir haben keine genaue Übereinstimmung gefunden — aber da deine Suche oder die Anzeige nicht genug Details für eine engere Eingrenzung bieten, zeigen wir dir trotzdem diese hier. Das ist kein Systemfehler, es fehlen einfach Informationen.",
  },
  sv: {
    zona_si: `Dessa är i {c}, ditt område:`, zona_no: `Inget i ditt område ({c}) ännu — men om andra städer funkar, dök dessa upp:`,
    wa_msg: `👋 Denna sida mejlar dig nya jobb inom ditt yrke. Gratis: https://konexu.app/sv`, wa_btn: `Dela på WhatsApp`,
    hola: "Hej", aparecieron: "{n} nya jobb för", s: "",
    justo: "Precis vad du letade efter. Här är de nya:", ver: "Se alla →",
    comparte: 'Dela <a href="https://konexu.app/sv" style="color:#C2502F;font-weight:700;text-decoration:none">konexu.app/sv</a> med någon som söker jobb.',
    util: "Var detta användbart?",
    pie: "Du får detta för att du aktiverade gratis bevakning på Konexu. Svara på mejlet för att avsluta.",
    asunto: '{n} nya jobb för "{q}"',
    aprox_leyenda: "Vi hittade inga exakta träffar — men eftersom din sökning eller annonsen inte har tillräckligt med detaljer för att smalna av mer, visar vi ändå dessa. Det här är inget systemfel, det saknas bara information.",
  },
  no: {
    zona_si: `Disse er i {c}, ditt område:`, zona_no: `Ingenting i ditt område ({c}) ennå — men hvis andre byer passer, dukket disse opp:`,
    wa_msg: `👋 Denne siden sender deg nye stillinger i ditt yrke. Gratis: https://konexu.app/no`, wa_btn: `Del på WhatsApp`,
    hola: "Hei", aparecieron: "{n} nye stillinger for", s: "",
    justo: "Akkurat det du lette etter. Her er de nye:", ver: "Se alle →",
    comparte: 'Del <a href="https://konexu.app/no" style="color:#C2502F;font-weight:700;text-decoration:none">konexu.app/no</a> med noen som ser etter jobb.',
    util: "Var dette nyttig?",
    pie: "Du får dette fordi du aktiverte gratis varsling på Konexu. Svar på e-posten for å melde deg av.",
    asunto: '{n} nye stillinger for "{q}"',
    aprox_leyenda: "Vi fant ingen eksakt match — men siden søket ditt eller annonsen ikke har nok detaljer til å avgrense mer, viser vi disse likevel. Dette er ikke en systemfeil, det mangler bare informasjon.",
  },
  ja: {
    zona_si: `こちらは{c}（お住まいの地域）の求人です：`, zona_no: `お住まいの地域（{c}）ではまだ見つかりませんでしたが、他の都市でよければこちらが出ています：`,
    wa_msg: `👋 自分の職種の求人をメールで知らせてくれるサイトです。無料: https://konexu.app/ja`, wa_btn: `WhatsAppでシェア`,
    hola: "こんにちは", aparecieron: "「{q}」の新着求人 {n} 件", s: "",
    justo: "お探しの条件に合う新着です：", ver: "すべて見る →",
    comparte: 'お役に立ちましたか？お仕事を探している方に <a href="https://konexu.app/ja" style="color:#C2502F;font-weight:700;text-decoration:none">konexu.app/ja</a> をぜひ紹介してください。',
    util: "",
    pie: "このメールはKonexuの無料求人アラートにご登録いただいた方にお送りしています。配信停止はこのメールに返信してください。",
    asunto: '「{q}」の新着求人{n}件',
    aprox_leyenda: "完全に一致する求人は見つかりませんでした——ただ、検索内容や求人情報だけでは絞り込みが十分でないため、参考までにこちらもお送りします。システムの不具合ではなく、情報が足りないだけです。",
  },
};
function idiomaDe(pais: string | null): string {
  const cod = codPais(pais);
  return (cod && LANG_POR_PAIS[cod]) || "es";
}

function plantilla(nombre: string | null, busqueda: string, exactos: any[], aproximados: any[], lang = "es", intro?: string): string {
  const t = T[lang] ?? T.es;
  const saludo = nombre ? `${t.hola} ${esc(nombre)},` : `${t.hola},`;
  const filaDe = (c: any) => {
    const titulo = esc(c.cargo || c.titulo);
    const org    = esc(c.organismo || "");
    const lugar  = esc(c.lugar || c.pais || "");
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #EDE8E2">
      <div style="font-size:15px;font-weight:700;color:#1A1020">${titulo}</div>
      <div style="font-size:13px;color:#8c8492;margin-top:2px">${org}${org && lugar ? " · " : ""}${lugar}</div>
    </td></tr>`;
  };
  const n = exactos.length + aproximados.length;
  const plural = n > 1 ? t.s : "";
  const base = (n === 1 && t.aparecieron1) ? t.aparecieron1 : t.aparecieron;
  const titular = lang === "ja"
    ? base.replace("{q}", esc(busqueda)).replace("{n}", String(n))
    : `${base.replace("{n}", String(n)).replace(/\{s\}/g, plural)} "${esc(busqueda)}"`;
  const link = `${SITE}/empleos?q=${encodeURIComponent(busqueda)}`;
  const tablaExactos = exactos.length > 0
    ? `<table style="width:100%;border-collapse:collapse">${exactos.map(filaDe).join("")}</table>` : "";
  // Sección aparte, honesta, para los avisos de menor confianza: no se
  // mezclan con los exactos, y se aclara que no es un error del sistema.
  const seccionAprox = aproximados.length > 0 ? `
      <p style="font-size:12px;color:#a99fb5;margin:26px 0 8px;padding-top:14px;border-top:1px dashed #EDE8E2">${t.aprox_leyenda ?? T.es.aprox_leyenda}</p>
      <table style="width:100%;border-collapse:collapse">${aproximados.map(filaDe).join("")}</table>` : "";
  // Aviso de transparencia: si algún resultado viene de Computrabajo (requiere
  // cuenta propia para ver el detalle completo), lo aclaramos — no ocultamos
  // que van a tener que registrarse ahí también.
  const tieneComputrabajo = [...exactos, ...aproximados].some((c: any) => String(c?.url_detalle ?? "").includes("computrabajo.com"));
  const leyendaComputrabajo = tieneComputrabajo
    ? `<p style="font-size:12px;color:#a99fb5;margin:16px 0 0;padding-top:14px;border-top:1px dashed #EDE8E2">${t.leyenda_computrabajo ?? T.es.leyenda_computrabajo}</p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#FBF8F4">
    <div style="background:#0D1117;padding:24px 32px"><img src="https://www.konexu.app/logo-email.png" alt="Konexu" width="98" height="40" style="display:block;border:0"></div>
    <div style="padding:28px 32px">
      <p style="font-size:15px;color:#1A1020">${saludo}</p>
      <h2 style="color:#1A1020;font-size:20px;margin:8px 0 4px">${titular}</h2>
      <p style="font-size:13px;color:#8c8492;margin:0 0 16px">${intro ?? t.justo}</p>
      ${tablaExactos}
      ${seccionAprox}
      ${leyendaComputrabajo}
      <a href="${link}" style="display:inline-block;margin-top:22px;background:#C2502F;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:800;font-size:15px">${t.ver}</a>
      <p style="font-size:13px;color:#5A4E6A;margin-top:22px">${t.util ? t.util + " " : ""}${t.comparte}</p>
      <a href="https://wa.me/?text=${encodeURIComponent(String(t.wa_msg ?? ""))}" style="display:inline-block;margin-top:10px;background:#25D366;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:800;font-size:13px">💬 ${t.wa_btn}</a>
      <p style="font-size:12px;color:#a99fb5;margin-top:12px">${t.pie}</p>
    </div>
  </div>`;
}
function asuntoDe(lang: string, n: number, busqueda: string): string {
  const t = T[lang] ?? T.es;
  const plural = n > 1 ? t.s : "";
  const base = (n === 1 && t.asunto1) ? t.asunto1 : t.asunto;
  return base.replace("{n}", String(n)).replace(/\{s\}/g, plural).replace("{q}", busqueda);
}

console.log(`[diag] SUPABASE_URL="${URL}"`);
const LOTE = 5; // usuarios por invocación (2026-07-31) — el cuelgue real era el
// RPC de matching con estadísticas desactualizadas (ANALYZE lo resolvió,
// confirmado: de 25s+ a <300ms). Ya no hace falta ir de a 1: con el RPC
// rápido y el timeout de 20s por usuario, 5 por tick es seguro y termina
// el ciclo mucho antes. Con el cursor persistido, cualquier tick que falle
// igual se retoma solo en el próximo minuto.
serve(async (req: Request) => {
  const db = createClient(URL, KEY);

  // Orquestación por cursor persistido en vez de auto-invocación encadenada
  // (fetch + waitUntil): esa cadena se cortaba a mitad de camino sin avisar
  // (caso real 2026-07-31: se cortó en el usuario 10 de 83, sin error visible,
  // nunca mandó el resumen). Ahora un cron corre cada 1 minuto y cada tick
  // retoma desde el cursor guardado en la base — si un tick se cae, el
  // próximo simplemente reintenta el mismo lote (idempotente por
  // alertas_enviadas, no duplica emails ya mandados).
  const HORA_INICIO_UTC = 11;
  const hoy = new Date().toISOString().slice(0, 10);
  const horaActualUTC = new Date().getUTCHours();

  const { data: estadoDb } = await db.from("alertas_ciclo_estado").select("*").eq("id", 1).maybeSingle();
  let estado = estadoDb;

  if (!estado || estado.fecha !== hoy) {
    if (horaActualUTC < HORA_INICIO_UTC) {
      return new Response(JSON.stringify({ ok: true, skip: "fuera_de_horario" }), { headers: { "Content-Type": "application/json" } });
    }
    // Arranca el ciclo del día: barre basura de un ciclo anterior que no cerró.
    await db.from("alertas_ciclo_resumen").delete().lt("created_at", new Date(Date.now() - 20 * 3600000).toISOString());
    const nuevoEstado = { id: 1, fecha: hoy, run_id: crypto.randomUUID(), offset_actual: 0, completado: false, updated_at: new Date().toISOString() };
    await db.from("alertas_ciclo_estado").upsert(nuevoEstado);
    estado = nuevoEstado;
  }

  if (estado.completado) {
    return new Response(JSON.stringify({ ok: true, skip: "ciclo_ya_completado" }), { headers: { "Content-Type": "application/json" } });
  }

  // Lock optimista: si el último update fue hace <20s, puede haber otro tick
  // en vuelo (invocación lenta) — no pisar el mismo lote en paralelo.
  const segsDesdeUpdate = (Date.now() - new Date(estado.updated_at).getTime()) / 1000;
  if (segsDesdeUpdate < 20) {
    return new Response(JSON.stringify({ ok: true, skip: "tick_muy_reciente" }), { headers: { "Content-Type": "application/json" } });
  }
  await db.from("alertas_ciclo_estado").update({ updated_at: new Date().toISOString() }).eq("id", 1);

  const run_id: string = estado.run_id;
  const offset: number = estado.offset_actual;
  const { data: leads } = await db
    .from("waitlist")
    .select("id,email,nombre,pais,ciudad,busqueda,ultima_alerta_at,created_at")
    .not("busqueda", "is", null)
    .limit(1000);

  let enviados = 0, conMatch = 0;
  const errores: string[] = [];
  // Resumen para el admin: UN solo email por ciclo con todo lo enviado
  // (reemplaza a la copia espejo bcc por usuario, que llenaba la casilla).
  const resumen: { email: string; busqueda: string; pais: string; avisos: string[] }[] = [];

  const todos = (leads ?? []) as any[];
  const lote = todos.slice(offset, offset + LOTE);
  for (const l of lote) {
    const _t0 = Date.now();
    try {
      const email = String(l.email ?? "");
      console.log(`[diag] inicio ${email} pais=${l.pais}`);
      if (!email.includes("@") || email.includes("example.com")) continue;

      // Primera alerta: mirar 30 días hacia atrás para que el usuario nuevo
      // arranque con los avisos que YA existen (caso real: 30 gerentes en NI
      // invisibles). El dedupe por contenido evita cualquier repetición futura.
      const desde = l.ultima_alerta_at ||
        new Date(Date.now() - 30 * 86400000).toISOString();
      // La gente escribe varios oficios separados por comas ("niñera, limpieza, cocina"):
      // se matchea cada término por separado — la frase literal completa no existe en ningún aviso.
      // Y dentro de cada término, por PALABRAS sin importar el orden: "higiene y seguridad"
      // debe encontrar "Seguridad e Higiene" (caso real: 4 de 6 avisos NI invertían el orden).
      const STOP = new Set(["y","e","o","u","de","del","la","el","los","las","en","para","con","por"]);
      const terminos = String(l.busqueda)
        .split(/[,;/]/)
        .map((t) => t.replace(/[%_'"\\;()]/g, "").trim().slice(0, 40))
        .filter((t) => t.length >= 3)
        .slice(0, 5);
      if (terminos.length === 0) continue;
      const cod = codPais(l.pais);
      let matches: any[] | null = null;

      if (cod) {
        // Con país: RPC insensible a tildes ("tecnico" encuentra "Técnico").
        // Caso real: "tecnico en hemoterapia" sin tilde recibió 0 alertas
        // teniendo 2 llamados exactos activos (2026-07-14).
        const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const terminosNorm = terminos.map((t) =>
          t.split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase())).slice(0, 4).map(norm).join(" ")
        ).filter((s) => s.length > 0);
        if (terminosNorm.length === 0) continue;
        const _tRpc0 = Date.now();
        const _rpcRes = await fetch(`${URL}/rest/v1/rpc/buscar_concursos_alerta`, {
          method: "POST",
          headers: { "apikey": KEY, "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_pais: cod, p_desde: desde, p_terminos: terminosNorm }),
          // Términos muy genéricos (ej. "Cualquiera") pueden hacer que esta consulta
          // nunca termine — confirmado 2026-07-31, colgó >30s sin responder y tumbó
          // la función entera contra el IDLE_TIMEOUT de 150s. Con límite: se descarta
          // ese usuario puntual (cae al catch de abajo) y sigue con los demás.
          signal: AbortSignal.timeout(20000),
        });
        const _rpcData = await _rpcRes.json().catch(() => null);
        console.log(`[diag] rpc1-rawfetch ${email} ${Date.now() - _tRpc0}ms status=${_rpcRes.status} matches=${Array.isArray(_rpcData) ? _rpcData.length : 0}`);
        let exactos: any[] = Array.isArray(_rpcData) ? _rpcData : [];
        // Búsqueda de UNA sola palabra ("Gerente"): la RPC ya exige que sea
        // inicio de palabra (no "Walmart" por "art"), pero una palabra sola
        // puede aparecer como MODIFICADOR del puesto, no como el puesto en sí
        // ("Conductor PARA Gerente General"). Si no está entre las primeras 2
        // palabras del cargo, se degrada a aproximado en vez de exacto.
        const posicionPalabra = (texto: string, palabra: string) => {
          const palabras = norm(String(texto || "")).split(/\s+/);
          return palabras.findIndex((w) => w.startsWith(palabra));
        };
        let aproximados: any[] = [];
        const esUnaSolaPalabra = terminosNorm.length === 1 && !terminosNorm[0].includes(" ");
        if (esUnaSolaPalabra) {
          const palabra = terminosNorm[0];
          const buenos: any[] = [];
          for (const c of exactos) {
            const pos = posicionPalabra(c.cargo, palabra);
            const posFinal = pos >= 0 ? pos : posicionPalabra(c.titulo, palabra);
            if (posFinal >= 0 && posFinal <= 1) buenos.push(c);
            else aproximados.push(c);
          }
          exactos = buenos;
        }

        // Términos SIN ningún resultado exacto propio caen a SU palabra más
        // distintiva (≥5 letras), no a la de toda la búsqueda junta — así una
        // búsqueda de varios oficios no pierde especificidad si UNO no matchea.
        // Caso real: "Realizar Protocolo De Estambul, psicología forense,
        // auxiliar de inventario" — antes, si el conjunto entero daba 0, se
        // colapsaba TODO a una palabra genérica. Ahora cada término se resuelve
        // por separado y lo aproximado queda marcado como tal, no mezclado.
        if (!esUnaSolaPalabra) {
          const terminoCubierto = (term: string, c: any) => {
            const palabrasTerm = term.split(" ").filter((w) => w.length > 0);
            const cubreTexto = (texto: string) => {
              const pals = norm(String(texto || "")).split(/\s+/);
              return palabrasTerm.every((p) => pals.some((w) => w.startsWith(p)));
            };
            return cubreTexto(c.cargo) || cubreTexto(c.titulo);
          };
          const noCubiertos = terminosNorm.filter((t) => !exactos.some((c) => terminoCubierto(t, c)));
          if (noCubiertos.length > 0) {
            // Palabra "distintiva" = la más específica del término, NO la más larga.
            // Caso real 2026-08-05: "piloto ejecutivo" sin match exacto colapsaba a
            // "ejecutivo" (9 letras) en vez de "piloto" (6) porque el criterio viejo
            // era solo longitud — y "ejecutivo" aparece en cualquier puesto comercial
            // (ventas, telemarketing, créditos), mandando avisos ≈ completamente
            // ajenos al oficio real buscado. Se descartan modificadores genéricos de
            // cargo antes de elegir por longitud, salvo que sea la única palabra.
            //
            // Caso real 2026-08-06: "ingenieria de sistemas" sin match exacto colapsó
            // a "ingenieria" (más larga que "sistemas") — misma familia de bug pero con
            // sustantivos de RUBRO amplio en vez de modificadores de CARGO: "ingeniería"
            // sola matchea cualquier rama (hidráulica, civil, industrial...), no solo
            // sistemas. Se suman esos sustantivos de rubro a la misma lista de descarte.
            const MODIFICADORES_GENERICOS = new Set([
              "ejecutivo", "ejecutiva", "asistente", "auxiliar", "general", "senior",
              "junior", "jefe", "encargado", "encargada", "responsable", "coordinador",
              "coordinadora", "especialista", "gerente", "supervisor", "supervisora",
              "operador", "operadora", "representante", "agente", "tecnico", "tecnica",
              "analista", "consultor", "consultora",
              "ingenieria", "licenciatura", "desarrollo", "administracion", "gestion",
              "profesional", "tecnologia", "carrera",
              // Caso real 2026-08-06: "Servicio al cliente" colapsó a "servicio" (más
              // larga que "cliente") y trajo "Servicios Generales" — mismo problema,
              // "servicio" es genérico (servicio al cliente, técnico, de limpieza...).
              // También se descarta "industrial": aparecía en el TÍTULO por venir pegado
              // al nombre de la empresa ("Importante empresa del Sector Industrial"),
              // no porque el puesto tuviera relación real con esa palabra.
              "servicio", "servicios", "industrial", "industriales",
              // Palabras de "quiero UN trabajo" — no son un oficio, nunca deben ser la
              // palabra distintiva. Caso real 2026-08-14: "trabajo remoto" elegía "trabajo"
              // (más larga que "remoto") y traía "Trabajo en Altura" — lo OPUESTO a remoto.
              // Al descartarlas, el fallback cae en "remoto" y matchea puestos remotos.
              "trabajo", "trabajos", "laburo", "empleo", "empleos", "puesto", "puestos",
              "vacante", "vacantes", "oferta", "ofertas",
            ]);
            const distintivas = [...new Set(
              noCubiertos
                .map((t) => {
                  const palabras = t.split(" ");
                  const especificas = palabras.filter((w) => !MODIFICADORES_GENERICOS.has(w));
                  const candidatas = especificas.length > 0 ? especificas : palabras;
                  return candidatas.sort((a, b) => b.length - a.length)[0];
                })
                .filter((w) => w && w.length >= 5),
            )];
            if (distintivas.length > 0) {
              const _tRpc1 = Date.now();
              const { data: data2 } = await db.rpc("buscar_concursos_alerta", {
                p_pais: cod, p_desde: desde, p_terminos: distintivas,
              }).abortSignal(AbortSignal.timeout(20000));
              console.log(`[diag] rpc2(fallback) ${email} ${Date.now() - _tRpc1}ms matches=${data2?.length ?? 0}`);
              const yaTraidos = new Set([...exactos, ...aproximados].map((c: any) => c.id));
              for (const c of (data2 ?? [])) {
                if (!yaTraidos.has(c.id)) aproximados.push(c);
              }
            }
          }
        }

        matches = [
          ...exactos.map((c) => ({ ...c, _aprox: false })),
          ...aproximados.map((c) => ({ ...c, _aprox: true })),
        ];
      } else {
        // Sin país: filtro ilike clásico. El RPC recorta el barrido global a las
        // 20k filas más recientes y perdería avisos viejos (regresión verificada).
        const filtroOr = terminos.flatMap((t) => {
          const palabras = t.split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase())).slice(0, 4);
          if (palabras.length === 0) return [];
          if (palabras.length === 1) return [`titulo.ilike.%${palabras[0]}%`, `cargo.ilike.%${palabras[0]}%`];
          const en = (col: string) => `and(${palabras.map((w) => `${col}.ilike.%${w}%`).join(",")})`;
          return [en("titulo"), en("cargo")];
        }).join(",");
        if (!filtroOr) continue;
        const _tIlike0 = Date.now();
        const { data } = await db.from("concursos")
          .select("id,titulo,cargo,organismo,pais,lugar,url_detalle")
          .eq("activo", true)
          .gt("created_at", desde)
          .or(filtroOr)
          .order("created_at", { ascending: false })
          .limit(8);
        console.log(`[diag] ilike-fallback ${email} ${Date.now() - _tIlike0}ms matches=${data?.length ?? 0}`);
        matches = data;
      }
      if (!matches || matches.length === 0) { console.log(`[diag] sin-match ${email} total=${Date.now()-_t0}ms`); continue; }

      // Dedupe por CONTENIDO por persona: las fuentes borran y reinsertan los
      // mismos avisos a diario (created_at nuevo), y "creados desde tu última
      // alerta" repetía el mismo email todos los días. La clave antes era
      // cargo|organismo|pais EXACTO — caso real confirmado: el mismo aviso de
      // Walmart CR llegó como "Operador Tienda" un día y "Operador de Tienda"
      // otro, y al no ser texto idéntico se mandó dos veces.
      //
      // Ahora, dos capas:
      // 1) Si el link del aviso es una URL real de detalle (no una búsqueda
      //    armada con el título, patrón "search?" de fuentes tipo Adzuna),
      //    se usa esa URL sin el fragmento "#..." de tracking — es el
      //    identificador más confiable porque viene de la fuente original.
      // 2) Si no hay URL confiable, texto normalizado: sin tildes, sin
      //    palabras de relleno (de/la/el/...), palabras ordenadas para no
      //    depender del orden, y sin el número de calificación pegado al
      //    organismo ("4,5\n...Walmart" -> "walmart").
      const limpiarUrl = (u: unknown): string | null => {
        const s = String(u ?? "").trim();
        if (!s || s.includes("search?")) return null;
        return s.split("#")[0];
      };
      const normTexto = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const normalizarCargo = (s: string) =>
        normTexto(s).replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
          .filter((w) => w.length > 0 && !STOP.has(w)).sort().join(" ");
      const normalizarOrganismo = (s: string) =>
        normTexto(s).replace(/^\d[.,]\d\s*/, "").replace(/\s+/g, " ").trim();
      const claveDe = (c: any): string => {
        const urlLimpia = limpiarUrl(c.url_detalle);
        if (urlLimpia) return `url:${urlLimpia}`;
        const cargoNorm = normalizarCargo(String((c.cargo ?? "").trim() || c.titulo || ""));
        const orgNorm = normalizarOrganismo(String(c.organismo ?? ""));
        return `txt:${cargoNorm}|${orgNorm}|${String(c.pais ?? "")}`;
      };
      const claves = matches.map(claveDe);
      const { data: yaEnviadas } = await db
        .from("alertas_enviadas")
        .select("clave")
        .eq("waitlist_id", l.id)
        .in("clave", claves);
      const yaSet = new Set((yaEnviadas ?? []).map((r: any) => r.clave));
      let nuevos = matches.filter((c: any) => !yaSet.has(claveDe(c)));
      if (nuevos.length === 0) continue;
      conMatch++;

      // Zona: si el usuario dio ciudad, priorizar avisos de su zona. Si no hay
      // ninguno de su zona, avisarlo con honestidad y mostrar los de otras
      // ciudades (pedido explícito: "en tu zona aún no encontramos nada, pero
      // si te interesan otras ciudades, aparecieron estos").
      const lng = idiomaDe(l.pais);
      const tz = T[lng] ?? T.es;
      let intro: string | undefined;
      const ciudad = String(l.ciudad ?? "").trim();
      if (ciudad.length >= 3) {
        const normZ = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cn = normZ(ciudad);
        // Solo la parte de CIUDAD del lugar (antes de la coma): "Ribeirão Preto,
        // Estado de São Paulo" no debe matchear con ciudad "São Paulo".
        const deZona = nuevos.filter((c: any) => normZ(String(c.lugar ?? "").split(",")[0]).includes(cn));
        if (deZona.length > 0) {
          nuevos = deZona;
          intro = String(tz.zona_si ?? "").replace("{c}", ciudad);
        } else {
          intro = String(tz.zona_no ?? "").replace("{c}", ciudad);
        }
      }
      // Tope: hasta 8 exactos + hasta 4 aproximados, para no saturar el email
      // con resultados de baja confianza.
      const nuevosExactos = nuevos.filter((c: any) => !c._aprox).slice(0, 8);
      const nuevosAprox = nuevos.filter((c: any) => c._aprox).slice(0, 4);
      nuevos = [...nuevosExactos, ...nuevosAprox];

      const _tResend0 = Date.now();
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Konexu <noreply@konexu.app>",
          to: [email],
          // Entregabilidad: sin emoji en el asunto (penaliza en remitentes nuevos)
          // y con List-Unsubscribe (Gmail lo premia; sin él castiga a bulk senders).
          headers: { "List-Unsubscribe": "<mailto:hola@konexu.app?subject=Baja%20de%20alertas>" },
          subject: asuntoDe(lng, nuevos.length, l.busqueda),
          html: plantilla(l.nombre, l.busqueda, nuevosExactos, nuevosAprox, lng, intro),
        }),
      });
      console.log(`[diag] resend ${email} ${Date.now() - _tResend0}ms status=${res.status} total=${Date.now()-_t0}ms`);

      if (res.ok) {
        enviados++;
        resumen.push({
          email,
          busqueda: String(l.busqueda ?? ""),
          pais: String(l.pais ?? "—"),
          avisos: nuevos.map((c: any) => (c._aprox ? "≈ " : "") + String(c.cargo || c.titulo || "")),
        });
        await db.from("waitlist").update({ ultima_alerta_at: new Date().toISOString() }).eq("id", l.id);
        await db.from("alertas_enviadas").upsert(
          nuevos.map((c: any) => ({ waitlist_id: l.id, clave: claveDe(c) })),
          { onConflict: "waitlist_id,clave", ignoreDuplicates: true },
        );
      } else {
        errores.push(`${email}: Resend ${res.status}`);
      }
    } catch (e) {
      errores.push(`${l.email}: ${(e as Error).message.slice(0, 60)}`);
    }
  }

  // Este lote NO manda email — guarda lo suyo en el acumulador del ciclo.
  // El ÚLTIMO lote de la cadena junta todo y manda UN solo resumen al admin
  // (antes: un email por cada lote de 3 usuarios → 16 emails por ciclo).
  // Mismo shape de columnas en TODAS las filas (resumen y error mezclados) —
  // el insert masivo de PostgREST rechaza con PGRST102 si no coinciden las claves.
  const filasAcumulador = [
    ...resumen.map((r) => ({ run_id, email: r.email, pais: r.pais, busqueda: r.busqueda, avisos: r.avisos, error_msg: null })),
    ...errores.map((e) => ({ run_id, email: e.split(":")[0]?.trim() || "?", pais: null, busqueda: null, avisos: null, error_msg: e })),
  ];
  if (filasAcumulador.length > 0) {
    // Idempotencia ante reintento del mismo lote: si este tick ya había escrito
    // sus filas y murió antes de avanzar el cursor (más abajo), el próximo tick
    // reintenta el MISMO lote. Sin esto, sus filas se acumulaban duplicadas en el
    // resumen del admin (caso real 2026-08-09: 4 usuarios aparecieron 2 veces).
    // Borramos primero las filas de estos emails en este run_id y reescribimos.
    // Los emails a usuarios NO se re-mandan (dedupe aparte por alertas_enviadas):
    // esto solo evita el duplicado en el email de resumen.
    const emailsLote = filasAcumulador.map((f) => f.email).filter((e) => e && e !== "?");
    if (emailsLote.length > 0) {
      await db.from("alertas_ciclo_resumen").delete().eq("run_id", run_id).in("email", emailsLote);
    }
    const { error: errAcum } = await db.from("alertas_ciclo_resumen").insert(filasAcumulador);
    if (errAcum) console.log(`[diag] error insert acumulador: ${errAcum.message}`);
  }

  const esUltimoLote = offset + LOTE >= todos.length;

  if (!esUltimoLote) {
    // Guardar avance del cursor — el próximo tick del cron (cada 1 min)
    // retoma solo, sin depender de que este proceso siga vivo.
    await db.from("alertas_ciclo_estado").update({ offset_actual: offset + LOTE, updated_at: new Date().toISOString() }).eq("id", 1);
  } else {
    // Último lote del ciclo: juntar todo lo acumulado y mandar UN solo resumen.
    const { data: acumulado, error: errLeer } = await db
      .from("alertas_ciclo_resumen")
      .select("email,pais,busqueda,avisos,error_msg")
      .eq("run_id", run_id);
    if (errLeer) console.log(`[diag] error leer acumulador: ${errLeer.message}`);
    const filas = (acumulado ?? []).filter((r: any) => !r.error_msg);
    const erroresAcum = (acumulado ?? []).filter((r: any) => r.error_msg).map((r: any) => r.error_msg as string);
    if (filas.length > 0 || erroresAcum.length > 0) {
      const totalEnviados = filas.length;
      const totalAvisos = filas.reduce((n: number, r: any) => n + (r.avisos?.length ?? 0), 0);
      const bloques = filas.map((r: any) => `
        <tr><td style="padding:10px 0;border-bottom:1px solid #EDE8E2">
          <div style="font-size:14px;font-weight:700;color:#1A1020">${esc(r.email)} · ${esc(r.pais)}</div>
          <div style="font-size:12px;color:#8c8492">buscaba: "${esc(r.busqueda)}"</div>
          <ul style="margin:6px 0 0;padding-left:18px;font-size:12px;color:#1A1020">
            ${(r.avisos ?? []).map((a: string) => `<li>${esc(a)}</li>`).join("")}
          </ul>
        </td></tr>`).join("");
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Konexu <noreply@konexu.app>",
          to: ["alejandrodslp@gmail.com"],
          subject: `Resumen alertas: ${totalEnviados} email${totalEnviados === 1 ? "" : "s"}, ${totalAvisos} aviso${totalAvisos === 1 ? "" : "s"}${erroresAcum.length ? `, ${erroresAcum.length} errores` : ""}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px">
            <h3>Ciclo de alertas — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</h3>
            <table style="width:100%;border-collapse:collapse">${bloques}</table>
            ${erroresAcum.length ? `<p style="color:#C2502F;font-size:12px">Errores: ${esc(erroresAcum.join(" | "))}</p>` : ""}
          </div>`,
        }),
      }).catch(() => {});
    }
    // Limpieza: borrar lo acumulado de este ciclo, ya consolidado en el email.
    await db.from("alertas_ciclo_resumen").delete().eq("run_id", run_id);
    await db.from("alertas_ciclo_estado").update({ completado: true, updated_at: new Date().toISOString() }).eq("id", 1);
  }

  return new Response(
    JSON.stringify({ ok: true, tanda_desde: offset, procesados: lote.length, total: todos.length, con_match: conMatch, enviados, errores }),
    { headers: { "Content-Type": "application/json" } },
  );
});
