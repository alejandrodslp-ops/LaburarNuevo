const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const ADMIN_EMAIL         = 'alejandrodslp@gmail.com';
const KONEXU_ID             = '074e674b-c049-4d07-af89-70dc4ad48012';

function ok(data)             { return { _ok: true,  body: data }; }
function err(msg, status = 400) { return { _ok: false, status, body: { error: msg } }; }

function b64url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4);
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function jwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(new TextDecoder().decode(b64url(parts[1])));
  } catch { return null; }
}

async function verificarAdmin(authHeader) {
  try {
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token || token.split('.').length !== 3) return { email: null, sub: null };
    const [headerB64, payloadB64, sigB64] = token.split('.');
    try {
      const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(SUPABASE_JWT_SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
      );
      const valid = await crypto.subtle.verify(
        'HMAC', key, b64url(sigB64), new TextEncoder().encode(`${headerB64}.${payloadB64}`)
      );
      if (valid) {
        const payload = JSON.parse(new TextDecoder().decode(b64url(payloadB64)));
        return { email: payload.email ?? null, sub: payload.sub ?? null };
      }
    } catch { /* algoritmo distinto — continuar con fallback */ }
    const timeout = new Promise(resolve => setTimeout(() => resolve(null), 4000));
    const result  = await Promise.race([db.auth.getUser(token), timeout]);
    if (!result) return { email: null, sub: null };
    const { data: { user }, error } = result;
    if (error || !user) return { email: null, sub: null };
    return { email: user.email ?? null, sub: user.id };
  } catch { return { email: null, sub: null }; }
}

async function getStats(db) {
  const now      = new Date().toISOString();
  const in7days  = new Date(Date.now() + 7  * 86400000).toISOString();
  const weekAgo  = new Date(Date.now() - 7  * 86400000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const [
    totalRes, activosRes, enPruebaRes, inactivosRes, vencenRes,
    semanaRes, mesRes, sinFotoRes, conSaldoRes, totalMensajesRes, mensajesSemanaRes,
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('perfil_activo', true).not('perfil_activo_hasta', 'is', null).gt('perfil_activo_hasta', now),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('perfil_activo', false).not('periodo_gratis_hasta', 'is', null).gt('periodo_gratis_hasta', now),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('perfil_activo', false).or(`periodo_gratis_hasta.is.null,periodo_gratis_hasta.lte.${now}`),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('perfil_activo', true).not('perfil_activo_hasta', 'is', null).gt('perfil_activo_hasta', now).lt('perfil_activo_hasta', in7days),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo),
    db.from('profiles').select('*', { count: 'exact', head: true }).is('avatar_url', null),
    db.from('profiles').select('*', { count: 'exact', head: true }).gt('visualizaciones_disponibles', 0),
    db.from('mensajes').select('*', { count: 'exact', head: true }),
    db.from('mensajes').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
  ]);
  const totalUsuarios = totalRes.count    ?? 0;
  const activos       = activosRes.count  ?? 0;
  const enPrueba      = enPruebaRes.count ?? 0;
  const inactivos     = inactivosRes.count ?? 0;
  const vencenEn7Dias = vencenRes.count   ?? 0;
  const sinFoto       = sinFotoRes.count  ?? 0;
  const employersConSaldo = conSaldoRes.count ?? 0;

  const [{ data: distData }, { data: pgd }] = await Promise.all([
    db.from('profiles').select('pais, ciudad, created_at, avatar_url, servicios, profesiones'),
    db.from('pagos').select('monto, created_at, estado'),
  ]);
  const arr = distData ?? [];
  const porPais = {}, porCiudad = {}, porHora = {};
  let perfilesCompletos = 0;
  for (const p of arr) {
    if (p.pais)   porPais[p.pais]     = (porPais[p.pais]     ?? 0) + 1;
    if (p.ciudad) porCiudad[p.ciudad] = (porCiudad[p.ciudad] ?? 0) + 1;
    if (p.created_at) {
      const h = new Date(p.created_at).getUTCHours();
      porHora[h] = (porHora[h] ?? 0) + 1;
    }
    if (p.avatar_url && ((p.servicios?.length ?? 0) > 0 || (p.profesiones?.length ?? 0) > 0)) perfilesCompletos++;
  }
  const paises    = Object.entries(porPais).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([pais,count])=>({pais,count}));
  const ciudades  = Object.entries(porCiudad).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([ciudad,count])=>({ciudad,count}));
  const horasPico = Object.entries(porHora).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([h,count])=>({ hora:`${String(h).padStart(2,'0')}:00`, count:Number(count) }));

  const mesesKeys = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i, 1);
    mesesKeys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  const regPorMes = Object.fromEntries(mesesKeys.map(k => [k, 0]));
  for (const p of arr) { const k = (p.created_at ?? '').slice(0,7); if (regPorMes[k] !== undefined) regPorMes[k]++; }
  const registrosPorMes = mesesKeys.map(mes => ({ mes, count: regPorMes[mes] }));

  const aprobados     = (pgd ?? []).filter(p => p.estado === 'aprobado');
  const ingresoTotal  = aprobados.reduce((s,p) => s + (p.monto ?? 0), 0);
  const ingresoSemana = aprobados.filter(p => p.created_at >= weekAgo).reduce((s,p) => s + (p.monto ?? 0), 0);
  const ingresoMes    = aprobados.filter(p => p.created_at >= monthAgo).reduce((s,p) => s + (p.monto ?? 0), 0);
  const actPorMes     = Object.fromEntries(mesesKeys.map(k => [k, 0]));
  for (const p of aprobados) { const k = (p.created_at ?? '').slice(0,7); if (actPorMes[k] !== undefined) actPorMes[k]++; }
  const activacionesPorMes = mesesKeys.map(mes => ({ mes, count: actPorMes[mes] }));
  const tasaActivacion = totalUsuarios > 0 ? Math.round((activos / totalUsuarios) * 100) : 0;
  return ok({
    totalUsuarios, activos, enPrueba, inactivos, vencenEn7Dias,
    nuevosEstaSemana: semanaRes.count ?? 0, nuevosEsteMes: mesRes.count ?? 0,
    sinFoto, employersConSaldo, paises, ciudades,
    ingresoTotal, ingresoSemana, ingresoMes, cantidadPagos: aprobados.length,
    registrosPorMes, activacionesPorMes, horasPico,
    totalMensajes: totalMensajesRes.count ?? 0, mensajesSemana: mensajesSemanaRes.count ?? 0,
    tasaActivacion, perfilesCompletos,
  });
}

