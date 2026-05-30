import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { useApp } from '../../services/AppContext';

const CATS = [
  { id: 'Limpieza del hogar', emoji: '🧹' },
  { id: 'Albañil',            emoji: '🏗️' },
  { id: 'Electricista',       emoji: '⚡' },
  { id: 'Plomero/a',          emoji: '🔧' },
  { id: 'Jardinero/a',        emoji: '🌿' },
  { id: 'Cocinero/a',         emoji: '🍳' },
  { id: 'Niñera',             emoji: '👶' },
  { id: 'Programador/a',      emoji: '💻' },
  { id: 'Contador/a',         emoji: '📊' },
  { id: 'Enfermero/a',        emoji: '🏥' },
  { id: 'Abogado/a',          emoji: '⚖️' },
  { id: 'Medico/a',           emoji: '🩺' },
];

const FREE_LIMIT = 3;

function estrellas(r) {
  const n = Math.round(r || 0);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function WorkerCard({ item, onPress }) {
  const oficio = item.servicios?.[0] || item.profesiones?.[0] || 'Profesional';
  const zona   = [item.barrio, item.ciudad, item.pais].filter(Boolean)[0] || '—';
  const tags   = [...(item.servicios || []).slice(0, 2), ...(item.especialidades || []).slice(0, 1)];

  return (
    <TouchableOpacity style={ss.card} onPress={onPress} activeOpacity={0.85}>
      <View style={ss.cardHeader}>
        <View style={ss.avatar}><Text style={ss.avatarIcon}>👤</Text></View>
        <View style={ss.cardInfo}>
          <Text style={ss.cardNombre}>{item.nombre || 'Trabajador'}</Text>
          <Text style={ss.cardOficio}>{oficio}</Text>
          <Text style={ss.cardZona}>📍 {zona}</Text>
        </View>
        {item.referencias && (
          <View style={ss.refBadge}><Text style={ss.refTxt}>✓ Ref</Text></View>
        )}
      </View>
      <View style={ss.ratingRow}>
        <Text style={ss.stars}>{estrellas(item.rating)}</Text>
        <Text style={ss.ratingNum}>{(item.rating || 0).toFixed(1)}</Text>
        <Text style={ss.ratingCount}>({item.total_valoraciones || 0})</Text>
        {item.disponibilidad && (
          <Text style={ss.disponib}>● {item.disponibilidad}</Text>
        )}
      </View>
      {tags.length > 0 && (
        <View style={ss.tagsRow}>
          {tags.map((tag, i) => (
            <View key={i} style={ss.tag}><Text style={ss.tagTxt}>{tag}</Text></View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

function LockedCard({ onPress }) {
  return (
    <TouchableOpacity style={[ss.card, ss.lockedCard]} onPress={onPress} activeOpacity={0.9}>
      <View style={ss.lockedRow}>
        <View style={ss.lockCircle}><Text style={ss.lockIcon}>🔒</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={ss.lockTitle}>Perfil bloqueado</Text>
          <Text style={ss.lockSub}>Activá tu suscripción para ver este perfil</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function BuscarEmpresaScreen({ navigation }) {
  const { suscripcionActiva } = useApp();
  const [query,     setQuery]     = useState('');
  const [catActiva, setCatActiva] = useState(null);
  const [todos,     setTodos]     = useState([]);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => { buscar('', catActiva); }, [catActiva]);

  async function buscar(q, cat) {
    setLoading(true);
    try {
      let req = supabase
        .from('profiles')
        .select('id,nombre,servicios,profesiones,especialidades,ciudad,barrio,pais,disponibilidad,rating,total_valoraciones,referencias')
        .eq('perfil_activo', true)
        .order('rating', { ascending: false })
        .limit(40);

      if (cat) req = req.contains('servicios', [cat]);

      const { data } = await req;
      let items = data || [];

      const lower = (q || '').toLowerCase().trim();
      if (lower) {
        items = items.filter(p =>
          (p.servicios     || []).some(s => s.toLowerCase().includes(lower)) ||
          (p.profesiones   || []).some(s => s.toLowerCase().includes(lower)) ||
          (p.especialidades|| []).some(s => s.toLowerCase().includes(lower)) ||
          (p.ciudad  || '').toLowerCase().includes(lower) ||
          (p.pais    || '').toLowerCase().includes(lower)
        );
      }

      setTodos(items);
    } catch (e) {
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit() {
    Keyboard.dismiss();
    buscar(query, catActiva);
  }

  function onClear() {
    setQuery('');
    buscar('', catActiva);
  }

  function irAPerfil(item) {
    navigation.getParent()?.navigate('PerfilTrabajador', { perfil: item });
  }

  function verPlanes() {
    navigation.getParent()?.navigate('BienvenidaEmpresa');
  }

  const visibles  = suscripcionActiva ? todos : todos.slice(0, FREE_LIMIT);
  const bloqueados = (!suscripcionActiva && todos.length > FREE_LIMIT)
    ? todos.length - FREE_LIMIT : 0;

  return (
    <SafeAreaView style={ss.container} edges={['top']}>

      {/* Header */}
      <View style={ss.header}>
        <Text style={ss.titulo}>Buscar talento</Text>
        {!loading && todos.length > 0 && (
          <Text style={ss.sub}>{todos.length} perfil{todos.length !== 1 ? 'es' : ''} disponible{todos.length !== 1 ? 's' : ''}</Text>
        )}
      </View>

      {/* Search input */}
      <View style={ss.searchWrap}>
        <Text style={ss.searchIcon}>🔍</Text>
        <TextInput
          style={ss.searchInput}
          placeholder="Buscar oficio, profesión, ciudad..."
          placeholderTextColor="#A898B8"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={onClear}>
            <Text style={ss.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={ss.catsScroll}
        contentContainerStyle={ss.catsContent}
      >
        <TouchableOpacity
          style={[ss.chip, !catActiva && ss.chipA]}
          onPress={() => setCatActiva(null)}
        >
          <Text style={[ss.chipTxt, !catActiva && ss.chipTxtA]}>Todos</Text>
        </TouchableOpacity>
        {CATS.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[ss.chip, catActiva === c.id && ss.chipA]}
            onPress={() => setCatActiva(catActiva === c.id ? null : c.id)}
          >
            <Text style={ss.chipEmoji}>{c.emoji}</Text>
            <Text style={[ss.chipTxt, catActiva === c.id && ss.chipTxtA]}>{c.id}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Gate banner */}
        {bloqueados > 0 && (
          <TouchableOpacity style={ss.gateBanner} onPress={verPlanes} activeOpacity={0.9}>
            <View style={{ flex: 1 }}>
              <Text style={ss.gateTitle}>+{bloqueados} perfiles más disponibles</Text>
              <Text style={ss.gateSub}>Activá tu plan para contactar sin límite</Text>
            </View>
            <View style={ss.gateBtn}><Text style={ss.gateBtnTxt}>Ver planes →</Text></View>
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#3DA882" style={{ marginTop: 40 }} />
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {visibles.map(item => (
              <WorkerCard key={item.id} item={item} onPress={() => irAPerfil(item)} />
            ))}
            {bloqueados > 0 && Array.from({ length: Math.min(2, bloqueados) }).map((_, i) => (
              <LockedCard key={'lock-' + i} onPress={verPlanes} />
            ))}
            {todos.length === 0 && !loading && (
              <View style={ss.empty}>
                <Text style={ss.emptyIcon}>🔍</Text>
                <Text style={ss.emptyTit}>Sin resultados</Text>
                <Text style={ss.emptySub}>Probá con otro oficio o cambiá los filtros</Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF8F4' },

  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#EDE8E2',
  },
  titulo: { fontSize: 24, fontWeight: '900', color: '#1A1020', marginBottom: 2 },
  sub:    { fontSize: 13, color: '#A898B8' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: '#EDE8E2',
  },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: '#1A1020' },
  clearBtn:    { fontSize: 14, color: '#A898B8', paddingHorizontal: 4 },

  catsScroll:   { flexGrow: 0 },
  catsContent:  { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#EDE8E2',
  },
  chipA:    { backgroundColor: '#E6FBF5', borderColor: '#3DA882' },
  chipEmoji:{ fontSize: 14 },
  chipTxt:  { fontSize: 13, fontWeight: '600', color: '#5A4E6A' },
  chipTxtA: { color: '#3DA882' },

  gateBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#FFF8E6', borderRadius: 14,
    padding: 14, borderWidth: 1.5, borderColor: '#F59E0B',
  },
  gateTitle:  { fontSize: 14, fontWeight: '800', color: '#1A1020', marginBottom: 2 },
  gateSub:    { fontSize: 12, color: '#5A4E6A' },
  gateBtn:    { backgroundColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  gateBtnTxt: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    marginBottom: 12, padding: 16,
    borderWidth: 1, borderColor: '#EDE8E2',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  avatar:     { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F2EDE6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarIcon: { fontSize: 22 },
  cardInfo:   { flex: 1 },
  cardNombre: { fontSize: 16, fontWeight: '800', color: '#1A1020', marginBottom: 2 },
  cardOficio: { fontSize: 14, color: '#3DA882', fontWeight: '600', marginBottom: 3 },
  cardZona:   { fontSize: 12, color: '#A898B8' },
  refBadge:   { backgroundColor: '#E6FBF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  refTxt:     { fontSize: 11, color: '#3DA882', fontWeight: '700' },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  stars:      { fontSize: 12, color: '#F59E0B' },
  ratingNum:  { fontSize: 13, fontWeight: '700', color: '#1A1020' },
  ratingCount:{ fontSize: 12, color: '#A898B8' },
  disponib:   { fontSize: 12, color: '#3DA882', marginLeft: 'auto' },
  tagsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag:        { backgroundColor: '#F2EDE6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagTxt:     { fontSize: 12, color: '#5A4E6A', fontWeight: '600' },

  lockedCard: { borderStyle: 'dashed', borderColor: '#D0C8DC', backgroundColor: '#FAFAFA' },
  lockedRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  lockCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F2EDE6', alignItems: 'center', justifyContent: 'center' },
  lockIcon:   { fontSize: 20 },
  lockTitle:  { fontSize: 14, fontWeight: '700', color: '#5A4E6A', marginBottom: 3 },
  lockSub:    { fontSize: 12, color: '#A898B8' },

  empty:    { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:{ fontSize: 48, marginBottom: 12 },
  emptyTit: { fontSize: 18, fontWeight: '800', color: '#1A1020', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#A898B8', textAlign: 'center' },
});
