// src/screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Image, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

const { width } = Dimensions.get('window');

// ── Header ──────────────────────────────────────────────────────────
function HomeHeader({ nombre, activo, diasRestantes, vistas, contactos, onActivar, avatar }) {
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  return (
    <LinearGradient colors={['#D6E4F0', '#B8D4E8']} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} style={ss.header}>
      <View style={ss.headerTop}>
        <View>
          <Text style={ss.greeting}>{saludo}</Text>
          <Text style={ss.name}>{nombre ? `Hola, ${nombre} 👋` : 'Hola 👋'}</Text>
        </View>
        <View style={ss.headerRight}>
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
      <TouchableOpacity style={ss.statusPill} onPress={onActivar} activeOpacity={0.85}>
        <View>
          <Text style={ss.pillLabel}>MI PERFIL</Text>
          <View style={ss.pillActive}>
            <View style={[ss.pillDot, { backgroundColor: activo ? COLORS.menta : '#EF4444' }]} />
            <Text style={ss.pillActiveText}>{activo ? 'Activo' : 'Inactivo'}</Text>
          </View>
          {activo && diasRestantes > 0
            ? <Text style={ss.pillDays}>{diasRestantes} días restantes</Text>
            : !activo ? <Text style={[ss.pillDays, { color: '#EF444488' }]}>Tocá para activar</Text>
            : null}
        </View>
        <View style={ss.pillStats}>
          <View style={ss.pillStat}>
            <Text style={ss.pillNum}>{vistas}</Text>
            <Text style={ss.pillStatLbl}>Vistas</Text>
          </View>
          <View style={ss.pillStat}>
            <Text style={ss.pillNum}>{contactos}</Text>
            <Text style={ss.pillStatLbl}>Contactos</Text>
          </View>
        </View>
      </TouchableOpacity>
    </LinearGradient>
  );
}

// ── Card banners de sector ───────────────────────────────────────────
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

