import React, { useState, useRef } from 'react';
import {
  Text, Modal, TextInput, TouchableOpacity,
  StyleSheet, Pressable, ActivityIndicator, Vibration,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ADMIN_SESSION_KEY = 'admin_sesion';
const ADMIN_PIN_KEY = 'admin_pin_local';
export const PIN_DEFAULT = 'nexu2024';

export async function tieneSessionAdmin() {
  try {
    const raw = await AsyncStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return false;
    const { expira } = JSON.parse(raw);
    return new Date(expira) > new Date();
  } catch {
    return false;
  }
}

export async function cerrarSesionAdmin() {
  await AsyncStorage.removeItem(ADMIN_SESSION_KEY);
}

export async function cambiarPinAdmin(nuevoPin) {
  await AsyncStorage.setItem(ADMIN_PIN_KEY, nuevoPin);
}

export default function PinAdminModal({ visible, onSuccess, onClose }) {
  const [pin, setPin]           = useState('');
  const [error, setError]       = useState('');
  const [cargando, setCargando] = useState(false);
  const [shake, setShake]       = useState(false);
  const inputRef = useRef(null);

  function resetY() { setPin(''); setError(''); }

  function triggerError(msg) {
    setError(msg);
    setPin('');
    Vibration.vibrate(200);
    setShake(true);
    setTimeout(() => setShake(false), 500);
    inputRef.current?.focus();
  }

  async function verificar() {
    if (!pin.trim()) return;
    setCargando(true);
    setError('');
    try {
      const guardado = await AsyncStorage.getItem(ADMIN_PIN_KEY);
      const pinCorrecto = guardado ?? PIN_DEFAULT;
      if (pin.trim() !== pinCorrecto) {
        triggerError('Clave incorrecta');
        return;
      }
      const expira = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await AsyncStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ expira }));
      resetY();
      onSuccess();
    } catch {
      triggerError('Error al verificar');
    } finally {
      setCargando(false);
    }
  }

  function cerrar() { resetY(); onClose(); }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cerrar}>
      <KeyboardAvoidingView
        style={ss.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={ss.backdropTouch} onPress={cerrar}>
          <ScrollView
            contentContainerStyle={ss.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable style={[ss.card, shake && ss.shake]} onPress={() => {}}>
              <Text style={ss.emoji}>⚙️</Text>
              <Text style={ss.titulo}>Acceso administrador</Text>
              <Text style={ss.sub}>Ingresá tu clave especial de admin</Text>

              <TextInput
                ref={inputRef}
                style={[ss.input, error ? ss.inputError : null]}
                placeholder="••••••••"
                placeholderTextColor="#A898B8"
                secureTextEntry
                value={pin}
                onChangeText={v => { setPin(v); setError(''); }}
                autoFocus
                onSubmitEditing={verificar}
                returnKeyType="done"
                maxLength={64}
              />

              {error ? <Text style={ss.errorTxt}>{error}</Text> : null}

              <TouchableOpacity
                style={[ss.btn, (!pin.trim() || cargando) && ss.btnDis]}
                onPress={verificar}
                disabled={!pin.trim() || cargando}
              >
                {cargando
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={ss.btnTxt}>Ingresar →</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={ss.cancelarBtn} onPress={cerrar}>
                <Text style={ss.cancelarTxt}>Cancelar</Text>
              </TouchableOpacity>

              <Text style={ss.sesionTxt}>Sesión válida por 30 min</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ss = StyleSheet.create({
  backdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  backdropTouch: { flex: 1 },
  scroll:        { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  card:          { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center' },
  shake:       { transform: [{ translateX: 6 }] },
  emoji:       { fontSize: 44, marginBottom: 12 },
  titulo:      { fontSize: 20, fontWeight: '900', color: '#1A3A5C', marginBottom: 6, textAlign: 'center' },
  sub:         { fontSize: 13, color: '#A898B8', marginBottom: 24, textAlign: 'center' },
  input:       { width: '100%', backgroundColor: '#F8F5F2', borderRadius: 14, borderWidth: 2, borderColor: '#EDE8E2', paddingHorizontal: 18, paddingVertical: 14, fontSize: 18, letterSpacing: 4, color: '#1A1020', textAlign: 'center', marginBottom: 8 },
  inputError:  { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  errorTxt:    { fontSize: 13, color: '#EF4444', fontWeight: '600', marginBottom: 12 },
  btn:         { width: '100%', backgroundColor: '#1A3A5C', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnDis:      { opacity: 0.4 },
  btnTxt:      { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  cancelarBtn: { paddingVertical: 12, marginTop: 4 },
  cancelarTxt: { fontSize: 13, color: '#A898B8', fontWeight: '600' },
  sesionTxt:   { fontSize: 10, color: '#D0C8DC', marginTop: 12 },
});