async function listarUsuarios(db, params) {
  const busqueda  = ((params?.busqueda ?? '')).trim();
  const filtro    = params?.filtro   ?? 'todos';
  const paisFlt   = ((params?.pais   ?? '')).trim();
  const ciudadFlt = ((params?.ciudad ?? '')).trim();
  const pagina    = Math.max(0, Number(params?.pagina ?? 0));
  const limite    = Math.min(100, Math.max(1, Number(params?.limite ?? 40)));
  const esEmailSearch = busqueda.includes('@');

  let q = db.from('profiles').select(
    'id, nombre, apellido1, servicios, profesiones, pais, ciudad, perfil_activo, perfil_activo_hasta, vistas, contactos, rating, avatar_url, visualizaciones_disponibles, created_at',
    { count: 'exact' }
  );
  if (filtro === 'activo')    q = q.eq('perfil_activo', true);
  if (filtro === 'inactivo')  q = q.eq('perfil_activo', false);
  if (filtro === 'con_saldo') q = q.gt('visualizaciones_disponibles', 0);
  if (paisFlt)   q = q.ilike('pais',   `%${paisFlt}%`);
  if (ciudadFlt) q = q.ilike('ciudad', `%${ciudadFlt}%`);
  if (busqueda && !esEmailSearch) q = q.or(`nombre.ilike.%${busqueda}%,apellido1.ilike.%${busqueda}%`);
  q = q.order('created_at', { ascending: false });
  if (!esEmailSearch) q = q.range(pagina * limite, (pagina + 1) * limite - 1);

  const [{ data: rawPerfiles, count: totalSQL }, { data: authData }] = await Promise.all([
    q,
    esEmailSearch
      ? db.auth.admin.listUsers({ page: 1, perPage: 1000 })
      : Promise.resolve({ data: { users: [] } }),
  ]);
  const emailMap = {};
  for (const u of authData?.users ?? []) emailMap[u.id] = u.email ?? '—';
  let usuarios = (rawPerfiles ?? []).map(p => ({ ...p, email: emailMap[p.id] ?? '—' }));
  if (esEmailSearch) {
    const term = busqueda.toLowerCase();
    usuarios = usuarios.filter(p => p.email?.toLowerCase().includes(term));
    return ok({ usuarios: usuarios.slice(pagina * limite, (pagina + 1) * limite), total: usuarios.length });
  }
  return ok({ usuarios, total: totalSQL ?? usuarios.length });
}

async function getDetalle(db, params) {
  const id = params?.id;
  if (!id) return err('id requerido');
  const [
    { data: perfil }, { data: authUser }, { data: pagos },
    { data: mensajesEnv }, { data: mensajesRec }, { data: propuestas },
    { data: matches }, { data: reportes },
  ] = await Promise.all([
    db.from('profiles').select('*').eq('id', id).single(),
    db.auth.admin.getUserById(id),
    db.from('pagos').select('*').or(`user_id.eq.${id},employer_id.eq.${id},worker_id.eq.${id}`).order('created_at', { ascending: false }),
    db.from('mensajes').select('id,texto,created_at,receiver_id').eq('sender_id', id).order('created_at', { ascending: false }).limit(20),
    db.from('mensajes').select('id,texto,created_at,sender_id').eq('receiver_id', id).order('created_at', { ascending: false }).limit(20),
    db.from('propuestas').select('id,estado,created_at,employer_id,worker_id,descripcion').or(`employer_id.eq.${id},worker_id.eq.${id}`).order('created_at', { ascending: false }).limit(20),
    db.from('concurso_matches').select('id,score,created_at,concurso_id,concursos(titulo,organizacion,pais)').eq('worker_id', id).order('score', { ascending: false }).limit(15),
    db.from('reportes').select('id,motivo,detalle,estado,created_at,reporter_id').or(`reporter_id.eq.${id},reported_id.eq.${id}`).order('created_at', { ascending: false }).limit(10),
  ]);
  return ok({
    perfil,
    email:           authUser?.user?.email ?? '—',
    last_sign_in_at: authUser?.user?.last_sign_in_at ?? null,
    pagos: pagos ?? [], mensajes_enviados: mensajesEnv ?? [],
    mensajes_recibidos: mensajesRec ?? [], propuestas: propuestas ?? [],
    matches: matches ?? [], reportes: reportes ?? [],
  });
}

async function getPagos(db, params) {
  const periodo = params?.periodo ?? 'todo';
  const now = new Date();
  const fechas = {
    hoy:    new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
    semana: new Date(now.getTime() - 7   * 86400000).toISOString(),
    mes:    new Date(now.getTime() - 30  * 86400000).toISOString(),
    anio:   new Date(now.getTime() - 365 * 86400000).toISOString(),
  };
  let q = db.from('pagos').select('id, user_id, monto, moneda, metodo, estado, created_at').eq('estado', 'aprobado').order('created_at', { ascending: false });
  if (fechas[periodo]) q = q.gte('created_at', fechas[periodo]);
  const { data: ps } = await q;
  const arr = ps ?? [];
  const total = arr.reduce((s,p) => s + (p.monto ?? 0), 0);
  const porMetodo = {};
  for (const p of arr) porMetodo[p.metodo ?? 'otro'] = (porMetodo[p.metodo ?? 'otro'] ?? 0) + (p.monto ?? 0);
  return ok({ pagos: arr.slice(0, 100), total, cantidad: arr.length, porMetodo });
}