// ── Mini card de match ───────────────────────────────────────────────
function MatchMini({ icon, company, cargo, score, dias, esPrivado, onPress }) {
  return (
    <TouchableOpacity style={ss.matchMini} onPress={onPress} activeOpacity={0.85}>
      <View style={[ss.matchMiniStripe, { backgroundColor: esPrivado ? '#E65100' : '#1565C0' }]} />
      <View style={[ss.matchMiniIcon, { backgroundColor: esPrivado ? '#FFF3E0' : '#E3F2FD' }]}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ss.matchMiniCargo} numberOfLines={1}>{cargo}</Text>
        <Text style={ss.matchMiniOrg} numberOfLines={1}>
          {company} · {Math.round(score)}% compatible{dias !== null ? ` · ${dias}d` : ''}
        </Text>
      </View>
      <Text style={ss.matchMiniArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ── Buscador ─────────────────────────────────────────────────────────
function BuscadorCard({ busqueda, onChangeBusqueda, modalidad, onChangeModalidad, onBuscar }) {
  const mods = [
    { val: 'todos',       label: 'Cualquiera' },
    { val: 'presencial',  label: 'Presencial' },
    { val: 'teletrabajo', label: 'Teletrabajo' },
  ];
  return (
    <View style={ss.buscadorCard}>
      <View style={ss.buscadorHeader}>
        <Text style={{ fontSize: 20 }}>🔍</Text>
        <View>
          <Text style={ss.buscadorTitle}>Búsqueda específica</Text>
          <Text style={ss.buscadorSub}>Buscá por cargo, habilidad o empresa</Text>
        </View>
      </View>
      <View style={ss.buscadorInput}>
        <TextInput
          style={ss.buscadorText}
          placeholder="Ej: contador, diseñador, abogado..."
          placeholderTextColor={COLORS.texto3}
          value={busqueda}
          onChangeText={onChangeBusqueda}
          returnKeyType="search"
          onSubmitEditing={onBuscar}
        />
        {busqueda.length > 0 && (
          <TouchableOpacity onPress={() => onChangeBusqueda('')}>
            <Text style={{ color: COLORS.texto3, fontSize: 18, paddingHorizontal: 4 }}>×</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={ss.modRow}>
        {mods.map(m => (
          <TouchableOpacity
            key={m.val}
            style={[ss.modBtn, modalidad === m.val && ss.modBtnActive]}
            onPress={() => onChangeModalidad(m.val)}
          >
            <Text style={[ss.modTxt, modalidad === m.val && ss.modTxtActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={ss.buscadorBtn} onPress={onBuscar} activeOpacity={0.85}>
        <Text style={ss.buscadorBtnText}>Buscar →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Pantalla principal ───────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const [perfil, setPerfil] = useState({ nombre: '', activo: false, diasRestantes: 0, vistas: 0, contactos: 0, avatar: null });
  const [matchesPublicos, setMatchesPublicos] = useState([]);
  const [matchesPrivados, setMatchesPrivados] = useState([]);
  const [totalConcursos, setTotalConcursos] = useState(0);
  const [propuestasPendientes, setPropuestasPendientes] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [modalidad, setModalidad] = useState('todos');

  async function cargar() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('nombre, perfil_activo, perfil_activo_hasta, vistas, contactos, avatar_url, pais, rol')
        .eq('id', user.id)
        .single();
      if (!data) return;

      const hasta = data.perfil_activo_hasta ? new Date(data.perfil_activo_hasta) : null;
      const diasRestantes = hasta ? Math.max(0, Math.ceil((hasta - new Date()) / (1000 * 60 * 60 * 24))) : 0;
      setPerfil({
        nombre: data.nombre || '',
        activo: data.perfil_activo && diasRestantes > 0,
        diasRestantes,
        vistas: data.vistas || 0,
        contactos: data.contactos || 0,
        avatar: data.avatar_url || null,
      });

      if (data.rol === 'worker' && data.pais) {
        const PAIS_ISO = { 'uruguay':'UY','argentina':'AR','chile':'CL','colombia':'CO','peru':'PE','perú':'PE','brasil':'BR','brazil':'BR','paraguay':'PY' };
        const paisISO = PAIS_ISO[(data.pais||'').toLowerCase().trim()] || data.pais.slice(0, 2).toUpperCase();

        // Total de concursos activos del país
        const { count } = await supabase
          .from('concursos')
          .select('id', { count: 'exact', head: true })
          .eq('pais', paisISO)
          .eq('activo', true);
        setTotalConcursos(count || 0);

        // Todos los matches compatibles del worker
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

        // Propuestas pendientes
        const { count: propCount } = await supabase
          .from('propuestas')
          .select('id', { count: 'exact', head: true })
          .eq('worker_id', user.id)
          .eq('estado', 'pendiente');
        setPropuestasPendientes(propCount || 0);
      }
    } catch (_) {}
  }

  useEffect(() => { cargar(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', cargar);
    return unsub;
  }, [navigation]);

  function irAConcursa(params) {
    navigation.navigate('Concursa', { screen: 'ConcursaMain', params });
  }

  function handleBuscar() {
    if (!busqueda.trim() && modalidad === 'todos') {
      irAConcursa({ presetFiltro: 'todos', presetSector: 'todos' });
      return;
    }
    irAConcursa({
      presetFiltro: 'todos',
      presetSector: 'todos',
      busqueda: busqueda.trim(),
      presetModalidad: modalidad,
    });
  }

  const diasFn = (fechaCierre) => fechaCierre
    ? Math.ceil((new Date(fechaCierre) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <SafeAreaView style={ss.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <HomeHeader
          nombre={perfil.nombre}
          activo={perfil.activo}
          diasRestantes={perfil.diasRestantes}
          vistas={perfil.vistas}
          contactos={perfil.contactos}
          onActivar={() => { if (!perfil.activo) navigation.navigate('PagoActivacion'); }}
          avatar={perfil.avatar}
        />

        <View style={ss.body}>

          {/* ── Alerta propuestas ── */}
          {propuestasPendientes > 0 && (
            <TouchableOpacity style={ss.alertaBanner} onPress={() => navigation.navigate('Mensajes')} activeOpacity={0.85}>
              <Text style={{ fontSize: 24 }}>📩</Text>
              <View style={{ flex: 1 }}>
                <Text style={ss.alertaTit}>
                  {propuestasPendientes === 1 ? 'Tenés 1 propuesta pendiente' : `Tenés ${propuestasPendientes} propuestas pendientes`}
                </Text>
                <Text style={ss.alertaSub}>Respondelas antes de que venzan</Text>
              </View>
              <Text style={{ fontSize: 22, color: '#E65100', fontWeight: '700' }}>›</Text>
            </TouchableOpacity>
          )}

          {/* ── Bloque 1: Concursos públicos ── */}
          <SectorCard
            icon="🏛️"
            badge={matchesPublicos.length > 0 ? `${matchesPublicos.length} COMPATIBLES` : `${totalConcursos} ACTIVOS`}
            title="Concursos para tu perfil"
            sub={matchesPublicos.length > 0 ? `${matchesPublicos.length} llamados compatibles · sector público` : 'Llamados públicos abiertos en tu país'}
            color={COLORS.coral}
            onPress={() => irAConcursa({ presetFiltro: 'para_vos', presetSector: 'publico' })}
          />

          {/* ── Bloque 2: Empleos privados ── */}
          <View style={{ marginBottom: SIZES.md }}>
            <SectorCard
              icon="💼"
              badge={matchesPrivados.length > 0 ? `${matchesPrivados.length} COMPATIBLES` : 'SECTOR PRIVADO'}
              title="Empleos del sector privado"
              sub={matchesPrivados.length > 0 ? `${matchesPrivados.length} empleos compatibles con tu perfil` : 'Empleos privados activos en tu país'}
              color="#E65100"
              onPress={() => irAConcursa({ presetFiltro: 'para_vos', presetSector: 'privado' })}
            />

            {/* Mini cards de matches privados */}
            {matchesPrivados.length > 0 && matchesPrivados.map((m, i) => {
              const c = m.concursos;
              const d = diasFn(c?.fecha_cierre);
              return (
                <MatchMini
                  key={i}
                  icon="💼"
                  company={c?.organismo || 'Empresa privada'}
                  cargo={c?.cargo || c?.titulo || ''}
                  score={m.score}
                  dias={d}
                  esPrivado
                  onPress={() => irAConcursa({ presetFiltro: 'para_vos', presetSector: 'privado' })}
                />
              );
            })}

            {/* Mini cards de matches públicos (si los hay) */}
            {matchesPublicos.length > 0 && (
              <View style={{ marginTop: SIZES.sm }}>
                <Text style={ss.seccionLabel}>LLAMADOS COMPATIBLES</Text>
                {matchesPublicos.map((m, i) => {
                  const c = m.concursos;
                  const d = diasFn(c?.fecha_cierre);
                  return (
                    <MatchMini
                      key={i}
                      icon="🏛️"
                      company={c?.organismo || 'Organismo público'}
                      cargo={c?.cargo || c?.titulo || ''}
                      score={m.score}
                      dias={d}
                      esPrivado={false}
                      onPress={() => irAConcursa({ presetFiltro: 'para_vos', presetSector: 'publico' })}
                    />
                  );
                })}
              </View>
            )}

            {matchesPublicos.length === 0 && matchesPrivados.length === 0 && (
              <TouchableOpacity
                style={ss.sinMatchesBanner}
                onPress={() => navigation.navigate('Cuenta', { screen: 'EditarPerfil' })}
                activeOpacity={0.85}
              >
                <Text style={ss.sinMatchesTit}>Completá tu perfil para ver matches</Text>
                <Text style={ss.sinMatchesSub}>Agregá profesiones y especialidades → Editar perfil →</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Bloque 3: Búsqueda específica ── */}
          <BuscadorCard
            busqueda={busqueda}
            onChangeBusqueda={setBusqueda}
            modalidad={modalidad}
            onChangeModalidad={setModalidad}
            onBuscar={handleBuscar}
          />

          {/* Vistas del perfil */}
          {perfil.vistas > 0 && (
            <View style={ss.vistasRow}>
              <Text style={{ fontSize: 20 }}>👁️</Text>
              <Text style={ss.vistasText}>
                Tu perfil fue visto por <Text style={{ fontWeight: '800', color: COLORS.texto1 }}>{perfil.vistas}</Text> empleadores
                {perfil.contactos > 0 ? ` · ${perfil.contactos} te contactaron` : ''}
              </Text>
            </View>
          )}

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.crema },

  // Header
  header: {
    paddingHorizontal: SIZES.md, paddingTop: SIZES.md, paddingBottom: SIZES.lg,
    borderBottomLeftRadius: SIZES.radiusXl, borderBottomRightRadius: SIZES.radiusXl,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.md },
  greeting: { color: 'rgba(26,58,92,0.6)', fontSize: SIZES.textSm, fontWeight: '500' },
  name:     { color: '#1A3A5C', fontSize: SIZES.textXl, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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

  // Sector cards (public / private banners)
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
});
