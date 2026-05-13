// src/screens/HomeScreen.js
// Pantalla de inicio del trabajador
// Imágenes 1 y 2: header azul índigo + cards de novedades

import React, { useState, useEffect } from 'react';
import{supabase}from '../services/supabase';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

const { width } = Dimensions.get('window');

// ── Componente: Header ──
function HomeHeader({ nombre, activo, diasRestantes, vistas, contactos, onActivar, avatar }) {
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <LinearGradient
      colors={['#D6E4F0', '#B8D4E8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.header}
    >
      {/* Saludo + avatar */}
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.greeting}>{saludo}</Text>
          <Text style={styles.name}>{nombre ? `Hola, ${nombre} 👋` : 'Hola 👋'}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.bellWrap}>
            <Text style={styles.bell}>🔔</Text>
            <View style={styles.bellDot} />
          </TouchableOpacity>
          <View style={styles.avatar}>
            {avatar
              ? <Image source={{ uri: avatar }} style={{ width: 38, height: 38, borderRadius: 19 }} />
              : <Text style={{ fontSize: 18 }}>👤</Text>
            }
          </View>
        </View>
      </View>

      {/* Pill de estado del perfil */}
      <TouchableOpacity style={styles.statusPill} onPress={onActivar} activeOpacity={0.85}>
        <View style={styles.pillLeft}>
          <Text style={styles.pillLabel}>MI PERFIL</Text>
          <View style={styles.pillActive}>
            <View style={[styles.pillDot, { backgroundColor: activo ? COLORS.menta : '#EF4444' }]} />
            <Text style={styles.pillActiveText}>{activo ? 'Activo' : 'Inactivo'}</Text>
          </View>
          {activo && diasRestantes > 0
            ? <Text style={styles.pillDays}>{diasRestantes} días restantes</Text>
            : !activo
              ? <Text style={[styles.pillDays, { color: '#EF444488' }]}>Tocá para activar</Text>
              : null
          }
        </View>
        <View style={styles.pillStats}>
          <View style={styles.pillStat}>
            <Text style={styles.pillNum}>{vistas}</Text>
            <Text style={styles.pillStatLbl}>Vistas</Text>
          </View>
          <View style={styles.pillStat}>
            <Text style={styles.pillNum}>{contactos}</Text>
            <Text style={styles.pillStatLbl}>Contactos</Text>
          </View>
        </View>
      </TouchableOpacity>
    </LinearGradient>
  );
}