async function getOfertasEmpleadores(db, params) {
  const paisFlt   = ((params?.pais    ?? '')).trim().toUpperCase().slice(0, 2);
  const ciudadFlt = ((params?.ciudad  ?? '')).trim().replace(/['"\\;]/g, '').slice(0, 60);
  const cargoFlt  = ((params?.cargo   ?? '')).trim().replace(/['"\\;]/g, '').slice(0, 100);
  const soloActivas = params?.activa !== false;
  let q = db.from('ofertas')
    .select(`id, titulo, cargo, descripcion, pais, ciudad, modalidad, tipo_contrato, salario_min, salario_max, moneda, activa, vistas, postulaciones, fecha_cierre, created_at, employer_id, profiles!ofertas_employer_id_fkey(nombre, apellido1, avatar_url)`)
    .order('created_at', { ascending: false }).limit(300);
  if (soloActivas) q = q.eq('activa', true);
  if (paisFlt)     q = q.eq('pais', paisFlt);
  if (ciudadFlt)   q = q.ilike('ciudad', `%${ciudadFlt}%`);
  if (cargoFlt)    q = q.or(`cargo.ilike.%${cargoFlt}%,titulo.ilike.%${cargoFlt}%`);
  const { data: ofertas, error } = await q;
  if (error) return err(error.message);
  const registros = ofertas ?? [];
  const por_pais = {}, por_ciudad = {};
  for (const o of registros) {
    if (o.pais)   por_pais[o.pais]     = (por_pais[o.pais]     ?? 0) + 1;
    if (o.ciudad) por_ciudad[o.ciudad] = (por_ciudad[o.ciudad] ?? 0) + 1;
  }
  return ok({ ofertas: registros, por_pais, por_ciudad, total: registros.length });
}

async function consultas(db, params) {
  const tipo = params?.tipo;
  const now  = new Date();
  switch (tipo) {
    case 'vencen_pronto': {
      const en7 = new Date(now.getTime() + 7 * 86400000).toISOString();
      const { data } = await db.from('profiles').select('id,nombre,apellido1,perfil_activo_hasta,vistas,contactos,pais,ciudad').eq('perfil_activo', true).lte('perfil_activo_hasta', en7).gte('perfil_activo_hasta', now.toISOString()).order('perfil_activo_hasta', { ascending: true });
      return ok(data ?? []);
    }
    case 'sin_foto': {
      const { data } = await db.from('profiles').select('id,nombre,apellido1,pais,ciudad,servicios,perfil_activo,created_at').is('avatar_url', null).order('created_at', { ascending: false });
      return ok(data ?? []);
    }
    case 'top_vistas': {
      const { data } = await db.from('profiles').select('id,nombre,apellido1,servicios,profesiones,ciudad,vistas,contactos,rating,perfil_activo').gt('vistas', 0).order('vistas', { ascending: false }).limit(30);
      return ok(data ?? []);
    }
    case 'recientes_24h': {
      const ayer = new Date(now.getTime() - 86400000).toISOString();
      const { data } = await db.from('profiles').select('id,nombre,apellido1,pais,ciudad,servicios,profesiones,created_at').gte('created_at', ayer).order('created_at', { ascending: false });
      return ok(data ?? []);
    }
    case 'employers_saldo': {
      const { data } = await db.from('profiles').select('id,nombre,apellido1,visualizaciones_disponibles,ciudad,pais').gt('visualizaciones_disponibles', 0).order('visualizaciones_disponibles', { ascending: false });
      return ok(data ?? []);
    }
    case 'sin_actividad': {
      const dias  = Math.max(1, Number(params?.dias ?? 30));
      const corte = new Date(now.getTime() - dias * 86400000).toISOString();
      const { data } = await db.from('profiles').select('id,nombre,apellido1,ciudad,pais,perfil_activo,updated_at,vistas').lte('updated_at', corte).eq('perfil_activo', false).order('updated_at', { ascending: true }).limit(50);
      return ok(data ?? []);
    }
    case 'top_oficios': {
      const { data } = await db.from('profiles').select('servicios,profesiones');
      const cnt = {};
      for (const p of data ?? []) {
        for (const s of p.servicios   ?? []) cnt[s] = (cnt[s] ?? 0) + 1;
        for (const s of p.profesiones ?? []) cnt[s] = (cnt[s] ?? 0) + 1;
      }
      return ok(Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,40).map(([oficio,count])=>({oficio,count})));
    }
    case 'top_empleadores': {
      const { data: pgs } = await db.from('pagos').select('employer_id,monto').eq('estado', 'aprobado');
      const gastos = {};
      for (const p of pgs ?? []) { if (!p.employer_id) continue; gastos[p.employer_id] = (gastos[p.employer_id] ?? 0) + (p.monto ?? 0); }
      const top = Object.entries(gastos).sort((a,b)=>b[1]-a[1]).slice(0,20);
      if (!top.length) return ok([]);
      const { data: prfs } = await db.from('profiles').select('id,nombre,apellido1,ciudad,pais').in('id', top.map(([id])=>id));
      const mapa = Object.fromEntries((prfs ?? []).map(p => [p.id, p]));
      return ok(top.map(([id, total]) => ({ ...(mapa[id] ?? { id }), total_gastado: total })));
    }
    case 'mas_contratados': {
      const { data } = await db.from('profiles').select('id,nombre,apellido1,servicios,profesiones,ciudad,pais,contactos,vistas,rating,perfil_activo').gt('contactos', 0).order('contactos', { ascending: false }).limit(30);
      return ok(data ?? []);
    }
    case 'demanda_concursos': {
      const { data } = await db.from('concursos').select('cargo, tipo_tarea, tipo_vinculo').eq('activo', true);
      const cnt = {};
      for (const c of data ?? []) { const k = (c.cargo || c.tipo_tarea || 'Otro').trim(); if (k) cnt[k] = (cnt[k] ?? 0) + 1; }
      return ok(Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,40).map(([oficio,count])=>({oficio,count})));
    }
    case 'todos_llamados': {
      const tipoVinculo = ((params?.tipo_vinculo ?? '')).trim();
      const paisFlt2    = ((params?.pais          ?? '')).trim().toUpperCase().slice(0, 2);
      const cargoFlt2   = ((params?.cargo         ?? '')).trim().replace(/['"\\;]/g, '').slice(0, 100);
      const LIMITE_LLAMADOS = 2000;

      let q = db.from('concursos')
        .select('id,cargo,titulo,organismo,pais,lugar,fecha_cierre,tipo_tarea,tipo_vinculo,activo,created_at,url_detalle,url_postulacion,numero_llamado,puestos,fecha_inicio')
        .eq('activo', true).order('created_at', { ascending: false }).limit(LIMITE_LLAMADOS);

      if (tipoVinculo === 'privado')       q = q.eq('tipo_vinculo', 'privado');
      else if (tipoVinculo === 'publico')  q = q.or('tipo_vinculo.neq.privado,tipo_vinculo.is.null');
      if (paisFlt2)  q = q.eq('pais', paisFlt2);
      if (cargoFlt2) q = q.or(`cargo.ilike.%${cargoFlt2}%,titulo.ilike.%${cargoFlt2}%`);

      let countQ = db.from('concursos').select('*', { count: 'estimated', head: true }).eq('activo', true);
      if (tipoVinculo === 'privado')      countQ = countQ.eq('tipo_vinculo', 'privado');
      else if (tipoVinculo === 'publico') countQ = countQ.or('tipo_vinculo.neq.privado,tipo_vinculo.is.null');
      if (paisFlt2)  countQ = countQ.eq('pais', paisFlt2);
      if (cargoFlt2) countQ = countQ.or(`cargo.ilike.%${cargoFlt2}%,titulo.ilike.%${cargoFlt2}%`);

      const sinFiltros = !tipoVinculo && !paisFlt2 && !cargoFlt2;
      const [{ data: todos }, totalRes, paisResult] = await Promise.all([
        q,
        sinFiltros ? db.rpc('count_concursos_activos').catch(() => ({ data: null })) : countQ,
        sinFiltros ? db.rpc('count_concursos_por_pais').catch(() => ({ data: null })) : Promise.resolve({ data: null }),
      ]);
      const registros  = todos ?? [];
      const totalReal  = sinFiltros
        ? (typeof totalRes?.data === 'number' ? totalRes.data : null)
        : (totalRes?.count ?? null);
      const por_pais   = {};
      if (sinFiltros && paisResult?.data) {
        for (const row of paisResult.data) if (row.pais) por_pais[row.pais] = Number(row.total);
      } else {
        for (const c of registros) if (c.pais) por_pais[c.pais] = (por_pais[c.pais] ?? 0) + 1;
      }
      return ok({ concursos: registros, por_pais, total: totalReal ?? registros.length, cargados: registros.length });
    }
    case 'concursos_publicos': {
      const { data } = await db.from('concursos').select('id,cargo,titulo,organismo,pais,lugar,fecha_cierre,tipo_tarea,tipo_vinculo,created_at').eq('activo', true).neq('tipo_vinculo', 'privado').order('created_at', { ascending: false }).limit(40);
      return ok(data ?? []);
    }
    case 'concursos_privados': {
      const { data } = await db.from('concursos').select('id,cargo,titulo,organismo,pais,lugar,fecha_cierre,tipo_tarea,tipo_vinculo,created_at').eq('activo', true).eq('tipo_vinculo', 'privado').order('created_at', { ascending: false }).limit(40);
      return ok(data ?? []);
    }
    case 'ofertas_empleadores': return await getOfertasEmpleadores(db, params);
    case 'mensajes_resumen': {
      const paisFlt   = ((params?.pais   ?? '')).trim().toLowerCase();
      const sectorFlt = ((params?.sector ?? '')).trim().toLowerCase();
      const semana    = new Date(now.getTime() - 7 * 86400000).toISOString();
      const [{ data: msgs }, { data: prfs }] = await Promise.all([
        db.from('mensajes').select('sender_id,receiver_id,created_at').order('created_at', { ascending: false }).limit(10000),
        db.from('profiles').select('id,pais,ciudad,servicios,profesiones'),
      ]);
      const perfilMap = Object.fromEntries((prfs ?? []).map(p => [p.id, p]));
      const pares = new Set();
      let totalMsgs = 0, recientes = 0;
      const byCiudad = {}, bySector = {};
      for (const m of msgs ?? []) {
        const p1 = perfilMap[m.sender_id], p2 = perfilMap[m.receiver_id];
        if (paisFlt && !(p1?.pais?.toLowerCase().includes(paisFlt) || p2?.pais?.toLowerCase().includes(paisFlt))) continue;
        const sects = [...(p1?.servicios??[]),...(p1?.profesiones??[]),...(p2?.servicios??[]),...(p2?.profesiones??[])];
        if (sectorFlt && !sects.some(s => s.toLowerCase().includes(sectorFlt))) continue;
        totalMsgs++;
        pares.add([m.sender_id, m.receiver_id].sort().join('|'));
        if (m.created_at >= semana) recientes++;
        for (const c of [p1?.ciudad, p2?.ciudad].filter(Boolean)) byCiudad[c] = (byCiudad[c] ?? 0) + 1;
        for (const s of sects) bySector[s] = (bySector[s] ?? 0) + 1;
      }
      return ok({
        total: totalMsgs, conversaciones: pares.size, recientes,
        topCiudades: Object.entries(byCiudad).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([ciudad,count])=>({ciudad,count})),
        topSectores: Object.entries(bySector).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([sector,count])=>({sector,count})),
      });
    }
    default: return err('consulta desconocida');
  }
}

async function getWaitlistStats(db) {
  const [
    { count: total }, { count: habilitados }, { count: pendientes }, { count: registrados },
    { data: cfg }, { data: proximos }, { data: lotes },
  ] = await Promise.all([
    db.from('waitlist').select('*', { count: 'exact', head: true }),
    db.from('waitlist').select('*', { count: 'exact', head: true }).eq('habilitado', true),
    db.from('waitlist').select('*', { count: 'exact', head: true }).eq('habilitado', true).eq('registrado', false),
    db.from('waitlist').select('*', { count: 'exact', head: true }).eq('registrado', true),
    db.from('waitlist_config').select('*').eq('id', 1).single(),
    db.from('waitlist').select('posicion,email,nombre,created_at').eq('habilitado', false).order('posicion', { ascending: true }).limit(15),
    db.from('waitlist_lotes').select('*').order('created_at', { ascending: false }).limit(10),
  ]);
  return ok({ total, habilitados, pendientes, registrados, en_espera: (total ?? 0) - (habilitados ?? 0), config: cfg, proximos: proximos ?? [], lotes: lotes ?? [] });
}

async function updateWaitlistConfig(db, params) {
  const upsertData = { id: 1 };
  if (params.activo              !== undefined) upsertData.activo              = params.activo;
  if (params.batch_size          !== undefined) upsertData.batch_size          = Number(params.batch_size);
  if (params.intervalo_minutos   !== undefined) upsertData.intervalo_minutos   = Number(params.intervalo_minutos);
  if (params.umbral_activos_hora !== undefined) upsertData.umbral_activos_hora = Number(params.umbral_activos_hora);
  if (params.max_cola_pendiente  !== undefined) upsertData.max_cola_pendiente  = Number(params.max_cola_pendiente);
  const { error } = await db.from('waitlist_config').upsert(upsertData, { onConflict: 'id' });
  if (error) return err(error.message);
  return ok({ ok: true });
}

async function getWaitlistLista(db, params) {
  const pagina = Math.max(0, Number(params?.pagina ?? 0));
  const filtro  = params?.filtro ?? 'todos';
  const tam     = 50;
  let countQ = db.from('waitlist').select('*', { count: 'exact', head: true });
  let dataQ  = db.from('waitlist').select('posicion,email,nombre,habilitado,registrado,created_at,pais');
  if (filtro === 'en_espera')   { countQ = countQ.eq('habilitado', false);                         dataQ = dataQ.eq('habilitado', false); }
  if (filtro === 'habilitados') { countQ = countQ.eq('habilitado', true).eq('registrado', false);  dataQ = dataQ.eq('habilitado', true).eq('registrado', false); }
  if (filtro === 'registrados') { countQ = countQ.eq('registrado', true);                          dataQ = dataQ.eq('registrado', true); }
  const [{ count }, { data, error }] = await Promise.all([
    countQ,
    dataQ.order('posicion', { ascending: true }).range(pagina * tam, pagina * tam + tam - 1),
  ]);
  if (error) return err(error.message);
  return ok({ usuarios: data ?? [], total: count ?? 0, pagina, tam });
}

async function getWaitlistPaises(db) {
  const { data, error } = await db.from('waitlist').select('pais');
  if (error) return err(error.message);
  const conteo = {};
  for (const r of data ?? []) { const p = r.pais?.trim() || 'Sin datos'; conteo[p] = (conteo[p] ?? 0) + 1; }
  const lista = Object.entries(conteo).map(([pais, total]) => ({ pais, total })).sort((a, b) => b.total - a.total);
  return ok({ paises: lista });
}

async function habilitarManualWaitlist(db, params) {
  const cantidad = Math.min(Number(params?.cantidad ?? 100), 5000);
  const { data: proximos } = await db.from('waitlist').select('id, push_token').eq('habilitado', false).order('posicion', { ascending: true }).limit(cantidad);
  if (!proximos?.length) return ok({ habilitados: 0 });
  const ids    = proximos.map(u => u.id);
  await db.from('waitlist').update({ habilitado: true, habilitado_at: new Date().toISOString() }).in('id', ids);
  const tokens = proximos.map(u => u.push_token).filter(Boolean);
  if (tokens.length) {
    fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens.map(to => ({ to, title: '🎉 ¡Tu lugar en Konexu está listo!', body: 'Ya podés registrarte. Abrí la app y completá tu perfil.', sound: 'default', data: { pantalla: 'Register' } }))),
    }).catch(() => {});
  }
  await db.from('waitlist_config').update({ ultimo_lote_at: new Date().toISOString() }).eq('id', 1);
  return ok({ habilitados: ids.length, notificados: tokens.length });
}

