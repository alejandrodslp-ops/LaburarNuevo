import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL          = "alejandrodslp@gmail.com";

function ok(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json", ...CORS } });
}
function err(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { headers: { "Content-Type": "application/json", ...CORS } });
}

// Verifica el JWT contra Supabase — valida firma criptográfica real
async function verificarAdmin(authHeader: string): Promise<{ email: string | null; sub: string | null }> {
  try {
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return { email: null, sub: null };
    const verifier = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error } = await verifier.auth.getUser(token);
    if (error || !user) return { email: null, sub: null };
    return { email: user.email ?? null, sub: user.id };
  } catch { return { email: null, sub: null }; }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
async function getStats(db: ReturnType<typeof createClient>) {
  const now      = new Date();
  const weekAgo  = new Date(now.getTime() - 7  * 86400000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

  const { data: ps } = await db.from("profiles").select(
    "id, pais, ciudad, perfil_activo, perfil_activo_hasta, periodo_gratis_hasta, avatar_url, visualizaciones_disponibles, created_at, vistas, contactos, rating, servicios, profesiones"
  );
  const arr = ps ?? [];

  const activos          = arr.filter((p: any) => p.perfil_activo && p.perfil_activo_hasta && new Date(p.perfil_activo_hasta) > now).length;
  const enPrueba         = arr.filter((p: any) => !p.perfil_activo && p.periodo_gratis_hasta && new Date(p.periodo_gratis_hasta) > now).length;
  const inactivos        = arr.filter((p: any) => !p.perfil_activo && (!p.periodo_gratis_hasta || new Date(p.periodo_gratis_hasta) <= now)).length;
  const vencenEn7Dias    = arr.filter((p: any) => p.perfil_activo && p.perfil_activo_hasta && new Date(p.perfil_activo_hasta) > now && new Date(p.perfil_activo_hasta) < new Date(now.getTime() + 7 * 86400000)).length;
  const nuevosEstaSemana = arr.filter((p: any) => p.created_at >= weekAgo).length;
  const nuevosEsteMes    = arr.filter((p: any) => p.created_at >= monthAgo).length;
  const sinFoto          = arr.filter((p: any) => !p.avatar_url).length;
  const employersConSaldo= arr.filter((p: any) => (p.visualizaciones_disponibles ?? 0) > 0).length;
  const perfilesCompletos= arr.filter((p: any) => p.avatar_url && ((p.servicios?.length ?? 0) > 0 || (p.profesiones?.length ?? 0) > 0)).length;

  const porPais: Record<string,number> = {};
  const porCiudad: Record<string,number> = {};
  for (const p of arr as any[]) {
    if (p.pais)   porPais[p.pais]     = (porPais[p.pais]     ?? 0) + 1;
    if (p.ciudad) porCiudad[p.ciudad] = (porCiudad[p.ciudad] ?? 0) + 1;
  }
  const paises   = Object.entries(porPais).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([pais,count])=>({pais,count}));
  const ciudades = Object.entries(porCiudad).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([ciudad,count])=>({ciudad,count}));

  // Horas pico de registro (UTC)
  const porHora: Record<number,number> = {};
  for (const p of arr as any[]) {
    if (p.created_at) {
      const h = new Date(p.created_at).getUTCHours();
      porHora[h] = (porHora[h] ?? 0) + 1;
    }
  }
  const horasPico = Object.entries(porHora)
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([h, count]) => ({ hora: `${String(h).padStart(2,'0')}:00`, count: Number(count) }));

  // Tendencia mensual — últimos 6 meses
  const mesesKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    mesesKeys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  const regPorMes: Record<string,number> = Object.fromEntries(mesesKeys.map(k => [k, 0]));
  for (const p of arr as any[]) {
    const key = (p.created_at ?? '').slice(0, 7);
    if (regPorMes[key] !== undefined) regPorMes[key]++;
  }
  const registrosPorMes = mesesKeys.map(mes => ({ mes, count: regPorMes[mes] }));

  const { data: pgd } = await db.from("pagos").select("monto, created_at, estado");
  const aprobados    = (pgd ?? []).filter((p: any) => p.estado === "aprobado");
  const ingresoTotal = aprobados.reduce((s: number, p: any) => s + (p.monto ?? 0), 0);
  const ingresoSemana= aprobados.filter((p: any) => p.created_at >= weekAgo).reduce((s: number, p: any) => s + (p.monto ?? 0), 0);
  const ingresoMes   = aprobados.filter((p: any) => p.created_at >= monthAgo).reduce((s: number, p: any) => s + (p.monto ?? 0), 0);

  const actPorMes: Record<string,number> = Object.fromEntries(mesesKeys.map(k => [k, 0]));
  for (const p of aprobados as any[]) {
    const key = (p.created_at ?? '').slice(0, 7);
    if (actPorMes[key] !== undefined) actPorMes[key]++;
  }
  const activacionesPorMes = mesesKeys.map(mes => ({ mes, count: actPorMes[mes] }));

  // Mensajes enviados
  const semanaAtras = new Date(now.getTime() - 7 * 86400000).toISOString();
  const [{ count: totalMensajes }, { count: mensajesSemana }] = await Promise.all([
    db.from("mensajes").select("*", { count: "exact", head: true }),
    db.from("mensajes").select("*", { count: "exact", head: true }).gte("created_at", semanaAtras),
  ]);

  const tasaActivacion = arr.length > 0 ? Math.round((activos / arr.length) * 100) : 0;

  return ok({ totalUsuarios: arr.length, activos, enPrueba, inactivos, vencenEn7Dias, nuevosEstaSemana, nuevosEsteMes, sinFoto, employersConSaldo, paises, ciudades, ingresoTotal, ingresoSemana, ingresoMes, cantidadPagos: aprobados.length, registrosPorMes, activacionesPorMes, horasPico, totalMensajes: totalMensajes ?? 0, mensajesSemana: mensajesSemana ?? 0, tasaActivacion, perfilesCompletos });
}

