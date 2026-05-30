import React, { useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity,
  StyleSheet, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../services/supabase';
import { useI18n } from '../services/I18nContext';

const CATEGORIAS_DEF = [
  { key: 'sop_cat_cuenta',   emoji: '👤' },
  { key: 'sop_cat_pago',     emoji: '💳' },
  { key: 'sop_cat_tecnico',  emoji: '🔧' },
  { key: 'sop_cat_otro',     emoji: '💬' },
];

export default function SoporteModal({ visible, onClose, email, nombre }) {
  const { t } = useI18n();
  const [catActiva, setCatActiva] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const CATEGORIAS = CATEGORIAS_DEF.map(c => ({ ...c, label: t(c.key) }));

  function reset() {
    setCatActiva(null);
    setMensaje('');
    setEnviando(false);
    setEnviado(false);
    onClose();
  }

  async function enviar() {
    if (!mensaje.trim()) {
      Alert.alert(t('sop_mensaje_vacio_tit'), t('sop_mensaje_vacio_msg'));
      return;
    }
    setEnviando(true);
    try {
      const { error } = await supabase.functions.invoke('enviar-soporte', {
        body: {
          email,
          nombre,
          mensaje: mensaje.trim(),
          categoria: catActiva ? t(catActiva) : null,
        },
      });
      if (error) throw error;
      setEnviado(true);
    } catch (e) {
      console.log('soporte error:', e.message);
      Alert.alert(t('error'), t('sop_error_msg'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={reset}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={ss.backdrop} onPress={reset}>
          <Pressable style={ss.sheet} onPress={() => {}}>
            <View style={ss.handle} />

            {enviado ? (
              <View style={ss.exitoWrap}>
                <Text style={ss.exitoEmoji}>✅</Text>
                <Text style={ss.exitoTit}>{t('sop_enviado_tit')}</Text>
                <Text style={ss.exitoSub}>{t('sop_enviado_msg', { email })}</Text>
                <TouchableOpacity style={ss.cerrarBtn} onPress={reset}>
                  <Text style={ss.cerrarBtnTxt}>{t('ok')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={ss.titulo}>{t('ayuda_soporte')}</Text>
                <Text style={ss.emailRow}>📧 {email}</Text>

                <Text style={ss.label}>{t('sop_categoria_lbl')}</Text>
                <View style={ss.catsRow}>
                  {CATEGORIAS.map(c => (
                    <TouchableOpacity
                      key={c.key}
                      style={[ss.catBtn, catActiva === c.key && ss.catBtnA]}
                      onPress={() => setCatActiva(catActiva === c.key ? null : c.key)}
                    >
                      <Text style={ss.catEmoji}>{c.emoji}</Text>
                      <Text style={[ss.catLbl, catActiva === c.key && ss.catLblA]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={ss.label}>{t('sop_mensaje_lbl')}</Text>
                <TextInput
                  style={ss.textarea}
                  multiline
                  numberOfLines={5}
                  placeholder={t('sop_mensaje_placeholder')}
                  placeholderTextColor="#A898B8"
                  value={mensaje}
                  onChangeText={setMensaje}
                  textAlignVertical="top"
                  maxLength={1000}
                />
                <Text style={ss.contador}>{mensaje.length}/1000</Text>

                <TouchableOpacity
                  style={[ss.enviarBtn, (!mensaje.trim() || enviando) && ss.enviarBtnDis]}
                  onPress={enviar}
                  disabled={!mensaje.trim() || enviando}
                >
                  {enviando
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={ss.enviarTxt}>{t('sop_enviar_btn')}</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity style={ss.cancelarBtn} onPress={reset}>
                  <Text style={ss.cancelarTxt}>{t('cancelar')}</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ss = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  handle:      { width: 40, height: 4, backgroundColor: '#EDE8E2', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  titulo:      { fontSize: 18, fontWeight: '800', color: '#1A1020', marginBottom: 4, letterSpacing: -0.3 },
  emailRow:    { fontSize: 13, color: '#A898B8', marginBottom: 16 },
  label:       { fontSize: 11, fontWeight: '700', color: '#A898B8', letterSpacing: 0.8, marginBottom: 8 },
  catsRow:     { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  catBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F8F5F2', borderWidth: 1.5, borderColor: 'transparent' },
  catBtnA:     { backgroundColor: '#FFF3F0', borderColor: '#E8785A' },
  catEmoji:    { fontSize: 16 },
  catLbl:      { fontSize: 13, fontWeight: '600', color: '#5A4E6A' },
  catLblA:     { color: '#E8785A' },
  textarea:    { backgroundColor: '#F8F5F2', borderRadius: 12, borderWidth: 1.5, borderColor: '#EDE8E2', padding: 14, fontSize: 14, color: '#1A1020', minHeight: 120, lineHeight: 20 },
  contador:    { fontSize: 11, color: '#A898B8', textAlign: 'right', marginTop: 4, marginBottom: 16 },
  enviarBtn:   { backgroundColor: '#E8785A', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  enviarBtnDis:{ opacity: 0.5 },
  enviarTxt:   { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  cancelarBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelarTxt: { fontSize: 14, fontWeight: '600', color: '#A898B8' },
  exitoWrap:   { alignItems: 'center', paddingVertical: 24 },
  exitoEmoji:  { fontSize: 52, marginBottom: 16 },
  exitoTit:    { fontSize: 20, fontWeight: '900', color: '#1A1020', marginBottom: 8 },
  exitoSub:    { fontSize: 14, color: '#A898B8', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  cerrarBtn:   { backgroundColor: '#E8785A', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  cerrarBtnTxt:{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
