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
    comparte: 'Comparte <a href="https://konexu.app" style="color:#C2502F;font-weight:700;text-decoration:none">konexu.app</a> con alguien que esté buscando trabajo — puede cambiarle la semana.',
    util: "¿Te resultó útil?",
    pie: "Te llega esto porque activaste alertas gratis en Konexu. Si no querés recibir más, respondé este correo.",
    asunto: '{n} nuevo{s} empleo{s} de "{q}" para ti',
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
  },
};
function idiomaDe(pais: string | null): string {
  const cod = codPais(pais);
  return (cod && LANG_POR_PAIS[cod]) || "es";
}

function plantilla(nombre: string | null, busqueda: string, matches: any[], lang = "es", intro?: string): string {
  const t = T[lang] ?? T.es;
  const saludo = nombre ? `${t.hola} ${esc(nombre)},` : `${t.hola},`;
  const items = matches.map((c) => {
    const titulo = esc(c.cargo || c.titulo);
    const org    = esc(c.organismo || "");
    const lugar  = esc(c.lugar || c.pais || "");
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #EDE8E2">
      <div style="font-size:15px;font-weight:700;color:#1A1020">${titulo}</div>
      <div style="font-size:13px;color:#8c8492;margin-top:2px">${org}${org && lugar ? " · " : ""}${lugar}</div>
    </td></tr>`;
  }).join("");
  const n = matches.length;
  const plural = n > 1 ? t.s : "";
  const base = (n === 1 && t.aparecieron1) ? t.aparecieron1 : t.aparecieron;
  const titular = lang === "ja"
    ? base.replace("{q}", esc(busqueda)).replace("{n}", String(n))
    : `${base.replace("{n}", String(n)).replace(/\{s\}/g, plural)} "${esc(busqueda)}"`;
  const link = `${SITE}/empleos?q=${encodeURIComponent(busqueda)}`;
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#FBF8F4">
    <div style="background:#0D1117;padding:24px 32px"><img src="https://www.konexu.app/logo-email.png" alt="Konexu" width="98" height="40" style="display:block;border:0"></div>
    <div style="padding:28px 32px">
      <p style="font-size:15px;color:#1A1020">${saludo}</p>
      <h2 style="color:#1A1020;font-size:20px;margin:8px 0 4px">${titular}</h2>
      <p style="font-size:13px;color:#8c8492;margin:0 0 16px">${intro ?? t.justo}</p>
      <table style="width:100%;border-collapse:collapse">${items}</table>
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

const LOTE = 12; // usuarios por invocación: con el doble RPC del fallback,
// procesar todos en una pasada superaba los 150s del runtime (IDLE_TIMEOUT)
// y los últimos de la lista quedaban sin procesar.
serve(async (req: Request) => {
  const { offset = 0 } = await req.json().catch(() => ({ offset: 0 }));
  const db = createClient(URL, KEY);
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
    try {
      const email = String(l.email ?? "");
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
        const { data } = await db.rpc("buscar_concursos_alerta", {
          p_pais: cod, p_desde: desde, p_terminos: terminosNorm,
        });
        matches = data;
        // Fallback SOLO cuando hay CERO resultados: reintentar con la palabra
        // más distintiva (la más larga, ≥5 letras) de cada término. Caso real:
        // "técnico superior en hemoterapia" recibía 0 por la palabra "superior"
        // mientras "técnico en hemoterapia" recibía 2. Quien ya recibe, no cambia.
        if (!matches || matches.length === 0) {
          const distintivas = [...new Set(
            terminosNorm
              .map((t) => t.split(" ").sort((a, b) => b.length - a.length)[0])
              .filter((w) => w && w.length >= 5),
          )];
          if (distintivas.length > 0) {
            const { data: data2 } = await db.rpc("buscar_concursos_alerta", {
              p_pais: cod, p_desde: desde, p_terminos: distintivas,
            });
            matches = data2;
          }
        }
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
        const { data } = await db.from("concursos")
          .select("id,titulo,cargo,organismo,pais,lugar")
          .eq("activo", true)
          .gt("created_at", desde)
          .or(filtroOr)
          .order("created_at", { ascending: false })
          .limit(8);
        matches = data;
      }
      if (!matches || matches.length === 0) continue;

      // Dedupe por CONTENIDO por persona: las fuentes borran y reinsertan los
      // mismos avisos a diario (created_at nuevo), y "creados desde tu última
      // alerta" repetía el mismo email todos los días (caso real: Leyssi recibió
      // los mismos 2 avisos el 09 y el 10/07). La clave es cargo|organismo|pais.
      const claveDe = (c: any) =>
        [String((c.cargo ?? "").trim() || c.titulo || "").trim().toLowerCase(),
         String(c.organismo ?? "").trim().toLowerCase(),
         String(c.pais ?? "")].join("|");
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
      nuevos = nuevos.slice(0, 8);

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
          html: plantilla(l.nombre, l.busqueda, nuevos, lng, intro),
        }),
      });

      if (res.ok) {
        enviados++;
        resumen.push({
          email,
          busqueda: String(l.busqueda ?? ""),
          pais: String(l.pais ?? "—"),
          avisos: nuevos.map((c: any) => String(c.cargo || c.titulo || "")),
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

  // Un solo email al admin con todo lo del ciclo (auditoría: los avisos fuente
  // rotan a diario y el contenido no es reconstruible después).
  if (resumen.length > 0) {
    const totalAvisos = resumen.reduce((n, r) => n + r.avisos.length, 0);
    const bloques = resumen.map((r) => `
      <tr><td style="padding:10px 0;border-bottom:1px solid #EDE8E2">
        <div style="font-size:14px;font-weight:700;color:#1A1020">${esc(r.email)} · ${esc(r.pais)}</div>
        <div style="font-size:12px;color:#8c8492">buscaba: "${esc(r.busqueda)}"</div>
        <ul style="margin:6px 0 0;padding-left:18px;font-size:12px;color:#1A1020">
          ${r.avisos.map((a) => `<li>${esc(a)}</li>`).join("")}
        </ul>
      </td></tr>`).join("");
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Konexu <noreply@konexu.app>",
        to: ["alejandrodslp@gmail.com"],
        subject: `Resumen alertas: ${enviados} email${enviados > 1 ? "s" : ""}, ${totalAvisos} aviso${totalAvisos > 1 ? "s" : ""}${errores.length ? `, ${errores.length} errores` : ""}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px">
          <h3>Ciclo de alertas — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</h3>
          <table style="width:100%;border-collapse:collapse">${bloques}</table>
          ${errores.length ? `<p style="color:#C2502F;font-size:12px">Errores: ${esc(errores.join(" | "))}</p>` : ""}
        </div>`,
      }),
    }).catch(() => {});
  }

  // Encadenar la siguiente tanda sin bloquear la respuesta
  if (offset + LOTE < todos.length) {
    const siguiente = fetch(`${URL}/functions/v1/alertas-waitlist`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ offset: offset + LOTE }),
    }).catch(() => {});
    // @ts-ignore — disponible en el runtime de Supabase
    (globalThis as any).EdgeRuntime?.waitUntil?.(siguiente);
  }

  return new Response(
    JSON.stringify({ ok: true, tanda_desde: offset, procesados: lote.length, total: todos.length, con_match: conMatch, enviados, errores }),
    { headers: { "Content-Type": "application/json" } },
  );
});