// ── Listar ────────────────────────────────────────────────────────────────────
async function listarUsuarios(db: ReturnType<typeof createClient>, params: any) {
  const busqueda = ((params?.busqueda as string) ?? "").trim().toLowerCase();
  const filtro   = (params?.filtro   as string) ?? "todos";
  const paisFlt  = ((params?.pais    as string) ?? "").trim().toLowerCase();
  const ciudadFlt= ((params?.ciudad  as string) ?? "").trim().toLowerCase();
  const pagina   = Number(params?.pagina ?? 0);
  const limite   = Number(params?.limite ?? 40);

  let q = db.from("profiles").select(
    "id, nombre, apellido1, servicios, profesiones, pais, ciudad, perfil_activo, perfil_activo_hasta, vistas, contactos, rating, avatar_url, visualizaciones_disponibles, created_at"
  );
  if (filtro === "activo")    q = q.eq("perfil_activo", true);
  if (filtro === "inactivo")  q = q.eq("perfil_activo", false);
  if (filtro === "con_saldo") q = q.gt("visualizaciones_disponibles", 0);

  const { data: authData } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap: Record<string,string> = {};
  for (const u of authData?.users ?? []) emailMap[u.id] = u.email ?? "—";

  const { data: rawPerfiles } = await q.order("created_at", { ascending: false });
  let filtrados = (rawPerfiles ?? []).map((p: any) => ({ ...p, email: emailMap[p.id] ?? "—" }));

  if (busqueda) filtrados = filtrados.filter((p: any) =>
    p.nombre?.toLowerCase().includes(busqueda) ||
    p.apellido1?.toLowerCase().includes(busqueda) ||
    p.email?.toLowerCase().includes(busqueda) ||
    p.ciudad?.toLowerCase().includes(busqueda) ||
    p.pais?.toLowerCase().includes(busqueda) ||
    p.servicios?.some((s: string) => s.toLowerCase().includes(busqueda)) ||
    p.profesiones?.some((s: string) => s.toLowerCase().includes(busqueda))
  );
  if (paisFlt)   filtrados = filtrados.filter((p: any) => p.pais?.toLowerCase().includes(paisFlt));
  if (ciudadFlt) filtrados = filtrados.filter((p: any) => p.ciudad?.toLowerCase().includes(ciudadFlt));

  return ok({ usuarios: filtrados.slice(pagina*limite, (pagina+1)*limite), total: filtrados.length });
}

// ── Detalle ───────────────────────────────────────────────────────────────────
async function getDetalle(db: ReturnType<typeof createClient>, params: any) {
  const id = params?.id as string;
  if (!id) return err("id requerido");
  const [
    { data: perfil },
    { data: authUser },
    { data: pagos },
    { data: mensajesEnv },
    { data: mensajesRec },
    { data: propuestas },
    { data: matches },
    { data: reportes },
  ] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).single(),
    db.auth.admin.getUserById(id),
    db.from("pagos").select("*").or(`user_id.eq.${id},employer_id.eq.${id},worker_id.eq.${id}`).order("created_at", { ascending: false }),
    db.from("mensajes").select("id,texto,created_at,receiver_id").eq("sender_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("mensajes").select("id,texto,created_at,sender_id").eq("receiver_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("propuestas").select("id,estado,created_at,employer_id,worker_id,descripcion").or(`employer_id.eq.${id},worker_id.eq.${id}`).order("created_at", { ascending: false }).limit(20),
    db.from("concurso_matches").select("id,score,created_at,concurso_id,concursos(titulo,organizacion,pais)").eq("worker_id", id).order("score", { ascending: false }).limit(15),
    db.from("reportes").select("id,motivo,detalle,estado,created_at,reporter_id").or(`reporter_id.eq.${id},reported_id.eq.${id}`).order("created_at", { ascending: false }).limit(10),
  ]);
  return ok({
    perfil,
    email:           (authUser as any)?.user?.email ?? "—",
    last_sign_in_at: (authUser as any)?.user?.last_sign_in_at ?? null,
    pagos:           pagos ?? [],
    mensajes_enviados:   mensajesEnv ?? [],
    mensajes_recibidos:  mensajesRec ?? [],
    propuestas:          propuestas ?? [],
    matches:             matches ?? [],
    reportes:            reportes ?? [],
  });
}

// ── Pagos ─────────────────────────────────────────────────────────────────────
async function getPagos(db: ReturnType<typeof createClient>, params: any) {
  const periodo = (params?.periodo as string) ?? "todo";
  const now = new Date();
  const fechas: Record<string,string> = {
    hoy:    new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
    semana: new Date(now.getTime() - 7   * 86400000).toISOString(),
    mes:    new Date(now.getTime() - 30  * 86400000).toISOString(),
    anio:   new Date(now.getTime() - 365 * 86400000).toISOString(),
  };
  let q = db.from("pagos").select("id, user_id, monto, moneda, metodo, estado, created_at").eq("estado", "aprobado").order("created_at", { ascending: false });
  if (fechas[periodo]) q = q.gte("created_at", fechas[periodo]);
  const { data: ps } = await q;
  const arr = ps ?? [];
  const total = arr.reduce((s: number, p: any) => s + (p.monto ?? 0), 0);
  const porMetodo: Record<string,number> = {};
  for (const p of arr as any[]) porMetodo[p.metodo ?? "otro"] = (porMetodo[p.metodo ?? "otro"] ?? 0) + (p.monto ?? 0);
  return ok({ pagos: arr.slice(0, 100), total, cantidad: arr.length, porMetodo });
}

