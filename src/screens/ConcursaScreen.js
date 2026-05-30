// src/screens/ConcursaScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import NexuWatermark from '../components/NexuWatermark';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { supabase } from '../services/supabase';
import { useApp as useAppContext } from '../services/AppContext';
import { useI18n } from '../services/I18nContext';

// ─────────────────────────────────────────────────────────────
// BANDERA EMOJI POR PAÍS
// ─────────────────────────────────────────────────────────────
const BANDERAS = {
  // Sudamérica
  UY:'🇺🇾', AR:'🇦🇷', BR:'🇧🇷', CL:'🇨🇱', CO:'🇨🇴',
  PE:'🇵🇪', PY:'🇵🇾', BO:'🇧🇴', EC:'🇪🇨', VE:'🇻🇪', MX:'🇲🇽',
  // Centroamérica y Caribe
  CU:'🇨🇺', CR:'🇨🇷', GT:'🇬🇹', SV:'🇸🇻', HN:'🇭🇳',
  NI:'🇳🇮', PA:'🇵🇦', DO:'🇩🇴',
  // Europa
  ES:'🇪🇸', PT:'🇵🇹', IT:'🇮🇹', FR:'🇫🇷', DE:'🇩🇪', GB:'🇬🇧',
  SE:'🇸🇪', NO:'🇳🇴',
  // Anglosajones
  US:'🇺🇸', CA:'🇨🇦', AU:'🇦🇺',
  // Asia
  JP:'🇯🇵', IN:'🇮🇳',
};

