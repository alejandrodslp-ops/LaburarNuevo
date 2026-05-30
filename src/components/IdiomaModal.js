import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useI18n } from '../services/I18nContext';

// Config central de idiomas — para agregar un nuevo idioma: añadir aquí y en I18nContext.js
export const IDIOMAS_DISPONIBLES = [
  { code: 'es', nombre: 'Español',    bandera: '🇺🇾', region: 'América Latina', abrev: 'ES',  disponible: true },
  { code: 'pt', nombre: 'Português',  bandera: '🇧🇷', region: 'Brasil',         abrev: 'PT',  disponible: true },
  { code: 'en', nombre: 'English',    bandera: '🇬🇧', region: 'Global',         abrev: 'EN',  disponible: true },
  { code: 'de', nombre: 'Deutsch',    bandera: '🇩🇪', region: 'Deutschland',    abrev: 'DE',  disponible: true },
  { code: 'fr', nombre: 'Français',   bandera: '🇫🇷', region: 'France',         abrev: 'FR',  disponible: true },
  { code: 'it', nombre: 'Italiano',   bandera: '🇮🇹', region: 'Italia',         abrev: 'IT',  disponible: true },
  { code: 'sv', nombre: 'Svenska',    bandera: '🇸🇪', region: 'Sverige',        abrev: 'SV',  disponible: true },
  { code: 'no', nombre: 'Norsk',      bandera: '🇳🇴', region: 'Norge',          abrev: 'NO',  disponible: true },
  { code: 'ja', nombre: '日本語',      bandera: '🇯🇵', region: '日本',           abrev: 'JA',  disponible: true },
  { code: 'hi', nombre: 'हिन्दी',      bandera: '🇮🇳', region: 'भारत',          abrev: 'HI',  disponible: true },
];

// ── Badge de idioma en el header (solo informativo, no interactivo) ──────────
export function IdiomaBoton({ style }) {
  const { idioma } = useI18n();
  const actual = IDIOMAS_DISPONIBLES.find(i => i.code === idioma);

  return (
    <View style={[ss.boton, style]}>
      <Text style={ss.botonFlag}>{actual?.bandera ?? '🌐'}</Text>
      <Text style={ss.botonLbl}>{actual?.abrev ?? 'ES'}</Text>
    </View>
  );
}

// ── Modal selector de idioma ─────────────────────────────────────────────────
export default function IdiomaModal({ visible, onClose }) {
  const { idioma, setIdioma } = useI18n();

  function seleccionar(code) {
    setIdioma(code);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={ss.backdrop} onPress={onClose}>
        <Pressable style={ss.sheet} onPress={() => {}}>
          <View style={ss.handle} />
          <Text style={ss.titulo}>Idioma / Language</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={ss.lista}>
          {IDIOMAS_DISPONIBLES.map(lang => {
            const esActivo = idioma === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[ss.opcion, esActivo && ss.opcionActiva, !lang.disponible && ss.opcionDeshabilitada]}
                onPress={() => lang.disponible && seleccionar(lang.code)}
                activeOpacity={lang.disponible ? 0.75 : 1}
              >
                <Text style={ss.opcionFlag}>{lang.bandera}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[ss.opcionNombre, esActivo && ss.opcionNombreActivo, !lang.disponible && ss.opcionNombreDeshabilitado]}>
                    {lang.nombre}
                  </Text>
                  <Text style={[ss.opcionRegion, !lang.disponible && ss.opcionNombreDeshabilitado]}>
                    {lang.region}
                  </Text>
                </View>
                {esActivo && <Text style={ss.checkmark}>✓</Text>}
                {!lang.disponible && <Text style={ss.proximamente}>Pronto</Text>}
              </TouchableOpacity>
            );
          })}
          </ScrollView>

          <TouchableOpacity style={ss.cerrar} onPress={onClose}>
            <Text style={ss.cerrarTxt}>Cerrar / Fechar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ss = StyleSheet.create({
  // Botón de header
  boton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(26,58,92,0.18)',
  },
  botonFlag:  { fontSize: 15 },
  botonLbl:   { fontSize: 11, fontWeight: '700', color: '#1A3A5C', letterSpacing: 0.3 },
  botonArrow: { fontSize: 9, color: '#1A3A5C', marginTop: 1 },

  // Modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36,
    maxHeight: '88%',
  },
  lista: { flexGrow: 0 },
  handle: { width: 40, height: 4, backgroundColor: '#EDE8E2', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  titulo: { fontSize: 18, fontWeight: '800', color: '#1A1020', marginBottom: 16, textAlign: 'center', letterSpacing: -0.3 },

  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
    marginBottom: 8, backgroundColor: '#F8F5F2',
    borderWidth: 2, borderColor: 'transparent',
  },
  opcionActiva:          { backgroundColor: '#FFF3F0', borderColor: '#E8785A' },
  opcionDeshabilitada:   { opacity: 0.4 },
  opcionFlag:            { fontSize: 32 },
  opcionNombre:          { fontSize: 17, fontWeight: '700', color: '#1A1020' },
  opcionNombreActivo:    { color: '#E8785A' },
  opcionNombreDeshabilitado: { color: '#A898B8' },
  opcionRegion:          { fontSize: 12, color: '#A898B8', marginTop: 2 },
  checkmark:             { fontSize: 20, color: '#E8785A', fontWeight: '800' },
  proximamente:          { fontSize: 11, color: '#A898B8', fontWeight: '600', backgroundColor: '#EDE8E2', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },

  cerrar: { marginTop: 8, paddingVertical: 14, alignItems: 'center', backgroundColor: '#F2EDE6', borderRadius: 14 },
  cerrarTxt: { fontSize: 14, fontWeight: '700', color: '#A898B8' },
});