// ── Consultas ─────────────────────────────────────────────────────────────────
async function consultas(db: ReturnType<typeof createClient>, params: any) {
  const tipo = params?.tipo as string;
  const now  = new Date();

  switch (tipo) {
    case "vencen_pronto": {
      const en7 = new Date(now.getTime() + 7 * 86400000).toISOString();
      const { data } = await db.from("profiles").select("id,nombre,apellido1,perfil_activo_hasta,vistas,contactos,pais,ciudad").eq("perfil_activo", true).lte("perfil_activo_hasta", en7).gte("perfil_activo_hasta", now.toISOString()).order("perfil_activo_hasta", { ascending: true });
      return ok(data ?? []);
    }
    case "sin_foto": {
      const { data } = await db.from("profiles").select("id,nombre,apellido1,pais,ciudad,servicios,perfil_activo,created_at").is("avatar_url", null).order("created_at", { ascending: false });
      return ok(data ?? []);
    }
    case "top_vistas": {
      const { data } = await db.from("profiles").select("id,nombre,apellido1,servicios,profesiones,ciudad,vistas,contactos,rating,perfil_activo").gt("vistas", 0).order("vistas", { ascending: false }).limit(30);
      return ok(data ?? []);
    }
    case "recientes_24h": {
      const ayer = new Date(now.getTime() - 86400000).toISOString();
      const { data } = await db.from("profiles").select("id,nombre,apellido1,pais,ciudad,servicios,profesiones,created_at").gte("created_at", ayer).order("created_at", { ascending: false });
      return ok(data ?? []);
    }
    case "employers_saldo": {
      const { data } = await db.from("profiles").select("id,nombre,apellido1,visualizaciones_disponibles,ciudad,pais").gt("visualizaciones_disponibles", 0).order("visualizaciones_disponibles", { ascending: false });
      return ok(data ?? []);
    }
    case "sin_actividad": {
      const dias  = Math.max(1, Number(params?.dias ?? 30));
      const corte = new Date(now.getTime() - dias * 86400000).toISOString();
      const { data } = await db.from("profiles").select("id,nombre,apellido1,ciudad,pais,perfil_activo,updated_at,vistas").lte("updated_at", corte).eq("perfil_activo", false).order("updated_at", { ascending: true }).limit(50);
      return ok(data ?? []);
    }
    case "top_oficios": {
      const { data } = await db.from("profiles").select("servicios,profesiones");
      const cnt: Record<string,number> = {};
      for (const p of data as any[] ?? []) {
        for (const s of p.servicios ?? [])   cnt[s] = (cnt[s] ?? 0) + 1;
        for (const s of p.profesiones ?? []) cnt[s] = (cnt[s] ?? 0) + 1;
      }
      return ok(Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,40).map(([oficio,count])=>({oficio,count})));
    }
    case "top_empleadores": {
      const { data: pgs } = await db.from("pagos").select("employer_id,monto").eq("estado", "aprobado");
      const gastos: Record<string,number> = {};
      for (const p of pgs as any[] ?? []) {
        if (!p.employer_id) continue;
        gastos[p.employer_id] = (gastos[p.employer_id] ?? 0) + (p.monto ?? 0);
      }
      const top = Object.entries(gastos).sort((a,b)=>b[1]-a[1]).slice(0,20);
      if (!top.length) return ok([]);
      const { data: prfs } = await db.from("profiles").select("id,nombre,apellido1,ciudad,pais").in("id", top.map(([id])=>id));
      const mapa: Record<string,any> = Object.fromEntries((prfs as any[] ?? []).map((p: any) => [p.id, p]));
      return ok(top.map(([id, total]) => ({ ...(mapa[id] ?? { id }), total_gastado: total })));
    }
    case "mas_contratados": {
      const { data } = await db.from("profiles").select("id,nombre,apellido1,servicios,profesiones,ciudad,pais,contactos,vistas,rating,perfil_activo").gt("contactos", 0).order("contactos", { ascending: false }).limit(30);
      return ok(data ?? []);
    }
    // ── Nuevas consultas de concursos ──
    case "demanda_concursos": {
      const { data } = await db.from("concursos").select("cargo, tipo_tarea, tipo_vinculo").eq("activo", true);
      const cnt: Record<string,number> = {};
      for (const c of data as any[] ?? []) {
        const key = (c.cargo || c.tipo_tarea || "Otro").trim();
        if (key) cnt[key] = (cnt[key] ?? 0) + 1;
      }
      return ok(Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,40).map(([oficio,count])=>({oficio,count})));
    }
    case "todos_llamados": {
      const tipoVinculo = ((params?.tipo_vinculo as string) ?? "").trim();
      const paisFlt2    = ((params?.pais          as string) ?? "").trim().toUpperCase().slice(0, 2);
      const cargoFlt2   = ((params?.cargo         as string) ?? "").trim().replace(/['"\\;]/g, "").slice(0, 100);

      // LÍMITE FIJO: NO MODIFICAR. Máximo de registros a devolver en la consulta de admin.
      // Solo cambiar si el usuario lo solicita explícitamente.
      const LIMITE_LLAMADOS = 2000;

      const ahoraISO = new Date().toISOString();

      let q = db.from("concursos")
        .select("id,cargo,titulo,organismo,pais,lugar,fecha_cierre,tipo_tarea,tipo_vinculo,activo,created_at,url_detalle,url_postulacion,descripcion,requisitos,numero_llamado,puestos,fecha_inicio")
        .eq("activo", true)
        .or(`fecha_cierre.is.null,fecha_cierre.gte.${ahoraISO}`)
        .order("created_at", { ascending: false })
        .limit(LIMITE_LLAMADOS);

      // Privado = tiene tipo_vinculo "privado"
      // Público  = no tiene "privado" O tiene tipo_vinculo NULL (la mayoría de concursos estatales)
      if (tipoVinculo === "privado") {
        q = q.eq("tipo_vinculo", "privado");
      } else if (tipoVinculo === "publico") {
        q = q.or("tipo_vinculo.neq.privado,tipo_vinculo.is.null");
      }

      // Filtros en SQL antes del límite
      if (paisFlt2)   q = q.eq("pais", paisFlt2);
      if (cargoFlt2)  q = q.or(`cargo.ilike.%${cargoFlt2}%,titulo.ilike.%${cargoFlt2}%`);

      // COUNT real (sin límite) para mostrar total exacto en DB
      let countQ = db.from("concursos").select("*", { count: "exact", head: true })
        .eq("activo", true)
        .or(`fecha_cierre.is.null,fecha_cierre.gte.${ahoraISO}`);
      if (tipoVinculo === "privado") countQ = countQ.eq("tipo_vinculo", "privado");
      else if (tipoVinculo === "publico") countQ = countQ.or("tipo_vinculo.neq.privado,tipo_vinculo.is.null");
      if (paisFlt2)  countQ = countQ.eq("pais", paisFlt2);
      if (cargoFlt2) countQ = countQ.or(`cargo.ilike.%${cargoFlt2}%,titulo.ilike.%${cargoFlt2}%`);

      const [{ data: todos }, { count: totalReal }] = await Promise.all([q, countQ]);
      const registros = (todos as any[]) ?? [];

      // Breakdown por país para mostrar cobertura real
      const por_pais: Record<string, number> = {};
      for (const c of registros) {
        if (c.pais) por_pais[c.pais] = (por_pais[c.pais] ?? 0) + 1;
      }

      return ok({ concursos: registros, por_pais, total: totalReal ?? registros.length, cargados: registros.length });
    }
    case "concursos_publicos": {
      const { data } = await db.from("concursos")
        .select("id,cargo,titulo,organismo,pais,lugar,fecha_cierre,tipo_tarea,tipo_vinculo,created_at")
        .eq("activo", true).neq("tipo_vinculo", "privado")
        .order("created_at", { ascending: false }).limit(40);
      return ok(data ?? []);
    }
    case "concursos_privados": {
      const { data } = await db.from("concursos")
        .select("id,cargo,titulo,organismo,pais,lugar,fecha_cierre,tipo_tarea,tipo_vinculo,created_at")
        .eq("activo", true).eq("tipo_vinculo", "privado")
        .order("created_at", { ascending: false }).limit(40);
      return ok(data ?? []);
    }
    case "ofertas_empleadores": {
      return await getOfertasEmpleadores(db, params);
    }
    case "mensajes_resumen": {
      const paisFlt   = ((params?.pais   as string) ?? "").trim().toLowerCase();
      const sectorFlt = ((params?.sector as string) ?? "").trim().toLowerCase();
      const semana    = new Date(now.getTime() - 7 * 86400000).toISOString();

      const [{ data: msgs }, { data: prfs }] = await Promise.all([
        db.from("mensajes").select("sender_id,receiver_id,created_at").order("created_at", { ascending: false }).limit(10000),
        db.from("profiles").select("id,pais,ciudad,servicios,profesiones"),
      ]);
      const perfilMap: Record<string,any> = Object.fromEntries((prfs as any[] ?? []).map((p: any) => [p.id, p]));

      const pares = new Set<string>();
      let totalMsgs = 0, recientes = 0;
      const byCiudad: Record<string,number> = {};
      const bySector: Record<string,number> = {};

      for (const m of msgs as any[] ?? []) {
        const p1 = perfilMap[m.sender_id];
        const p2 = perfilMap[m.receiver_id];
        if (paisFlt) {
          const okPais = p1?.pais?.toLowerCase().includes(paisFlt) || p2?.pais?.toLowerCase().includes(paisFlt);
          if (!okPais) continue;
        }
        const sects: string[] = [...(p1?.servicios ?? []), ...(p1?.profesiones ?? []), ...(p2?.servicios ?? []), ...(p2?.profesiones ?? [])];
        if (sectorFlt && !sects.some((s: string) => s.toLowerCase().includes(sectorFlt))) continue;

        totalMsgs++;
        pares.add([m.sender_id, m.receiver_id].sort().join("|"));
        if (m.created_at >= semana) recientes++;
        for (const c of [p1?.ciudad, p2?.ciudad].filter(Boolean) as string[]) byCiudad[c] = (byCiudad[c] ?? 0) + 1;
        for (const s of sects) bySector[s] = (bySector[s] ?? 0) + 1;
      }

      return ok({
        total: totalMsgs,
        conversaciones: pares.size,
        recientes,
        topCiudades: Object.entries(byCiudad).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([ciudad,count])=>({ciudad,count})),
        topSectores: Object.entries(bySector).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([sector,count])=>({sector,count})),
      });
    }
    default:
      return err("consulta desconocida");
  }
}

