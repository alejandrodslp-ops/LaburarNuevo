import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { supabase } from '../services/supabase';

async function getPushToken() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return null;
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch { return null; }
}

export default function WaitlistScreen({ navigation, route }) {
  const emailInicial = route?.params?.email ?? '';
  const rolParam     = route?.params?.role  ?? 'worker';

  const [email,    setEmail]    = useState(emailInicial);
  const [nombre,   setNombre]   = useState('');
  const [loading,  setLoading]  = useState(!!emailInicial);
  const [posicion, setPosicion] = useState(null);
  const [habilitado, setHabilitado] = useState(false);
  const [yaEstaba,   setYaEstaba]   = useState(false);

  useEffect(() => {
    if (emailInicial) consultarEstado(emailInicial);
  }, []);

  async function consultarEstado(em) {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('waitlist', {
        body: { accion: 'consultar', email: em.toLowerCase().trim() },
      });
      if (data?.en_lista) {
        setPosicion(data.posicion);
        setHabilitado(data.habilitado);
        setYaEstaba(true);
      }
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }

  async function unirse() {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Email inválido', 'Ingresá un email válido.');
      return;
    }
    setLoading(true);
    try {
      const pushToken = await getPushToken();
      const { data, error } = await supabase.functions.invoke('waitlist', {
        body: { accion: 'unirse', email: email.trim().toLowerCase(), nombre: nombre.trim(), push_token: pushToken },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? 'Error');
      setPosicion(data.posicion);
      setHabilitado(data.habilitado);
      setYaEstaba(data.ya_estaba ?? false);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Pantalla de resultado ────────────────────────────────────────────────────
  if (posicion !== null) {
    return (
      <SafeAreaView style={ss.safe} edges={['top']}>
        <ScrollView contentContainerStyle={ss.center}>
          <Text style={ss.bigEmoji}>{habilitado ? '🎉' : '✅'}</Text>

          <Text style={ss.tit}>
            {habilitado
              ? '¡Tu lugar está listo!'
              : yaEstaba ? 'Ya estás en la lista' : '¡Quedaste anotado!'}
          </Text>

          {habilitado ? (
            <>
              <Text style={ss.sub}>Podés registrarte ahora mismo</Text>
              <TouchableOpacity
                style={ss.btnPrimario}
                onPress={() => navigation.navigate('Register', { role: rolParam })}
              >
                <Text style={ss.btnPrimarioTxt}>Registrarme ahora →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={ss.posCard}>
                <Text style={ss.posLabel}>Tu posición en la lista</Text>
                <Text style={ss.posNum}>#318 798</Text>
              </View>
              <Text style={ss.sub}>
                Ingresarás con los próximos 350.000{'\n'}Te avisamos cuando sea tu turno.
              </Text>
              <View style={ss.infoBox}>
                <Text style={ss.infoTxt}>
                  💡 Activá las notificaciones para que te avisemos cuando podés entrar
                </Text>
              </View>
            </>
          )}

          <TouchableOpacity style={ss.volverBtn} onPress={() => navigation.goBack()}>
            <Text style={ss.volverTxt}>← Volver</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Pantalla de inscripción ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={ss.safe} edges={['top']}>
      <ScrollView contentContainerStyle={ss.center} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={ss.backBtn}>
          <Text style={ss.backTxt}>← Volver</Text>
        </TouchableOpacity>

        <Text style={ss.bigEmoji}>🚀</Text>
        <Text style={ss.tit}>Konexu está llegando</Text>
        <Text style={ss.sub}>
          Hay mucha demanda. Anotate y te avisamos cuando sea tu turno.
        </Text>

        <View style={ss.formCard}>
          <Text style={ss.lbl}>Nombre</Text>
          <TextInput
            style={ss.input}
            placeholder="Tu nombre"
            placeholderTextColor="#A898B8"
            value={nombre}
            onChangeText={setNombre}
            autoCapitalize="words"
          />
          <Text style={ss.lbl}>Email</Text>
          <TextInput
            style={ss.input}
            placeholder="tu@email.com"
            placeholderTextColor="#A898B8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[ss.btnPrimario, (!email.trim() || loading) && ss.btnDis]}
            onPress={unirse}
            disabled={!email.trim() || loading}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={ss.btnPrimarioTxt}>Quiero mi lugar →</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={ss.nota}>
          🔔 Te pedimos permiso de notificaciones para avisarte cuando sea tu turno
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#FBF8F4' },
  center:       { flexGrow: 1, alignItems: 'center', paddingHorizontal: 28, paddingBottom: 40, paddingTop: 20 },
  backBtn:      { alignSelf: 'flex-start', marginBottom: 24 },
  backTxt:      { fontSize: 14, fontWeight: '700', color: '#2DD4BF' },
  bigEmoji:     { fontSize: 64, marginBottom: 16 },
  tit:          { fontSize: 28, fontWeight: '900', color: '#1A1020', textAlign: 'center', letterSpacing: -0.5, marginBottom: 10 },
  sub:          { fontSize: 14, color: '#5A4E6A', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  formCard:     { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#EDE8E2', marginBottom: 16 },
  lbl:          { fontSize: 12, fontWeight: '700', color: '#5A4E6A', marginBottom: 6, marginTop: 4 },
  input:        { backgroundColor: '#F8F5F2', borderRadius: 12, borderWidth: 1.5, borderColor: '#EDE8E2', paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: '#1A1020', marginBottom: 12 },
  btnPrimario:  { width: '100%', backgroundColor: '#E8785A', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnPrimarioTxt:{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  btnDis:       { opacity: 0.4 },
  nota:         { fontSize: 12, color: '#A898B8', textAlign: 'center', lineHeight: 18 },
  posCard:      { backgroundColor: '#1A3A5C', borderRadius: 20, paddingVertical: 28, paddingHorizontal: 40, alignItems: 'center', marginBottom: 20 },
  posLabel:     { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 6, letterSpacing: 1 },
  posNum:       { fontSize: 48, fontWeight: '900', color: '#FFFFFF' },
  infoBox:      { backgroundColor: '#E6FBF5', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: '#3DA882', marginBottom: 24, width: '100%' },
  infoTxt:      { fontSize: 13, color: '#2E9472', lineHeight: 20 },
  volverBtn:    { marginTop: 8 },
  volverTxt:    { fontSize: 14, fontWeight: '700', color: '#A898B8' },
});
