// src/screens/ConcursaScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { supabase } from '../services/supabase';
import { useApp as useAppContext } from '../services/AppContext';

// ─────────────────────────────────────────────────────────────
// BANDERA EMOJI POR PAÍS
// ─────────────────────────────────────────────────────────────
const BANDERAS = {
  UY: '🇺🇾', AR: '🇦🇷', CL: '🇨🇱', CO: '🇨🇴',
  PE: '🇵🇪', BR: '🇧🇷', PY: '🇵🇾', BO: '🇧🇴',
  EC: '🇪🇨', VE: '🇻🇪',
};

// ─────────────────────────────────────────────────────────────
// CARD DE LLAMADO
// ─────────────────────────────────────────────────────────────
function LlamadoCard({ match, onPress }) {
  const { concursos: c, score, cumple, keywords_match } = match;

  const diasRestantes = () => {
    if (!c.fecha_cierre) return null;
    const diff = new Date(c.fecha_cierre) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };
  const dias = diasRestantes();

  const tagConfig = () => {
    if (score >= 70) return { text: '✓ Cumplís todos los requisitos', bg: COLORS.mentaSoft, color: COLORS.mentaDark };
    if (score >= 40) return { text: `⚡ ${Math.round(score)}% compatible — postulate`, bg: '#FFF7ED', color: '#C2410C' };
    if (score >= 15) return { text: `⚠ Compatible parcial (${Math.round(score)}%)`, bg: COLORS.goldSoft, color: '#D97706' };
    return { text: 'Nuevo llamado', bg: COLORS.indigoSoft, color: COLORS.indigo };
  };
  const tag = tagConfig();

  const stripeColor = score >= 70 ? COLORS.menta : score >= 40 ? COLORS.coral : score >= 15 ? COLORS.gold : COLORS.indigo;
  const bandera = BANDERAS[c.pais] || '🌍';
  const esPrivado = c.tipo_vinculo === 'privado';

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(match)} activeOpacity={0.8}>
      <View style={[styles.cardStripe, { backgroundColor: stripeColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardOrg} numberOfLines={1}>
            {bandera} {c.organismo || (esPrivado ? 'Empresa privada' : 'Organismo público')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {esPrivado
              ? <View style={{ backgroundColor: '#FFF3E0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, color: '#E65100', fontWeight: '700' }}>PRIVADO</Text>
                </View>
              : <View style={{ backgroundColor: '#E3F2FD', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, color: '#1565C0', fontWeight: '700' }}>PÚBLICO</Text>
                </View>
            }
            {c.numero_llamado && <Text style={styles.cardNum}>#{c.numero_llamado}</Text>}
          </View>
        </View>
        <Text style={styles.cardCargo} numberOfLines={2}>{c.cargo || c.titulo}</Text>

        <View style={[styles.tag, { backgroundColor: tag.bg }]}>
          <Text style={[styles.tagText, { color: tag.color }]}>{tag.text}</Text>
        </View>

        {keywords_match?.length > 0 && (
          <View style={styles.kwRow}>
            {keywords_match.slice(0, 4).map((kw, i) => (
              <View key={i} style={styles.kwChip}>
                <Text style={styles.kwText}>{kw}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.cardFoot}>
          <View>
            {dias !== null && (
              <Text style={[styles.diasText, dias <= 5 && { color: COLORS.coral, fontWeight: '700' }]}>
                {dias > 0 ? `Cierra en ${dias} días` : 'Último día'}
              </Text>
            )}
            {c.lugar && <Text style={styles.lugarText}>📍 {c.lugar}</Text>}
          </View>
          <TouchableOpacity
            style={[styles.btn, cumple ? styles.btnPrimary : styles.btnOutline]}
            onPress={() => onPress(match)}
          >
            <Text style={[styles.btnText, !cumple && { color: COLORS.indigo }]}>
              {cumple ? 'Postularme →' : 'Ver detalles'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
// PANTALLA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function ConcursaScreen({ navigation, route }) {
  const { user } = useAppContext();
  const [matches, setMatches] = useState([]);
  const [todos, setTodos] = useState([]);
  const [stats, setStats] = useState({ total: 0, paraVos: 0, cierranPronto: 0 });
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroActivo, setFiltroActivo] = useState('para_vos');
  const [sector, setSector] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [modalidad, setModalidad] = useState('todos');
  const [sinPerfil, setSinPerfil] = useState(false);
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [modoBusqueda, setModoBusqueda] = useState(false);
  const [buscandoEnBD, setBuscandoEnBD] = useState(false);

  // Consulta real a la BD por texto
  async function buscarEnBD(termino) {
    const t = (termino || '').trim();
    if (!t) { setModoBusqueda(false); setResultadosBusqueda([]); return; }
    setModoBusqueda(true);
    setBuscandoEnBD(true);
    try {
      const { data } = await supabase
        .from('concursos')
        .select('id, pais, numero_llamado, titulo, cargo, organismo, tipo_tarea, tipo_vinculo, lugar, fecha_inicio, fecha_cierre, puestos, url_detalle, url_postulacion')
        .eq('activo', true)
        .or(`cargo.ilike.%${t}%,titulo.ilike.%${t}%,organismo.ilike.%${t}%`)
        .order('created_at', { ascending: false })
        .limit(60);
      const hoy = new Date();
      setResultadosBusqueda((data || []).filter(c => !c.fecha_cierre || new Date(c.fecha_cierre) >= hoy));
    } catch (_) {}
    setBuscandoEnBD(false);
  }

  function limpiarBusqueda() {
    setBusqueda('');
    setModoBusqueda(false);
    setResultadosBusqueda([]);
  }

  // Aplicar filtros/búsqueda que vienen desde HomeScreen
  useEffect(() => {
    const p = route.params || {};
    if (p.presetFiltro) setFiltroActivo(p.presetFiltro);
    if (p.presetSector) setSector(p.presetSector);
    if (p.presetModalidad) setModalidad(p.presetModalidad);
    if (p.busqueda) {
      setBusqueda(p.busqueda);
      buscarEnBD(p.busqueda);
    }
  }, [route.params?.presetFiltro, route.params?.presetSector, route.params?.busqueda, route.params?.presetModalidad]);

  const cargar = useCallback(async (esRefresh = false) => {
    if (esRefresh) setRefreshing(true);
    else setCargando(true);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setCargando(false); return; }
      console.log('[Concursa] cargar() inicio — user:', authUser.id);

      // Verificar que el usuario tiene perfil de worker
      const { data: perfil, error: perfilError } = await supabase
        .from('profiles')
        .select('rol, servicios, profesiones, especialidades, pais')
        .eq('id', authUser.id)
        .single();

      console.log('[Concursa] perfil:', perfil?.rol, perfil?.pais, '| error:', perfilError?.message);

      if (perfil?.rol !== 'worker') {
        setSinPerfil(true);
        return;
      }

      const tieneKeywords = [
        ...(perfil?.servicios || []),
        ...(perfil?.profesiones || []),
        ...(perfil?.especialidades || []),
      ].length > 0;

      if (!tieneKeywords) {
        setSinPerfil(false);
        // Igual traemos concursos aunque no haya keywords, mostramos todos
      }

      console.log('[Concursa] user.id:', authUser.id, '| pais:', perfil?.pais, '| rol:', perfil?.rol);

      // Disparar matching actualizado en el servidor
      supabase.functions.invoke('match-concursos', {
        body: { worker_id: authUser.id },
      }).catch(() => {});

      // Traer matches con datos del concurso
      const { data: matchData, error } = await supabase
        .from('concurso_matches')
        .select(`
          score, cumple, keywords_match,
          concursos (
            id, pais, numero_llamado, titulo, cargo, organismo,
            tipo_tarea, tipo_vinculo, lugar, fecha_inicio, fecha_cierre,
            puestos, url_detalle, url_postulacion, descripcion, requisitos
          )
        `)
        .eq('worker_id', authUser.id)
        .order('score', { ascending: false })
        .limit(80);

      if (error) throw error;

      const hoy = new Date();
      const PAIS_ISO = {
        'uruguay':'UY','argentina':'AR','chile':'CL','colombia':'CO',
        'peru':'PE','perú':'PE','brasil':'BR','brazil':'BR','paraguay':'PY',
        'bolivia':'BO','ecuador':'EC','venezuela':'VE',
      };
      const paisRaw = (perfil?.pais || '').toLowerCase().trim();
      const paisISO = PAIS_ISO[paisRaw] || paisRaw.slice(0,2).toUpperCase();

      // Filtrar matches por país (comparar ISO con ISO)
      const validos = (matchData || []).filter(m => {
        if (!m.concursos) return false;
        if (paisISO && m.concursos.pais && m.concursos.pais !== paisISO) return false;
        if (m.concursos.fecha_cierre) {
          if (new Date(m.concursos.fecha_cierre) < hoy) return false;
        }
        return true;
      });

      setMatches(validos);

      // Cargar TODOS los concursos del país directamente (no depende de matching)
      const { data: todosData } = await supabase
        .from('concursos')
        .select('id, pais, numero_llamado, titulo, cargo, organismo, tipo_tarea, tipo_vinculo, lugar, fecha_inicio, fecha_cierre, puestos, url_detalle, url_postulacion')
        .eq('pais', paisISO)
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(100);

      const todosValidos = (todosData || []).filter(c => {
        if (c.fecha_cierre && new Date(c.fecha_cierre) < hoy) return false;
        return true;
      });
      console.log('[Concursa] paisISO:', paisISO, '| todos raw:', todosData?.length, '| todos validos:', todosValidos.length, '| matches:', validos.length);
      setTodos(todosValidos);

      // Stats
      const paraVos = validos.filter(m => m.cumple).length;
      const cierranPronto = validos.filter(m => {
        if (!m.concursos?.fecha_cierre) return false;
        const dias = (new Date(m.concursos.fecha_cierre) - hoy) / (1000 * 60 * 60 * 24);
        return dias >= 0 && dias <= 7;
      }).length;

      setStats({ total: todosValidos.length, paraVos, cierranPronto });

    } catch (e) {
      console.error('[Concursa] ERROR:', e.message, e.stack);
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => cargar());
    return unsub;
  }, [navigation]);

  const handleAlertas = () => {
    Alert.alert(
      '🔔 Alertas activadas',
      'Te notificaremos cuando aparezcan nuevos llamados compatibles con tu perfil.',
      [{ text: 'OK' }]
    );
  };

  const matchesPorId = Object.fromEntries(matches.map(m => [m.concursos?.id, m]));

  const filtrarSector = (arr, getConcurso) => {
    if (sector === 'todos') return arr;
    return arr.filter(item => {
      const c = getConcurso(item);
      return sector === 'privado' ? c?.tipo_vinculo === 'privado' : c?.tipo_vinculo !== 'privado';
    });
  };

  const REMOTO_KW = ['remoto', 'teletrabajo', 'home office', 'remote', 'virtual', 'a distancia'];

  let mostrados;
  if (modoBusqueda) {
    // Modo búsqueda: usa resultados de la BD, ignora Para vos / Todos
    mostrados = resultadosBusqueda
      .map(c => matchesPorId[c.id] || { concursos: c, score: 0, cumple: false, keywords_match: [] });
    mostrados = filtrarSector(mostrados, item => item.concursos);
    if (modalidad !== 'todos') {
      mostrados = mostrados.filter(item => {
        const c = item.concursos;
        const txt = `${c?.cargo||''} ${c?.titulo||''} ${c?.descripcion||''}`.toLowerCase();
        const esRemoto = REMOTO_KW.some(w => txt.includes(w));
        return modalidad === 'teletrabajo' ? esRemoto : !esRemoto;
      });
    }
  } else {
    let base = filtroActivo === 'para_vos'
      ? matches.filter(m => m.cumple)
      : todos.map(c => matchesPorId[c.id] || { concursos: c, score: 0, cumple: false, keywords_match: [] });
    base = filtrarSector(base, item => item.concursos);
    if (modalidad !== 'todos') {
      base = base.filter(item => {
        const c = item.concursos;
        const txt = `${c?.cargo||''} ${c?.titulo||''} ${c?.descripcion||''}`.toLowerCase();
        const esRemoto = REMOTO_KW.some(w => txt.includes(w));
        return modalidad === 'teletrabajo' ? esRemoto : !esRemoto;
      });
    }
    mostrados = base;
  }

  if (cargando && todos.length === 0 && matches.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.coral} />
        <Text style={{ color: COLORS.texto3, marginTop: 12 }}>Buscando llamados compatibles…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} tintColor={COLORS.coral} />
        }
      >
        {/* ── HEADER ── */}
        <LinearGradient
          colors={['#D6E4F0', '#B8D4E8']}
          start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View style={styles.brand}>
              <View style={styles.brandIcon}>
                <Text style={{ fontSize: 16 }}>🏛️</Text>
              </View>
              <View>
                <Text style={[styles.brandName, { color: '#1A3A5C' }]}>Concursa</Text>
                <Text style={[styles.brandSub, { color: 'rgba(26,58,92,0.5)' }]}>Powered by Nexu</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.alertasBtn, { backgroundColor: 'rgba(26,58,92,0.12)', borderColor: 'rgba(26,58,92,0.25)' }]} onPress={handleAlertas}>
              <Text style={[styles.alertasBtnText, { color: '#1A3A5C' }]}>🔔 Alertas</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroWrap}>
            <Text style={[styles.heroTitle, { color: '#1A3A5C' }]}>Oportunidades de{'\n'}empleo público</Text>
            <Text style={[styles.heroDesc, { color: 'rgba(26,58,92,0.6)' }]}>
              Analizamos tu perfil y lo comparamos con los llamados abiertos en tu país para identificar las mejores oportunidades
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.paraVos}</Text>
                <Text style={styles.statLbl}>Para vos</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.total}</Text>
                <Text style={styles.statLbl}>Abiertos</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.cierranPronto}</Text>
                <Text style={styles.statLbl}>Cierran pronto</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── MATCH BAR ── */}
        <View style={styles.matchBarWrap}>
          <View style={styles.matchBar}>
            <Text style={{ fontSize: 22 }}>🎯</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.matchTitle}>
                {stats.paraVos > 0
                  ? `Compatible con ${stats.paraVos} llamado${stats.paraVos !== 1 ? 's' : ''}`
                  : stats.total > 0
                    ? 'No encontramos llamados compatibles aún'
                    : 'Sin llamados disponibles por el momento'}
              </Text>
              <Text style={styles.matchSub}>Actualizado hoy · tu país</Text>
            </View>
            {stats.paraVos > 0 && (
              <Text style={styles.matchNum}>{stats.paraVos}</Text>
            )}
          </View>
        </View>

        {/* ── FILTROS PRINCIPAL ── */}
        <View style={styles.filtrosRow}>
          <TouchableOpacity
            style={[styles.filtroBtn, filtroActivo === 'para_vos' && styles.filtroBtnActive]}
            onPress={() => setFiltroActivo('para_vos')}
          >
            <Text style={[styles.filtroTxt, filtroActivo === 'para_vos' && styles.filtroTxtActive]}>
              Para vos ({matches.filter(m => m.cumple).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filtroBtn, filtroActivo === 'todos' && styles.filtroBtnActive]}
            onPress={() => setFiltroActivo('todos')}
          >
            <Text style={[styles.filtroTxt, filtroActivo === 'todos' && styles.filtroTxtActive]}>
              Todos ({todos.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── FILTRO SECTOR ── */}
        <View style={styles.sectorRow}>
          {[['todos','Todo'], ['publico','Público 🏛️'], ['privado','Privado 💼']].map(([val, label]) => (
            <TouchableOpacity
              key={val}
              style={[styles.sectorBtn, sector === val && styles.sectorBtnActive]}
              onPress={() => setSector(val)}
            >
              <Text style={[styles.sectorTxt, sector === val && styles.sectorTxtActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── BÚSQUEDA ── */}
        <View style={styles.searchWrap}>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Text style={{ fontSize: 13, color: COLORS.texto3 }}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar en toda la base de datos..."
                placeholderTextColor={COLORS.texto3}
                value={busqueda}
                onChangeText={v => { setBusqueda(v); if (!v.trim()) limpiarBusqueda(); }}
                returnKeyType="search"
                onSubmitEditing={() => buscarEnBD(busqueda)}
              />
              {busqueda.length > 0 && (
                <TouchableOpacity onPress={limpiarBusqueda}>
                  <Text style={{ color: COLORS.texto3, fontSize: 17, paddingHorizontal: 2 }}>×</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.searchBtn, buscandoEnBD && { opacity: 0.6 }]}
              onPress={() => buscarEnBD(busqueda)}
              disabled={buscandoEnBD}
            >
              {buscandoEnBD
                ? <ActivityIndicator size="small" color={COLORS.blanco} />
                : <Text style={styles.searchBtnTxt}>Buscar</Text>}
            </TouchableOpacity>
          </View>
          <View style={styles.modRow}>
            {[['todos','Cualquiera'], ['presencial','Presencial'], ['teletrabajo','Remoto']].map(([v, l]) => (
              <TouchableOpacity key={v} style={[styles.modBtn, modalidad === v && styles.modBtnActive]} onPress={() => setModalidad(v)}>
                <Text style={[styles.modTxt, modalidad === v && styles.modTxtActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── CABECERA RESULTADOS DE BÚSQUEDA ── */}
        {modoBusqueda && (
          <View style={styles.busquedaHeader}>
            <Text style={styles.busquedaHeaderTxt}>
              {buscandoEnBD ? 'Buscando...' : `${resultadosBusqueda.length} resultado${resultadosBusqueda.length !== 1 ? 's' : ''} para "${busqueda}"`}
            </Text>
            <TouchableOpacity onPress={limpiarBusqueda}>
              <Text style={styles.busquedaLimpiar}>Limpiar ×</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── SIN PERFIL ── */}
        {sinPerfil && (
          <View style={styles.sinPerfilBox}>
            <Text style={styles.sinPerfilTitle}>Completá tu perfil para ver matches</Text>
            <Text style={styles.sinPerfilSub}>
              Agregá tus servicios, profesión y especialidades para que podamos comparar tu perfil contra los llamados abiertos.
            </Text>
          </View>
        )}

        {/* ── LISTA DE LLAMADOS ── */}
        <View style={styles.lista}>
          {mostrados.length === 0 && !sinPerfil && !buscandoEnBD ? (
            <View style={styles.vacio}>
              <Text style={{ fontSize: 40 }}>{modoBusqueda ? '🔎' : '🔍'}</Text>
              <Text style={styles.vacioTxt}>
                {modoBusqueda
                  ? `Sin resultados para "${busqueda}".\nProbá con otra palabra o cambiá el filtro de sector.`
                  : filtroActivo === 'para_vos'
                    ? 'No encontramos llamados compatibles con tu perfil por ahora.\nProbá ver todos los disponibles.'
                    : 'No hay llamados disponibles en este momento.'}
              </Text>
              {!modoBusqueda && filtroActivo === 'para_vos' && (
                <TouchableOpacity onPress={() => setFiltroActivo('todos')}>
                  <Text style={{ color: COLORS.coral, fontWeight: '700', marginTop: 8 }}>Ver todos →</Text>
                </TouchableOpacity>
              )}
              {modoBusqueda && (
                <TouchableOpacity onPress={limpiarBusqueda}>
                  <Text style={{ color: COLORS.coral, fontWeight: '700', marginTop: 8 }}>Limpiar búsqueda →</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {filtroActivo === 'para_vos' && mostrados.filter(m => m.cumple).length > 0 && (
                <Text style={styles.sectionLabel}>COMPATIBLES ✓</Text>
              )}
              {mostrados.map((m, i) => (
                <LlamadoCard
                  key={`${m.concursos?.id || i}-${i}`}
                  match={m}
                  onPress={(item) => navigation.navigate('ConcursaDetalle', { match: item })}
                />
              ))}
              <View style={{ height: 24 }} />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.crema },
  header: {
    paddingHorizontal: SIZES.md,
    paddingTop: SIZES.md,
    paddingBottom: SIZES.lg,
    borderBottomLeftRadius: SIZES.radiusXl,
    borderBottomRightRadius: SIZES.radiusXl,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SIZES.lg,
  },
  brand:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandIcon: {
    width: 34, height: 34, backgroundColor: COLORS.coral,
    borderRadius: SIZES.radiusSm, alignItems: 'center', justifyContent: 'center',
  },
  brandName:      { color: COLORS.blanco, fontWeight: '800', fontSize: SIZES.textMd },
  brandSub:       { color: 'rgba(255,255,255,0.35)', fontSize: SIZES.textXs },
  alertasBtn: {
    backgroundColor: 'rgba(255,95,64,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,95,64,0.3)',
    borderRadius: SIZES.radiusSm,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  alertasBtnText: { color: COLORS.coral, fontSize: SIZES.textSm, fontWeight: '700' },
  heroWrap:       { alignItems: 'center' },
  heroTitle: {
    fontSize: 24, fontWeight: '900', color: COLORS.blanco,
    textAlign: 'center', marginBottom: 8, lineHeight: 30,
  },
  heroDesc: {
    fontSize: SIZES.textSm, color: 'rgba(255,255,255,0.45)',
    textAlign: 'center', lineHeight: 20, marginBottom: SIZES.md,
  },
  statsRow:       { flexDirection: 'row', gap: 32 },
  statItem:       { alignItems: 'center' },
  statNum:        { fontSize: 28, fontWeight: '900', color: '#1A3A5C', lineHeight: 32 },
  statLbl:        { fontSize: SIZES.textXs, color: 'rgba(26,58,92,0.55)', fontWeight: '600' },

  matchBarWrap:   { paddingHorizontal: SIZES.md, marginTop: -14 },
  matchBar: {
    backgroundColor: COLORS.blanco, borderRadius: SIZES.radiusMd,
    padding: SIZES.md, flexDirection: 'row', alignItems: 'center',
    gap: 10, ...SHADOWS.md,
  },
  matchTitle:     { fontSize: SIZES.textMd, fontWeight: '800', color: COLORS.texto1 },
  matchSub:       { fontSize: SIZES.textSm, color: COLORS.texto3 },
  matchNum:       { fontSize: 28, fontWeight: '900', color: COLORS.mentaDark },

  filtrosRow: {
    flexDirection: 'row', paddingHorizontal: SIZES.md,
    marginTop: SIZES.md, gap: 8,
  },
  filtroBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: SIZES.radiusFull,
    borderWidth: 1, borderColor: COLORS.borde,
    backgroundColor: COLORS.blanco,
  },
  filtroBtnActive: { backgroundColor: COLORS.coral, borderColor: COLORS.coral },
  filtroTxt:      { fontSize: SIZES.textSm, fontWeight: '600', color: COLORS.texto2 },
  filtroTxtActive:{ color: COLORS.blanco },

  sectorRow: {
    flexDirection: 'row', paddingHorizontal: SIZES.md,
    marginTop: 8, gap: 6,
  },
  sectorBtn: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: SIZES.radiusFull,
    borderWidth: 1, borderColor: COLORS.borde,
    backgroundColor: 'transparent',
  },
  sectorBtnActive: { backgroundColor: '#1A3A5C', borderColor: '#1A3A5C' },
  sectorTxt:      { fontSize: 12, fontWeight: '600', color: COLORS.texto3 },
  sectorTxtActive:{ color: COLORS.blanco },

  sinPerfilBox: {
    margin: SIZES.md,
    backgroundColor: COLORS.indigoSoft,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    borderWidth: 1, borderColor: COLORS.borde,
  },
  sinPerfilTitle: { fontWeight: '800', color: COLORS.indigo, marginBottom: 4 },
  sinPerfilSub:   { fontSize: SIZES.textSm, color: COLORS.texto2, lineHeight: 18 },

  lista:          { padding: SIZES.md, paddingTop: SIZES.sm },
  sectionLabel: {
    fontSize: SIZES.textXs, fontWeight: '700',
    color: COLORS.texto3, letterSpacing: 1, marginBottom: SIZES.sm,
  },
  vacio:          { alignItems: 'center', paddingVertical: SIZES.xl },
  vacioTxt:       { color: COLORS.texto3, textAlign: 'center', lineHeight: 20, marginTop: 12 },

  // Search
  searchWrap: { paddingHorizontal: SIZES.md, marginTop: 8, marginBottom: 4 },
  searchRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.blanco, borderRadius: SIZES.radiusMd,
    borderWidth: 1, borderColor: COLORS.borde,
    paddingHorizontal: SIZES.sm, paddingVertical: 8,
  },
  searchInput:   { flex: 1, fontSize: SIZES.textSm, color: COLORS.texto1, paddingHorizontal: 4 },
  searchBtn:     { backgroundColor: COLORS.coral, borderRadius: SIZES.radiusMd, paddingHorizontal: 14, paddingVertical: 10 },
  searchBtnTxt:  { color: COLORS.blanco, fontWeight: '800', fontSize: SIZES.textSm },
  busquedaHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SIZES.md, marginBottom: 4, marginTop: 2 },
  busquedaHeaderTxt: { fontSize: SIZES.textSm, fontWeight: '700', color: COLORS.texto2 },
  busquedaLimpiar:   { fontSize: SIZES.textSm, color: COLORS.coral, fontWeight: '700' },
  modRow:     { flexDirection: 'row', gap: 6 },
  modBtn:     { paddingHorizontal: 12, paddingVertical: 4, borderRadius: SIZES.radiusFull, borderWidth: 1, borderColor: COLORS.borde, backgroundColor: 'transparent' },
  modBtnActive:  { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo },
  modTxt:        { fontSize: 11, color: COLORS.texto3, fontWeight: '600' },
  modTxtActive:  { color: COLORS.blanco },

  // Card
  card: {
    backgroundColor: COLORS.blanco,
    borderRadius: SIZES.radiusMd,
    marginBottom: SIZES.sm,
    overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.borde,
    ...SHADOWS.sm,
  },
  cardStripe:     { height: 3 },
  cardBody:       { padding: SIZES.md },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  cardOrg:        { fontSize: SIZES.textXs, color: COLORS.texto3, fontWeight: '600', flex: 1 },
  cardNum:        { fontSize: SIZES.textXs, color: COLORS.texto3, marginLeft: 8 },
  cardCargo:      { fontSize: SIZES.textLg, fontWeight: '800', color: COLORS.texto1, marginBottom: 8, lineHeight: 22 },
  tag:            { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, marginBottom: SIZES.sm },
  tagText:        { fontSize: SIZES.textSm, fontWeight: '700' },
  kwRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: SIZES.sm },
  kwChip: {
    backgroundColor: COLORS.mentaSoft,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4,
  },
  kwText:         { fontSize: 10, color: COLORS.mentaDark, fontWeight: '600' },
  cardFoot:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  diasText:       { fontSize: SIZES.textSm, color: COLORS.texto3 },
  lugarText:      { fontSize: SIZES.textXs, color: COLORS.texto3, marginTop: 2 },
  btn:            { borderRadius: SIZES.radiusSm, paddingHorizontal: 14, paddingVertical: 7 },
  btnPrimary:     { backgroundColor: COLORS.menta },
  btnOutline:     { backgroundColor: COLORS.indigoSoft },
  btnText:        { fontSize: SIZES.textSm, fontWeight: '700', color: COLORS.blanco },
});
