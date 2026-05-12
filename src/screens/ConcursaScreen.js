// src/screens/ConcursaScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
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

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(match)} activeOpacity={0.8}>
      <View style={[styles.cardStripe, { backgroundColor: stripeColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardOrg} numberOfLines={1}>{bandera} {c.organismo || 'Organismo público'}</Text>
          {c.numero_llamado && (
            <Text style={styles.cardNum}>#{c.numero_llamado}</Text>
          )}
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
export default function ConcursaScreen({ navigation }) {
  const { user } = useAppContext();
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState({ total: 0, paraVos: 0, cierranPronto: 0 });
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroActivo, setFiltroActivo] = useState('para_vos'); // 'para_vos' | 'todos'
  const [sinPerfil, setSinPerfil] = useState(false);

  const cargar = useCallback(async (esRefresh = false) => {
    if (esRefresh) setRefreshing(true);
    else setCargando(true);

    try {
      // Verificar que el usuario tiene perfil de worker
      const { data: perfil } = await supabase
        .from('profiles')
        .select('rol, servicios, profesiones, especialidades, pais')
        .eq('id', user.id)
        .single();

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

      // Disparar matching actualizado en el servidor
      supabase.functions.invoke('match-concursos', {
        body: { worker_id: user.id },
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
        .eq('worker_id', user.id)
        .order('score', { ascending: false })
        .limit(80);

      if (error) throw error;

      // Filtrar por país del usuario, vigentes y con concurso cargado
      const hoy = new Date();
      const paisUsuario = perfil?.pais;
      const validos = (matchData || []).filter(m => {
        if (!m.concursos) return false;
        if (paisUsuario && m.concursos.pais && m.concursos.pais !== paisUsuario) return false;
        if (m.concursos.fecha_cierre) {
          const cierre = new Date(m.concursos.fecha_cierre);
          if (cierre < hoy) return false;
        }
        return true;
      });

      setMatches(validos);

      // Stats
      const paraVos = validos.filter(m => m.cumple).length;
      const cierranPronto = validos.filter(m => {
        if (!m.concursos?.fecha_cierre) return false;
        const dias = (new Date(m.concursos.fecha_cierre) - hoy) / (1000 * 60 * 60 * 24);
        return dias >= 0 && dias <= 7;
      }).length;

      setStats({ total: validos.length, paraVos, cierranPronto });

    } catch (e) {
      console.error('ConcursaScreen error:', e.message);
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleAlertas = () => {
    Alert.alert(
      '🔔 Alertas activadas',
      'Te notificaremos cuando aparezcan nuevos llamados compatibles con tu perfil.',
      [{ text: 'OK' }]
    );
  };

  const mostrados = filtroActivo === 'para_vos'
    ? matches.filter(m => m.score >= 15)
    : matches;

  if (cargando) {
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

        {/* ── FILTROS ── */}
        <View style={styles.filtrosRow}>
          <TouchableOpacity
            style={[styles.filtroBtn, filtroActivo === 'para_vos' && styles.filtroBtnActive]}
            onPress={() => setFiltroActivo('para_vos')}
          >
            <Text style={[styles.filtroTxt, filtroActivo === 'para_vos' && styles.filtroTxtActive]}>
              Para vos ({matches.filter(m => m.score >= 15).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filtroBtn, filtroActivo === 'todos' && styles.filtroBtnActive]}
            onPress={() => setFiltroActivo('todos')}
          >
            <Text style={[styles.filtroTxt, filtroActivo === 'todos' && styles.filtroTxtActive]}>
              Todos ({matches.length})
            </Text>
          </TouchableOpacity>
        </View>

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
          {mostrados.length === 0 && !sinPerfil ? (
            <View style={styles.vacio}>
              <Text style={{ fontSize: 40 }}>🔍</Text>
              <Text style={styles.vacioTxt}>
                {filtroActivo === 'para_vos'
                  ? 'No encontramos llamados compatibles con tu perfil por ahora.\nProbá ver todos los disponibles.'
                  : 'No hay llamados disponibles en este momento.'}
              </Text>
              {filtroActivo === 'para_vos' && (
                <TouchableOpacity onPress={() => setFiltroActivo('todos')}>
                  <Text style={{ color: COLORS.coral, fontWeight: '700', marginTop: 8 }}>Ver todos →</Text>
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
                  key={`${m.concursos?.id}-${i}`}
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