// ─────────────────────────────────────────────────────────────
// CARD DE LLAMADO
// ─────────────────────────────────────────────────────────────
function LlamadoCard({ match, onPress }) {
  const { concursos: c, score, cumple, keywords_match } = match;
  const { t } = useI18n();

  const esBusquedaPersonal = c.fuente === 'busqueda_diaria_gnews';
  const esNoticia = c.fuente?.endsWith('_gnews') && !esBusquedaPersonal;

  const diasRestantes = () => {
    if (!c.fecha_cierre) return null;
    const diff = new Date(c.fecha_cierre) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };
  const dias = diasRestantes();

  const diasPublicado = () => {
    if (!c.fecha_inicio) return null;
    const diff = Date.now() - new Date(c.fecha_inicio).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const tagConfig = () => {
    if (esBusquedaPersonal) return { text: '🔍 Tu búsqueda diaria', bg: '#F3E8FF', color: '#7C3AED' };
    if (esNoticia) return { text: '📰 Noticia de empleo', bg: '#F0F4FF', color: '#3B4FA8' };
    if (score >= 70) return { text: t('cumple_total'), bg: COLORS.mentaSoft, color: COLORS.mentaDark };
    if (score >= 40) return { text: t('compatible_x_pct', { n: Math.round(score) }), bg: '#FFF7ED', color: '#C2410C' };
    if (score >= 15) return { text: t('compatible_parcial', { n: Math.round(score) }), bg: COLORS.goldSoft, color: '#D97706' };
    return { text: t('nuevo_llamado'), bg: COLORS.indigoSoft, color: COLORS.indigo };
  };
  const tag = tagConfig();

  const stripeColor = esNoticia ? '#3B4FA8' : score >= 70 ? COLORS.menta : score >= 40 ? COLORS.coral : score >= 15 ? COLORS.gold : COLORS.indigo;
  const bandera = BANDERAS[c.pais] || '🌍';
  const esPrivado = c.tipo_vinculo === 'privado';

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(match)} activeOpacity={0.8}>
      <View style={[styles.cardStripe, { backgroundColor: stripeColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardOrg} numberOfLines={1}>
            {bandera} {c.organismo || (esPrivado ? t('empresa_privada') : t('organismo_publico'))}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {esPrivado
              ? <View style={{ backgroundColor: '#FFF3E0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, color: '#E65100', fontWeight: '700' }}>{t('privado_badge')}</Text>
                </View>
              : <View style={{ backgroundColor: '#E3F2FD', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, color: '#1565C0', fontWeight: '700' }}>{t('publico_badge')}</Text>
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
            {esNoticia
              ? diasPublicado() !== null && <Text style={styles.diasText}>🕐 Hace {diasPublicado() === 0 ? 'hoy' : `${diasPublicado()} día${diasPublicado() !== 1 ? 's' : ''}`}</Text>
              : dias !== null && (
                  <Text style={[styles.diasText, dias <= 2 && { color: '#FF9800', fontWeight: '700' }, dias > 2 && dias <= 5 && { color: '#FFC107', fontWeight: '700' }]}>
                    {dias > 0 ? (dias <= 2 ? `🟠 ${t('cierra_en_n', { n: dias })}` : dias <= 5 ? `🟡 ${t('cierra_en_n', { n: dias })}` : t('cierra_en_n', { n: dias })) : t('ultimo_dia')}
                  </Text>
                )
            }
            {c.lugar && <Text style={styles.lugarText}>📍 {c.lugar}</Text>}
          </View>
          <TouchableOpacity
            style={[styles.btn, (cumple && !esNoticia) ? styles.btnPrimary : styles.btnOutline]}
            onPress={() => onPress(match)}
          >
            <Text style={[styles.btnText, (!cumple || esNoticia) && { color: COLORS.indigo }]}>
              {esNoticia ? 'Ver noticia' : cumple ? t('postularme') : t('ver_detalles')}
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
  const { t } = useI18n();
  const [matches, setMatches] = useState([]);
  const [todos, setTodos] = useState([]);
  const [stats, setStats] = useState({ total: 0, paraVos: 0, cierranPronto: 0 });
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroActivo, setFiltroActivo] = useState('para_vos');
  const [sector, setSector] = useState('todos');
  const [sinPerfil, setSinPerfil] = useState(false);

  // Aplicar filtros que vienen desde HomeScreen
  useEffect(() => {
    const p = route.params || {};
    if (p.presetFiltro) setFiltroActivo(p.presetFiltro);
    if (p.presetSector) setSector(p.presetSector);
  }, [route.params?.presetFiltro, route.params?.presetSector]);

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
        .select('rol, servicios, profesiones, especialidades, tecnicaturas, pais, nomada_digital, idiomas_trabajo')
        .eq('id', authUser.id)
        .single();

      console.log('[Concursa] perfil:', perfil?.rol, perfil?.pais, '| error:', perfilError?.message);

      if (perfil?.rol === 'employer' || perfil?.rol === 'company') {
        setSinPerfil(true);
        return;
      }

      const tieneKeywords = [
        ...(perfil?.servicios || []),
        ...(perfil?.profesiones || []),
        ...(perfil?.especialidades || []),
        ...(perfil?.tecnicaturas || []),
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
            id, pais, fuente, numero_llamado, titulo, cargo, organismo,
            tipo_tarea, tipo_vinculo, lugar, fecha_inicio, fecha_cierre,
            puestos, url_detalle, url_postulacion, descripcion, requisitos
          )
        `)
        .eq('worker_id', authUser.id)
        .order('score', { ascending: false })
        .limit(2000);

      if (error) throw error;

      const hoy = new Date();
      const hoyStr = new Date().toISOString().slice(0, 10); // "2026-05-21" — para comparar fechas sin timezone
      const PAIS_ISO = {
        'uruguay':'UY','argentina':'AR','chile':'CL','colombia':'CO',
        'peru':'PE','perú':'PE','brasil':'BR','brazil':'BR','paraguay':'PY',
        'bolivia':'BO','ecuador':'EC','venezuela':'VE','mexico':'MX','méxico':'MX',
        'cuba':'CU','costa rica':'CR','guatemala':'GT','el salvador':'SV',
        'honduras':'HN','nicaragua':'NI','panamá':'PA','panama':'PA',
        'república dominicana':'DO','republica dominicana':'DO',
        'españa':'ES','espana':'ES','spain':'ES',
        'portugal':'PT','italia':'IT','italy':'IT',
        'francia':'FR','france':'FR','alemania':'DE','germany':'DE',
        'reino unido':'GB','united kingdom':'GB','uk':'GB',
        'estados unidos':'US','united states':'US','usa':'US',
        'canadá':'CA','canada':'CA',
        'australia':'AU',
        'suecia':'SE','sweden':'SE',
        'noruega':'NO','norway':'NO',
        'japón':'JP','japon':'JP','japan':'JP',
        'india':'IN',
      };
      const IDIOMA_PAISES = {
        es: ['UY','AR','CL','CO','PE','PY','BO','EC','MX','VE','CU','CR','GT','SV','HN','NI','PA','DO','ES'],
        pt: ['BR','PT'],
        en: ['US','CA','GB','AU','SE','NO','IN'],
        fr: ['FR'],
        de: ['DE'],
        it: ['IT'],
        sv: ['SE'],
        nb: ['NO'],
        ja: ['JP'],
        hi: ['IN'],
      };
      const paisRaw = (perfil?.pais || '').toLowerCase().trim();
      const paisISO = PAIS_ISO[paisRaw] || paisRaw.slice(0,2).toUpperCase();

      // Países permitidos según modo nómada
      let paisesPermitidos = null; // null = solo país propio
      if (perfil?.nomada_digital) {
        const idiomas = perfil.idiomas_trabajo?.length ? perfil.idiomas_trabajo : ['es'];
        paisesPermitidos = idiomas.flatMap(i => IDIOMA_PAISES[i] || []);
        if (!paisesPermitidos.includes(paisISO)) paisesPermitidos.push(paisISO);
      }

      // Filtrar matches por país
      const validos = (matchData || []).filter(m => {
        if (!m.concursos) return false;
        const mp = m.concursos.pais;
        if (paisesPermitidos) {
          if (mp && !paisesPermitidos.includes(mp)) return false;
        } else {
          if (paisISO && mp && mp !== paisISO) return false;
        }
        if (m.concursos.fecha_cierre && m.concursos.fecha_cierre < hoyStr) return false;
        if (m.concursos.fuente?.includes('gnews') || m.concursos.fuente?.includes('news')) return false;
        return true;
      });

      setMatches(validos);

      // Cargar TODOS los concursos del país directamente (no depende de matching)
      let todosQuery = supabase
        .from('concursos')
        .select('id, pais, fuente, numero_llamado, titulo, cargo, organismo, tipo_tarea, tipo_vinculo, lugar, fecha_inicio, fecha_cierre, puestos, url_detalle, url_postulacion')
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (paisesPermitidos) {
        todosQuery = todosQuery.in('pais', paisesPermitidos);
      } else if (paisISO) {
        todosQuery = todosQuery.eq('pais', paisISO);
      }
      const { data: todosData } = await todosQuery;

      const todosValidos = (todosData || []).filter(c => {
        if (c.fecha_cierre && c.fecha_cierre < hoyStr) return false;
        if (c.fuente?.includes('gnews') || c.fuente?.includes('news')) return false;
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
    Alert.alert(t('alerta_activada_tit'), t('alerta_activada_desc'), [{ text: t('ok') }]);
  };

  const matchesPorId = Object.fromEntries(matches.map(m => [m.concursos?.id, m]));

  const filtrarSector = (arr, getConcurso) => {
    if (sector === 'todos') return arr;
    return arr.filter(item => {
      const c = getConcurso(item);
      return sector === 'privado' ? c?.tipo_vinculo === 'privado' : c?.tipo_vinculo !== 'privado';
    });
  };

  let mostrados = filtroActivo === 'para_vos'
    ? matches.filter(m => m.cumple)
    : todos.map(c => matchesPorId[c.id] || { concursos: c, score: 0, cumple: false, keywords_match: [] });
  mostrados = filtrarSector(mostrados, item => item.concursos);

  if (cargando && todos.length === 0 && matches.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.coral} />
        <Text style={{ color: COLORS.texto3, marginTop: 12 }}>{t('concursa_cargando')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <NexuWatermark/>
      <ScrollView
        showsVerticalScrollIndicator={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
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
                <Text style={[styles.brandName, { color: '#1A3A5C' }]}>{t('concursa_brand')}</Text>
                <Text style={[styles.brandSub, { color: 'rgba(26,58,92,0.5)' }]}>{t('concursa_sub')}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => cargar(true)} style={{ padding: 6 }}>
                <Text style={{ fontSize: 18 }}>{refreshing ? '⏳' : '🔄'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.alertasBtn, { backgroundColor: 'rgba(26,58,92,0.12)', borderColor: 'rgba(26,58,92,0.25)' }]} onPress={handleAlertas}>
                <Text style={[styles.alertasBtnText, { color: '#1A3A5C' }]}>{t('concursa_alertas')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroWrap}>
            <Text style={[styles.heroTitle, { color: '#1A3A5C' }]}>{t('concursa_hero')}</Text>
            <Text style={[styles.heroDesc, { color: 'rgba(26,58,92,0.6)' }]}>{t('concursa_hero_desc')}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.paraVos}</Text>
                <Text style={styles.statLbl}>{t('stat_para_vos')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.total}</Text>
                <Text style={styles.statLbl}>{t('stat_abiertos')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.cierranPronto}</Text>
                <Text style={styles.statLbl}>{t('stat_cierran_pronto')}</Text>
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
                  ? t('match_compatible_n', { n: stats.paraVos, s: stats.paraVos !== 1 ? 's' : '' })
                  : stats.total > 0
                    ? t('match_no_compatible')
                    : t('match_sin_llamados')}
              </Text>
              <Text style={styles.matchSub}>{t('match_actualizado')}</Text>
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
              {t('filtro_para_vos', { n: matches.filter(m => m.cumple).length })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filtroBtn, filtroActivo === 'todos' && styles.filtroBtnActive]}
            onPress={() => setFiltroActivo('todos')}
          >
            <Text style={[styles.filtroTxt, filtroActivo === 'todos' && styles.filtroTxtActive]}>
              {t('filtro_todos', { n: todos.length })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── FILTRO SECTOR ── */}
        <View style={styles.sectorRow}>
          {[['todos', t('sector_todo')], ['publico', t('sector_publico')], ['privado', t('sector_privado')]].map(([val, label]) => (
            <TouchableOpacity
              key={val}
              style={[styles.sectorBtn, sector === val && styles.sectorBtnActive]}
              onPress={() => setSector(val)}
            >
              <Text style={[styles.sectorTxt, sector === val && styles.sectorTxtActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>


        {/* ── SIN PERFIL ── */}
        {sinPerfil && (
          <View style={styles.sinPerfilBox}>
            <Text style={styles.sinPerfilTitle}>{t('sin_perfil_tit')}</Text>
            <Text style={styles.sinPerfilSub}>{t('sin_perfil_sub')}</Text>
          </View>
        )}

        {/* ── LISTA DE LLAMADOS ── */}
        <View style={styles.lista}>
          {mostrados.length === 0 && !sinPerfil ? (
            <View style={styles.vacio}>
              <Text style={{ fontSize: 40 }}>🔍</Text>
              <Text style={styles.vacioTxt}>
                {filtroActivo === 'para_vos' ? t('sin_compatibles') : t('no_hay_llamados')}
              </Text>
              {filtroActivo === 'para_vos' && (
                <TouchableOpacity onPress={() => setFiltroActivo('todos')}>
                  <Text style={{ color: COLORS.coral, fontWeight: '700', marginTop: 8 }}>{t('ver_todos')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {filtroActivo === 'para_vos' && mostrados.filter(m => m.cumple).length > 0 && (
                <Text style={styles.sectionLabel}>{t('compatibles_section')}</Text>
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