// ── Waitlist admin ────────────────────────────────────────────────────────────
async function getWaitlistStats(db: ReturnType<typeof createClient>) {
  const [
    { count: total },
    { count: habilitados },
    { count: pendientes },
    { count: registrados },
    { data: cfg },
    { data: proximos },
    { data: lotes },
  ] = await Promise.all([
    db.from("waitlist").select("*", { count: "exact", head: true }),
    db.from("waitlist").select("*", { count: "exact", head: true }).eq("habilitado", true),
    db.from("waitlist").select("*", { count: "exact", head: true }).eq("habilitado", true).eq("registrado", false),
    db.from("waitlist").select("*", { count: "exact", head: true }).eq("registrado", true),
    db.from("waitlist_config").select("*").eq("id", 1).single(),
    db.from("waitlist").select("posicion,email,nombre,created_at").eq("habilitado", false).order("posicion", { ascending: true }).limit(15),
    db.from("waitlist_lotes").select("*").order("created_at", { ascending: false }).limit(10),
  ]);
  return ok({ total, habilitados, pendientes, registrados, en_espera: (total ?? 0) - (habilitados ?? 0), config: cfg, proximos: proximos ?? [], lotes: lotes ?? [] });
}

async function updateWaitlistConfig(db: ReturnType<typeof createClient>, params: any) {
  const upsertData: any = { id: 1 };
  if (params.activo             !== undefined) upsertData.activo             = params.activo;
  if (params.batch_size         !== undefined) upsertData.batch_size         = Number(params.batch_size);
  if (params.intervalo_minutos  !== undefined) upsertData.intervalo_minutos  = Number(params.intervalo_minutos);
  if (params.umbral_activos_hora!== undefined) upsertData.umbral_activos_hora= Number(params.umbral_activos_hora);
  if (params.max_cola_pendiente !== undefined) upsertData.max_cola_pendiente = Number(params.max_cola_pendiente);
  const { error } = await db.from("waitlist_config").upsert(upsertData, { onConflict: "id" });
  if (error) return err(error.message);
  return ok({ ok: true });
}

