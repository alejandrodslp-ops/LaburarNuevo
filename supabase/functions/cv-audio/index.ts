import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_KEY   = Deno.env.get("GROQ_API_KEY")!;
const SUPA_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPA_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db         = createClient(SUPA_URL, SUPA_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ok  = (b: unknown) => new Response(JSON.stringify(b), { headers: { ...CORS, "Content-Type": "application/json" } });
const err = (m: string, s = 400) => new Response(JSON.stringify({ error: m }), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

async function llama(prompt: string): Promise<unknown> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Llama error: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const contentType = req.headers.get("content-type") ?? "";

  try {
    /* ══════════════════════════════════════════════════════
       ACCIÓN 1: TRANSCRIBIR (FormData con audio)
       ══════════════════════════════════════════════════════ */
    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      const audioFile = fd.get("audio") as File | null;
      if (!audioFile) return err("Campo 'audio' requerido");

      // Whisper
      const wf = new FormData();
      wf.append("file", audioFile, audioFile.name || "audio.webm");
      wf.append("model", "whisper-large-v3");
      wf.append("language", "es");
      wf.append("response_format", "json");

      const wRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_KEY}` },
        body: wf,
      });
      if (!wRes.ok) throw new Error(`Whisper error: ${await wRes.text()}`);
      const { text: transcript } = await wRes.json();
      if (!transcript?.trim()) return err("No se detectó voz. Intentá hablar más cerca del micrófono.");

      // Extraer perfil del audio
      const analisis = await llama(`Eres experto en RRHH para América Latina. Transcribiste el audio de un usuario que está armando su CV.

Audio transcripto: "${transcript}"

REGLAS ESTRICTAS DE EXTRACCIÓN:

1. GEOGRAFÍA — los siguientes son departamentos de URUGUAY, NO apellidos. Si el usuario los menciona, son su CIUDAD/LOCALIDAD:
   Artigas, Canelones, Cerro Largo, Colonia, Durazno, Flores, Florida, Lavalleja, Maldonado, Montevideo, Paysandú, Río Negro, Rivera, Rocha, Salto, San José, Soriano, Tacuarembó, Treinta y Tres.
   También son ciudades: Buenos Aires, Córdoba, Rosario, Santiago, Lima, Bogotá, Ciudad de México, São Paulo, etc.

2. MÚLTIPLES OFICIOS — si menciona más de un oficio, profesión o trabajo (ej: "soy electricista, plomero y pintor"), ponelos TODOS en roles_buscados y en habilidades. No te quedés con uno solo.

3. EDAD — si dice su edad o año de nacimiento, extraela como número.

4. AÑOS DE EXPERIENCIA — si dice "llevo 10 años", "trabajo desde hace 5 años", "tengo 3 años de experiencia", extraé el número.

5. Si no mencionó algo, poné null. No inventes datos.

Respondé SOLO JSON válido, sin texto antes ni después:
{
  "perfil": {
    "nombre": "nombre mencionado o null",
    "edad": número o null,
    "ciudad": "ciudad o departamento mencionado o null",
    "pais": "país mencionado o null (si dijo un depto. uruguayo y no mencionó país, poné Uruguay)",
    "profesion": "profesión principal en 2-4 palabras",
    "sector": "tecnología / salud / educación / comercio / construcción / administración / servicios / arte / otro",
    "anos_experiencia": número o null,
    "habilidades": ["TODOS los oficios, habilidades y herramientas mencionados"],
    "experiencia": "resumen de experiencia en 1 oración concreta",
    "roles_buscados": ["TODOS los cargos u oficios mencionados como trabajo actual o buscado"]
  },
  "cv": "perfil profesional en primera persona, tono formal y directo. PROHIBIDO: frases sobre metas, objetivos, crecimiento personal, ampliar habilidades, superación, o cualquier lenguaje aspiracional. SOLO hechos: qué hace, cuánto tiempo lleva, qué sabe hacer. 3-4 oraciones.",
  "mensaje": "observación directa sobre sus puntos fuertes, tono profesional, máximo 2 oraciones"
}`);

      return ok({ transcript, analisis });
    }

    /* ══════════════════════════════════════════════════════
       ACCIÓN 2: GENERAR CV COMPLETO + BUSCAR EMPLEOS (JSON)
       ══════════════════════════════════════════════════════ */
    const body = await req.json();
    if (body.action !== "generate_cv") return err("Acción no reconocida");

    const { analisis, datos } = body;
    const p = analisis?.perfil ?? {};

    // CV final pulido
    const cv_final = await llama(`Sos un redactor profesional de CVs para América Latina.

Datos del usuario:
- Nombre: ${datos.nombre}
- Edad: ${datos.edad || p.edad || "no especificada"}
- Profesión: ${datos.profesion || p.profesion}
- Nivel: ${datos.nivel}
- Ciudad/País: ${[datos.ciudad, datos.pais].filter(Boolean).join(", ") || "no especificado"}
- Habilidades: ${(p.habilidades ?? []).join(", ")}
- Experiencia: ${p.experiencia}
- Extra: ${datos.extra || "ninguno"}

Generá un JSON con:
{
  "resumen": "párrafo de perfil profesional en primera persona. Tono formal y directo. Sin metáforas, sin adjetivos exagerados, sin frases poéticas. Solo hechos concretos: qué hace, cuánto tiene de experiencia, qué sabe. 3-4 oraciones."
}`);

    // Matching de empleos — estrategia por capas
    const roles: string[] = p.roles_buscados ?? [datos.profesion ?? p.profesion ?? ""];
    const habilidades: string[] = p.habilidades ?? [];
    const sector: string = p.sector ?? "";

    // Capa 1: overlap con keywords[] de concursos
    const { data: porKeywords } = await db
      .from("concursos")
      .select("id, titulo, cargo, organismo, pais, lugar, url_postulacion, url_detalle, requisitos, keywords")
      .eq("activo", true)
      .overlaps("keywords", habilidades.concat(roles).map(s => s.toLowerCase()))
      .limit(8);

    // Capa 2: búsqueda por cargo con cada rol
    const capas2Promesas = roles.slice(0, 3).map((r: string) =>
      db.from("concursos")
        .select("id, titulo, cargo, organismo, pais, lugar, url_postulacion, url_detalle, requisitos, keywords")
        .eq("activo", true)
        .ilike("cargo", `%${r}%`)
        .limit(4)
    );
    const capas2Results = await Promise.all(capas2Promesas);

    // Capa 3: búsqueda por titulo
    const capas3Promesas = roles.slice(0, 2).map((r: string) =>
      db.from("concursos")
        .select("id, titulo, cargo, organismo, pais, lugar, url_postulacion, url_detalle, requisitos, keywords")
        .eq("activo", true)
        .ilike("titulo", `%${r}%`)
        .limit(4)
    );
    const capas3Results = await Promise.all(capas3Promesas);

    // Unir y deduplicar
    const vistos = new Set<string>();
    const candidatos: unknown[] = [];
    const todas = [
      ...(porKeywords ?? []),
      ...capas2Results.flatMap(r => r.data ?? []),
      ...capas3Results.flatMap(r => r.data ?? []),
    ];
    for (const j of todas) {
      const item = j as Record<string, unknown>;
      if (!vistos.has(item.id as string)) {
        vistos.add(item.id as string);
        candidatos.push(item);
      }
    }

    if (candidatos.length === 0) {
      return ok({ cv_final, empleos: [] });
    }

    // Filtrar y puntuar con Llama — pasamos los candidatos y el perfil
    const candidatosSimples = candidatos.slice(0, 12).map((j: unknown) => {
      const item = j as Record<string, unknown>;
      return {
        id: item.id, titulo: item.titulo, cargo: item.cargo,
        organismo: item.organismo, pais: item.pais,
        requisitos: typeof item.requisitos === "string" ? item.requisitos?.slice(0, 200) : null,
      };
    });

    const filtrado = await llama(`Sos un experto en RRHH. Dado este perfil:
- Profesión: ${datos.profesion || p.profesion}
- Sector: ${sector}
- Habilidades: ${habilidades.join(", ")}
- Nivel: ${datos.nivel}

Evaluá cada empleo y devolvé SOLO los que realmente apliquen al perfil (máximo 5).
Descartá los que claramente no tienen relación.

Empleos candidatos:
${JSON.stringify(candidatosSimples)}

Respondé JSON:
{
  "empleos": [
    { "id": "uuid del empleo", "razon": "por qué encaja en 1 oración corta" }
  ]
}`);

    // Reconstruir con datos completos
    const empleosFiltrados = (filtrado as { empleos?: Array<{ id: string; razon: string }> }).empleos ?? [];
    const empleosFinales = empleosFiltrados
      .map(({ id, razon }) => {
        const full = candidatos.find((c: unknown) => (c as Record<string, unknown>).id === id) as Record<string, unknown> | undefined;
        if (!full) return null;
        return { ...full, razon, keywords: undefined };
      })
      .filter(Boolean)
      .slice(0, 5);

    return ok({ cv_final, empleos: empleosFinales });

  } catch (e) {
    console.error("cv-audio error:", e);
    return err(e instanceof Error ? e.message : "Error interno", 500);
  }
});
