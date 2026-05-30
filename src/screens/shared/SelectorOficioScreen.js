import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../services/I18nContext';
import { getProfesiones } from '../../data/profesiones';

export default function SelectorOficioScreen({ navigation, route }) {
  const { idioma, t } = useI18n();
  const [busqueda, setBusqueda] = useState('');
  const onSelect = route?.params?.onSelect;
  const opcionesCustom = route?.params?.opciones;
  const tituloCustom = route?.params?.titulo || t('seleccionar_oficio');
  const placeholderCustom = route?.params?.placeholder || t('buscar_oficio');

  const lista = opcionesCustom || getProfesiones(idioma);
  const filtrados = busqueda.length > 0
    ? lista.filter(o => o.toLowerCase().includes(busqueda.toLowerCase()))
    : lista;

  function seleccionar(oficio) {
    if (onSelect) onSelect(oficio);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={ss.c}>
      <View style={ss.hdr}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={ss.cancelar}>{t('cancelar')}</Text>
        </TouchableOpacity>
        <Text style={ss.titulo}>{tituloCustom}</Text>
        <View style={{ width: 70 }} />
      </View>
      <View style={ss.searchBox}>
        <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
        <TextInput
          style={ss.searchInput}
          placeholder={placeholderCustom}
          placeholderTextColor="#A898B8"
          value={busqueda}
          onChangeText={setBusqueda}
          autoFocus
          autoCorrect={false}
        />
        {busqueda.length > 0 && (
          <TouchableOpacity onPress={() => setBusqueda('')}>
            <Text style={{ fontSize: 16, color: '#A898B8' }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      {busqueda.length > 0 && !filtrados.includes(busqueda) && (
        <TouchableOpacity style={ss.usarBtn} onPress={() => seleccionar(busqueda)}>
          <Text style={ss.usarTxt}>Usar "{busqueda}"</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={filtrados}
        keyExtractor={item => item}
        renderItem={({ item }) => (
          <TouchableOpacity style={ss.item} onPress={() => seleccionar(item)}>
            <Text style={ss.itemTxt}>{item}</Text>
            <Text style={ss.itemFlecha}>›</Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={ss.sep} />}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#FBF8F4' },
  hdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EDE8E2' },
  cancelar: { fontSize: 14, fontWeight: '700', color: '#2DD4BF' },
  titulo: { fontSize: 16, fontWeight: '800', color: '#1A1020' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', margin: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: '#EDE8E2' },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1020' },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF' },
  itemTxt: { fontSize: 15, color: '#1A1020' },
  itemFlecha: { fontSize: 20, color: '#A898B8' },
  sep: { height: 1, backgroundColor: '#EDE8E2', marginLeft: 16 },
  usarBtn: { marginHorizontal: 12, marginBottom: 4, padding: 14, backgroundColor: '#E8F8F7', borderRadius: 12, borderWidth: 1.5, borderColor: '#2DD4BF', alignItems: 'center' },
  usarTxt: { fontSize: 14, fontWeight: '700', color: '#2DD4BF' },
});