async function enviarMensajes(db, params, adminId) {
  const ids   = params?.receiver_ids ?? [];
  const texto = ((params?.texto ?? '')).trim();
  const tipo  = params?.tipo ?? 'libre';
  if (!texto)      return err('Texto requerido');
  if (!ids.length) return err('Sin destinatarios');
  if (!adminId)    return err('Sin sender');
  const prefijos = { motivacional: '💪 ', propuesta: '💼 ', incentivo: '🎁 ' };
  const textoFinal = (prefijos[tipo] ?? '') + texto;
  let enviados = 0;
  const CHUNK  = 50;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const rows  = chunk.map(rid => ({ sender_id: adminId, receiver_id: rid, texto: textoFinal, leido: false }));
    const { error } = await db.from('mensajes').insert(rows);
    if (error) {
      for (const rid of chunk) {
        const { error: e2 } = await db.from('mensajes').insert({ sender_id: adminId, receiver_id: rid, texto: textoFinal, leido: false });
        if (!e2) enviados++;
      }
    } else { enviados += chunk.length; }
  }
  return ok({ enviados, total: ids.length });
}

async function getReportesPendientes(db) {
  const { data: reportes } = await db.from('reportes').select('*').eq('estado', 'pendiente').order('created_at', { ascending: false });
  if (!reportes?.length) return ok([]);
  const reportedIds = [...new Set(reportes.map(r => r.reported_id))];
  const { data: authUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap = {};
  for (const u of authUsers?.users ?? []) emailMap[u.id] = u.email ?? '—';
  const { data: perfiles } = await db.from('profiles').select('id,nombre,apellido1,servicios,profesiones,ciudad,pais,suspendido,perfil_activo,total_reportes').in('id', reportedIds);
  const perfilMap = Object.fromEntries((perfiles ?? []).map(p => [p.id, p]));
  const agrupado = {};
  for (const r of reportes) {
    if (!agrupado[r.reported_id]) agrupado[r.reported_id] = { perfil: perfilMap[r.reported_id] ?? { id: r.reported_id }, email: emailMap[r.reported_id] ?? '—', reportes: [] };
    agrupado[r.reported_id].reportes.push(r);
  }
  return ok(Object.values(agrupado).sort((a, b) => b.reportes.length - a.reportes.length));
}

async function accionUsuario(db, params) {
  const { id, accion: tipo, dias } = params ?? {};
  if (!id) return err('id requerido');
  switch (tipo) {
    case 'dar_dias': {
      const d = Number(dias ?? 7);
      const { data: p } = await db.from('profiles').select('perfil_activo_hasta').eq('id', id).single();
      const base = p?.perfil_activo_hasta && new Date(p.perfil_activo_hasta) > new Date() ? new Date(p.perfil_activo_hasta) : new Date();
      base.setDate(base.getDate() + d);
      await db.from('profiles').update({ perfil_activo: true, perfil_activo_hasta: base.toISOString() }).eq('id', id);
      return ok({ ok: true, mensaje: `${d} días agregados` });
    }
    case 'suspender': {
      await db.from('profiles').update({ suspendido: true, suspendido_motivo: 'Suspendido por administrador', suspendido_at: new Date().toISOString(), perfil_activo: false }).eq('id', id);
      return ok({ ok: true, mensaje: 'Usuario suspendido' });
    }
    case 'restaurar': {
      await db.from('profiles').update({ suspendido: false, suspendido_motivo: null, suspendido_at: null, total_reportes: 0 }).eq('id', id);
      await db.from('reportes').update({ estado: 'restaurado' }).eq('reported_id', id);
      return ok({ ok: true, mensaje: 'Usuario restaurado' });
    }
    case 'activar': {
      const hasta = new Date(Date.now() + 10 * 86400000).toISOString();
      await db.from('profiles').update({ perfil_activo: true, perfil_activo_hasta: hasta }).eq('id', id);
      return ok({ ok: true, mensaje: 'Perfil activado (10 días)' });
    }
    default: return err('acción desconocida');
  }
}

async function enviarMensajeDirecto(db, params) {
  const { user_id, texto } = params ?? {};
  if (!user_id || !texto?.trim()) return err('user_id y texto requeridos');
  const { data, error } = await db.from('mensajes').insert({ sender_id: KONEXU_ID, receiver_id: user_id, texto: texto.trim(), leido: false }).select('id').single();
  if (error) return err(error.message);
  return ok({ ok: true, mensaje: 'Mensaje enviado', msg_id: data?.id });
}

async function listarMensajesKonexu(db, params) {
  const { user_id } = params ?? {};
  if (!user_id) return err('user_id requerido');
  const { data } = await db.from('mensajes').select('id, texto, created_at').eq('sender_id', KONEXU_ID).eq('receiver_id', user_id).order('created_at', { ascending: false });
  return ok({ mensajes: data ?? [] });
}

async function eliminarMensajeKonexu(db, params) {
  const { user_id, msg_id } = params ?? {};
  if (!user_id) return err('user_id requerido');
  if (msg_id) {
    const { error } = await db.from('mensajes').delete().eq('id', msg_id);
    if (error) return err(error.message);
  } else {
    const { error } = await db.from('mensajes').delete().eq('sender_id', KONEXU_ID).eq('receiver_id', user_id);
    if (error) return err(error.message);
  }
  return ok({ ok: true });
}

async function gestionarIdentidad(db, params) {
  const { id, accion } = params ?? {};
  if (!id || !accion) return err('id y accion requeridos');
  if (accion === 'aprobar') {
    await db.from('profiles').update({ identidad_estado: 'aprobada' }).eq('id', id);
    return ok({ ok: true, mensaje: 'Identidad aprobada' });
  }
  if (accion === 'rechazar') {
    await db.from('profiles').update({ identidad_estado: 'rechazada', identidad_url: null }).eq('id', id);
    return ok({ ok: true, mensaje: 'Identidad rechazada' });
  }
  return err("accion debe ser 'aprobar' o 'rechazar'");
}

async function getVerificacionesPendientes(db) {
  const { data } = await db.from('profiles').select('id, nombre, apellido1, pais, ciudad, identidad_url, created_at').eq('identidad_estado', 'pendiente').order('created_at', { ascending: true });
  return ok({ pendientes: data ?? [] });
}

async function resolverReporte(db, params) {
  const { reported_id, accion: tipo } = params ?? {};
  if (!reported_id) return err('reported_id requerido');
  if (tipo === 'ignorar') {
    await db.from('reportes').update({ estado: 'ignorado' }).eq('reported_id', reported_id).eq('estado', 'pendiente');
    await db.from('profiles').update({ total_reportes: 0 }).eq('id', reported_id);
    return ok({ ok: true });
  }
  if (tipo === 'confirmar') {
    await db.from('reportes').update({ estado: 'confirmado' }).eq('reported_id', reported_id).eq('estado', 'pendiente');
    await db.from('profiles').update({ suspendido: true, suspendido_motivo: 'Suspendido luego de revisión de denuncias', suspendido_at: new Date().toISOString(), perfil_activo: false }).eq('id', reported_id);
    return ok({ ok: true });
  }
  return err("accion debe ser 'ignorar' o 'confirmar'");
}

async function idsSegmento(db, params) {
  const segmento    = params?.segmento ?? 'todos';
  const paisFlt     = ((params?.pais  ?? '')).trim().toLowerCase();
  const sexoFlt     = params?.sexo ?? '';
  const nowIso      = new Date().toISOString();
  const gratisCorte = new Date(Date.now()).toISOString();
  let q = db.from('profiles').select('id').eq('rol', 'worker');
  if (segmento === 'activos')      q = q.eq('perfil_activo', true).gt('perfil_activo_hasta', nowIso);
  if (segmento === 'en_prueba')    q = q.eq('perfil_activo', false).gt('periodo_gratis_hasta', gratisCorte);
  if (segmento === 'pagos')        q = q.not('perfil_activo_hasta', 'is', null);
  if (segmento === 'inactivos')    q = q.or(`perfil_activo.eq.false,perfil_activo_hasta.lt.${nowIso},perfil_activo_hasta.is.null`);
  if (segmento === 'inactivos_30d') { const corte = new Date(Date.now() - 30 * 86400000).toISOString(); q = q.lte('updated_at', corte).or(`perfil_activo.eq.false,perfil_activo_hasta.lt.${nowIso}`); }
  if (segmento === 'pais' && paisFlt) q = q.ilike('pais', `%${paisFlt}%`);
  if (sexoFlt === 'Masculino') q = q.eq('sexo', 'Masculino');
  else if (sexoFlt === 'Femenino') q = q.eq('sexo', 'Femenino');
  const { data } = await q.limit(5000);
  return ok({ ids: (data ?? []).map(p => p.id), total: data?.length ?? 0 });
}

async function getMensajesHilo(db, params) {
  const user1 = params?.user1, user2 = params?.user2;
  if (!user1 || !user2) return err('user1 y user2 requeridos');
  const { data: msgs } = await db.from('mensajes').select('id,texto,created_at,sender_id,receiver_id').or(`and(sender_id.eq.${user1},receiver_id.eq.${user2}),and(sender_id.eq.${user2},receiver_id.eq.${user1})`).order('created_at', { ascending: true }).limit(200);
  const { data: perfiles } = await db.from('profiles').select('id,nombre,apellido1,avatar_url').in('id', [user1, user2]);
  return ok({ mensajes: msgs ?? [], perfiles: perfiles ?? [] });
}

async function getConversaciones(db, params) {
  const id = params?.id;
  if (!id) return err('id requerido');
  const { data: todos, error: msgsErr } = await db.from('mensajes').select('id,texto,created_at,sender_id,receiver_id').or(`sender_id.eq.${id},receiver_id.eq.${id}`).order('created_at', { ascending: false }).limit(500);
  if (msgsErr) return err(msgsErr.message);
  if (!todos?.length) return ok({ conversaciones: [] });
  const mapa = {};
  for (const m of todos) {
    const partner = m.sender_id === id ? m.receiver_id : m.sender_id;
    if (!mapa[partner]) mapa[partner] = { partner_id: partner, ultimo: m.texto, fecha: m.created_at, total: 0 };
    mapa[partner].total++;
  }
  const partnerIds = Object.keys(mapa);
  const { data: perfiles } = await db.from('profiles').select('id,nombre,apellido1,avatar_url').in('id', partnerIds);
  const perfilMap = {};
  for (const p of perfiles ?? []) perfilMap[p.id] = p;
  const conversaciones = Object.values(mapa).map(c => ({
    ...c,
    nombre:   perfilMap[c.partner_id]?.nombre   ?? 'Usuario',
    apellido: perfilMap[c.partner_id]?.apellido1 ?? '',
    avatar:   perfilMap[c.partner_id]?.avatar_url ?? null,
  })).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  return ok({ conversaciones });
}

async function getAnalytics(db) {
  const now    = new Date();
  const h30    = new Date(now.getTime() - 30 * 86400000).toISOString();
  const h7     = new Date(now.getTime() -  7 * 86400000).toISOString();
  const h30str = h30.slice(0, 10);
  const [
    { data: perfiles }, { data: msgs30d },
    { count: totalPosts }, { data: authRaw },
  ] = await Promise.all([
    db.from('profiles').select('id, pais, perfil_activo, avatar_url, created_at, perfil_activo_hasta, sexo, fecha_nac, servicios, profesiones, tecnicaturas'),
    db.from('mensajes').select('created_at').gte('created_at', h30),
    db.from('postulaciones').select('*', { count: 'exact', head: true }),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const arr              = perfiles ?? [];
  const totalRegistrados = arr.length;
  const conFoto          = arr.filter(p => p.avatar_url).length;
  const activos          = arr.filter(p => p.perfil_activo).length;
  const activaciones30d  = arr.filter(p => p.perfil_activo && p.perfil_activo_hasta >= h30).length;
  const registrosPorDia  = {};
  for (const p of arr) { const dia = (p.created_at ?? '').slice(0,10); if (dia >= h30str) registrosPorDia[dia] = (registrosPorDia[dia] ?? 0) + 1; }
  const nuevosPorPais = {};
  for (const p of arr) { if ((p.created_at ?? '') >= h30) { const pais = p.pais ?? '—'; nuevosPorPais[pais] = (nuevosPorPais[pais] ?? 0) + 1; } }
  const msgsPorHora = new Array(24).fill(0);
  for (const m of msgs30d ?? []) msgsPorHora[(new Date(m.created_at).getUTCHours() - 3 + 24) % 24]++;
  const loginsPorHora = new Array(24).fill(0);
  let logins30d = 0;
  for (const u of authRaw?.users ?? []) {
    if (!u.last_sign_in_at || u.last_sign_in_at < h30) continue;
    loginsPorHora[(new Date(u.last_sign_in_at).getUTCHours() - 3 + 24) % 24]++;
    logins30d++;
  }
  const porSexo = {};
  for (const p of arr) { const s = p.sexo || 'Sin datos'; porSexo[s] = (porSexo[s] ?? 0) + 1; }
  const ahora  = now.getFullYear();
  const franjas = { '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '55+': 0, 'Sin datos': 0 };
  for (const p of arr) {
    if (!p.fecha_nac) { franjas['Sin datos']++; continue; }
    const edad = ahora - new Date(p.fecha_nac).getFullYear();
    if      (edad <= 25) franjas['18-25']++;
    else if (edad <= 35) franjas['26-35']++;
    else if (edad <= 45) franjas['36-45']++;
    else if (edad <= 55) franjas['46-55']++;
    else                 franjas['55+']++;
  }
  const tipoPerfil = { profesional: 0, oficio: 0, ambos: 0, sinCategorizar: 0 };
  for (const p of arr) {
    const tp = p.profesiones?.length ?? 0, to = p.servicios?.length ?? 0;
    if (tp && to) tipoPerfil.ambos++;
    else if (tp)  tipoPerfil.profesional++;
    else if (to)  tipoPerfil.oficio++;
    else          tipoPerfil.sinCategorizar++;
  }
  const nivelAcademico = {
    conTecnicatura: arr.filter(p => p.tecnicaturas?.length).length,
    conProfesion:   arr.filter(p => p.profesiones?.length).length,
    soloOficios:    arr.filter(p => !p.profesiones?.length && p.servicios?.length).length,
  };
  const porPais = {};
  for (const p of arr) { const pais = p.pais ?? '—'; porPais[pais] = (porPais[pais] ?? 0) + 1; }
  return ok({
    embudo: { totalRegistrados, conFoto, activos, tasaActivacion: totalRegistrados > 0 ? Math.round(activos / totalRegistrados * 100) : 0 },
    nuevos30d: arr.filter(p => (p.created_at ?? '') >= h30).length,
    nuevos7d:  arr.filter(p => (p.created_at ?? '') >= h7).length,
    activaciones30d,
    registrosPorDia: Object.entries(registrosPorDia).sort((a,b)=>a[0].localeCompare(b[0])),
    porSexo, franjas, tipoPerfil, nivelAcademico,
    porPais:       Object.entries(porPais).sort((a,b)=>b[1]-a[1]).slice(0,20),
    nuevosPorPais: Object.entries(nuevosPorPais).sort((a,b)=>b[1]-a[1]).slice(0,15),
    mensajes: { total30d: msgs30d?.length ?? 0, porHora: msgsPorHora },
    loginsPorHora, logins30d,
    totalPostulaciones: totalPosts ?? 0,
  });
}

router.post('/', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] ?? '';
    const { email, sub: adminId } = await verificarAdmin(authHeader);
    if (!email)                return res.status(401).json({ error: 'No autorizado' });
    if (email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' });

    const { accion, params } = req.body ?? {};
    console.log('admin-data:', accion, JSON.stringify(params ?? {}));

    let result;
    switch (accion) {
      case 'stats':                      result = await getStats(db); break;
      case 'listar':                     result = await listarUsuarios(db, params ?? {}); break;
      case 'detalle':                    result = await getDetalle(db, params ?? {}); break;
      case 'pagos_resumen':              result = await getPagos(db, params ?? {}); break;
      case 'consultas':                  result = await consultas(db, params ?? {}); break;
      case 'enviar_mensajes':            result = await enviarMensajes(db, params ?? {}, adminId ?? ''); break;
      case 'waitlist_stats':             result = await getWaitlistStats(db); break;
      case 'waitlist_lista':             result = await getWaitlistLista(db, params ?? {}); break;
      case 'waitlist_paises':            result = await getWaitlistPaises(db); break;
      case 'waitlist_config':            result = await updateWaitlistConfig(db, params ?? {}); break;
      case 'waitlist_habilitar':         result = await habilitarManualWaitlist(db, params ?? {}); break;
      case 'reportes_pendientes':        result = await getReportesPendientes(db); break;
      case 'accion_usuario':             result = await accionUsuario(db, params ?? {}); break;
      case 'resolver_reporte':           result = await resolverReporte(db, params ?? {}); break;
      case 'ids_segmento':               result = await idsSegmento(db, params ?? {}); break;
      case 'conversaciones':             result = await getConversaciones(db, params ?? {}); break;
      case 'mensajes_hilo':              result = await getMensajesHilo(db, params ?? {}); break;
      case 'ofertas_empleadores':        result = await getOfertasEmpleadores(db, params ?? {}); break;
      case 'analytics':                  result = await getAnalytics(db); break;
      case 'enviar_mensaje_directo':     result = await enviarMensajeDirecto(db, params ?? {}); break;
      case 'listar_mensajes_konexu':       result = await listarMensajesKonexu(db, params ?? {}); break;
      case 'eliminar_mensaje_konexu':      result = await eliminarMensajeKonexu(db, params ?? {}); break;
      case 'gestionar_identidad':        result = await gestionarIdentidad(db, params ?? {}); break;
      case 'verificaciones_pendientes':  result = await getVerificacionesPendientes(db); break;
      case 'scraper_stats': {
        const PAISES = ['UY','AR','BR','CL','CO','PE','PY','BO','EC','MX','VE','CU','CR','GT','SV','HN','NI','PA','DO','ES','PT','IT','FR','DE','GB','US','CA','AU','SE','NO','JP','IN'];
        const entries = await Promise.all(PAISES.map(async p => {
          const { count } = await db.from('concursos').select('*', { count: 'estimated', head: true }).eq('pais', p).eq('activo', true);
          return [p, count ?? 0];
        }));
        result = ok({ conteos: Object.fromEntries(entries) });
        break;
      }
      case 'get_ciudades': {
        const q = ((params?.query ?? '')).trim();
        if (q.length < 2) { result = ok({ ciudades: [] }); break; }
        const { data: cd } = await db.from('profiles').select('ciudad').ilike('ciudad', `%${q}%`).not('ciudad', 'is', null).limit(500);
        const set = new Set();
        for (const p of cd ?? []) if (p.ciudad) set.add(p.ciudad);
        result = ok({ ciudades: Array.from(set).sort().slice(0, 10) });
        break;
      }
      default: return res.status(400).json({ error: 'acción desconocida' });
    }

    return result._ok ? res.json(result.body) : res.status(result.status || 400).json(result.body);
  } catch (e) {
    const msg = e?.message ?? String(e);
    console.log('admin-data ERROR:', msg);
    return res.json({ error: msg });
  }
});

module.exports = router;