async function habilitarManualWaitlist(db: ReturnType<typeof createClient>, params: any) {
  const cantidad = Math.min(Number(params?.cantidad ?? 100), 5000);
  const { data: proximos } = await db.from("waitlist")
    .select("id, push_token")
    .eq("habilitado", false)
    .order("posicion", { ascending: true })
    .limit(cantidad);
  if (!proximos?.length) return ok({ habilitados: 0 });
  const ids = (proximos as any[]).map((u: any) => u.id);
  await db.from("waitlist").update({ habilitado: true, habilitado_at: new Date().toISOString() }).in("id", ids);
  const tokens = (proximos as any[]).map((u: any) => u.push_token).filter(Boolean);
  if (tokens.length) {
    fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokens.map((to: string) => ({ to, title: "🎉 ¡Tu lugar en Nexu está listo!", body: "Ya podés registrarte. Abrí la app y completá tu perfil.", sound: "default", data: { pantalla: "Register" } }))),
    }).catch(() => {});
  }
  await db.from("waitlist_config").update({ ultimo_lote_at: new Date().toISOString() }).eq("id", 1);
  return ok({ habilitados: ids.length, notificados: tokens.length });
}

// ── Enviar mensajes masivos ───────────────────────────────────────────────────
async function enviarMensajes(db: ReturnType<typeof createClient>, params: any, adminId: string) {
  const ids   = (params?.receiver_ids as string[]) ?? [];
  const texto = ((params?.texto as string) ?? "").trim();
  const tipo  = (params?.tipo  as string) ?? "libre";
  if (!texto)      return err("Texto requerido");
  if (!ids.length) return err("Sin destinatarios");
  if (!adminId)    return err("Sin sender");

  const prefijos: Record<string,string> = { motivacional: "💪 ", propuesta: "💼 ", incentivo: "🎁 " };
  const textoFinal = (prefijos[tipo] ?? "") + texto;

  // Insertar de a 50; si un chunk falla por FK inválida, reintenta uno a uno
  let enviados = 0;
  const CHUNK = 50;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const rows = chunk.map((rid: string) => ({ sender_id: adminId, receiver_id: rid, texto: textoFinal, leido: false }));
    const { error } = await db.from("mensajes").insert(rows);
    if (error) {
      for (const rid of chunk) {
        const { error: e2 } = await db.from("mensajes").insert({ sender_id: adminId, receiver_id: rid, texto: textoFinal, leido: false });
        if (!e2) enviados++;
      }
    } else {
      enviados += chunk.length;
    }
  }
  return ok({ enviados, total: ids.length });
}