// ── Componente: Card de Concursa ──
function ConcursaCard({ onPress, total, proximoCierre }) {
  const label = total > 0 ? `${total} LLAMADOS` : 'VER LLAMADOS';
  const sub = proximoCierre
    ? `Cierra en ${proximoCierre} días`
    : 'Llamados públicos activos';
  return (
    <TouchableOpacity
      style={styles.concursaCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.concursaIcon}>
        <Text style={{ fontSize: 20 }}>🏛️</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.concursaBadge}>
          <Text style={styles.concursaBadgeText}>{label}</Text>
        </View>
        <Text style={styles.concursaTitle}>Concursos para tu perfil</Text>
        <Text style={styles.concursaSub}>{sub}</Text>
      </View>
      <Text style={styles.concursaArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ── Componente: Card de novedad ──
function NovedadCard({ icon, company, role, tag, tagColor, tagBg, time, btnLabel, btnColor, onPress }) {
  return (
    <View style={styles.card}>
      {/* Barra lateral de color */}
      <View style={[styles.cardStripe, { backgroundColor: tagColor }]} />

      {/* Ícono */}
      <View style={[styles.cardIcon, { backgroundColor: tagBg + '33' }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>

      {/* Contenido */}
      <View style={{ flex: 1 }}>
        <Text style={styles.cardCompany}>{company}</Text>
        <Text style={styles.cardRole}>{role}</Text>
        <View style={[styles.tag, { backgroundColor: tagBg }]}>
          <Text style={[styles.tagText, { color: tagColor }]}>{tag}</Text>
        </View>
      </View>

      {/* Tiempo o botón */}
      {time ? (
        <Text style={styles.cardTime}>{time}</Text>
      ) : (
        <TouchableOpacity
          style={[styles.cardBtn, { backgroundColor: btnColor || COLORS.indigo }]}
          onPress={onPress}
        >
          <Text style={styles.cardBtnText}>{btnLabel} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Pantalla principal ──
export default function HomeScreen({ navigation }) {
  const [perfil, setPerfil] = useState({
    nombre: '', activo: false, diasRestantes: 0, vistas: 0, contactos: 0, avatar: null,
  });
  const [concursaStats, setConcursaStats] = useState({ total: 0, proximoCierre: null });
  const [topMatches, setTopMatches] = useState([]);
  const [propuestasPendientes, setPropuestasPendientes] = useState(0);

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
      const diasRestantes = hasta
        ? Math.max(0, Math.ceil((hasta - new Date()) / (1000 * 60 * 60 * 24)))
        : 0;
      const activo = data.perfil_activo && diasRestantes > 0;

      setPerfil({
        nombre: data.nombre || '',
        activo, diasRestantes,
        vistas: data.vistas || 0,
        contactos: data.contactos || 0,
        avatar: data.avatar_url || null,
      });

      if (data.rol === 'worker' && data.pais) {
        const PAIS_ISO = { 'uruguay':'UY','argentina':'AR','chile':'CL','colombia':'CO','peru':'PE','perú':'PE','brasil':'BR','brazil':'BR','paraguay':'PY' };
        const paisISO = PAIS_ISO[(data.pais||'').toLowerCase().trim()] || data.pais.slice(0,2).toUpperCase();

        // Total concursos activos del país
        const { data: cs } = await supabase
          .from('concursos').select('fecha_cierre').eq('pais', paisISO).eq('activo', true);
        if (cs) {
          const hoy = new Date();
          const vigentes = cs.filter(c => !c.fecha_cierre || new Date(c.fecha_cierre) >= hoy);
          const prox = vigentes.filter(c => c.fecha_cierre)
            .map(c => Math.ceil((new Date(c.fecha_cierre) - hoy) / (1000*60*60*24)))
            .filter(d => d >= 0).sort((a,b) => a-b)[0] ?? null;
          setConcursaStats({ total: vigentes.length, proximoCierre: prox });
        }

        // Top 3 matches para este worker
        const { data: matches } = await supabase
          .from('concurso_matches')
          .select('score, cumple, concursos(cargo, organismo, fecha_cierre, tipo_vinculo, pais)')
          .eq('worker_id', user.id)
          .eq('cumple', true)
          .order('score', { ascending: false })
          .limit(3);
        setTopMatches(matches || []);

        // Propuestas pendientes
        const { count } = await supabase
          .from('propuestas')
          .select('id', { count: 'exact', head: true })
          .eq('worker_id', user.id)
          .eq('estado', 'pendiente');
        setPropuestasPendientes(count || 0);
      }
    } catch (e) {}
  }

  useEffect(() => { cargar(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', cargar);
    return unsub;
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <HomeHeader
          nombre={perfil.nombre}
          activo={perfil.activo}
          diasRestantes={perfil.diasRestantes}
          vistas={perfil.vistas}
          contactos={perfil.contactos}
          onActivar={() => { if(!perfil.activo) navigation.navigate('PagoActivacion'); }}
          avatar={perfil.avatar}
        />

        {/* Body */}
        <View style={styles.body}>

          {/* Card Concursa */}
          <ConcursaCard
            onPress={() => navigation.navigate('Concursa')}
            total={concursaStats.total}
            proximoCierre={concursaStats.proximoCierre}
          />

          {/* Propuestas pendientes */}
          {propuestasPendientes > 0 && (
            <TouchableOpacity
              style={styles.alertaBanner}
              onPress={() => navigation.navigate('Mensajes')}
              activeOpacity={0.85}
            >
              <Text style={styles.alertaIcon}>📩</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertaTit}>
                  {propuestasPendientes === 1
                    ? 'Tenés 1 propuesta pendiente'
                    : `Tenés ${propuestasPendientes} propuestas pendientes`}
                </Text>
                <Text style={styles.alertaSub}>Respondelas antes de que venzan</Text>
              </View>
              <Text style={styles.alertaArrow}>›</Text>
            </TouchableOpacity>
          )}

          {/* Top matches */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>
              {topMatches.length > 0 ? 'Llamados compatibles' : 'Oportunidades'}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Concursa')}>
              <Text style={styles.verTodo}>Ver todo</Text>
            </TouchableOpacity>
          </View>

          {topMatches.length > 0 ? topMatches.map((m, i) => {
            const c = m.concursos;
            const esPrivado = c?.tipo_vinculo === 'privado';
            const dias = c?.fecha_cierre
              ? Math.ceil((new Date(c.fecha_cierre) - new Date()) / (1000*60*60*24))
              : null;
            return (
              <NovedadCard
                key={i}
                icon={esPrivado ? '💼' : '🏛️'}
                company={c?.organismo || (esPrivado ? 'Empresa privada' : 'Organismo público')}
                role={`${Math.round(m.score)}% compatible${dias !== null ? ` · Cierra en ${dias}d` : ''}`}
                tag={esPrivado ? 'Sector privado' : 'Sector público'}
                tagColor={esPrivado ? '#C2410C' : '#1565C0'}
                tagBg={esPrivado ? '#FFF3E0' : '#E3F2FD'}
                btnLabel="Ver"
                btnColor={COLORS.coral}
                onPress={() => navigation.navigate('Concursa')}
              />
            );
          }) : (
            <NovedadCard
              icon="🏛️"
              company="Sin matches aún"
              role="Completá tu perfil con profesiones para recibir matches"
              tag="Completar perfil"
              tagColor={COLORS.indigo}
              tagBg={COLORS.indigoSoft}
              btnLabel="Editar"
              btnColor={COLORS.indigo}
              onPress={() => navigation.navigate('EditarPerfil')}
            />
          )}

          {/* Vistas del perfil */}
          {perfil.vistas > 0 && (
            <NovedadCard
              icon="👁️"
              company="Tu perfil fue visto"
              role={`${perfil.vistas} empleadores vieron tu perfil · ${perfil.contactos} te contactaron`}
              tag={`${perfil.vistas} vistas`}
              tagColor={COLORS.coral}
              tagBg={COLORS.coralSoft}
              time={`${perfil.contactos} contactos`}
            />
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Estilos ──
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.crema,
  },

  // Header
  header: {
    paddingHorizontal: SIZES.md,
    paddingTop:  SIZES.md,
    paddingBottom: SIZES.lg,
    borderBottomLeftRadius:  SIZES.radiusXl,
    borderBottomRightRadius: SIZES.radiusXl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  greeting: {
    color: 'rgba(26,58,92,0.6)',
    fontSize: SIZES.textSm,
    fontWeight: '500',
  },
  name: {
    color: '#1A3A5C',
    fontSize: SIZES.textXl,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellWrap: {
    position: 'relative',
  },
  bell: {
    fontSize: 22,
  },
  bellDot: {
    position: 'absolute',
    top: -1, right: -1,
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.coral,
    borderWidth: 1.5,
    borderColor: COLORS.indigo,
  },
  avatar: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.coral,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },

  // Status pill
  statusPill: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(26,58,92,0.15)',
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pillLeft: {},
  pillLabel: {
    color: 'rgba(26,58,92,0.55)',
    fontSize: SIZES.textXs,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  pillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillDot: {
    width: 7, height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.menta,
  },
  pillActiveText: {
    color: '#1A3A5C',
    fontSize: SIZES.textMd,
    fontWeight: '700',
  },
  pillDays: {
    color: 'rgba(26,58,92,0.5)',
    fontSize: SIZES.textXs,
    marginTop: 2,
  },
  pillStats: {
    flexDirection: 'row',
    gap: 16,
  },
  pillStat: {
    alignItems: 'center',
  },
  pillNum: {
    color: '#1A3A5C',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 28,
  },
  pillStatLbl: {
    color: 'rgba(26,58,92,0.55)',
    fontSize: SIZES.textXs,
    fontWeight: '600',
  },

  // Body
  body: {
    padding: SIZES.md,
    paddingTop: SIZES.md,
  },

  // Concursa card
  concursaCard: {
    backgroundColor: COLORS.arena,
    borderRadius: SIZES.radiusLg,
    padding: SIZES.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: SIZES.md,
    ...SHADOWS.md,
  },
  concursaIcon: {
    width: 40, height: 40,
    backgroundColor: COLORS.coral,
    borderRadius: SIZES.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  concursaBadge: {
    backgroundColor: COLORS.coral,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 3,
  },
  concursaBadgeText: {
    color: COLORS.blanco,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  concursaTitle: {
    color: COLORS.blanco,
    fontSize: SIZES.textMd,
    fontWeight: '700',
    marginBottom: 2,
  },
  concursaSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: SIZES.textSm,
  },
  concursaArrow: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 22,
    fontWeight: '700',
  },

  alertaBanner: {
    backgroundColor: '#FFF3E0', borderRadius: SIZES.radiusMd,
    padding: SIZES.md, flexDirection: 'row', alignItems: 'center',
    gap: 12, marginBottom: SIZES.md,
    borderWidth: 1, borderColor: '#FFCC80',
  },
  alertaIcon: { fontSize: 24 },
  alertaTit:  { fontSize: SIZES.textMd, fontWeight: '700', color: '#E65100' },
  alertaSub:  { fontSize: SIZES.textSm, color: '#BF360C', marginTop: 2 },
  alertaArrow:{ fontSize: 22, color: '#E65100', fontWeight: '700' },

  // Sección
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  sectionTitle: {
    fontSize: SIZES.textLg,
    fontWeight: '800',
    color: COLORS.texto1,
  },
  verTodo: {
    fontSize: SIZES.textSm,
    fontWeight: '700',
    color: COLORS.indigo,
  },

  // Cards
  card: {
    backgroundColor: COLORS.blanco,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.borde,
    position: 'relative',
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  cardStripe: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 3,
    borderTopLeftRadius: SIZES.radiusMd,
    borderBottomLeftRadius: SIZES.radiusMd,
  },
  cardIcon: {
    width: 38, height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  cardCompany: {
    fontSize: SIZES.textMd,
    fontWeight: '700',
    color: COLORS.texto1,
    marginBottom: 2,
  },
  cardRole: {
    fontSize: SIZES.textSm,
    color: COLORS.texto3,
    marginBottom: 6,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardTime: {
    fontSize: 10,
    color: COLORS.texto3,
    marginLeft: 'auto',
  },
  cardBtn: {
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 'auto',
  },
  cardBtnText: {
    color: COLORS.blanco,
    fontSize: 10,
    fontWeight: '700',
  },
});
