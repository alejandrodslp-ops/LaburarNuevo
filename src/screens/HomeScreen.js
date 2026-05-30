// src/screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Image, AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { useI18n } from '../services/I18nContext';
import { useApp } from '../services/AppContext';
import NexuWatermark from '../components/NexuWatermark';
import { IdiomaBoton } from '../components/IdiomaModal';
import ModalPerfilInactivo from '../components/ModalPerfilInactivo';
import { FRASES } from '../data/frases';
import { FRASES_PT } from '../data/frases_pt';

const PRECIO_LOCAL = {
  UY:{usd:1},AR:{usd:1},BR:{usd:1},CL:{usd:1},CO:{usd:1},PE:{usd:1},
  PY:{usd:1},BO:{usd:1},EC:{usd:1},VE:{usd:1},MX:{usd:1},
  ES:{usd:2},PT:{usd:2},IT:{usd:2},FR:{usd:2},DE:{usd:2},
  GB:{usd:2},US:{usd:2},CA:{usd:2},AU:{usd:2},
};
let _alertaInactivaMostrada = false;

// ── Header ────────────────────────────────────────────────────────────────────
function HomeHeader({ nombre, activo, diasRestantes, vistas, contactos, onActivar, avatar, esWorker, visDisp }) {
  const { t } = useI18n();
  const hora = new Date().getHours();
  const saludo = hora < 12 ? t('buenos_dias') : hora < 19 ? t('buenas_tardes') : t('buenas_noches');
  return (
    <LinearGradient colors={['#D6E4F0', '#B8D4E8']} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} style={ss.header}>
      <View style={ss.headerTop}>
        <View>
          <Text style={ss.greeting}>{saludo}</Text>
          <Text style={ss.name}>{nombre ? t('hola_nombre', { nombre }) : `${t('hola')} 👋`}</Text>
        </View>
        <View style={ss.headerRight}>
          <IdiomaBoton />
          <TouchableOpacity style={ss.bellWrap}>
            <Text style={ss.bell}>🔔</Text>
            <View style={ss.bellDot} />
          </TouchableOpacity>
          <View style={ss.avatar}>
            {avatar
              ? <Image source={{ uri: avatar }} style={{ width: 38, height: 38, borderRadius: 19 }} />
              : <Text style={{ fontSize: 18 }}>👤</Text>}
          </View>
        </View>
      </View>

      {esWorker ? (
        <TouchableOpacity style={ss.statusPill} onPress={onActivar} activeOpacity={0.85}>
          <View>
            <Text style={ss.pillLabel}>{t('mi_perfil')}</Text>
            <View style={ss.pillActive}>
              <View style={[ss.pillDot, { backgroundColor: activo ? COLORS.menta : '#EF4444' }]} />
              <Text style={ss.pillActiveText}>{activo ? t('activo') : t('inactivo')}</Text>
            </View>
            {activo && diasRestantes > 0
              ? <Text style={ss.pillDays}>{t('dias_restantes', { n: diasRestantes })}</Text>
              : !activo ? <Text style={[ss.pillDays, { color: '#EF444488' }]}>{t('tocar_activar')}</Text>
              : null}
          </View>
          <View style={ss.pillStats}>
            <View style={ss.pillStat}>
              <Text style={ss.pillNum}>{vistas}</Text>
              <Text style={ss.pillStatLbl}>{t('vistas')}</Text>
            </View>
            <View style={ss.pillStat}>
              <Text style={ss.pillNum}>{contactos}</Text>
              <Text style={ss.pillStatLbl}>{t('contactos')}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={ss.statusPill}>
          <View>
            <Text style={ss.pillLabel}>PANEL DE BÚSQUEDA</Text>
            <Text style={ss.pillActiveText}>Encontrá el talento que necesitás</Text>
            <Text style={ss.pillDays}>Buscá empleados y servicios en tu zona</Text>
          </View>
          <View style={ss.pillStats}>
            <View style={ss.pillStat}>
              <Text style={ss.pillNum}>{visDisp ?? 0}</Text>
              <Text style={ss.pillStatLbl}>créditos</Text>
            </View>
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

// ── Card banners de sector ────────────────────────────────────────────────────
function SectorCard({ icon, badge, title, sub, color, onPress }) {
  return (
    <TouchableOpacity style={[ss.sectorCard, { backgroundColor: COLORS.arena }]} onPress={onPress} activeOpacity={0.85}>
      <View style={[ss.sectorIcon, { backgroundColor: color }]}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={[ss.sectorBadge, { backgroundColor: color }]}>
          <Text style={ss.sectorBadgeText}>{badge}</Text>
        </View>
        <Text style={ss.sectorTitle}>{title}</Text>
        <Text style={ss.sectorSub}>{sub}</Text>
      </View>
      <Text style={ss.sectorArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ── Cards de acceso rápido para empleador ─────────────────────────────────────
function EmpleadorCards({ navigation }) {
  return (
    <View style={{ marginBottom: SIZES.md }}>
      <TouchableOpacity style={[ss.sectorCard,{backgroundColor:COLORS.arena}]} onPress={()=>navigation.navigate('Buscar')} activeOpacity={0.85}>
        <View style={[ss.sectorIcon,{backgroundColor:'#4DC8C4'}]}>
          <Text style={{fontSize:20}}>🔍</Text>
        </View>
        <View style={{flex:1}}>
          <View style={[ss.sectorBadge,{backgroundColor:'#4DC8C4'}]}>
            <Text style={ss.sectorBadgeText}>BUSCAR</Text>
          </View>
          <Text style={ss.sectorTitle}>Encontrá tu próximo trabajador</Text>
          <Text style={ss.sectorSub}>Explorá perfiles disponibles en tu zona</Text>
        </View>
        <Text style={ss.sectorArrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[ss.sectorCard,{backgroundColor:COLORS.arena}]} onPress={()=>navigation.navigate('Ofertas')} activeOpacity={0.85}>
        <View style={[ss.sectorIcon,{backgroundColor:'#E65100'}]}>
          <Text style={{fontSize:20}}>📋</Text>
        </View>
        <View style={{flex:1}}>
          <View style={[ss.sectorBadge,{backgroundColor:'#E65100'}]}>
            <Text style={ss.sectorBadgeText}>MIS OFERTAS</Text>
          </View>
          <Text style={ss.sectorTitle}>Búsquedas publicadas</Text>
          <Text style={ss.sectorSub}>Gestioná y publicá nuevas búsquedas</Text>
        </View>
        <Text style={ss.sectorArrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const FRASE_GRADIENTE = ['#E8785A','#C75A9E'];

const FRASE_LABEL = {
  es:'Frase del día', pt:'Frase do dia',    en:'Quote of the day',  de:'Zitat des Tages',
  fr:'Citation du jour', it:'Citazione del giorno', sv:'Dagens citat', no:'Dagens sitat',
  ja:'今日の名言',        hi:'आज का विचार',
};
const FRASE_ANONIMO = {
  es:'Anónimo', pt:'Anônimo', en:'Anonymous', de:'Anonym',
  fr:'Anonyme', it:'Anonimo', sv:'Anonym',    no:'Anonym',
  ja:'作者不詳', hi:'अज्ञात',
};

function getFechaHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function idxDesdeFecha(dateStr, total) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = Math.imul(31, hash) + dateStr.charCodeAt(i) | 0;
  }
  return (Math.abs(hash) + 1) % total;
}

function FraseDiaria() {
  const { idioma } = useI18n();
  const [, forceRender] = useState(0);
  useEffect(() => {
    const tick = () => forceRender(n => n + 1);
    tick();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') tick(); });
    const interval = setInterval(tick, 60_000);
    return () => { sub.remove(); clearInterval(interval); };
  }, []);
  const fecha = getFechaHoy();
  const banco = idioma === 'pt' ? FRASES_PT : FRASES;
  const { t: texto, a: autor } = banco[idxDesdeFecha(fecha, banco.length)];
  const label = FRASE_LABEL[idioma] ?? FRASE_LABEL.es;
  const fallback = FRASE_ANONIMO[idioma] ?? FRASE_ANONIMO.es;
  return (
    <LinearGradient colors={FRASE_GRADIENTE} start={{x:0,y:0.5}} end={{x:1,y:0.5}} style={ss.fraseBanner}>
      <Text style={ss.fraseIcon}>✨</Text>
      <View style={{flex:1}}>
        <Text style={ss.fraseLabel}>{label}</Text>
        <Text style={ss.fraseTexto}>{texto}</Text>
        <Text style={ss.fraseAutor}>— {autor ?? fallback}</Text>
      </View>
    </LinearGradient>
  );
}

// ── Pantalla principal ─────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { t } = useI18n();
  const { modoActivo } = useApp();
  const esWorker = modoActivo === 'worker';
  const [perfil, setPerfil] = useState({ nombre: '', activo: false, diasRestantes: 0, vistas: 0, contactos: 0, avatar: null });
  const [matchesPublicos, setMatchesPublicos] = useState([]);
  const [matchesPrivados, setMatchesPrivados] = useState([]);
  const [totalConcursos, setTotalConcursos] = useState(0);
  const [propuestasPendientes, setPropuestasPendientes] = useState(0);
  const [visDisp, setVisDisp] = useState(0);
  const [modalInactivo, setModalInactivo] = useState({ visible: false, usd: 1 });

  async function cargar() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('nombre, perfil_activo, perfil_activo_hasta, vistas, contactos, avatar_url, pais, rol, visualizaciones_disponibles')
        .eq('id', user.id)
        .single();
      if (!data) return;

      const hasta = data.perfil_activo_hasta ? new Date(data.perfil_activo_hasta) : null;
      const diasRestantes = hasta ? Math.max(0, Math.ceil((hasta - new Date()) / (1000 * 60 * 60 * 24))) : 0;
      const esAdmin = user.email === 'alejandrodslp@gmail.com';
      const inactivo = !esAdmin && data.rol === 'worker' && (!data.perfil_activo || diasRestantes === 0);
      if (inactivo && !_alertaInactivaMostrada) {
        _alertaInactivaMostrada = true;
        const usd = PRECIO_LOCAL[data.pais?.slice(0,2).toUpperCase()]?.usd ?? 1;
        setModalInactivo({ visible: true, usd });
      }
      setPerfil({
        nombre: data.nombre || '',
        activo: data.perfil_activo && diasRestantes > 0,
        diasRestantes,
        vistas: data.vistas || 0,
        contactos: data.contactos || 0,
        avatar: data.avatar_url || null,
      });
      setVisDisp(data.visualizaciones_disponibles || 0);

      if (data.rol === 'worker' && data.pais) {
        const PAIS_ISO = { 'uruguay':'UY','argentina':'AR','chile':'CL','colombia':'CO','peru':'PE','perú':'PE','brasil':'BR','brazil':'BR','paraguay':'PY' };
        const paisISO = PAIS_ISO[(data.pais||'').toLowerCase().trim()] || data.pais.slice(0, 2).toUpperCase();

        const { count } = await supabase
          .from('concursos')
          .select('id', { count: 'exact', head: true })
          .eq('pais', paisISO)
          .eq('activo', true);
        setTotalConcursos(count || 0);

        const { data: allMatches } = await supabase
          .from('concurso_matches')
          .select('score, cumple, concursos(id, cargo, organismo, fecha_cierre, tipo_vinculo, pais)')
          .eq('worker_id', user.id)
          .eq('cumple', true)
          .order('score', { ascending: false })
          .limit(30);

        const hoy = new Date();
        const validos = (allMatches || []).filter(m => {
          if (!m.concursos) return false;
          if (m.concursos.fecha_cierre && new Date(m.concursos.fecha_cierre) < hoy) return false;
          return true;
        });

        setMatchesPublicos(validos.filter(m => m.concursos?.tipo_vinculo !== 'privado').slice(0, 3));
        setMatchesPrivados(validos.filter(m => m.concursos?.tipo_vinculo === 'privado').slice(0, 3));

        const { count: propCount } = await supabase
          .from('propuestas')
          .select('id', { count: 'exact', head: true })
          .eq('worker_id', user.id)
          .eq('estado', 'pendiente');
        setPropuestasPendientes(propCount || 0);
      }
    } catch (_) {}
  }

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') { _alertaInactivaMostrada = false; cargar(); }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    cargar();
    AsyncStorage.getItem('ir_a_editar_perfil').then(val => {
      if (val === 'true') {
        AsyncStorage.removeItem('ir_a_editar_perfil');
        navigation.navigate('Cuenta', { screen: 'EditarPerfil', params: { desdeRegistro: true } });
      }
    });
  }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', cargar);
    return unsub;
  }, [navigation]);

  function irAConcursa(params) {
    navigation.navigate('Concursa', { screen: 'ConcursaMain', params });
  }

  return (
    <SafeAreaView style={ss.container} edges={['top']}>
      <ModalPerfilInactivo
        visible={modalInactivo.visible}
        usd={modalInactivo.usd}
        onActivar={()=>{ setModalInactivo(m=>({...m,visible:false})); navigation.navigate('PagoActivacion'); }}
        onCerrar={()=>setModalInactivo(m=>({...m,visible:false}))}
      />
      <NexuWatermark/>
      <View style={{flex:1}}>
        <HomeHeader
          nombre={perfil.nombre}
          activo={perfil.activo}
          diasRestantes={perfil.diasRestantes}
          vistas={perfil.vistas}
          contactos={perfil.contactos}
          onActivar={() => { if (!perfil.activo) navigation.navigate('PagoActivacion'); }}
          avatar={perfil.avatar}
          esWorker={esWorker}
          visDisp={visDisp}
        />

        <View style={ss.body}>

          {/* ── Alerta propuestas ── */}
          {propuestasPendientes > 0 && (
            <TouchableOpacity style={ss.alertaBanner} onPress={() => navigation.navigate('Mensajes')} activeOpacity={0.85}>
              <Text style={{ fontSize: 24 }}>📩</Text>
              <View style={{ flex: 1 }}>
                <Text style={ss.alertaTit}>
                  {propuestasPendientes === 1 ? t('propuesta_singular') : t('propuesta_plural', { n: propuestasPendientes })}
                </Text>
                <Text style={ss.alertaSub}>{t('respondelas')}</Text>
              </View>
              <Text style={{ fontSize: 22, color: '#E65100', fontWeight: '700' }}>›</Text>
            </TouchableOpacity>
          )}

          {/* ── Bloques de concursos: solo para trabajadores ── */}
          {esWorker&&(<>
            <SectorCard
              icon="🏛️"
              badge={matchesPublicos.length > 0
                ? t('badge_compatibles', { n: matchesPublicos.length })
                : t('badge_activos', { n: totalConcursos })}
              title={t('bloque_publico_titulo')}
              sub={matchesPublicos.length > 0
                ? t('bloque_publico_sub_matches', { n: matchesPublicos.length })
                : t('bloque_publico_sub_todos')}
              color={COLORS.coral}
              onPress={() => irAConcursa({ presetFiltro: 'para_vos', presetSector: 'publico' })}
            />
            <View style={{ marginBottom: SIZES.md }}>
              <SectorCard
                icon="💼"
                badge={matchesPrivados.length > 0
                  ? t('badge_compatibles', { n: matchesPrivados.length })
                  : t('badge_sector_privado')}
                title={t('bloque_privado_titulo')}
                sub={matchesPrivados.length > 0
                  ? t('bloque_privado_sub_matches', { n: matchesPrivados.length })
                  : t('bloque_privado_sub_todos')}
                color="#E65100"
                onPress={() => irAConcursa({ presetFiltro: 'para_vos', presetSector: 'privado' })}
              />
            </View>
          </>)}

          {!esWorker&&<EmpleadorCards navigation={navigation}/>}

          <FraseDiaria />

          <View style={{ height: 100 }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  // Header
  header: {
    paddingHorizontal: SIZES.md, paddingTop: SIZES.md, paddingBottom: SIZES.lg,
    borderBottomLeftRadius: SIZES.radiusXl, borderBottomRightRadius: SIZES.radiusXl,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.md },
  greeting: { color: 'rgba(26,58,92,0.6)', fontSize: SIZES.textSm, fontWeight: '500' },
  name:     { color: '#1A3A5C', fontSize: SIZES.textXl, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellWrap: { position: 'relative' },
  bell:     { fontSize: 22 },
  bellDot:  { position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.coral, borderWidth: 1.5, borderColor: COLORS.indigo },
  avatar:   { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.coral, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },

  // Status pill
  statusPill: {
    backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(26,58,92,0.15)',
    borderRadius: SIZES.radiusMd, padding: SIZES.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pillLabel:      { color: 'rgba(26,58,92,0.55)', fontSize: SIZES.textXs, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  pillActive:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillDot:        { width: 7, height: 7, borderRadius: 4 },
  pillActiveText: { color: '#1A3A5C', fontSize: SIZES.textMd, fontWeight: '700' },
  pillDays:       { color: 'rgba(26,58,92,0.5)', fontSize: SIZES.textXs, marginTop: 2 },
  pillStats:      { flexDirection: 'row', gap: 16 },
  pillStat:       { alignItems: 'center' },
  pillNum:        { color: '#1A3A5C', fontSize: 26, fontWeight: '900', letterSpacing: -1, lineHeight: 28 },
  pillStatLbl:    { color: 'rgba(26,58,92,0.55)', fontSize: SIZES.textXs, fontWeight: '600' },

  body: { padding: SIZES.md, paddingTop: SIZES.md },

  // Alertas
  alertaBanner: {
    backgroundColor: '#FFF3E0', borderRadius: SIZES.radiusMd, padding: SIZES.md,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SIZES.md,
    borderWidth: 1, borderColor: '#FFCC80',
  },
  alertaTit: { fontSize: SIZES.textMd, fontWeight: '700', color: '#E65100' },
  alertaSub: { fontSize: SIZES.textSm, color: '#BF360C', marginTop: 2 },

  // Sector cards
  sectorCard: {
    borderRadius: SIZES.radiusLg, padding: SIZES.md,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: SIZES.sm, ...SHADOWS.md,
  },
  sectorIcon:      { width: 40, height: 40, borderRadius: SIZES.radiusSm, alignItems: 'center', justifyContent: 'center' },
  sectorBadge:     { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 3 },
  sectorBadgeText: { color: COLORS.blanco, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  sectorTitle:     { color: COLORS.blanco, fontSize: SIZES.textMd, fontWeight: '700', marginBottom: 2 },
  sectorSub:       { color: 'rgba(255,255,255,0.45)', fontSize: SIZES.textSm },
  sectorArrow:     { color: 'rgba(255,255,255,0.3)', fontSize: 22, fontWeight: '700' },

  // Mini match cards
  matchMini: {
    backgroundColor: COLORS.blanco, borderRadius: SIZES.radiusMd,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 6, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.borde, ...SHADOWS.sm,
  },
  matchMiniStripe: { width: 3, alignSelf: 'stretch' },
  matchMiniIcon:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  matchMiniCargo:  { fontSize: SIZES.textSm, fontWeight: '700', color: COLORS.texto1 },
  matchMiniOrg:    { fontSize: SIZES.textXs, color: COLORS.texto3, marginTop: 1 },
  matchMiniArrow:  { fontSize: 18, color: COLORS.texto3, paddingRight: SIZES.sm },

  seccionLabel: { fontSize: SIZES.textXs, fontWeight: '700', color: COLORS.texto3, letterSpacing: 1, marginBottom: 6, marginTop: 4 },

  // Sin matches
  sinMatchesBanner: {
    backgroundColor: COLORS.indigoSoft, borderRadius: SIZES.radiusMd,
    padding: SIZES.md, marginTop: 6,
    borderWidth: 1, borderColor: COLORS.borde,
  },
  sinMatchesTit: { fontSize: SIZES.textSm, fontWeight: '700', color: COLORS.indigo, marginBottom: 3 },
  sinMatchesSub: { fontSize: SIZES.textSm, color: COLORS.texto2 },

  // Buscador
  buscadorCard: {
    backgroundColor: COLORS.blanco, borderRadius: SIZES.radiusLg,
    padding: SIZES.md, marginBottom: SIZES.md,
    borderWidth: 1, borderColor: COLORS.borde, ...SHADOWS.sm,
  },
  buscadorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SIZES.sm },
  buscadorTitle:  { fontSize: SIZES.textMd, fontWeight: '800', color: COLORS.texto1 },
  buscadorSub:    { fontSize: SIZES.textSm, color: COLORS.texto3 },
  buscadorInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.crema, borderRadius: SIZES.radiusMd,
    borderWidth: 1, borderColor: COLORS.borde,
    paddingHorizontal: SIZES.sm, paddingVertical: 10,
    marginBottom: SIZES.sm,
  },
  buscadorText: { flex: 1, fontSize: SIZES.textMd, color: COLORS.texto1, paddingHorizontal: 6 },
  modRow:   { flexDirection: 'row', gap: 6, marginBottom: SIZES.sm },
  modBtn:   { paddingHorizontal: 12, paddingVertical: 5, borderRadius: SIZES.radiusFull, borderWidth: 1, borderColor: COLORS.borde, backgroundColor: 'transparent' },
  modBtnActive:  { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo },
  modTxt:        { fontSize: SIZES.textSm, color: COLORS.texto3, fontWeight: '600' },
  modTxtActive:  { color: COLORS.blanco },
  buscadorBtn: {
    backgroundColor: COLORS.coral, borderRadius: SIZES.radiusFull,
    paddingVertical: 12, alignItems: 'center',
  },
  buscadorBtnText: { color: COLORS.blanco, fontWeight: '800', fontSize: SIZES.textMd },

  // Vistas
  vistasRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.blanco, borderRadius: SIZES.radiusMd,
    padding: SIZES.md, borderWidth: 1, borderColor: COLORS.borde, ...SHADOWS.sm,
    marginBottom: SIZES.sm,
  },
  vistasText: { flex: 1, fontSize: SIZES.textSm, color: COLORS.texto2, lineHeight: 18 },

  fraseBanner: {
    borderRadius: SIZES.radiusLg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 14,
    marginBottom: SIZES.sm,
    ...SHADOWS.md,
  },
  fraseIcon:  { fontSize: 22, marginTop: 2 },
  fraseLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  fraseTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', lineHeight: 24, letterSpacing: -0.2 },
  fraseAutor: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600', textAlign: 'right', marginTop: 10 },
});