// ── Reportes pendientes ───────────────────────────────────────────────────────
async function getReportesPendientes(db: ReturnType<typeof createClient>) {
  const { data: reportes } = await db.from("reportes")
    .select("*").eq("estado", "pendiente").order("created_at", { ascending: false });
  if (!reportes?.length) return ok([]);

  const reportedIds = [...new Set((reportes as any[]).map((r: any) => r.reported_id))];
  const { data: authUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap: Record<string,string> = {};
  for (const u of authUsers?.users ?? []) emailMap[u.id] = u.email ?? "—";

  const { data: perfiles } = await db.from("profiles")
    .select("id,nombre,apellido1,servicios,profesiones,ciudad,pais,suspendido,perfil_activo,total_reportes")
    .in("id", reportedIds);
  const perfilMap: Record<string,any> = Object.fromEntries((perfiles as any[] ?? []).map((p: any) => [p.id, p]));

  const agrupado: Record<string, { perfil: any; email: string; reportes: any[] }> = {};
  for (const r of reportes as any[]) {
    if (!agrupado[r.reported_id]) {
      agrupado[r.reported_id] = {
        perfil: perfilMap[r.reported_id] ?? { id: r.reported_id },
        email: emailMap[r.reported_id] ?? "—",
        reportes: [],
      };
    }
    agrupado[r.reported_id].reportes.push(r);
  }
  const lista = Object.values(agrupado).sort((a, b) => b.reportes.length - a.reportes.length);
  return ok(lista);
}

// ── Acción sobre usuario (admin) ──────────────────────────────────────────────
async function accionUsuario(db: ReturnType<typeof createClient>, params: any) {
  const { id, accion: tipo, dias } = params ?? {};
  if (!id) return err("id requerido");

  switch (tipo) {
    case "dar_dias": {
      const d = Number(dias ?? 7);
      const { data: p } = await db.from("profiles").select("perfil_activo_hasta").eq("id", id).single();
      const base = p?.perfil_activo_hasta && new Date(p.perfil_activo_hasta) > new Date()
        ? new Date(p.perfil_activo_hasta)
        : new Date();
      base.setDate(base.getDate() + d);
      await db.from("profiles").update({ perfil_activo: true, perfil_activo_hasta: base.toISOString() }).eq("id", id);
      return ok({ ok: true, mensaje: `${d} días agregados` });
    }
    case "suspender": {
      await db.from("profiles").update({
        suspendido: true,
        suspendido_motivo: "Suspendido por administrador",
        suspendido_at: new Date().toISOString(),
        perfil_activo: false,
      }).eq("id", id);
      return ok({ ok: true, mensaje: "Usuario suspendido" });
    }
    case "restaurar": {
      await db.from("profiles").update({
        suspendido: false,
        suspendido_motivo: null,
        suspendido_at: null,
        total_reportes: 0,
      }).eq("id", id);
      // Marcar reportes de este usuario como "ignorados"
      await db.from("reportes").update({ estado: "restaurado" }).eq("reported_id", id);
      return ok({ ok: true, mensaje: "Usuario restaurado" });
    }
    case "activar": {
      const hasta = new Date(Date.now() + 10 * 86400000).toISOString();
      await db.from("profiles").update({ perfil_activo: true, perfil_activo_hasta: hasta }).eq("id", id);
      return ok({ ok: true, mensaje: "Perfil activado (10 días)" });
    }
    default: return err("acción desconocida");
  }
}

const NEXU_ID = "074e674b-c049-4d07-af89-70dc4ad48012"; // UUID real del admin — aparece como Nexu

// ── Enviar mensaje directo (admin → usuario, aparece como Nexu) ───────────────
async function enviarMensajeDirecto(db: ReturnType<typeof createClient>, params: any) {
  const { user_id, texto } = params ?? {};
  if (!user_id || !texto?.trim()) return err("user_id y texto requeridos");
  const { data, error } = await db.from("mensajes").insert({
    sender_id: NEXU_ID,
    receiver_id: user_id,
    texto: texto.trim(),
    leido: false,
  }).select("id").single();
  if (error) return err(error.message);
  return ok({ ok: true, mensaje: "Mensaje enviado", msg_id: data?.id });
}

// ── Listar mensajes de Nexu a un usuario ─────────────────────────────────────
async function listarMensajesNexu(db: ReturnType<typeof createClient>, params: any) {
  const { user_id } = params ?? {};
  if (!user_id) return err("user_id requerido");
  const { data } = await db.from("mensajes")
    .select("id, texto, created_at")
    .eq("sender_id", NEXU_ID)
    .eq("receiver_id", user_id)
    .order("created_at", { ascending: false });
  return ok({ mensajes: data ?? [] });
}

// ── Eliminar mensaje(s) de Nexu ───────────────────────────────────────────────
async function eliminarMensajeNexu(db: ReturnType<typeof createClient>, params: any) {
  const { user_id, msg_id } = params ?? {};
  if (!user_id) return err("user_id requerido");

  if (msg_id) {
    const { error } = await db.from("mensajes").delete().eq("id", msg_id);
    if (error) return err(error.message);
  } else {
    const { error } = await db.from("mensajes").delete()
      .eq("sender_id", NEXU_ID)
      .eq("receiver_id", user_id);
    if (error) return err(error.message);
  }
  return ok({ ok: true });
}

// ── Gestionar identidad ───────────────────────────────────────────────────────
async function gestionarIdentidad(db: ReturnType<typeof createClient>, params: any) {
  const { id, accion } = params ?? {};
  if (!id || !accion) return err("id y accion requeridos");
  if (accion === "aprobar") {
    await db.from("profiles").update({ identidad_estado: "aprobada" }).eq("id", id);
    return ok({ ok: true, mensaje: "Identidad aprobada" });
  }
  if (accion === "rechazar") {
    await db.from("profiles").update({ identidad_estado: "rechazada", identidad_url: null }).eq("id", id);
    return ok({ ok: true, mensaje: "Identidad rechazada" });
  }
  return err("accion debe ser 'aprobar' o 'rechazar'");
}

// ── Verificaciones pendientes ─────────────────────────────────────────────────
async function getVerificacionesPendientes(db: ReturnType<typeof createClient>) {
  const { data } = await db.from("profiles")
    .select("id, nombre, apellido1, pais, ciudad, identidad_url, created_at")
    .eq("identidad_estado", "pendiente")
    .order("created_at", { ascending: true });
  return ok({ pendientes: data ?? [] });
}

// ── Resolver reporte ──────────────────────────────────────────────────────────
async function resolverReporte(db: ReturnType<typeof createClient>, params: any) {
  const { reported_id, accion: tipo } = params ?? {};
  if (!reported_id) return err("reported_id requerido");

  if (tipo === "ignorar") {
    await db.from("reportes").update({ estado: "ignorado" }).eq("reported_id", reported_id).eq("estado", "pendiente");
    await db.from("profiles").update({ total_reportes: 0 }).eq("id", reported_id);
    return ok({ ok: true });
  }
  if (tipo === "confirmar") {
    await db.from("reportes").update({ estado: "confirmado" }).eq("reported_id", reported_id).eq("estado", "pendiente");
    await db.from("profiles").update({
      suspendido: true,
      suspendido_motivo: "Suspendido luego de revisión de denuncias",
      suspendido_at: new Date().toISOString(),
      perfil_activo: false,
    }).eq("id", reported_id);
    return ok({ ok: true });
  }
  return err("accion debe ser 'ignorar' o 'confirmar'");
}

// ── IDs de segmento (para campañas) ──────────────────────────────────────────
async function idsSegmento(db: ReturnType<typeof createClient>, params: any) {
  const segmento  = (params?.segmento as string) ?? "todos";
  const paisFlt   = ((params?.pais   as string) ?? "").trim().toLowerCase();
  const nowIso    = new Date().toISOString();

  // Todas las campañas apuntan solo a workers
  let q = db.from("profiles").select("id").eq("rol", "worker");

  if (segmento === "activos") {
    q = q.eq("perfil_activo", true).gt("perfil_activo_hasta", nowIso);
  }

  if (segmento === "inactivos") {
    // Inactivo = perfil_activo false  O  plan vencido (perfil_activo_hasta < hoy o nulo)
    q = q.or(`perfil_activo.eq.false,perfil_activo_hasta.lt.${nowIso},perfil_activo_hasta.is.null`);
  }

  if (segmento === "inactivos_30d") {
    const corte = new Date(Date.now() - 30 * 86400000).toISOString();
    // Sin actividad 30d Y que no tengan plan activo vigente
    q = q.lte("updated_at", corte).or(`perfil_activo.eq.false,perfil_activo_hasta.lt.${nowIso}`);
  }

  if (segmento === "pais" && paisFlt) {
    q = q.ilike("pais", `%${paisFlt}%`);
  }

  const { data } = await q.limit(5000);
  return ok({ ids: (data as any[] ?? []).map((p: any) => p.id), total: data?.length ?? 0 });
}

// ── Hilo de mensajes entre dos usuarios ───────────────────────────────────────
async function getMensajesHilo(db: ReturnType<typeof createClient>, params: any) {
  const user1 = params?.user1 as string;
  const user2 = params?.user2 as string;
  if (!user1 || !user2) return err("user1 y user2 requeridos");

  const { data: msgs } = await db.from("mensajes")
    .select("id,texto,created_at,sender_id,receiver_id")
    .or(`and(sender_id.eq.${user1},receiver_id.eq.${user2}),and(sender_id.eq.${user2},receiver_id.eq.${user1})`)
    .order("created_at", { ascending: true })
    .limit(200);

  // Traer nombres de ambos
  const { data: perfiles } = await db.from("profiles")
    .select("id,nombre,apellido1,avatar_url")
    .in("id", [user1, user2]);

  return ok({ mensajes: msgs ?? [], perfiles: perfiles ?? [] });
}

// ── Ofertas laborales de empleadores ─────────────────────────────────────────
async function getOfertasEmpleadores(db: ReturnType<typeof createClient>, params: any) {
  const paisFlt   = ((params?.pais    as string) ?? "").trim().toUpperCase().slice(0, 2);
  const ciudadFlt = ((params?.ciudad  as string) ?? "").trim().replace(/['"\\;]/g, "").slice(0, 60);
  const cargoFlt  = ((params?.cargo   as string) ?? "").trim().replace(/['"\\;]/g, "").slice(0, 100);
  const soloActivas = params?.activa !== false;

  let q = db.from("ofertas")
    .select(`id, titulo, cargo, descripcion, pais, ciudad, modalidad, tipo_contrato,
             salario_min, salario_max, moneda, activa, vistas, postulaciones,
             fecha_cierre, created_at, employer_id,
             profiles!ofertas_employer_id_fkey(nombre, apellido1, avatar_url)`)
    .order("created_at", { ascending: false })
    .limit(300);

  if (soloActivas) q = q.eq("activa", true);
  if (paisFlt)     q = q.eq("pais", paisFlt);
  if (ciudadFlt)   q = q.ilike("ciudad", `%${ciudadFlt}%`);
  if (cargoFlt)    q = q.or(`cargo.ilike.%${cargoFlt}%,titulo.ilike.%${cargoFlt}%`);

  const { data: ofertas, error } = await q;
  if (error) return err(error.message);

  const registros = (ofertas as any[]) ?? [];
  const por_pais:   Record<string, number> = {};
  const por_ciudad: Record<string, number> = {};
  for (const o of registros) {
    if (o.pais)   por_pais[o.pais]       = (por_pais[o.pais]     ?? 0) + 1;
    if (o.ciudad) por_ciudad[o.ciudad]   = (por_ciudad[o.ciudad] ?? 0) + 1;
  }
  return ok({ ofertas: registros, por_pais, por_ciudad, total: registros.length });
}

// ── Conversaciones de un usuario (resumen de hilos) ───────────────────────────
async function getConversaciones(db: ReturnType<typeof createClient>, params: any) {
  const id = params?.id as string;
  if (!id) return err("id requerido");

  const { data: todos, error: msgsErr } = await db.from("mensajes")
    .select("id,texto,created_at,sender_id,receiver_id")
    .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
    .order("created_at", { ascending: false })
    .limit(500);

  if (msgsErr) return err(msgsErr.message);
  if (!todos?.length) return ok({ conversaciones: [] });

  // Agrupar por interlocutor
  const mapa: Record<string, { partner_id: string; ultimo: string; fecha: string; total: number }> = {};
  for (const m of todos as any[]) {
    const partner = m.sender_id === id ? m.receiver_id : m.sender_id;
    if (!mapa[partner]) {
      mapa[partner] = { partner_id: partner, ultimo: m.texto, fecha: m.created_at, total: 0 };
    }
    mapa[partner].total++;
  }

  const partnerIds = Object.keys(mapa);
  const { data: perfiles } = await db.from("profiles")
    .select("id,nombre,apellido1,avatar_url")
    .in("id", partnerIds);

  const perfilMap: Record<string, any> = {};
  for (const p of perfiles as any[] ?? []) perfilMap[p.id] = p;

  const conversaciones = Object.values(mapa).map((c: any) => ({
    ...c,
    nombre: perfilMap[c.partner_id]?.nombre ?? "Usuario",
    apellido: perfilMap[c.partner_id]?.apellido1 ?? "",
    avatar: perfilMap[c.partner_id]?.avatar_url ?? null,
  })).sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return ok({ conversaciones });
}

// ── Analytics ─────────────────────────────────────────────────────────────────
async function getAnalytics(db: ReturnType<typeof createClient>) {
  const now    = new Date();
  const h30    = new Date(now.getTime() - 30 * 86400000).toISOString();
  const h7     = new Date(now.getTime() -  7 * 86400000).toISOString();
  const h30str = h30.slice(0, 10);

  const [
    { data: perfiles },
    { data: msgs30d },
    { count: totalPosts },
    { data: authRaw },
  ] = await Promise.all([
    db.from("profiles").select("id, pais, perfil_activo, avatar_url, created_at, perfil_activo_hasta, sexo, fecha_nac, servicios, profesiones, tecnicaturas"),
    db.from("mensajes").select("created_at").gte("created_at", h30),
    db.from("postulaciones").select("*", { count: "exact", head: true }),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const arr = (perfiles ?? []) as any[];

  // Embudo de adopción
  const totalRegistrados = arr.length;
  const conFoto          = arr.filter((p: any) => p.avatar_url).length;
  const activos          = arr.filter((p: any) => p.perfil_activo).length;
  const activaciones30d  = arr.filter((p: any) => p.perfil_activo && p.perfil_activo_hasta >= h30).length;

  // Registros por día (últimos 30)
  const registrosPorDia: Record<string, number> = {};
  for (const p of arr) {
    const dia = (p.created_at as string)?.slice(0, 10) ?? "";
    if (dia >= h30str) registrosPorDia[dia] = (registrosPorDia[dia] ?? 0) + 1;
  }

  // Nuevos por país (últimos 30 días)
  const nuevosPorPais: Record<string, number> = {};
  for (const p of arr) {
    if ((p.created_at as string) >= h30) {
      const pais = (p.pais as string) ?? "—";
      nuevosPorPais[pais] = (nuevosPorPais[pais] ?? 0) + 1;
    }
  }

  // Mensajes por hora UY (UTC-3) en últimos 30 días
  const msgsPorHora: number[] = new Array(24).fill(0);
  for (const m of (msgs30d ?? []) as any[]) {
    const horaUY = (new Date(m.created_at).getUTCHours() - 3 + 24) % 24;
    msgsPorHora[horaUY]++;
  }

  // Logins por hora UY desde last_sign_in_at de auth.users
  const loginsPorHora: number[] = new Array(24).fill(0);
  let logins30d = 0;
  for (const u of (authRaw as any)?.users ?? []) {
    if (!u.last_sign_in_at || u.last_sign_in_at < h30) continue;
    loginsPorHora[(new Date(u.last_sign_in_at).getUTCHours() - 3 + 24) % 24]++;
    logins30d++;
  }

  // ── Breakdowns demográficos ──────────────────────────────────────────────────

  // Por sexo
  const porSexo: Record<string, number> = {};
  for (const p of arr) {
    const s = (p.sexo as string) || "Sin datos";
    porSexo[s] = (porSexo[s] ?? 0) + 1;
  }

  // Por franja etaria (desde fecha_nac)
  const ahora = now.getFullYear();
  const franjas: Record<string, number> = { "18-25": 0, "26-35": 0, "36-45": 0, "46-55": 0, "55+": 0, "Sin datos": 0 };
  for (const p of arr) {
    if (!p.fecha_nac) { franjas["Sin datos"]++; continue; }
    const año = new Date(p.fecha_nac as string).getFullYear();
    const edad = ahora - año;
    if      (edad <= 25) franjas["18-25"]++;
    else if (edad <= 35) franjas["26-35"]++;
    else if (edad <= 45) franjas["36-45"]++;
    else if (edad <= 55) franjas["46-55"]++;
    else                 franjas["55+"]++;
  }

  // Tipo de perfil laboral
  const tipoPerfil = { profesional: 0, oficio: 0, ambos: 0, sinCategorizar: 0 };
  for (const p of arr) {
    const tieneProf   = (p.profesiones  as string[] | null)?.length ?? 0;
    const tieneOficio = (p.servicios    as string[] | null)?.length ?? 0;
    if      (tieneProf && tieneOficio) tipoPerfil.ambos++;
    else if (tieneProf)                tipoPerfil.profesional++;
    else if (tieneOficio)              tipoPerfil.oficio++;
    else                               tipoPerfil.sinCategorizar++;
  }

  // Nivel académico (proxy: tiene tecnicaturas o profesiones cargadas)
  const nivelAcademico = {
    conTecnicatura: arr.filter((p: any) => (p.tecnicaturas as string[] | null)?.length).length,
    conProfesion:   arr.filter((p: any) => (p.profesiones  as string[] | null)?.length).length,
    soloOficios:    arr.filter((p: any) => !(p.profesiones as string[] | null)?.length && (p.servicios as string[] | null)?.length).length,
  };

  // Todos los usuarios por país (no solo últimos 30d)
  const porPais: Record<string, number> = {};
  for (const p of arr) {
    const pais = (p.pais as string) ?? "—";
    porPais[pais] = (porPais[pais] ?? 0) + 1;
  }

  return ok({
    embudo:            { totalRegistrados, conFoto, activos, tasaActivacion: totalRegistrados > 0 ? Math.round(activos / totalRegistrados * 100) : 0 },
    nuevos30d:         arr.filter((p: any) => (p.created_at as string) >= h30).length,
    nuevos7d:          arr.filter((p: any) => (p.created_at as string) >= h7).length,
    activaciones30d,
    registrosPorDia:   Object.entries(registrosPorDia).sort((a, b) => a[0].localeCompare(b[0])),
    porSexo,
    franjas,
    tipoPerfil,
    nivelAcademico,
    porPais:           Object.entries(porPais).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 20),
    nuevosPorPais:     Object.entries(nuevosPorPais).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 15),
    mensajes:          { total30d: msgs30d?.length ?? 0, porHora: msgsPorHora },
    loginsPorHora,
    logins30d,
    totalPostulaciones: totalPosts ?? 0,
  });
}

// ── Handler ────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const { email, sub: adminId } = await verificarAdmin(authHeader);
    if (!email)                return err("No autorizado", 401);
    if (email !== ADMIN_EMAIL) return err("Acceso denegado", 403);

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { accion, params } = await req.json();
    console.log("admin-data:", accion, JSON.stringify(params ?? {}));

    switch (accion) {
      case "stats":           return await getStats(db);
      case "listar":          return await listarUsuarios(db, params ?? {});
      case "detalle":         return await getDetalle(db, params ?? {});
      case "pagos_resumen":   return await getPagos(db, params ?? {});
      case "consultas":       return await consultas(db, params ?? {});
      case "enviar_mensajes":      return await enviarMensajes(db, params ?? {}, adminId ?? "");
      case "waitlist_stats":       return await getWaitlistStats(db);
      case "waitlist_config":      return await updateWaitlistConfig(db, params ?? {});
      case "waitlist_habilitar":    return await habilitarManualWaitlist(db, params ?? {});
      case "reportes_pendientes":   return await getReportesPendientes(db);
      case "accion_usuario":        return await accionUsuario(db, params ?? {});
      case "resolver_reporte":      return await resolverReporte(db, params ?? {});
      case "ids_segmento":          return await idsSegmento(db, params ?? {});
      case "conversaciones":         return await getConversaciones(db, params ?? {});
      case "mensajes_hilo":          return await getMensajesHilo(db, params ?? {});
      case "ofertas_empleadores":    return await getOfertasEmpleadores(db, params ?? {});
      case "analytics":              return await getAnalytics(db);
      case "get_ciudades": {
        const q = ((params?.query as string) ?? "").trim();
        if (q.length < 2) return ok({ ciudades: [] });
        const { data: cd } = await db.from("profiles").select("ciudad").ilike("ciudad", `%${q}%`).not("ciudad", "is", null).limit(500);
        const set = new Set<string>();
        for (const p of (cd ?? []) as any[]) if (p.ciudad) set.add(p.ciudad);
        return ok({ ciudades: Array.from(set).sort().slice(0, 10) });
      }
      case "enviar_mensaje_directo":    return await enviarMensajeDirecto(db, params ?? {});
      case "listar_mensajes_nexu":      return await listarMensajesNexu(db, params ?? {});
      case "eliminar_mensaje_nexu":     return await eliminarMensajeNexu(db, params ?? {});
      case "gestionar_identidad":       return await gestionarIdentidad(db, params ?? {});
      case "verificaciones_pendientes": return await getVerificacionesPendientes(db);
      default:                      return err("acción desconocida");
    }
  } catch (e) {
    console.log("admin-data ERROR:", (e as Error).message);
    return err((e as Error).message, 500);
  }
});
