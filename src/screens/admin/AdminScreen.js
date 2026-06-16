import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, Pressable, Alert, Dimensions,
} from 'react-native';
const SCREEN_H = Dimensions.get('window').height;
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase';
import { tieneSessionAdmin, cerrarSesionAdmin, cambiarPinAdmin, PIN_DEFAULT } from '../../components/PinAdminModal';
import { useI18n } from '../../services/I18nContext';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmt(n) { return n?.toLocaleString('es-UY') ?? '0'; }

const BANDERAS = { UY:'🇺🇾', AR:'🇦🇷', BR:'🇧🇷', CL:'🇨🇱', CO:'🇨🇴', PE:'🇵🇪', PY:'🇵🇾', BO:'🇧🇴', EC:'🇪🇨', VE:'🇻🇪', MX:'🇲🇽', CU:'🇨🇺', CR:'🇨🇷', GT:'🇬🇹', SV:'🇸🇻', HN:'🇭🇳', NI:'🇳🇮', PA:'🇵🇦', DO:'🇩🇴', ES:'🇪🇸', PT:'🇵🇹', IT:'🇮🇹', FR:'🇫🇷', DE:'🇩🇪', GB:'🇬🇧', US:'🇺🇸', CA:'🇨🇦', AU:'🇦🇺', SE:'🇸🇪', NO:'🇳🇴', JP:'🇯🇵', IN:'🇮🇳' };

const NOMBRES_PAISES = {
  UY:'Uruguay', AR:'Argentina', BR:'Brasil', CL:'Chile', CO:'Colombia', PE:'Perú',
  PY:'Paraguay', BO:'Bolivia', EC:'Ecuador', VE:'Venezuela', MX:'México', CU:'Cuba',
  CR:'Costa Rica', GT:'Guatemala', SV:'El Salvador', HN:'Honduras', NI:'Nicaragua',
  PA:'Panamá', DO:'Rep. Dominicana', ES:'España', PT:'Portugal', IT:'Italia',
  FR:'Francia', DE:'Alemania', GB:'Reino Unido', US:'EE. UU.', CA:'Canadá',
  AU:'Australia', SE:'Suecia', NO:'Noruega', CH:'Suiza', JP:'Japón', IN:'India',
};

function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-UY', { day:'2-digit', month:'2-digit', year:'2-digit' });
}
function diasRestantes(iso) {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso) - new Date()) / 86400000);
  return d > 0 ? d : 0;
}
function oficio(u) { return u?.servicios?.[0] || u?.profesiones?.[0] || '—'; }

// ─────────────────────────────────────────────────────────────────────────────
// Llamada a la Edge Function (service role → ve todos los datos sin RLS)
// ─────────────────────────────────────────────────────────────────────────────
async function callAdmin(accion, params = {}) {
  // Leer el access_token directamente del storage — funciona aunque GoTrueClient
  // haya borrado la sesión en memoria (504 en refresh). La edge function acepta tokens
  // expirados con firma HMAC válida.
  let token = null;
  try {
    const raw = await AsyncStorage.getItem('supabase.auth.token');
    if (raw) token = JSON.parse(raw).access_token;
  } catch {}
  if (!token) {
    try { token = await AsyncStorage.getItem('nexu_access_token'); } catch {}
  }
  const extraHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const { data, error } = await supabase.functions.invoke('admin-data', {
    body: { accion, params },
    headers: extraHeaders,
  });
  if (error) throw new Error(error.message ?? 'Error en la función');
  if (data?.error) throw new Error(data.error);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ emoji, label, value, color = '#1A3A5C', sub }) {
  return (
    <View style={[ss.statCard, { borderLeftColor: color }]}>
      <Text style={ss.statEmoji}>{emoji}</Text>
      <Text style={[ss.statVal, { color }]}>{fmt(value)}</Text>
      <Text style={ss.statLbl}>{label}</Text>
      {sub ? <Text style={ss.statSub}>{sub}</Text> : null}
    </View>
  );
}

function BarraH({ label, value, max, color = '#E8785A' }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={ss.barraWrap}>
      <View style={ss.barraLabel}>
        <Text style={ss.barraLblTxt} numberOfLines={1}>{label}</Text>
        <Text style={ss.barraCount}>{fmt(value)}</Text>
      </View>
      <View style={ss.barraTrack}>
        <View style={[ss.barraFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function UserCard({ u, onPress }) {
  const dias = diasRestantes(u.perfil_activo_hasta);
  return (
    <TouchableOpacity style={ss.userCard} onPress={() => onPress(u)} activeOpacity={0.8}>
      <View style={[ss.userAvatar, { backgroundColor: u.perfil_activo ? '#E6FBF5' : '#F2EDE6' }]}>
        <Text style={{ fontSize: 22 }}>{u.perfil_activo ? '✅' : '👤'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ss.userNombre} numberOfLines={1}>{u.nombre} {u.apellido1 ?? ''}</Text>
        <Text style={ss.userOficio} numberOfLines={1}>{oficio(u)}</Text>
        <Text style={ss.userZona} numberOfLines={1}>{[u.ciudad, u.pais].filter(Boolean).join(', ') || '—'}</Text>
        {u.email && u.email !== '—' && <Text style={ss.userEmail} numberOfLines={1}>{u.email}</Text>}
      </View>
      <View style={[ss.statusBadge, {
        backgroundColor: u.perfil_activo ? (dias != null && dias <= 3 ? '#FEF2F2' : '#E6FBF5') : '#F2EDE6',
        borderColor:     u.perfil_activo ? (dias != null && dias <= 3 ? '#EF4444' : '#22C55E') : '#A898B8',
      }]}>
        <Text style={[ss.statusTxt, {
          color: u.perfil_activo ? (dias != null && dias <= 3 ? '#EF4444' : '#22C55E') : '#A898B8',
        }]}>
          {u.perfil_activo
            ? dias == null ? 'Activo'
              : dias <= 0  ? 'Vence hoy'
              : `${dias}d restantes`
            : 'Inactivo'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ConcursoCard({ c, onPress }) {
  const dias = c.fecha_cierre ? Math.ceil((new Date(c.fecha_cierre) - new Date()) / 86400000) : null;
  const esPrivado = c.tipo_vinculo === 'privado';
  return (
    <TouchableOpacity style={ss.concursoCard} onPress={onPress} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <View style={[ss.tipoConcurso, esPrivado ? ss.tipoConcursoPriv : ss.tipoConcursoPub]}>
            <Text style={[ss.tipoTxt, { color: esPrivado ? '#E8785A' : '#3DA882' }]}>
              {esPrivado ? '🏢 Privado' : '🏛️ Público'}
            </Text>
          </View>
          {c.pais ? <Text style={{ fontSize: 10, color: '#A898B8', fontWeight: '600' }}>{BANDERAS[c.pais] ?? '🌍'} {c.pais}</Text> : null}
        </View>
        <Text style={ss.concursoTitle} numberOfLines={2}>{c.cargo || c.titulo || '—'}</Text>
        <Text style={ss.concursoOrg} numberOfLines={1}>{c.organismo || '—'}</Text>
        {c.lugar ? <Text style={ss.concursoLugar} numberOfLines={1}>📍 {c.lugar}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {dias != null ? (
          <View style={[ss.statusBadge, {
            backgroundColor: dias <= 2 ? '#FFF3E0' : dias <= 5 ? '#FFFDE7' : '#F0FDF4',
            borderColor:     dias <= 2 ? '#FF9800' : dias <= 5 ? '#FFC107' : '#22C55E',
          }]}>
            <Text style={[ss.statusTxt, { color: dias <= 2 ? '#FF9800' : dias <= 5 ? '#F59E0B' : '#22C55E' }]}>{dias > 0 ? `${dias}d` : 'Vencido'}</Text>
          </View>
        ) : null}
        <Text style={{ fontSize: 10, color: '#A898B8' }}>Ver →</Text>
      </View>
    </TouchableOpacity>
  );
}

function OfertaCard({ o }) {
  const dias = o.fecha_cierre ? Math.ceil((new Date(o.fecha_cierre) - new Date()) / 86400000) : null;
  const employer = o.profiles ?? {};
  const salario = o.salario_min
    ? `${o.moneda ?? 'USD'} ${fmt(o.salario_min)}${o.salario_max ? `–${fmt(o.salario_max)}` : '+'}`
    : null;
  return (
    <View style={ss.concursoCard}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <View style={[ss.tipoConcurso, ss.tipoConcursoPriv]}>
            <Text style={[ss.tipoTxt, { color: '#E8785A' }]}>🏢 Empleador</Text>
          </View>
          {o.pais ? <Text style={{ fontSize: 10, color: '#A898B8', fontWeight: '600' }}>{BANDERAS[o.pais] ?? '🌍'} {o.pais}</Text> : null}
          {o.modalidad ? <Text style={{ fontSize: 10, color: '#A898B8' }}>{o.modalidad}</Text> : null}
        </View>
        <Text style={ss.concursoTitle} numberOfLines={2}>{o.cargo || o.titulo || '—'}</Text>
        <Text style={ss.concursoOrg} numberOfLines={1}>
          {employer.nombre ? `${employer.nombre} ${employer.apellido1 ?? ''}`.trim() : '—'}
        </Text>
        {o.ciudad ? <Text style={ss.concursoLugar} numberOfLines={1}>📍 {o.ciudad}</Text> : null}
        {salario  ? <Text style={{ fontSize: 11, color: '#3DA882', fontWeight: '700', marginTop: 2 }}>{salario}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {dias != null && (
          <View style={[ss.statusBadge, {
            backgroundColor: dias <= 2 ? '#FFF3E0' : dias <= 5 ? '#FFFDE7' : '#F0FDF4',
            borderColor:     dias <= 2 ? '#FF9800' : dias <= 5 ? '#FFC107' : '#22C55E',
          }]}>
            <Text style={[ss.statusTxt, { color: dias <= 2 ? '#FF9800' : dias <= 5 ? '#F59E0B' : '#22C55E' }]}>{dias > 0 ? `${dias}d` : 'Vencida'}</Text>
          </View>
        )}
        {o.postulaciones > 0 && (
          <Text style={{ fontSize: 10, color: '#A898B8' }}>👤 {o.postulaciones}</Text>
        )}
      </View>
    </View>
  );
}

function DetalleModal({ visible, usuario, onClose }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [accionando, setAccionando] = useState(false);
  const [convs, setConvs] = useState(null);
  const [cargandoConvs, setCargandoConvs] = useState(false);
  const [hiloAbierto, setHiloAbierto] = useState(null); // { partner_id, nombre, mensajes }
  const [cargandoHilo, setCargandoHilo] = useState(false);
  const [msgVisible, setMsgVisible] = useState(false);
  const [msgTexto, setMsgTexto] = useState('');
  const [enviandoMsg, setEnviandoMsg] = useState(false);
  const [msgsNexu, setMsgsNexu] = useState(null);
  const [cargandoMsgs, setCargandoMsgs] = useState(false);

  useEffect(() => {
    if (visible && usuario?.id) {
      setCargando(true); setError('');
      callAdmin('detalle', { id: usuario.id })
        .then(setDatos)
        .catch(e => setError(e.message))
        .finally(() => setCargando(false));
    } else { setDatos(null); }
  }, [visible, usuario?.id]);

  async function cargarMensajesNexu() {
    setCargandoMsgs(true);
    try {
      const r = await callAdmin('listar_mensajes_nexu', { user_id: usuario?.id });
      setMsgsNexu(r.mensajes ?? []);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setCargandoMsgs(false); }
  }

  async function enviarMensaje() {
    if (!msgTexto.trim()) return;
    setEnviandoMsg(true);
    try {
      await callAdmin('enviar_mensaje_directo', { user_id: usuario?.id, texto: msgTexto.trim() });
      setMsgTexto('');
      setMsgVisible(false);
      cargarMensajesNexu();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setEnviandoMsg(false); }
  }

  async function eliminarMensaje(msg_id) {
    try {
      await callAdmin('eliminar_mensaje_nexu', { user_id: usuario?.id, msg_id });
      setMsgsNexu(prev => prev?.filter(m => m.id !== msg_id) ?? []);
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function gestionarIdentidad(accion) {
    const p = datos?.perfil ?? usuario;
    try {
      const r = await callAdmin('gestionar_identidad', { id: p?.id, accion });
      Alert.alert('✅', r.mensaje ?? 'Listo');
      const nuevosDatos = await callAdmin('detalle', { id: p?.id });
      setDatos(nuevosDatos);
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function cargarConversaciones() {
    if (cargandoConvs) return;
    setCargandoConvs(true);
    try {
      const res = await callAdmin('conversaciones', { id: usuario?.id });
      setConvs(res.conversaciones ?? []);
    } catch (e) {
      Alert.alert('Error conversaciones', e.message);
      setConvs([]);
    }
    finally { setCargandoConvs(false); }
  }

  async function abrirHilo(partnerId, nombre) {
    if (hiloAbierto?.partner_id === partnerId) { setHiloAbierto(null); return; }
    setCargandoHilo(true);
    try {
      const res = await callAdmin('mensajes_hilo', { user1: usuario?.id, user2: partnerId });
      setHiloAbierto({ partner_id: partnerId, nombre, mensajes: res.mensajes ?? [] });
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setCargandoHilo(false); }
  }

  if (!visible) return null;
  const p = datos?.perfil ?? usuario;
  const dias = diasRestantes(p?.perfil_activo_hasta);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Backdrop: toque fuera cierra */}
      <Pressable style={ss.modalBackdrop} onPress={onClose} />
      {/* Sheet: posicionado encima, no anidado en el backdrop */}
      <View style={ss.modalSheet}>
        <View style={ss.modalHandle} />
        {cargando ? <ActivityIndicator color="#E8785A" style={{ padding: 40 }} /> :
         error    ? <Text style={{ color: '#EF4444', padding: 20, textAlign: 'center' }}>{error}</Text> : (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={ss.modalTit}>{p?.nombre} {p?.apellido1 ?? ''}</Text>
            {datos?.email && datos.email !== '—' && <Text style={ss.modalEmail}>{datos.email}</Text>}
            <View style={ss.modalGrid}>
              {[
                ['Estado',        p?.perfil_activo ? '✅ Activo' : '⭕ Inactivo'],
                ['Días restantes',dias != null ? `${dias} días` : '—'],
                ['Vence',         fmtFecha(p?.perfil_activo_hasta)],
                ['País',          p?.pais ?? '—'],
                ['Ciudad',        p?.ciudad ?? '—'],
                ['Barrio',        p?.barrio ?? '—'],
                ['Vistas',        fmt(p?.vistas)],
                ['Contactos',     fmt(p?.contactos)],
                ['Rating',        p?.rating ?? '—'],
                ['Últ. login',    fmtFecha(datos?.last_sign_in_at)],
                ['Registro',      fmtFecha(p?.created_at)],
                ['Saldo employer',p?.visualizaciones_disponibles ?? 0],
                ['Años exp.',     p?.anios_experiencia ?? '—'],
                ['Disponibilidad',p?.disponibilidad ?? '—'],
              ].map(([k, v]) => (
                <View key={k} style={ss.gridRow}>
                  <Text style={ss.gridKey}>{k}</Text>
                  <Text style={ss.gridVal}>{String(v)}</Text>
                </View>
              ))}
            </View>
            {p?.servicios?.length > 0 && <View style={ss.modalSec}><Text style={ss.modalSecTit}>SERVICIOS</Text><Text style={ss.modalChips}>{p.servicios.join(' · ')}</Text></View>}
            {p?.profesiones?.length > 0 && <View style={ss.modalSec}><Text style={ss.modalSecTit}>PROFESIONES</Text><Text style={ss.modalChips}>{p.profesiones.join(' · ')}</Text></View>}
            {datos?.pagos?.length > 0 && (
              <View style={ss.modalSec}>
                <Text style={ss.modalSecTit}>PAGOS ({datos.pagos.length})</Text>
                {datos.pagos.slice(0,5).map((pg, i) => (
                  <View key={i} style={ss.pagoRow}>
                    <Text style={ss.pagoMonto}>{pg.moneda} {fmt(pg.monto)}</Text>
                    <Text style={ss.pagoMeta}>{pg.metodo} · {fmtFecha(pg.created_at)}</Text>
                  </View>
                ))}
              </View>
            )}
            {p?.bio ? <View style={ss.modalSec}><Text style={ss.modalSecTit}>BIO</Text><Text style={ss.bioTxt}>{p.bio}</Text></View> : null}
            {/* IDENTIDAD */}
            {p?.identidad_estado && (
              <View style={ss.modalSec}>
                <Text style={ss.modalSecTit}>VERIFICACIÓN DE IDENTIDAD</Text>
                {p.identidad_estado === 'pendiente' ? (
                  <>
                    <Text style={{ fontSize: 13, color: '#D97706', marginBottom: 8 }}>⏳ Documento pendiente de revisión</Text>
                    {p.identidad_url && (
                      <Text style={{ fontSize: 11, color: '#A898B8', marginBottom: 10 }} selectable>{p.identidad_url}</Text>
                    )}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={[ss.accionBtn, { borderColor: '#22C55E', flex: 1 }]} onPress={() => gestionarIdentidad('aprobar')}>
                        <Text style={[ss.accionBtnTxt, { color: '#22C55E' }]}>✅ Aprobar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[ss.accionBtn, { borderColor: '#EF4444', flex: 1 }]} onPress={() => gestionarIdentidad('rechazar')}>
                        <Text style={[ss.accionBtnTxt, { color: '#EF4444' }]}>❌ Rechazar</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : p.identidad_estado === 'aprobada' ? (
                  <Text style={{ fontSize: 13, color: '#22C55E' }}>✅ Identidad aprobada</Text>
                ) : (
                  <Text style={{ fontSize: 13, color: '#EF4444' }}>❌ Identidad rechazada</Text>
                )}
              </View>
            )}

            <View style={ss.modalSec}>
              <Text style={ss.modalSecTit}>ACCIONES</Text>
              {/* Enviar mensaje */}
              <TouchableOpacity style={[ss.accionBtn, { borderColor: '#8B5CF6', marginBottom: 10, alignSelf: 'flex-start' }]} onPress={() => setMsgVisible(v => !v)}>
                <Text style={[ss.accionBtnTxt, { color: '#8B5CF6' }]}>✉️ Enviar mensaje</Text>
              </TouchableOpacity>
              {msgVisible && (
                <View style={{ marginBottom: 10 }}>
                  <TextInput
                    style={{ backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#8B5CF6', borderRadius: 10, padding: 10, fontSize: 13, color: '#1A1020', minHeight: 70, textAlignVertical: 'top', marginBottom: 8 }}
                    placeholder="Escribí tu mensaje al usuario..."
                    placeholderTextColor="#A898B8"
                    value={msgTexto}
                    onChangeText={setMsgTexto}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[ss.accionBtn, { borderColor: '#8B5CF6', backgroundColor: '#8B5CF6' }, (!msgTexto.trim() || enviandoMsg) && { opacity: 0.4 }]}
                    onPress={enviarMensaje}
                    disabled={!msgTexto.trim() || enviandoMsg}
                  >
                    <Text style={[ss.accionBtnTxt, { color: '#FFF' }]}>{enviandoMsg ? 'Enviando...' : 'Enviar'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {/* Mensajes Nexu enviados */}
              <TouchableOpacity
                style={[ss.accionBtn, { borderColor: '#8B5CF6', marginBottom: 6 }]}
                onPress={() => { if (msgsNexu === null) cargarMensajesNexu(); else setMsgsNexu(null); }}
              >
                <Text style={[ss.accionBtnTxt, { color: '#8B5CF6' }]}>
                  {msgsNexu === null ? '📋 Ver mensajes enviados' : '▲ Ocultar mensajes'}
                </Text>
              </TouchableOpacity>
              {msgsNexu !== null && (
                <View style={{ marginBottom: 8 }}>
                  {cargandoMsgs
                    ? <ActivityIndicator size="small" color="#8B5CF6" style={{ marginVertical: 8 }} />
                    : msgsNexu.length === 0
                      ? <Text style={{ fontSize: 12, color: '#A898B8', paddingVertical: 6 }}>Sin mensajes enviados como Nexu</Text>
                      : msgsNexu.map(m => (
                          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F2EDE6' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, color: '#1A1020', lineHeight: 18 }}>{m.texto}</Text>
                              <Text style={{ fontSize: 10, color: '#A898B8', marginTop: 2 }}>{fmtFecha(m.created_at)}</Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => Alert.alert('Eliminar', '¿Eliminás este mensaje? No quedará registro.', [
                                { text: 'Cancelar', style: 'cancel' },
                                { text: 'Eliminar', style: 'destructive', onPress: () => eliminarMensaje(m.id) },
                              ])}
                              style={{ padding: 4 }}
                            >
                              <Text style={{ fontSize: 16, color: '#EF4444' }}>🗑</Text>
                            </TouchableOpacity>
                          </View>
                        ))
                  }
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { label: '+7 días',  accion: 'dar_dias', dias: 7,  color: '#22C55E' },
                  { label: '+30 días', accion: 'dar_dias', dias: 30, color: '#22C55E' },
                  { label: 'Activar',  accion: 'activar',             color: '#4DC8C4' },
                  { label: p?.suspendido ? '✅ Restaurar' : '🚫 Suspender',
                    accion: p?.suspendido ? 'restaurar' : 'suspender',
                    color:  p?.suspendido ? '#22C55E' : '#EF4444' },
                ].map((btn) => (
                  <TouchableOpacity
                    key={btn.label}
                    style={[ss.accionBtn, { borderColor: btn.color }, accionando && { opacity: 0.5 }]}
                    disabled={accionando}
                    onPress={() => {
                      const exec = async () => {
                        setAccionando(true);
                        try {
                          const r = await callAdmin('accion_usuario', { id: p?.id, accion: btn.accion, dias: btn.dias });
                          Alert.alert('✅', r.mensaje ?? 'Listo');
                          const nuevosDatos = await callAdmin('detalle', { id: p?.id });
                          setDatos(nuevosDatos);
                        } catch (e) { Alert.alert('Error', e.message); }
                        finally { setAccionando(false); }
                      };
                      if (btn.accion === 'suspender') {
                        Alert.alert('Suspender', `¿Suspender a ${p?.nombre}?`, [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Suspender', style: 'destructive', onPress: exec },
                        ]);
                      } else { exec(); }
                    }}
                  >
                    <Text style={[ss.accionBtnTxt, { color: btn.color }]}>{btn.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {/* CONVERSACIONES */}
            <View style={ss.modalSec}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={ss.modalSecTit}>CONVERSACIONES</Text>
                <TouchableOpacity onPress={cargarConversaciones} style={ss.verConvsBtn}>
                  {cargandoConvs
                    ? <ActivityIndicator size="small" color="#E8785A" />
                    : <Text style={ss.verConvsTxt}>{convs === null ? 'Ver conversaciones' : '↺ Recargar'}</Text>}
                </TouchableOpacity>
              </View>
              <View style={ss.histRow}>
                <View style={ss.histBox}>
                  <Text style={ss.histNum}>{datos?.mensajes_enviados?.length ?? 0}</Text>
                  <Text style={ss.histLbl}>Enviados</Text>
                </View>
                <View style={ss.histBox}>
                  <Text style={ss.histNum}>{datos?.mensajes_recibidos?.length ?? 0}</Text>
                  <Text style={ss.histLbl}>Recibidos</Text>
                </View>
              </View>
              {convs !== null && convs?.length === 0 && (
                <View style={{ padding: 16, alignItems: 'center', backgroundColor: '#F8F5F2', borderRadius: 10 }}>
                  <Text style={{ fontSize: 13, color: '#A898B8' }}>Este usuario no tiene conversaciones</Text>
                </View>
              )}
              {convs?.map((c, i) => (
                <View key={i}>
                  <TouchableOpacity style={ss.convRow} onPress={() => abrirHilo(c.partner_id, c.nombre + ' ' + c.apellido)}>
                    <View style={ss.convAvatar}>
                      <Text style={{ fontSize: 18 }}>👤</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ss.convNombre}>{c.nombre} {c.apellido}</Text>
                      <Text style={ss.convUltimo} numberOfLines={1}>{c.ultimo}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={ss.convFecha}>{fmtFecha(c.fecha)}</Text>
                      <Text style={ss.convTotal}>{c.total} msg</Text>
                    </View>
                    <Text style={{ fontSize: 16, color: '#A898B8', marginLeft: 6 }}>
                      {hiloAbierto?.partner_id === c.partner_id ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                  {/* Hilo expandido */}
                  {hiloAbierto?.partner_id === c.partner_id && (
                    <View style={ss.hiloWrap}>
                      {cargandoHilo
                        ? <ActivityIndicator color="#E8785A" style={{ marginVertical: 12 }} />
                        : hiloAbierto.mensajes.map((m, j) => (
                          <View key={j} style={[ss.burbuja, m.sender_id === usuario?.id ? ss.burbujaPropia : ss.burbujaAjena]}>
                            <Text style={ss.burbujaTxt}>{m.texto}</Text>
                            <Text style={ss.burbujaFecha}>{new Date(m.created_at).toLocaleString('es-UY', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</Text>
                          </View>
                        ))
                      }
                    </View>
                  )}
                </View>
              ))}
            </View>

            {datos?.propuestas?.length > 0 && (
              <View style={ss.modalSec}>
                <Text style={ss.modalSecTit}>PROPUESTAS ({datos.propuestas.length})</Text>
                {datos.propuestas.map((pr, i) => (
                  <View key={i} style={ss.histItem}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={ss.histItemTxt} numberOfLines={1}>{pr.descripcion || '(sin descripción)'}</Text>
                      <View style={[ss.propEstado, { backgroundColor:
                        pr.estado === 'aceptada' ? '#DCFCE7' :
                        pr.estado === 'rechazada' ? '#FEE2E2' : '#FEF9C3' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color:
                          pr.estado === 'aceptada' ? '#16A34A' :
                          pr.estado === 'rechazada' ? '#DC2626' : '#CA8A04' }}>{pr.estado}</Text>
                      </View>
                    </View>
                    <Text style={ss.histItemFecha}>{fmtFecha(pr.created_at)}</Text>
                  </View>
                ))}
              </View>
            )}

            {datos?.matches?.length > 0 && (
              <View style={ss.modalSec}>
                <Text style={ss.modalSecTit}>MATCHES DE CONCURSOS ({datos.matches.length})</Text>
                {datos.matches.map((m, i) => (
                  <View key={i} style={ss.histItem}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={ss.histItemTxt} numberOfLines={1}>{m.concursos?.titulo || 'Concurso'}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#E8785A' }}>{m.score}%</Text>
                    </View>
                    <Text style={ss.histItemFecha}>{m.concursos?.organizacion} · {m.concursos?.pais}</Text>
                  </View>
                ))}
              </View>
            )}

            {datos?.reportes?.length > 0 && (
              <View style={ss.modalSec}>
                <Text style={[ss.modalSecTit, { color: '#EF4444' }]}>REPORTES ({datos.reportes.length})</Text>
                {datos.reportes.map((r, i) => (
                  <View key={i} style={[ss.histItem, { borderLeftColor: '#EF4444' }]}>
                    <Text style={[ss.histItemTxt, { color: '#EF4444' }]}>{r.motivo} — {r.estado}</Text>
                    {r.detalle ? <Text style={ss.histItemFecha}>{r.detalle}</Text> : null}
                    <Text style={ss.histItemFecha}>{fmtFecha(r.created_at)}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={ss.cerrarBtn} onPress={onClose}><Text style={ss.cerrarBtnTxt}>Cerrar</Text></TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function ConfigModal({ visible, onClose }) {
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [guardando, setGuardando] = useState(false);

  function cerrar() { setPin1(''); setPin2(''); onClose(); }

  async function guardar() {
    if (pin1.length < 4) { Alert.alert('PIN muy corto', 'Usá al menos 4 caracteres.'); return; }
    if (pin1 !== pin2)   { Alert.alert('No coinciden', 'Los dos campos deben ser iguales.'); return; }
    setGuardando(true);
    await cambiarPinAdmin(pin1);
    setGuardando(false);
    cerrar();
    Alert.alert('✅ PIN actualizado', 'La próxima vez usá el PIN nuevo.');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cerrar}>
      <Pressable style={ss.modalBackdrop} onPress={cerrar}>
        <Pressable style={ss.cfgCard} onPress={() => {}}>
          <Text style={ss.cfgTit}>⚙️  Configuración</Text>
          <Text style={ss.cfgLbl}>Nuevo PIN de acceso</Text>
          <TextInput style={ss.cfgInput} placeholder="Nuevo PIN..." placeholderTextColor="#A898B8" secureTextEntry value={pin1} onChangeText={setPin1} maxLength={64} />
          <Text style={ss.cfgLbl}>Repetir PIN</Text>
          <TextInput style={ss.cfgInput} placeholder="Repetir PIN..." placeholderTextColor="#A898B8" secureTextEntry value={pin2} onChangeText={setPin2} maxLength={64} onSubmitEditing={guardar} returnKeyType="done" />
          <Text style={ss.cfgHint}>PIN por defecto: <Text style={{ fontWeight: '900' }}>{PIN_DEFAULT}</Text></Text>
          <TouchableOpacity style={[ss.cfgBtn, (!pin1 || !pin2 || guardando) && { opacity: 0.4 }]} onPress={guardar} disabled={!pin1 || !pin2 || guardando}>
            {guardando ? <ActivityIndicator color="#FFF" /> : <Text style={ss.cfgBtnTxt}>Guardar PIN →</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{ paddingVertical: 12 }} onPress={cerrar}>
            <Text style={{ fontSize: 13, color: '#A898B8', fontWeight: '600', textAlign: 'center' }}>Cancelar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────
function TabPanel({ stats, analytics, refreshing, onRefresh, error }) {
  const [desglose, setDesglose] = useState(false);

  if (error) return (
    <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F6FA' }}>
      <Text style={{ fontSize: 13, color: '#EF4444', fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>Error: {error}</Text>
      <TouchableOpacity style={ss.limpiarBtn} onPress={onRefresh}><Text style={ss.limpiarTxt}>Reintentar</Text></TouchableOpacity>
    </View>
  );
  if (!stats) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F6FA' }}><ActivityIndicator color="#E8785A" size="large" /></View>;

  const maxPais   = stats.paises?.[0]?.count ?? 1;
  const maxCiudad = stats.ciudades?.[0]?.count ?? 1;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F2F6FA' }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E8785A" />}
    >
      <Text style={ss.secTit}>USUARIOS</Text>
      <View style={ss.statsGrid}>
        {/* Total — botón expandible */}
        <TouchableOpacity style={[ss.statCard, { borderLeftColor: '#1A3A5C' }]} onPress={() => setDesglose(v => !v)} activeOpacity={0.7}>
          <Text style={ss.statEmoji}>👥</Text>
          <Text style={[ss.statVal, { color: '#1A3A5C' }]}>{fmt(stats.totalUsuarios)}</Text>
          <Text style={ss.statLbl}>Total {desglose ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        <StatCard emoji="✅" label="Activos"       value={stats.activos}          color="#22C55E" />
        <StatCard emoji="⏳" label="En prueba"     value={stats.enPrueba}         color="#F59E0B" />
        <StatCard emoji="⭕" label="Inactivos"     value={stats.inactivos}        color="#A898B8" />
        <StatCard emoji="🔔" label="Vencen 7d"    value={stats.vencenEn7Dias}    color="#EF4444" />
        <StatCard emoji="👁️" label="Employers"    value={stats.employersConSaldo} color="#4DC8C4" sub="con saldo" />
        <StatCard emoji="📸" label="Sin foto"      value={stats.sinFoto}          color="#8B5CF6" />
        <StatCard emoji="🆕" label="Esta semana"  value={stats.nuevosEstaSemana} color="#E8785A" />
      </View>

      {/* Desglose detallado del total */}
      {desglose && analytics && (
        <View style={[ss.barrasCard, { marginTop: 12 }]}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: '#1A3A5C', marginBottom: 12 }}>DETALLE DE {fmt(stats.totalUsuarios)} USUARIOS</Text>

          {/* Por sexo */}
          <Text style={[ss.secTit, { marginTop: 0, marginBottom: 8 }]}>POR SEXO</Text>
          {Object.entries(analytics.porSexo ?? {}).sort((a,b) => b[1]-a[1]).map(([sexo, cant]) => (
            <BarraH key={sexo} label={sexo} value={cant} max={stats.totalUsuarios} color="#4DC8C4" />
          ))}

          {/* Por franja etaria */}
          <Text style={[ss.secTit, { marginTop: 16, marginBottom: 8 }]}>POR EDAD</Text>
          {Object.entries(analytics.franjas ?? {}).map(([rango, cant]) => (
            <BarraH key={rango} label={rango} value={cant} max={stats.totalUsuarios} color="#8B5CF6" />
          ))}

          {/* Tipo de perfil laboral */}
          <Text style={[ss.secTit, { marginTop: 16, marginBottom: 8 }]}>TIPO DE PERFIL</Text>
          {[
            { label: 'Profesionales',          value: analytics.tipoPerfil?.profesional,    color: '#22C55E' },
            { label: 'Oficios',                value: analytics.tipoPerfil?.oficio,         color: '#E8785A' },
            { label: 'Ambos (prof. + oficio)', value: analytics.tipoPerfil?.ambos,          color: '#F59E0B' },
            { label: 'Sin categorizar',        value: analytics.tipoPerfil?.sinCategorizar, color: '#A898B8' },
          ].map(({ label, value, color }) => (
            <BarraH key={label} label={label} value={value ?? 0} max={stats.totalUsuarios} color={color} />
          ))}

          {/* Nivel académico */}
          <Text style={[ss.secTit, { marginTop: 16, marginBottom: 8 }]}>NIVEL ACADÉMICO</Text>
          {[
            { label: 'Con profesión cargada',  value: analytics.nivelAcademico?.conProfesion,   color: '#1A3A5C' },
            { label: 'Con tecnicatura',        value: analytics.nivelAcademico?.conTecnicatura, color: '#4DC8C4' },
            { label: 'Solo oficios',           value: analytics.nivelAcademico?.soloOficios,    color: '#E8785A' },
          ].map(({ label, value, color }) => (
            <BarraH key={label} label={label} value={value ?? 0} max={stats.totalUsuarios} color={color} />
          ))}

          {/* Por país (todos) */}
          <Text style={[ss.secTit, { marginTop: 16, marginBottom: 8 }]}>POR PAÍS (todos)</Text>
          {(analytics.porPais ?? []).map(([pais, cant]) => (
            <BarraH key={pais} label={pais} value={cant} max={(analytics.porPais?.[0]?.[1] ?? 1)} color="#E8785A" />
          ))}
        </View>
      )}

      <Text style={[ss.secTit, { marginTop: 20 }]}>INGRESOS</Text>
      <View style={ss.ingresosCard}>
        {[['Total acumulado', stats.ingresoTotal, '#1A3A5C', 24], ['Este mes', stats.ingresoMes, '#22C55E', 20], ['Esta semana', stats.ingresoSemana, '#4DC8C4', 20], ['Transacciones', stats.cantidadPagos, '#1A3A5C', 20]].map(([lbl, val, col, sz], i) => (
          <View key={lbl}>
            {i > 0 && <View style={ss.ingresoDivider} />}
            <View style={ss.ingresoFila}>
              <Text style={ss.ingresoLbl}>{lbl}</Text>
              <Text style={[ss.ingresoVal, { color: col, fontSize: sz }]}>{lbl === 'Transacciones' ? fmt(val) : `$${fmt(val)}`}</Text>
            </View>
          </View>
        ))}
      </View>

      {stats.paises?.length > 0 && <>
        <Text style={[ss.secTit, { marginTop: 20 }]}>POR PAÍS</Text>
        <View style={ss.barrasCard}>{stats.paises.map(p => <BarraH key={p.pais} label={p.pais || '—'} value={p.count} max={maxPais} color="#E8785A" />)}</View>
      </>}
      {stats.ciudades?.length > 0 && <>
        <Text style={[ss.secTit, { marginTop: 20 }]}>POR CIUDAD (TOP 15)</Text>
        <View style={ss.barrasCard}>{stats.ciudades.map(c => <BarraH key={c.ciudad} label={c.ciudad || '—'} value={c.count} max={maxCiudad} color="#4DC8C4" />)}</View>
      </>}
      <Text style={ss.actualizadoTxt}>Nuevos este mes: {stats.nuevosEsteMes}</Text>

      {/* ── TENDENCIA MENSUAL ── */}
      {stats.registrosPorMes?.length > 0 && (() => {
        function fmtMes(ym) {
          const [y, m] = ym.split('-');
          const nombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
          return `${nombres[parseInt(m,10)-1]} ${y.slice(2)}`;
        }
        const maxReg = Math.max(...(stats.registrosPorMes ?? []).map(x => x.count), 1);
        const maxAct = Math.max(...(stats.activacionesPorMes ?? []).map(x => x.count), 1);
        return (
          <>
            <Text style={[ss.secTit, { marginTop: 20 }]}>TENDENCIA (últimos 6 meses)</Text>
            <View style={ss.barrasCard}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#8B5CF6', marginBottom: 8 }}>📥 REGISTROS</Text>
              {(stats.registrosPorMes ?? []).map(({ mes, count }) => (
                <BarraH key={`r${mes}`} label={fmtMes(mes)} value={count} max={maxReg} color="#8B5CF6" />
              ))}
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#22C55E', marginTop: 12, marginBottom: 8 }}>💳 ACTIVACIONES (pagos)</Text>
              {(stats.activacionesPorMes ?? []).map(({ mes, count }) => (
                <BarraH key={`a${mes}`} label={fmtMes(mes)} value={count} max={maxAct} color="#22C55E" />
              ))}
              {stats.tasaActivacion != null && (
                <Text style={{ fontSize: 11, color: '#A898B8', marginTop: 10 }}>
                  Tasa de activación general: {stats.tasaActivacion}% · Mensajes totales: {fmt(stats.totalMensajes)} · Esta semana: {fmt(stats.mensajesSemana)}
                </Text>
              )}
            </View>
          </>
        );
      })()}

      {/* ── ANALYTICS ── */}
      {analytics && <>
        {/* Embudo de adopción */}
        <Text style={[ss.secTit, { marginTop: 20 }]}>ADOPCIÓN</Text>
        <View style={ss.barrasCard}>
          <Text style={{ fontSize: 11, color: '#A898B8', marginBottom: 10 }}>Últimos 30 días · Tasa de activación: {analytics.embudo?.tasaActivacion ?? 0}%</Text>
          {[
            { label: 'Registrados total',   value: analytics.embudo?.totalRegistrados, color: '#1A3A5C' },
            { label: 'Con foto de perfil',  value: analytics.embudo?.conFoto,          color: '#4DC8C4' },
            { label: 'Activados (pagaron)', value: analytics.embudo?.activos,          color: '#22C55E' },
            { label: 'Activaciones (30d)',  value: analytics.activaciones30d,          color: '#E8785A' },
            { label: 'Nuevos (7 días)',     value: analytics.nuevos7d,                color: '#8B5CF6' },
            { label: 'Nuevos (30 días)',    value: analytics.nuevos30d,               color: '#F59E0B' },
          ].map(({ label, value, color }) => (
            <BarraH key={label} label={label} value={value ?? 0} max={analytics.embudo?.totalRegistrados ?? 1} color={color} />
          ))}
        </View>

        {/* Comunicaciones concretadas */}
        <Text style={[ss.secTit, { marginTop: 20 }]}>COMUNICACIONES (30 días)</Text>
        <View style={ss.statsGrid}>
          <StatCard emoji="💬" label="Mensajes enviados"  value={analytics.mensajes?.total30d ?? 0}    color="#3DA882" />
          <StatCard emoji="📋" label="Postulaciones total" value={analytics.totalPostulaciones ?? 0}   color="#1A3A5C" />
          <StatCard emoji="🔑" label="Sesiones (30d)"     value={analytics.logins30d ?? 0}            color="#4DC8C4" />
        </View>

        {/* Horario pico de actividad */}
        <Text style={[ss.secTit, { marginTop: 20 }]}>HORARIO PICO (hora UY)</Text>
        <View style={ss.barrasCard}>
          <Text style={{ fontSize: 11, color: '#A898B8', marginBottom: 8 }}>Basado en last login de cada usuario</Text>
          {(() => {
            const horas = analytics.loginsPorHora ?? [];
            const maxH = Math.max(...horas, 1);
            return [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22].map(h => {
              const v = horas[h] ?? 0;
              return <BarraH key={h} label={`${h}:00`} value={v} max={maxH} color="#E8785A" />;
            });
          })()}
        </View>

        {/* Mensajes por hora */}
        <Text style={[ss.secTit, { marginTop: 20 }]}>MENSAJES POR HORA (30d)</Text>
        <View style={ss.barrasCard}>
          {(() => {
            const horas = analytics.mensajes?.porHora ?? [];
            const maxH = Math.max(...horas, 1);
            return [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22].map(h => {
              const v = horas[h] ?? 0;
              return <BarraH key={h} label={`${h}:00`} value={v} max={maxH} color="#3DA882" />;
            });
          })()}
        </View>

        {/* Nuevos registros por día (últimos 14) */}
        {analytics.registrosPorDia?.length > 0 && <>
          <Text style={[ss.secTit, { marginTop: 20 }]}>REGISTROS POR DÍA (últimos 14)</Text>
          <View style={ss.barrasCard}>
            {(() => {
              const dias = analytics.registrosPorDia.slice(-14);
              const maxD = Math.max(...dias.map(([,v]) => v), 1);
              return dias.map(([dia, v]) => (
                <BarraH key={dia} label={dia.slice(5)} value={v} max={maxD} color="#8B5CF6" />
              ));
            })()}
          </View>
        </>}

        {/* Nuevos por país (últimos 30 días) */}
        {analytics.nuevosPorPais?.length > 0 && <>
          <Text style={[ss.secTit, { marginTop: 20 }]}>NUEVOS POR PAÍS (30 días)</Text>
          <View style={ss.barrasCard}>
            {(() => {
              const max = analytics.nuevosPorPais[0]?.[1] ?? 1;
              return analytics.nuevosPorPais.map(([pais, v]) => (
                <BarraH key={pais} label={pais} value={v} max={max} color="#F59E0B" />
              ));
            })()}
          </View>
        </>}
      </>}
    </ScrollView>
  );
}

function TabUsuarios({ onDetalleUsuario, refreshing, setRefreshing }) {
  const [busqueda, setBusqueda]           = useState('');
  const [pais, setPais]                   = useState('');
  const [ciudad, setCiudad]               = useState('');
  const [filtro, setFiltro]               = useState('todos');
  const [usuarios, setUsuarios]           = useState([]);
  const [total, setTotal]                 = useState(0);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [pagina, setPagina]               = useState(0);
  const [hayMas, setHayMas]               = useState(false);
  const [paisFocus, setPaisFocus]         = useState(false);
  const [ciudadFocus, setCiudadFocus]     = useState(false);
  const [ciudadesSug, setCiudadesSug]     = useState([]);
  const busTimer = useRef(null);
  const ciudadTimer = useRef(null);

  const sugerenciasPaises = Object.entries(NOMBRES_PAISES).filter(([cod, nombre]) => {
    const q = pais.toLowerCase();
    return q.length > 0 && (cod.toLowerCase().includes(q) || nombre.toLowerCase().includes(q));
  }).slice(0, 6);
  const LIMITE = 40;
  const FILTROS = [
    { id: 'todos', label: 'Todos' }, { id: 'activo', label: '✅ Activos' },
    { id: 'inactivo', label: '⭕ Inactivos' }, { id: 'con_saldo', label: '💳 Con saldo' },
  ];

  const cargar = useCallback(async (q, f, p, c, pag = 0, esRefresh = false) => {
    if (esRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await callAdmin('listar', { busqueda: q, filtro: f, pais: p, ciudad: c, pagina: pag, limite: LIMITE });
      if (pag === 0) setUsuarios(res.usuarios ?? []);
      else setUsuarios(prev => [...prev, ...(res.usuarios ?? [])]);
      setTotal(res.total ?? 0);
      setHayMas((pag + 1) * LIMITE < (res.total ?? 0));
      setPagina(pag);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { cargar('', 'todos', '', '', 0); }, []);

  function disparar(q, f, p, c) {
    clearTimeout(busTimer.current);
    busTimer.current = setTimeout(() => cargar(q, f, p, c, 0), 400);
  }
  async function buscarCiudades(txt) {
    if (txt.length < 2) { setCiudadesSug([]); return; }
    try {
      const r = await callAdmin('get_ciudades', { query: txt });
      setCiudadesSug(r.ciudades ?? []);
    } catch {}
  }
  function onBusqueda(txt) { setBusqueda(txt); disparar(txt, filtro, pais, ciudad); }
  function onPais(txt)     { setPais(txt);     disparar(busqueda, filtro, txt, ciudad); if (!txt) setCiudadesSug([]); }
  function onCiudad(txt) {
    setCiudad(txt);
    disparar(busqueda, filtro, pais, txt);
    clearTimeout(ciudadTimer.current);
    ciudadTimer.current = setTimeout(() => buscarCiudades(txt), 350);
    if (!txt) setCiudadesSug([]);
  }
  function onFiltro(f)     { setFiltro(f);     cargar(busqueda, f, pais, ciudad, 0); }
  function limpiar()       { setBusqueda(''); setPais(''); setCiudad(''); setFiltro('todos'); setCiudadesSug([]); cargar('', 'todos', '', '', 0); }
  function cargarMas()     { if (!loading && hayMas) cargar(busqueda, filtro, pais, ciudad, pagina + 1); }
  const hayFiltros = busqueda || pais || ciudad || filtro !== 'todos';

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F6FA' }}>
      <View style={ss.usuariosHeader}>
        <View style={ss.searchBox}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput style={ss.searchInput} placeholder="Nombre, email, oficio..." placeholderTextColor="#A898B8" value={busqueda} onChangeText={onBusqueda} />
          {busqueda.length > 0 && <TouchableOpacity onPress={() => onBusqueda('')}><Text style={{ fontSize: 14, color: '#A898B8', marginLeft: 8 }}>✕</Text></TouchableOpacity>}
        </View>
        <View style={[ss.filtroPairRow, { zIndex: 20 }]}>
          {/* PAÍS con dropdown absoluto */}
          <View style={{ flex: 1, zIndex: 10 }}>
            <View style={[ss.searchBox, { marginBottom: 0 }]}>
              <Text style={{ fontSize: 13, marginRight: 6 }}>🌍</Text>
              <TextInput
                style={[ss.searchInput, { fontSize: 12 }]}
                placeholder="País..."
                placeholderTextColor="#A898B8"
                value={pais}
                onChangeText={onPais}
                onFocus={() => setPaisFocus(true)}
                onBlur={() => setTimeout(() => setPaisFocus(false), 200)}
              />
              {pais.length > 0 && <TouchableOpacity onPress={() => { onPais(''); setPaisFocus(false); }}><Text style={{ fontSize: 13, color: '#A898B8' }}>✕</Text></TouchableOpacity>}
            </View>
            {paisFocus && sugerenciasPaises.length > 0 && (
              <View style={ss.dropdownList}>
                {sugerenciasPaises.map(([cod, nombre]) => (
                  <TouchableOpacity key={cod} style={ss.dropdownItem}
                    onPress={() => { onPais(cod); setPaisFocus(false); }}
                  >
                    <Text style={{ fontSize: 16, marginRight: 8 }}>{BANDERAS[cod]}</Text>
                    <Text style={{ fontSize: 13, color: '#1A1020', fontWeight: '600' }}>{nombre}</Text>
                    <Text style={{ fontSize: 11, color: '#A898B8', marginLeft: 6 }}>{cod}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <View style={{ width: 8 }} />
          {/* CIUDAD con dropdown absoluto */}
          <View style={{ flex: 1, zIndex: 9 }}>
            <View style={[ss.searchBox, { marginBottom: 0 }]}>
              <Text style={{ fontSize: 13, marginRight: 6 }}>📍</Text>
              <TextInput
                style={[ss.searchInput, { fontSize: 12 }]}
                placeholder="Ciudad..."
                placeholderTextColor="#A898B8"
                value={ciudad}
                onChangeText={onCiudad}
                onFocus={() => setCiudadFocus(true)}
                onBlur={() => setTimeout(() => setCiudadFocus(false), 200)}
              />
              {ciudad.length > 0 && <TouchableOpacity onPress={() => { onCiudad(''); setCiudadesSug([]); }}><Text style={{ fontSize: 13, color: '#A898B8' }}>✕</Text></TouchableOpacity>}
            </View>
            {ciudadFocus && ciudadesSug.length > 0 && (
              <View style={ss.dropdownList}>
                {ciudadesSug.map(c => (
                  <TouchableOpacity key={c} style={ss.dropdownItem}
                    onPress={() => { setCiudad(c); disparar(busqueda, filtro, pais, c); setCiudadFocus(false); setCiudadesSug([]); }}
                  >
                    <Text style={{ fontSize: 13, color: '#1A1020' }}>📍 {c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity style={[ss.filtrarBtn, { marginLeft: 8 }]} onPress={() => cargar(busqueda, filtro, pais, ciudad, 0)}>
            <Text style={ss.filtrarBtnTxt}>Buscar</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {FILTROS.map(f => (
              <TouchableOpacity key={f.id} style={[ss.filtroBtn, filtro === f.id && ss.filtroBtnA]} onPress={() => onFiltro(f.id)}>
                <Text style={[ss.filtroTxt, filtro === f.id && ss.filtroTxtA]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {hayFiltros && <TouchableOpacity onPress={limpiar} style={ss.limpiarBtn}><Text style={ss.limpiarTxt}>Limpiar</Text></TouchableOpacity>}
        </View>
        {error
          ? <Text style={ss.errorBanner}>{error}</Text>
          : <Text style={ss.totalTxt}>{fmt(total)} usuario{total !== 1 ? 's' : ''}</Text>
        }
      </View>
      <ScrollView
        style={{ flex: 1 }}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>cargar(busqueda,filtro,pais,ciudad,0,true)} tintColor="#E8785A" />}
        onMomentumScrollEnd={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 80) cargarMas();
        }}
        scrollEventThrottle={400}
      >
        <View style={{ padding: 12, paddingBottom: 24 }}>
          {usuarios.map(u => <UserCard key={u.id} u={u} onPress={onDetalleUsuario} />)}
          {loading && <ActivityIndicator color="#E8785A" style={{ padding: 20 }} />}
          {hayMas && !loading && <TouchableOpacity style={ss.cargarMasBtn} onPress={cargarMas}><Text style={ss.cargarMasTxt}>Cargar más →</Text></TouchableOpacity>}
          {!loading && !error && usuarios.length === 0 && <Text style={ss.actualizadoTxt}>Sin resultados</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const METODO_CFG = {
  stripe:        { emoji: '💳', color: '#6772E5', label: 'Tarjeta / Stripe' },
  mercadopago:   { emoji: '🛒', color: '#009EE3', label: 'MercadoPago' },
  transferencia: { emoji: '🏦', color: '#22C55E', label: 'Transferencia' },
  efectivo:      { emoji: '💵', color: '#F59E0B', label: 'Efectivo' },
  paypal:        { emoji: '🅿️', color: '#003087', label: 'PayPal' },
};
function metodoCfg(m) { return METODO_CFG[(m ?? '').toLowerCase()] ?? { emoji: '💰', color: '#A898B8', label: m || 'Otro' }; }

function TabPagos() {
  const [periodo, setPeriodo] = useState('mes');
  const [datos, setDatos]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const PERIODOS = [
    { id: 'hoy', label: 'Hoy' }, { id: 'semana', label: 'Semana' },
    { id: 'mes', label: 'Mes' }, { id: 'anio', label: 'Año' }, { id: 'todo', label: 'Total' },
  ];

  useEffect(() => {
    setLoading(true); setError('');
    callAdmin('pagos_resumen', { periodo }).then(setDatos).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [periodo]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
        {PERIODOS.map(p => (
          <TouchableOpacity key={p.id} style={[ss.filtroBtn, periodo === p.id && ss.filtroBtnA]} onPress={() => setPeriodo(p.id)}>
            <Text style={[ss.filtroTxt, periodo === p.id && ss.filtroTxtA]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {loading ? <ActivityIndicator color="#E8785A" style={{ padding: 40 }} /> :
       error   ? <Text style={[ss.actualizadoTxt, { color: '#EF4444' }]}>{error}</Text> :
       datos   ? (
        <>
          {/* Resumen */}
          <View style={ss.ingresosCard}>
            <View style={ss.ingresoFila}>
              <Text style={ss.ingresoLbl}>Total ingresado</Text>
              <Text style={[ss.ingresoVal, { fontSize: 28, color: '#22C55E' }]}>${fmt(datos.total)}</Text>
            </View>
            <View style={ss.ingresoDivider} />
            <View style={ss.ingresoFila}>
              <Text style={ss.ingresoLbl}>Transacciones</Text>
              <Text style={ss.ingresoVal}>{fmt(datos.cantidad)}</Text>
            </View>
          </View>

          {/* Por medio de pago */}
          {Object.keys(datos.porMetodo ?? {}).length > 0 && <>
            <Text style={[ss.secTit, { marginTop: 20 }]}>POR MEDIO DE PAGO</Text>
            <View style={ss.barrasCard}>
              {Object.entries(datos.porMetodo ?? {}).sort((a, b) => b[1] - a[1]).map(([m, v], idx) => {
                const cfg = metodoCfg(m);
                const pct = datos.total > 0 ? Math.round((v / datos.total) * 100) : 0;
                return (
                  <View key={m} style={[ss.metodoRow, idx > 0 && { borderTopWidth: 1, borderTopColor: '#F2EDE6' }]}>
                    <View style={[ss.metodoIcon, { backgroundColor: cfg.color + '20' }]}>
                      <Text style={{ fontSize: 18 }}>{cfg.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={ss.metodoNombre}>{cfg.label}</Text>
                        <Text style={[ss.metodoMonto, { color: cfg.color }]}>${fmt(v)}</Text>
                      </View>
                      <View style={ss.barraTrack}>
                        <View style={[ss.barraFill, { width: `${pct}%`, backgroundColor: cfg.color }]} />
                      </View>
                      <Text style={ss.metodoPct}>{pct}% del total</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>}

          {/* Últimas transacciones */}
          {datos.pagos?.length > 0 && <>
            <Text style={[ss.secTit, { marginTop: 20 }]}>ÚLTIMAS TRANSACCIONES</Text>
            <View style={ss.barrasCard}>
              {datos.pagos.map((pg, i) => {
                const cfg = metodoCfg(pg.metodo);
                return (
                  <View key={i} style={[ss.pagoItem, i > 0 && { borderTopWidth: 1, borderTopColor: '#EDE8E2' }]}>
                    <View style={[ss.metodoIcon, { backgroundColor: cfg.color + '20' }]}>
                      <Text style={{ fontSize: 16 }}>{cfg.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ss.pagoMonto}>{pg.moneda} {fmt(pg.monto)}</Text>
                      <Text style={ss.pagoMeta}>{cfg.label} · {fmtFecha(pg.created_at)}</Text>
                      <Text style={ss.pagoId} numberOfLines={1}>{pg.id}</Text>
                    </View>
                    <View style={[ss.statusBadge, { backgroundColor: '#E6FBF522', borderColor: '#22C55E' }]}>
                      <Text style={[ss.statusTxt, { color: '#22C55E' }]}>✓</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>}
          {datos.pagos?.length === 0 && <Text style={ss.actualizadoTxt}>Sin transacciones en este período</Text>}
        </>
       ) : null}
    </ScrollView>
  );
}

function RankCard({ item, rank }) {
  const colores = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const medal = rank <= 3 ? colores[rank - 1] : null;
  return (
    <View style={ss.oficioRow}>
      <View style={[ss.oficioRank, medal && { backgroundColor: medal }]}>
        <Text style={[ss.oficioRankTxt, medal && { color: '#1A1020' }]}>{rank}</Text>
      </View>
      <Text style={ss.oficioNombre} numberOfLines={2}>{item.oficio}</Text>
      <Text style={ss.oficioCount}>{item.count}</Text>
    </View>
  );
}

function MensajesResumenView({ datos }) {
  if (!datos) return <Text style={ss.actualizadoTxt}>Sin datos</Text>;
  const maxCiudad = datos.topCiudades?.[0]?.count ?? 1;
  const maxSector = datos.topSectores?.[0]?.count ?? 1;
  return (
    <View>
      <View style={ss.statsGrid}>
        <StatCard emoji="💬" label="Total mensajes"  value={datos.total}          color="#3DA882" />
        <StatCard emoji="🤝" label="Conversaciones"  value={datos.conversaciones} color="#1A3A5C" />
        <StatCard emoji="📅" label="Última semana"   value={datos.recientes}      color="#4DC8C4" />
      </View>
      {datos.topCiudades?.length > 0 && <>
        <Text style={[ss.secTit, { marginTop: 16 }]}>POR CIUDAD</Text>
        <View style={ss.barrasCard}>{datos.topCiudades.map(c => <BarraH key={c.ciudad} label={c.ciudad} value={c.count} max={maxCiudad} color="#3DA882" />)}</View>
      </>}
      {datos.topSectores?.length > 0 && <>
        <Text style={[ss.secTit, { marginTop: 16 }]}>POR SECTOR LABORAL</Text>
        <View style={ss.barrasCard}>{datos.topSectores.map(s => <BarraH key={s.sector} label={s.sector} value={s.count} max={maxSector} color="#1A3A5C" />)}</View>
      </>}
    </View>
  );
}

function MensajeModal({ visible, cantidad, receiverIds, onClose, onEnviado }) {
  const [tipo, setTipo]         = useState('motivacional');
  const [texto, setTexto]       = useState('');
  const [enviando, setEnviando] = useState(false);

  const TIPOS = [
    { id: 'motivacional', emoji: '💪', label: 'Motivar' },
    { id: 'propuesta',    emoji: '💼', label: 'Propuesta' },
    { id: 'incentivo',    emoji: '🎁', label: 'Incentivo' },
    { id: 'libre',        emoji: '✏️', label: 'Libre' },
  ];
  const TEMPLATES = {
    motivacional: '¡Hola! Tu perfil en Nexu tiene todo para destacar. Completalo y empezá a recibir más contactos. 💪',
    propuesta:    '¡Hola! Tenemos oportunidades laborales disponibles que pueden interesarte. Ingresá a la app para ver los llamados activos. 💼',
    incentivo:    '¡Hola! Como usuario de Nexu, tenés un beneficio especial esperándote. Ingresá y activá tu perfil hoy. 🎁',
  };

  function seleccionarTipo(t) {
    setTipo(t);
    if (TEMPLATES[t]) setTexto(TEMPLATES[t]);
    else setTexto('');
  }

  async function enviar() {
    if (!texto.trim()) { Alert.alert('Sin mensaje', 'Escribí un mensaje antes de enviar.'); return; }
    setEnviando(true);
    try {
      await callAdmin('enviar_mensajes', { receiver_ids: receiverIds, texto: texto.trim(), tipo });
      Alert.alert('✅ Enviado', `Mensaje enviado a ${cantidad} usuario${cantidad !== 1 ? 's' : ''}.`);
      onEnviado();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setEnviando(false); }
  }

  function cerrar() { setTexto(''); setTipo('motivacional'); onClose(); }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cerrar}>
      <Pressable style={ss.modalBackdrop} onPress={cerrar}>
        <Pressable style={ss.modalSheet} onPress={() => {}}>
          <View style={ss.modalHandle} />
          <Text style={ss.modalTit}>✉️ Mensaje masivo</Text>
          <Text style={[ss.modalEmail, { marginBottom: 12 }]}>A {cantidad} usuario{cantidad !== 1 ? 's' : ''}</Text>
          <Text style={ss.cfgLbl}>Tipo</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {TIPOS.map(t => (
              <TouchableOpacity key={t.id}
                style={[ss.periodoBtn, tipo === t.id && ss.periodoBtnA, { flex: 1, alignItems: 'center', paddingVertical: 10 }]}
                onPress={() => seleccionarTipo(t.id)}
              >
                <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
                <Text style={[ss.periodoTxt, tipo === t.id && ss.periodoTxtA, { fontSize: 10, marginTop: 3 }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={ss.cfgLbl}>Mensaje</Text>
          <TextInput
            style={[ss.cfgInput, { height: 110, textAlignVertical: 'top', lineHeight: 20 }]}
            placeholder="Escribí el mensaje..."
            placeholderTextColor="#A898B8"
            multiline
            value={texto}
            onChangeText={setTexto}
            maxLength={500}
          />
          <Text style={{ fontSize: 10, color: '#D0C8DC', textAlign: 'right', marginBottom: 16 }}>{texto.length}/500</Text>
          <TouchableOpacity
            style={[ss.cfgBtn, { backgroundColor: '#3DA882' }, (!texto.trim() || enviando) && { opacity: 0.4 }]}
            onPress={enviar} disabled={!texto.trim() || enviando}
          >
            {enviando ? <ActivityIndicator color="#FFF" /> : <Text style={ss.cfgBtnTxt}>Enviar a {cantidad} usuario{cantidad !== 1 ? 's' : ''} →</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{ paddingVertical: 12 }} onPress={cerrar}>
            <Text style={{ fontSize: 13, color: '#A898B8', fontWeight: '600', textAlign: 'center' }}>Cancelar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TabConsultas({ onDetalleUsuario, navigation }) {
  const [resultados, setResultados]             = useState([]);
  const [resultadosMeta, setResultadosMeta]     = useState(null);
  const [consulta, setConsulta]                 = useState(null);
  const [loading, setLoading]                   = useState(false);
  const [refreshing, setRefreshing]             = useState(false);
  const [errorMsg, setErrorMsg]                 = useState('');
  const [sinActividadDias, setSinActividadDias] = useState(30);
  const [seleccionados, setSeleccionados]       = useState([]);
  const [modoSeleccion, setModoSeleccion]       = useState(false);
  const [msgVisible, setMsgVisible]             = useState(false);
  const [msgPais, setMsgPais]                   = useState('');
  const [msgSector, setMsgSector]               = useState('');
  const [llamadosTipo, setLlamadosTipo]         = useState('todos');
  const [llamadosPais, setLlamadosPais]         = useState('');
  const [llamadosCargo, setLlamadosCargo]       = useState('');
  const [llamadosPorPais, setLlamadosPorPais]   = useState(null);
  const [llamadosTotal, setLlamadosTotal]       = useState(null);
  const [liveActualizado, setLiveActualizado]   = useState(false);
  const [ofertasPais, setOfertasPais]           = useState('');
  const [ofertasCiudad, setOfertasCiudad]       = useState('');
  const [ofertasCargo, setOfertasCargo]         = useState('');
  const [ofertasPorPais, setOfertasPorPais]     = useState(null);

  // Refs para que el callback de real-time siempre vea los valores actuales
  const ejecutarRef = useRef(null);
  const consultaRef = useRef(null);
  consultaRef.current = consulta;

  // Suscripción real-time a la tabla concursos
  useEffect(() => {
    const CONCURSO_VIEWS = ['todos_llamados', 'demanda_concursos'];
    let debounceTimer = null;
    const channel = supabase
      .channel('tabconsultas-concursos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'concursos' }, () => {
        const cur = consultaRef.current;
        if (!cur || !CONCURSO_VIEWS.includes(cur)) return;
        // Debounce: el scraper inserta cientos de filas seguidas.
        // Esperamos 60s para hacer un solo re-fetch al terminar.
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return; // no reintentar si el token venció
          ejecutarRef.current?.(cur, {}, true); // isRefresh=true → no borra datos existentes
          setLiveActualizado(true);
          setTimeout(() => setLiveActualizado(false), 3000);
        }, 60000);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); clearTimeout(debounceTimer); };
  }, []);

  const CONSULTAS = [
    { id: 'top_oficios',       emoji: '📋', label: 'Oficios más ofrecidos\n(perfiles)',      color: '#8B5CF6' },
    { id: 'demanda_concursos', emoji: '📊', label: 'Profesiones más\ndemandadas (llamados)', color: '#1A3A5C' },
    { id: 'mensajes_resumen',  emoji: '💬', label: 'Mensajes entre\nusuarios',               color: '#3DA882' },
    { id: 'todos_llamados',    emoji: '🗂️', label: 'Todos los\nllamados',                    color: '#E8785A' },
    { id: 'mas_contratados',   emoji: '⭐', label: 'Más contactados',                        color: '#22C55E' },
    { id: 'top_vistas',        emoji: '👁️', label: 'Top por vistas',                         color: '#4DC8C4' },
    { id: 'vencen_pronto',     emoji: '🔔', label: 'Vencen en 7 días',                       color: '#EF4444' },
    { id: 'recientes_24h',     emoji: '🆕', label: 'Registros últimas 24h',                  color: '#22C55E' },
    { id: 'top_empleadores',   emoji: '💰', label: 'Empleadores que\nmás gastan',              color: '#F59E0B' },
    { id: 'employers_saldo',   emoji: '💳', label: 'Empleadores con saldo',                  color: '#4DC8C4' },
    { id: 'sin_foto',          emoji: '📸', label: 'Sin foto de perfil',                     color: '#8B5CF6' },
    { id: 'sin_actividad',      emoji: '😴', label: 'Sin actividad',                          color: '#A898B8' },
    { id: 'ofertas_empleadores',emoji: '📣', label: 'Ofertas de\nempleadores',                 color: '#7C3AED' },
  ];

  async function ejecutar(tipo, overrides = {}, isRefresh = false) {
    setErrorMsg(''); setSeleccionados([]); setModoSeleccion(false);
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setConsulta(tipo);
      setLoading(true);
      setResultados([]); setResultadosMeta(null); setLlamadosTotal(null);
    }
    try {
      let extra = {};
      if (tipo === 'sin_actividad')    extra = { dias: overrides.dias ?? sinActividadDias };
      if (tipo === 'mensajes_resumen') extra = { pais: msgPais, sector: msgSector };
      if (tipo === 'todos_llamados') {
        const tv = overrides.tipo_vinculo ?? llamadosTipo;
        extra = { tipo_vinculo: tv === 'todos' ? '' : tv, pais: overrides.pais ?? llamadosPais, cargo: overrides.cargo ?? llamadosCargo };
      }
      if (tipo === 'ofertas_empleadores') {
        extra = { pais: overrides.pais ?? ofertasPais, ciudad: overrides.ciudad ?? ofertasCiudad, cargo: overrides.cargo ?? ofertasCargo };
      }
      const res = await callAdmin('consultas', { tipo, ...extra });
      // todos_llamados devuelve { concursos, por_pais, total }
      if (tipo === 'todos_llamados' && res?.concursos) {
        setResultados(res.concursos);
        setLlamadosPorPais(res.por_pais ?? null);
        setLlamadosTotal({ total: res.total ?? res.concursos.length, cargados: res.cargados ?? res.concursos.length });
        setOfertasPorPais(null);
      } else if (tipo === 'ofertas_empleadores' && res?.ofertas) {
        setResultados(res.ofertas);
        setOfertasPorPais(res.por_pais ?? null);
        setLlamadosPorPais(null);
      } else if (Array.isArray(res)) {
        setResultados(res);
        setLlamadosPorPais(null);
        setOfertasPorPais(null);
      } else {
        setResultadosMeta(res);
        setLlamadosPorPais(null);
        setOfertasPorPais(null);
      }
    } catch (e) { setErrorMsg(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }
  ejecutarRef.current = ejecutar;

  function cambiarPeriodo(d)     { setSinActividadDias(d); ejecutar('sin_actividad', { dias: d }); }
  function filtrarMensajes()     { ejecutar('mensajes_resumen'); }
  function buscarLlamados()      { ejecutar('todos_llamados'); }
  function cambiarTipoLlamado(t) { setLlamadosTipo(t); ejecutar('todos_llamados', { tipo_vinculo: t }); }
  function cambiarPais(p)        { setLlamadosPais(p); ejecutar('todos_llamados', { pais: p }, true); }
  function cambiarOfertasPais(p) { setOfertasPais(p); ejecutar('ofertas_empleadores', { pais: p }, true); }
  function buscarOfertas()       { ejecutar('ofertas_empleadores'); }

  function toggleSeleccion(id) {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function seleccionarTodos() { setSeleccionados(resultados.filter(u => u.id).map(u => u.id)); }
  function limpiarSeleccion() { setSeleccionados([]); setModoSeleccion(false); }

  const consultaActual    = CONSULTAS.find(c => c.id === consulta);
  const esRanking         = consulta === 'top_oficios' || consulta === 'demanda_concursos';
  const esConcursos       = consulta === 'todos_llamados';
  const esEmpleadores     = consulta === 'top_empleadores';
  const esMensajesResumen = consulta === 'mensajes_resumen';
  const esOfertas         = consulta === 'ofertas_empleadores';
  const esUsuarios        = !esRanking && !esConcursos && !esEmpleadores && !esMensajesResumen && !esOfertas && consulta !== null;
  const puedeSeleccionar  = esUsuarios && resultados.length > 0;

  return (
    <View style={{ flex: 1 }}>
      {consulta === null ? (
        /* ── Full grid when nothing selected ── */
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
          <Text style={ss.secTit}>CONSULTAS RÁPIDAS</Text>
          <View style={ss.consultasGrid}>
            {CONSULTAS.map(c => (
              <TouchableOpacity key={c.id}
                style={[ss.consultaBtn, { borderColor: c.color + '55' }]}
                onPress={() => ejecutar(c.id)} activeOpacity={0.8}
              >
                <Text style={ss.consultaEmoji}>{c.emoji}</Text>
                <Text style={[ss.consultaLbl, { color: c.color }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        /* ── Chip strip + results ── */
        <View style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={ss.chipBack}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
          >
            {CONSULTAS.map(c => (
              <TouchableOpacity key={c.id}
                style={[ss.chip, consulta === c.id && { backgroundColor: c.color + '20', borderColor: c.color }]}
                onPress={() => ejecutar(c.id)} activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
                <Text style={[ss.chipTxt, consulta === c.id && { color: c.color }]} numberOfLines={1}>
                  {c.label.replace('\n', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#EDE8E2' }}>
            {/* Result header */}
            <View style={ss.resultHeader}>
              <Text style={[ss.resultTit, { color: consultaActual?.color }]} numberOfLines={1}>
                {consultaActual?.emoji} {consultaActual?.label?.replace('\n', ' ')}
                {consulta === 'sin_actividad' ? ` · ${sinActividadDias}d` : ''}
              </Text>
              {liveActualizado && (
                <Text style={{ fontSize: 10, color: '#22C55E', fontWeight: '800' }}>● actualizado</Text>
              )}
              {!loading && !errorMsg && !esMensajesResumen && (
                esConcursos && llamadosTotal
                  ? <Text style={ss.resultCount}>
                      {llamadosTotal.cargados} cargados · {llamadosTotal.total} en DB
                    </Text>
                  : <Text style={ss.resultCount}>{resultados.length} resultado{resultados.length !== 1 ? 's' : ''}</Text>
              )}
            </View>

            {/* Breakdown por país — solo en todos_llamados */}
            {esConcursos && !loading && llamadosPorPais && Object.keys(llamadosPorPais).length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingBottom: 8 }}
              >
                {Object.entries(llamadosPorPais)
                  .sort((a, b) => b[1] - a[1])
                  .map(([pais, count]) => (
                    <TouchableOpacity key={pais} style={ss.paisCountChip} onPress={() => cambiarPais(pais)}>
                      <Text style={{ fontSize: 13 }}>{BANDERAS[pais] ?? '🌍'}</Text>
                      <Text style={ss.paisCountTxt}>{count}</Text>
                    </TouchableOpacity>
                  ))
                }
              </ScrollView>
            )}

            {/* Breakdown por país — ofertas_empleadores */}
            {esOfertas && !loading && ofertasPorPais && Object.keys(ofertasPorPais).length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingBottom: 8 }}
              >
                {Object.entries(ofertasPorPais)
                  .sort((a, b) => b[1] - a[1])
                  .map(([pais, count]) => (
                    <TouchableOpacity key={pais} style={ss.paisCountChip} onPress={() => cambiarOfertasPais(pais)}>
                      <Text style={{ fontSize: 13 }}>{BANDERAS[pais] ?? '🌍'}</Text>
                      <Text style={ss.paisCountTxt}>{count}</Text>
                    </TouchableOpacity>
                  ))
                }
              </ScrollView>
            )}

            {/* Period picker — sin_actividad */}
            {consulta === 'sin_actividad' && (
              <View style={ss.periodosWrap}>
                {[30, 15, 10, 5].map(d => (
                  <TouchableOpacity key={d}
                    style={[ss.periodoBtn, sinActividadDias === d && ss.periodoBtnA]}
                    onPress={() => cambiarPeriodo(d)} disabled={loading}
                  >
                    <Text style={[ss.periodoTxt, sinActividadDias === d && ss.periodoTxtA]}>{d} días</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Filter row — mensajes_resumen */}
            {esMensajesResumen && (
              <View style={ss.msgFiltrosWrap}>
                <View style={[ss.searchBox, { flex: 1, marginBottom: 0 }]}>
                  <Text style={{ fontSize: 13, marginRight: 6 }}>🌍</Text>
                  <TextInput style={[ss.searchInput, { fontSize: 12 }]} placeholder="País..." placeholderTextColor="#A898B8" value={msgPais} onChangeText={setMsgPais} />
                  {msgPais.length > 0 && <TouchableOpacity onPress={() => setMsgPais('')}><Text style={{ fontSize: 13, color: '#A898B8' }}>✕</Text></TouchableOpacity>}
                </View>
                <View style={{ width: 8 }} />
                <View style={[ss.searchBox, { flex: 1, marginBottom: 0 }]}>
                  <Text style={{ fontSize: 13, marginRight: 6 }}>🔧</Text>
                  <TextInput style={[ss.searchInput, { fontSize: 12 }]} placeholder="Sector laboral..." placeholderTextColor="#A898B8" value={msgSector} onChangeText={setMsgSector} />
                  {msgSector.length > 0 && <TouchableOpacity onPress={() => setMsgSector('')}><Text style={{ fontSize: 13, color: '#A898B8' }}>✕</Text></TouchableOpacity>}
                </View>
                <TouchableOpacity style={ss.filtrarBtn} onPress={filtrarMensajes} disabled={loading}>
                  <Text style={ss.filtrarBtnTxt}>Filtrar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Filter section — todos_llamados */}
            {esConcursos && (
              <View style={ss.llamadosFiltros}>
                {/* Fila 1: Tipo (Todos / Públicos / Privados) */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                  {[{ id: 'todos', label: 'Todos' }, { id: 'publico', label: '🏛️ Públicos' }, { id: 'privado', label: '🏢 Privados' }].map(op => (
                    <TouchableOpacity key={op.id}
                      style={[ss.filtroBtn, llamadosTipo === op.id && ss.filtroBtnA]}
                      onPress={() => cambiarTipoLlamado(op.id)} disabled={loading}
                    >
                      <Text style={[ss.filtroTxt, llamadosTipo === op.id && ss.filtroTxtA]}>{op.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {/* Fila 2: País (chips por país) */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                  {[
                    { id: '', label: '🌎 Todos' },
                    { id: 'UY', label: '🇺🇾 Uruguay' },
                    { id: 'AR', label: '🇦🇷 Argentina' },
                    { id: 'BR', label: '🇧🇷 Brasil' },
                    { id: 'CL', label: '🇨🇱 Chile' },
                    { id: 'CO', label: '🇨🇴 Colombia' },
                    { id: 'PE', label: '🇵🇪 Perú' },
                    { id: 'PY', label: '🇵🇾 Paraguay' },
                    { id: 'BO', label: '🇧🇴 Bolivia' },
                    { id: 'EC', label: '🇪🇨 Ecuador' },
                    { id: 'MX', label: '🇲🇽 México' },
                    { id: 'VE', label: '🇻🇪 Venezuela' },
                    { id: 'CU', label: '🇨🇺 Cuba' },
                    { id: 'CR', label: '🇨🇷 Costa Rica' },
                    { id: 'GT', label: '🇬🇹 Guatemala' },
                    { id: 'SV', label: '🇸🇻 El Salvador' },
                    { id: 'HN', label: '🇭🇳 Honduras' },
                    { id: 'NI', label: '🇳🇮 Nicaragua' },
                    { id: 'PA', label: '🇵🇦 Panamá' },
                    { id: 'DO', label: '🇩🇴 Rep. Dominicana' },
                    { id: 'ES', label: '🇪🇸 España' },
                    { id: 'PT', label: '🇵🇹 Portugal' },
                    { id: 'IT', label: '🇮🇹 Italia' },
                    { id: 'FR', label: '🇫🇷 Francia' },
                    { id: 'DE', label: '🇩🇪 Alemania' },
                    { id: 'GB', label: '🇬🇧 Reino Unido' },
                    { id: 'US', label: '🇺🇸 Estados Unidos' },
                    { id: 'CA', label: '🇨🇦 Canadá' },
                    { id: 'AU', label: '🇦🇺 Australia' },
                    { id: 'SE', label: '🇸🇪 Suecia' },
                    { id: 'NO', label: '🇳🇴 Noruega' },
                    { id: 'CH', label: '🇨🇭 Suiza' },
                    { id: 'JP', label: '🇯🇵 Japón' },
                    { id: 'IN', label: '🇮🇳 India' },
                  ].map(op => (
                    <TouchableOpacity key={op.id}
                      style={[ss.filtroBtn, llamadosPais === op.id && { backgroundColor: '#1A3A5C22', borderColor: '#1A3A5C' }]}
                      onPress={() => cambiarPais(op.id)} disabled={loading}
                    >
                      <Text style={[ss.filtroTxt, llamadosPais === op.id && { color: '#1A3A5C', fontWeight: '800' }]}>{op.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {/* Fila 3: Cargo + Buscar */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={[ss.searchBox, { flex: 1, marginBottom: 0 }]}>
                    <Text style={{ fontSize: 13, marginRight: 6 }}>💼</Text>
                    <TextInput style={[ss.searchInput, { fontSize: 12 }]} placeholder="Buscar cargo..." placeholderTextColor="#A898B8" value={llamadosCargo} onChangeText={setLlamadosCargo} />
                    {llamadosCargo.length > 0 && <TouchableOpacity onPress={() => setLlamadosCargo('')}><Text style={{ fontSize: 13, color: '#A898B8' }}>✕</Text></TouchableOpacity>}
                  </View>
                  <TouchableOpacity style={ss.filtrarBtn} onPress={buscarLlamados} disabled={loading}>
                    <Text style={ss.filtrarBtnTxt}>Buscar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Filter section — ofertas_empleadores */}
            {esOfertas && (
              <View style={ss.llamadosFiltros}>
                {/* Fila 1: País */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                  {[
                    { id: '', label: '🌎 Todos' },
                    { id: 'UY', label: '🇺🇾 Uruguay' },
                    { id: 'AR', label: '🇦🇷 Argentina' },
                    { id: 'BR', label: '🇧🇷 Brasil' },
                    { id: 'CL', label: '🇨🇱 Chile' },
                    { id: 'CO', label: '🇨🇴 Colombia' },
                    { id: 'PE', label: '🇵🇪 Perú' },
                    { id: 'PY', label: '🇵🇾 Paraguay' },
                    { id: 'BO', label: '🇧🇴 Bolivia' },
                    { id: 'EC', label: '🇪🇨 Ecuador' },
                    { id: 'MX', label: '🇲🇽 México' },
                    { id: 'VE', label: '🇻🇪 Venezuela' },
                    { id: 'CU', label: '🇨🇺 Cuba' },
                    { id: 'CR', label: '🇨🇷 Costa Rica' },
                    { id: 'GT', label: '🇬🇹 Guatemala' },
                    { id: 'SV', label: '🇸🇻 El Salvador' },
                    { id: 'HN', label: '🇭🇳 Honduras' },
                    { id: 'NI', label: '🇳🇮 Nicaragua' },
                    { id: 'PA', label: '🇵🇦 Panamá' },
                    { id: 'DO', label: '🇩🇴 Rep. Dominicana' },
                    { id: 'ES', label: '🇪🇸 España' },
                    { id: 'PT', label: '🇵🇹 Portugal' },
                    { id: 'IT', label: '🇮🇹 Italia' },
                    { id: 'FR', label: '🇫🇷 Francia' },
                    { id: 'DE', label: '🇩🇪 Alemania' },
                    { id: 'GB', label: '🇬🇧 Reino Unido' },
                    { id: 'US', label: '🇺🇸 Estados Unidos' },
                    { id: 'CA', label: '🇨🇦 Canadá' },
                    { id: 'AU', label: '🇦🇺 Australia' },
                    { id: 'SE', label: '🇸🇪 Suecia' },
                    { id: 'NO', label: '🇳🇴 Noruega' },
                    { id: 'CH', label: '🇨🇭 Suiza' },
                    { id: 'JP', label: '🇯🇵 Japón' },
                    { id: 'IN', label: '🇮🇳 India' },
                  ].map(op => (
                    <TouchableOpacity key={op.id}
                      style={[ss.filtroBtn, ofertasPais === op.id && { backgroundColor: '#7C3AED22', borderColor: '#7C3AED' }]}
                      onPress={() => cambiarOfertasPais(op.id)} disabled={loading}
                    >
                      <Text style={[ss.filtroTxt, ofertasPais === op.id && { color: '#7C3AED', fontWeight: '800' }]}>{op.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {/* Fila 2: Ciudad + Cargo + Buscar */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <View style={[ss.searchBox, { flex: 1, marginBottom: 0 }]}>
                    <Text style={{ fontSize: 13, marginRight: 6 }}>📍</Text>
                    <TextInput style={[ss.searchInput, { fontSize: 12 }]} placeholder="Ciudad..." placeholderTextColor="#A898B8" value={ofertasCiudad} onChangeText={setOfertasCiudad} />
                    {ofertasCiudad.length > 0 && <TouchableOpacity onPress={() => setOfertasCiudad('')}><Text style={{ fontSize: 13, color: '#A898B8' }}>✕</Text></TouchableOpacity>}
                  </View>
                  <View style={[ss.searchBox, { flex: 1, marginBottom: 0 }]}>
                    <Text style={{ fontSize: 13, marginRight: 6 }}>💼</Text>
                    <TextInput style={[ss.searchInput, { fontSize: 12 }]} placeholder="Cargo..." placeholderTextColor="#A898B8" value={ofertasCargo} onChangeText={setOfertasCargo} />
                    {ofertasCargo.length > 0 && <TouchableOpacity onPress={() => setOfertasCargo('')}><Text style={{ fontSize: 13, color: '#A898B8' }}>✕</Text></TouchableOpacity>}
                  </View>
                  <TouchableOpacity style={[ss.filtrarBtn, { backgroundColor: '#7C3AED' }]} onPress={buscarOfertas} disabled={loading}>
                    <Text style={ss.filtrarBtnTxt}>Buscar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Selection toolbar */}
            {puedeSeleccionar && (
              <View style={ss.selectToolbar}>
                {modoSeleccion ? (
                  <>
                    <TouchableOpacity onPress={seleccionarTodos} style={ss.selectBtn}>
                      <Text style={ss.selectBtnTxt}>Todos ({resultados.length})</Text>
                    </TouchableOpacity>
                    <Text style={ss.selectCount}>{seleccionados.length} sel.</Text>
                    <TouchableOpacity onPress={limpiarSeleccion} style={[ss.selectBtn, { borderColor: '#EF4444' }]}>
                      <Text style={[ss.selectBtnTxt, { color: '#EF4444' }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => setModoSeleccion(true)} style={ss.selectBtn}>
                    <Text style={ss.selectBtnTxt}>✉️ Seleccionar para mensaje</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {loading ? <ActivityIndicator color="#E8785A" style={{ padding: 40 }} /> :
             errorMsg ? <Text style={[ss.actualizadoTxt, { color: '#EF4444', padding: 20 }]}>{errorMsg}</Text> : (
              <ScrollView
                contentContainerStyle={{ padding: 12, paddingBottom: modoSeleccion && seleccionados.length > 0 ? 80 : 24 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => ejecutar(consulta, {}, true)} tintColor="#E8785A" />}
              >
                {esMensajesResumen
                  ? <MensajesResumenView datos={resultadosMeta} />
                  : resultados.length === 0
                    ? <Text style={ss.actualizadoTxt}>Sin resultados</Text>
                    : esRanking
                      ? resultados.map((item, i) => <RankCard key={item.oficio ?? i} item={item} rank={i + 1} />)
                      : esConcursos
                        ? resultados.map((c, i) => <ConcursoCard key={c.id ?? i} c={c} onPress={()=>navigation.navigate('ConcursaDetalle',{match:c})} />)
                        : esOfertas
                          ? resultados.map((o, i) => <OfertaCard key={o.id ?? i} o={o} />)
                          : esEmpleadores
                          ? resultados.map((item, i) => (
                              <TouchableOpacity key={item.id ?? i} style={ss.userCard} onPress={() => onDetalleUsuario(item)} activeOpacity={0.8}>
                                <View style={[ss.userAvatar, { backgroundColor: '#FFF3F0' }]}><Text style={{ fontSize: 22 }}>🏢</Text></View>
                                <View style={{ flex: 1 }}>
                                  <Text style={ss.userNombre} numberOfLines={1}>{item.nombre} {item.apellido1 ?? ''}</Text>
                                  <Text style={ss.userZona} numberOfLines={1}>{[item.ciudad, item.pais].filter(Boolean).join(', ') || '—'}</Text>
                                </View>
                                <View style={[ss.statusBadge, { backgroundColor: '#FFF3F0', borderColor: '#E8785A' }]}>
                                  <Text style={[ss.statusTxt, { color: '#E8785A' }]}>${fmt(item.total_gastado)}</Text>
                                </View>
                              </TouchableOpacity>
                            ))
                          : resultados.map((u, i) => {
                              const sel = seleccionados.includes(u.id);
                              const sc = u.perfil_activo ? '#22C55E' : '#A898B8';
                              const dias = diasRestantes(u.perfil_activo_hasta);
                              return (
                                <TouchableOpacity key={u.id ?? i}
                                  style={[ss.userCard, modoSeleccion && sel && ss.userCardSel]}
                                  onPress={() => modoSeleccion ? toggleSeleccion(u.id) : onDetalleUsuario(u)}
                                  onLongPress={() => { if (!modoSeleccion) { setModoSeleccion(true); toggleSeleccion(u.id); } }}
                                  activeOpacity={0.8}
                                >
                                  {modoSeleccion && (
                                    <View style={[ss.checkBox, sel && ss.checkBoxSel]}>
                                      {sel && <Text style={{ fontSize: 10, color: '#FFF', fontWeight: '900' }}>✓</Text>}
                                    </View>
                                  )}
                                  <View style={[ss.userAvatar, { backgroundColor: u.perfil_activo ? '#E6FBF5' : '#F2EDE6' }]}>
                                    <Text style={{ fontSize: 22 }}>{u.perfil_activo ? '✅' : '👤'}</Text>
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={ss.userNombre} numberOfLines={1}>{u.nombre} {u.apellido1 ?? ''}</Text>
                                    <Text style={ss.userOficio} numberOfLines={1}>{oficio(u)}</Text>
                                    <Text style={ss.userZona} numberOfLines={1}>{[u.ciudad, u.pais].filter(Boolean).join(', ') || '—'}</Text>
                                  </View>
                                  {!modoSeleccion && (
                                    <View style={[ss.statusBadge, { backgroundColor: sc + '22', borderColor: sc }]}>
                                      <Text style={[ss.statusTxt, { color: sc }]}>
                                        {u.perfil_activo ? (dias != null ? `${dias}d` : 'Activo') : 'Inactivo'}
                                      </Text>
                                    </View>
                                  )}
                                </TouchableOpacity>
                              );
                            })
                }
              </ScrollView>
            )}

            {/* Send message bottom bar */}
            {modoSeleccion && seleccionados.length > 0 && (
              <View style={ss.msgBottomBar}>
                <Text style={ss.msgBottomCount}>{seleccionados.length} usuario{seleccionados.length !== 1 ? 's' : ''}</Text>
                <TouchableOpacity style={ss.msgEnviarBtn} onPress={() => setMsgVisible(true)}>
                  <Text style={ss.msgEnviarTxt}>✉️ Enviar mensaje</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      <MensajeModal
        visible={msgVisible}
        cantidad={seleccionados.length}
        receiverIds={seleccionados}
        onClose={() => setMsgVisible(false)}
        onEnviado={() => { setMsgVisible(false); limpiarSeleccion(); }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Moderación
// ─────────────────────────────────────────────────────────────────────────────
function TabModeracion({ onDetalleUsuario }) {
  const [lista, setLista]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [expandido, setExpandido] = useState(null);
  const [accionando, setAccionando] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true); setError('');
    try {
      const res = await callAdmin('reportes_pendientes');
      setLista(Array.isArray(res) ? res : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function accion(reportedId, tipo) {
    setAccionando(true);
    try {
      await callAdmin('resolver_reporte', { reported_id: reportedId, accion: tipo });
      if (tipo === 'confirmar') {
        Alert.alert('✅ Suspendido', 'El perfil fue suspendido.');
      } else {
        Alert.alert('✅ Reportes ignorados', 'El perfil sigue activo.');
      }
      cargar();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setAccionando(false); }
  }

  if (loading) return <ActivityIndicator color="#E8785A" style={{ marginTop: 40 }} />;
  if (error)   return <View style={{ padding: 24 }}><Text style={{ color: '#EF4444', textAlign: 'center' }}>{error}</Text><TouchableOpacity style={ss.limpiarBtn} onPress={cargar}><Text style={ss.limpiarTxt}>Reintentar</Text></TouchableOpacity></View>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never">
      {lista.length === 0 && (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>✅</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1020' }}>Sin reportes pendientes</Text>
          <Text style={{ fontSize: 13, color: '#A898B8', marginTop: 6 }}>No hay denuncias para revisar</Text>
          <TouchableOpacity style={[ss.limpiarBtn, { marginTop: 20 }]} onPress={cargar}><Text style={ss.limpiarTxt}>Actualizar</Text></TouchableOpacity>
        </View>
      )}
      {lista.map((item) => {
        const p = item.perfil ?? {};
        const reportes = item.reportes ?? [];
        const suspendido = p.suspendido;
        const abierto = expandido === p.id;
        return (
          <View key={p.id} style={[ss.reporteCard, suspendido && { borderLeftColor: '#EF4444', borderLeftWidth: 4 }]}>
            <TouchableOpacity onPress={() => setExpandido(abierto ? null : p.id)} activeOpacity={0.8}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[ss.reporteBadge, { backgroundColor: suspendido ? '#FEF2F2' : '#FEF9C3' }]}>
                  <Text style={{ fontSize: 18 }}>{suspendido ? '🚫' : '⚠️'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.reporteNombre} numberOfLines={1}>{p.nombre} {p.apellido1 ?? ''}</Text>
                  <Text style={ss.reporteEmail} numberOfLines={1}>{item.email}</Text>
                  <Text style={ss.reporteZona} numberOfLines={1}>{[p.ciudad, p.pais].filter(Boolean).join(', ') || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={[ss.statusBadge, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}>
                    <Text style={[ss.statusTxt, { color: '#EF4444' }]}>{reportes.length} denuncia{reportes.length !== 1 ? 's' : ''}</Text>
                  </View>
                  {suspendido && (
                    <View style={[ss.statusBadge, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}>
                      <Text style={[ss.statusTxt, { color: '#EF4444' }]}>Suspendido</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 10, color: '#A898B8' }}>{abierto ? '▲' : '▼'}</Text>
                </View>
              </View>
            </TouchableOpacity>

            {abierto && (
              <View style={{ marginTop: 12 }}>
                {reportes.map((r, i) => (
                  <View key={r.id} style={[ss.reporteItem, i > 0 && { borderTopWidth: 1, borderTopColor: '#EDE8E2' }]}>
                    <Text style={ss.reporteMotivo}>{r.motivo}</Text>
                    {r.detalle ? <Text style={ss.reporteDetalle}>{r.detalle}</Text> : null}
                    <Text style={ss.reporteFecha}>{fmtFecha(r.created_at)}</Text>
                  </View>
                ))}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <TouchableOpacity style={ss.reporteVerBtn} onPress={() => onDetalleUsuario(p)}>
                    <Text style={ss.reporteVerTxt}>Ver perfil</Text>
                  </TouchableOpacity>
                  {suspendido ? (
                    <TouchableOpacity
                      style={[ss.reporteAccionBtn, { backgroundColor: '#E6FBF5', borderColor: '#3DA882', flex: 1 }]}
                      onPress={() => Alert.alert('Restaurar', `¿Restaurar el perfil de ${p.nombre}?`, [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Restaurar', onPress: () => accion(p.id, 'ignorar') },
                      ])}
                      disabled={accionando}
                    >
                      <Text style={[ss.reporteAccionTxt, { color: '#2E9472' }]}>✅ Restaurar</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[ss.reporteAccionBtn, { backgroundColor: '#F0FDF4', borderColor: '#3DA882', flex: 1 }]}
                        onPress={() => accion(p.id, 'ignorar')}
                        disabled={accionando}
                      >
                        <Text style={[ss.reporteAccionTxt, { color: '#2E9472' }]}>Ignorar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[ss.reporteAccionBtn, { backgroundColor: '#FEF2F2', borderColor: '#EF4444', flex: 1 }]}
                        onPress={() => Alert.alert('Suspender', `¿Suspender definitivamente a ${p.nombre}?`, [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Suspender', style: 'destructive', onPress: () => accion(p.id, 'confirmar') },
                        ])}
                        disabled={accionando}
                      >
                        <Text style={[ss.reporteAccionTxt, { color: '#EF4444' }]}>🚫 Suspender</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Campañas
// ─────────────────────────────────────────────────────────────────────────────

const FRASES_REACTIVACION = {
  es: [
    "Dos minutos de presente pueden cambiar todo tu futuro. Es la ley de causa y efecto. Activá tu perfil.",
    "Una llamada, una conexión tiene el potencial de cambiar tu realidad presente. Y el presente determina el futuro. Activá tu perfil.",
    "Una pequeña acción puede abrir la puerta que tus manos dudan en golpear. Activá tu perfil.",
    "El éxito no es otra cosa que un montón de pequeñas acciones tomadas en el camino correcto. Activá tu perfil.",
    "Algún día vas a mirar para atrás y vas a recordar el momento exacto en que todo empezó a cambiar. Puede ser hoy. Activá tu perfil.",
    "No subestimes lo que puede desencadenar una sola acción simple. La historia está llena de vidas que cambiaron por menos que esto. Activá tu perfil.",
    "Tus oportunidades están aquí, en algún lugar. Vos, ¿dónde estás? Activá tu perfil.",
    "Hay una versión de tu vida donde todo es como lo soñás. Vos sos el director de esa película. Solo tenés que decir acción: activá tu perfil.",
    "El próximo capítulo de tu vida laboral puede empezar hoy. Literalmente hoy. Con una acción que te lleva menos tiempo que leer este mensaje. Activá tu perfil.",
    "Simple. Rápido. Con potencial de cambiarte la vida. Pocas cosas cumplen esas tres condiciones al mismo tiempo. Esta sí: activá tu perfil.",
    "¿Cuánto vale para vos conseguir un trabajo mejor? Ese proceso empieza aquí. Activá tu perfil.",
    "Dos minutos ahora pueden ser el inicio de aquello que solo te atreves a soñar. Activá tu perfil.",
  ],
  pt: [
    "Dois minutos de presente podem mudar todo o seu futuro. É a lei de causa e efeito. Ative seu perfil.",
    "Uma ligação, uma conexão tem o potencial de mudar sua realidade presente. E o presente determina o futuro. Ative seu perfil.",
    "Uma pequena ação pode abrir a porta que suas mãos hesitam em bater. Ative seu perfil.",
    "O sucesso não é outra coisa senão um monte de pequenas ações tomadas no caminho certo. Ative seu perfil.",
    "Um dia você vai olhar pra trás e vai lembrar do momento exato em que tudo começou a mudar. Pode ser hoje. Ative seu perfil.",
    "Não subestime o que uma única ação simples pode desencadear. A história está cheia de vidas que mudaram por menos que isso. Ative seu perfil.",
    "Suas oportunidades estão aqui, em algum lugar. Você, onde está? Ative seu perfil.",
    "Existe uma versão da sua vida onde tudo é como você sonha. Você é o diretor desse filme. Só precisa dizer ação: ative seu perfil.",
    "O próximo capítulo da sua vida profissional pode começar hoje. Literalmente hoje. Com uma ação que leva menos tempo que ler essa mensagem. Ative seu perfil.",
    "Simples. Rápido. Com potencial de mudar sua vida. Poucas coisas cumprem essas três condições ao mesmo tempo. Esta sim: ative seu perfil.",
    "Quanto vale pra você conseguir um emprego melhor? Esse processo começa aqui. Ative seu perfil.",
    "Dois minutos agora podem ser o início daquilo que você só ousa sonhar. Ative seu perfil.",
  ],
  en: [
    "Two minutes of the present can change your entire future. That is the law of cause and effect. Activate your profile.",
    "One call, one connection has the potential to change your present reality. And the present determines the future. Activate your profile.",
    "One small action can open the door your hands hesitate to knock on. Activate your profile.",
    "Success is nothing more than a series of small actions taken on the right path. Activate your profile.",
    "One day you will look back and remember the exact moment everything started to change. It can be today. Activate your profile.",
    "Do not underestimate what a single simple action can trigger. History is full of lives that changed for less than this. Activate your profile.",
    "Your opportunities are here, somewhere. Where are you? Activate your profile.",
    "There is a version of your life where everything is just as you dream. You are the director of that film. All you have to do is say action: activate your profile.",
    "The next chapter of your professional life can start today. Literally today. With an action that takes less time than reading this message. Activate your profile.",
    "Simple. Fast. With the potential to change your life. Few things meet all three conditions at once. This one does: activate your profile.",
    "How much is getting a better job worth to you? That process starts here. Activate your profile.",
    "Two minutes now can be the beginning of what you only dare to dream. Activate your profile.",
  ],
  fr: [
    "Deux minutes du présent peuvent changer tout ton avenir. C'est la loi de cause à effet. Active ton profil.",
    "Un appel, une connexion a le potentiel de changer ta réalité présente. Et le présent détermine l'avenir. Active ton profil.",
    "Une petite action peut ouvrir la porte que tes mains hésitent à frapper. Active ton profil.",
    "Le succès n'est rien d'autre qu'un ensemble de petites actions prises sur le bon chemin. Active ton profil.",
    "Un jour tu regarderas en arrière et tu te souviendras du moment exact où tout a commencé à changer. Ça peut être aujourd'hui. Active ton profil.",
    "Ne sous-estime pas ce qu'une seule action simple peut déclencher. L'histoire est pleine de vies qui ont changé pour moins que ça. Active ton profil.",
    "Tes opportunités sont là, quelque part. Toi, où es-tu ? Active ton profil.",
    "Il existe une version de ta vie où tout est comme tu le rêves. Tu es le réalisateur de ce film. Tu n'as qu'à dire action : active ton profil.",
    "Le prochain chapitre de ta vie professionnelle peut commencer aujourd'hui. Littéralement aujourd'hui. Avec une action qui prend moins de temps que lire ce message. Active ton profil.",
    "Simple. Rapide. Avec le potentiel de changer ta vie. Peu de choses remplissent ces trois conditions à la fois. Celle-ci oui : active ton profil.",
    "Combien vaut pour toi décrocher un meilleur emploi ? Ce processus commence ici. Active ton profil.",
    "Deux minutes maintenant peuvent être le début de ce que tu n'oses qu'à peine rêver. Active ton profil.",
  ],
  de: [
    "Zwei Minuten der Gegenwart können deine gesamte Zukunft verändern. Das ist das Gesetz von Ursache und Wirkung. Aktiviere dein Profil.",
    "Ein Anruf, eine Verbindung hat das Potenzial, deine gegenwärtige Realität zu verändern. Und die Gegenwart bestimmt die Zukunft. Aktiviere dein Profil.",
    "Eine kleine Handlung kann die Tür öffnen, an die deine Hände zögern zu klopfen. Aktiviere dein Profil.",
    "Erfolg ist nichts anderes als eine Reihe kleiner Handlungen auf dem richtigen Weg. Aktiviere dein Profil.",
    "Eines Tages wirst du zurückblicken und dich an den genauen Moment erinnern, als sich alles zu ändern begann. Das kann heute sein. Aktiviere dein Profil.",
    "Unterschätze nicht, was eine einzige einfache Handlung auslösen kann. Die Geschichte ist voll von Leben, die sich für weniger als das verändert haben. Aktiviere dein Profil.",
    "Deine Chancen sind hier, irgendwo. Du, wo bist du? Aktiviere dein Profil.",
    "Es gibt eine Version deines Lebens, in der alles so ist, wie du es träumst. Du bist der Regisseur dieses Films. Du musst nur Aktion sagen: Aktiviere dein Profil.",
    "Das nächste Kapitel deines Berufslebens kann heute beginnen. Buchstäblich heute. Mit einer Aktion, die weniger Zeit braucht als diese Nachricht zu lesen. Aktiviere dein Profil.",
    "Einfach. Schnell. Mit dem Potenzial, dein Leben zu verändern. Wenige Dinge erfüllen diese drei Bedingungen gleichzeitig. Dieses schon: Aktiviere dein Profil.",
    "Wie viel ist es dir wert, einen besseren Job zu bekommen? Dieser Prozess beginnt hier. Aktiviere dein Profil.",
    "Zwei Minuten jetzt können der Beginn von dem sein, was du dir kaum zu träumen wagst. Aktiviere dein Profil.",
  ],
  it: [
    "Due minuti del presente possono cambiare tutto il tuo futuro. È la legge di causa ed effetto. Attiva il tuo profilo.",
    "Una telefonata, una connessione ha il potenziale di cambiare la tua realtà presente. E il presente determina il futuro. Attiva il tuo profilo.",
    "Una piccola azione può aprire la porta che le tue mani esitano a bussare. Attiva il tuo profilo.",
    "Il successo non è altro che una serie di piccole azioni intraprese sulla strada giusta. Attiva il tuo profilo.",
    "Un giorno guarderai indietro e ricorderai il momento esatto in cui tutto ha iniziato a cambiare. Può essere oggi. Attiva il tuo profilo.",
    "Non sottovalutare cosa può innescare una singola azione semplice. La storia è piena di vite cambiate per meno di questo. Attiva il tuo profilo.",
    "Le tue opportunità sono qui, da qualche parte. Tu, dove sei? Attiva il tuo profilo.",
    "Esiste una versione della tua vita in cui tutto è come lo sogni. Tu sei il regista di quel film. Devi solo dire azione: attiva il tuo profilo.",
    "Il prossimo capitolo della tua vita professionale può iniziare oggi. Letteralmente oggi. Con un'azione che richiede meno tempo che leggere questo messaggio. Attiva il tuo profilo.",
    "Semplice. Veloce. Con il potenziale di cambiarti la vita. Poche cose soddisfano queste tre condizioni allo stesso tempo. Questa sì: attiva il tuo profilo.",
    "Quanto vale per te trovare un lavoro migliore? Quel processo inizia qui. Attiva il tuo profilo.",
    "Due minuti adesso possono essere l'inizio di ciò che osi solo sognare. Attiva il tuo profilo.",
  ],
  sv: [
    "Två minuter av nuet kan förändra hela din framtid. Det är orsak och verkan. Aktivera din profil.",
    "Ett samtal, en kontakt har potential att förändra din nuvarande verklighet. Och nuet bestämmer framtiden. Aktivera din profil.",
    "En liten handling kan öppna dörren som dina händer tvekar att knacka på. Aktivera din profil.",
    "Framgång är ingenting annat än en massa små handlingar tagna på rätt väg. Aktivera din profil.",
    "En dag kommer du att blicka tillbaka och minnas det exakta ögonblicket när allt började förändras. Det kan vara idag. Aktivera din profil.",
    "Underskatta inte vad en enda enkel handling kan utlösa. Historien är full av liv som förändrats för mindre än detta. Aktivera din profil.",
    "Dina möjligheter finns här, någonstans. Du, var är du? Aktivera din profil.",
    "Det finns en version av ditt liv där allt är som du drömmer. Du är regissören av den filmen. Du behöver bara säga action: aktivera din profil.",
    "Nästa kapitel i ditt yrkesliv kan börja idag. Bokstavligen idag. Med en handling som tar kortare tid än att läsa det här meddelandet. Aktivera din profil.",
    "Enkelt. Snabbt. Med potential att förändra ditt liv. Få saker uppfyller dessa tre villkor samtidigt. Det här gör det: aktivera din profil.",
    "Hur mycket är det värt för dig att få ett bättre jobb? Den processen börjar här. Aktivera din profil.",
    "Två minuter nu kan vara början på det du bara vågar drömma om. Aktivera din profil.",
  ],
  no: [
    "To minutter av nåtiden kan forandre hele fremtiden din. Det er årsak og virkning. Aktiver profilen din.",
    "En samtale, en forbindelse har potensial til å forandre din nåværende virkelighet. Og nåtiden bestemmer fremtiden. Aktiver profilen din.",
    "En liten handling kan åpne døren som hendene dine nøler med å banke på. Aktiver profilen din.",
    "Suksess er ingenting annet enn en haug med små handlinger tatt på riktig vei. Aktiver profilen din.",
    "En dag vil du se tilbake og huske det nøyaktige øyeblikket da alt begynte å forandre seg. Det kan være i dag. Aktiver profilen din.",
    "Ikke undervurder hva en eneste enkel handling kan utløse. Historien er full av liv som forandret seg for mindre enn dette. Aktiver profilen din.",
    "Mulighetene dine er her, et sted. Du, hvor er du? Aktiver profilen din.",
    "Det finnes en versjon av livet ditt der alt er slik du drømmer. Du er regissøren av den filmen. Du trenger bare å si action: aktiver profilen din.",
    "Neste kapittel i arbeidslivet ditt kan begynne i dag. Bokstavelig talt i dag. Med en handling som tar kortere tid enn å lese denne meldingen. Aktiver profilen din.",
    "Enkelt. Raskt. Med potensial til å forandre livet ditt. Få ting oppfyller disse tre betingelsene samtidig. Dette gjør det: aktiver profilen din.",
    "Hvor mye er det verdt for deg å få en bedre jobb? Den prosessen begynner her. Aktiver profilen din.",
    "To minutter nå kan være begynnelsen på det du bare tør å drømme om. Aktiver profilen din.",
  ],
  ja: [
    "今の2分間が、あなたの未来全体を変えることができます。これは因果の法則です。プロフィールを有効にしてください。",
    "一本の電話、一つのつながりが、今の現実を変える力を持っています。そして今が未来を決めます。プロフィールを有効にしてください。",
    "小さな行動が、あなたの手が叩くのをためらっているドアを開けられます。プロフィールを有効にしてください。",
    "成功とは、正しい道で積み重ねた無数の小さな行動に他なりません。プロフィールを有効にしてください。",
    "いつかあなたは振り返り、すべてが変わり始めたその瞬間を思い出すでしょう。それは今日かもしれません。プロフィールを有効にしてください。",
    "たった一つのシンプルな行動が何を引き起こすか、過小評価しないでください。歴史はこれ以下のことで変わった人生に満ちています。プロフィールを有効にしてください。",
    "あなたのチャンスはここにあります、どこかに。あなたはどこにいますか？プロフィールを有効にしてください。",
    "あなたが夢に描く通りの人生のバージョンが存在します。あなたはその映画の監督です。アクションと言うだけです：プロフィールを有効にしてください。",
    "あなたのキャリアの次の章は今日始められます。文字通り今日。このメッセージを読むより短い時間でできる行動で。プロフィールを有効にしてください。",
    "シンプル。素早い。あなたの人生を変える可能性を持つ。この3つの条件を同時に満たすものは少ない。これは満たします：プロフィールを有効にしてください。",
    "より良い仕事を得ることは、あなたにとってどれほどの価値がありますか？そのプロセスはここから始まります。プロフィールを有効にしてください。",
    "今の2分間が、あなたがただ夢見るだけのことの始まりになれます。プロフィールを有効にしてください。",
  ],
  hi: [
    "वर्तमान के दो मिनट आपका पूरा भविष्य बदल सकते हैं। यह कारण और प्रभाव का नियम है। अपना प्रोफ़ाइल सक्रिय करें।",
    "एक कॉल, एक संबंध आपकी वर्तमान वास्तविकता बदलने की क्षमता रखता है। और वर्तमान भविष्य तय करता है। अपना प्रोफ़ाइल सक्रिय करें।",
    "एक छोटी सी कार्रवाई वह दरवाज़ा खोल सकती है जिस पर दस्तक देने से आपके हाथ झिझकते हैं। अपना प्रोफ़ाइल सक्रिय करें।",
    "सफलता सही राह पर उठाई गई अनगिनत छोटी कार्रवाइयों के सिवाय कुछ नहीं है। अपना प्रोफ़ाइल सक्रिय करें।",
    "एक दिन आप पीछे मुड़कर देखेंगे और वह सटीक पल याद करेंगे जब सब बदलने लगा था। वह आज हो सकता है। अपना प्रोफ़ाइल सक्रिय करें।",
    "एक साधारण कार्रवाई क्या शुरू कर सकती है, इसे कम मत आंकिए। इतिहास ऐसे जीवनों से भरा है जो इससे कम में बदल गए। अपना प्रोफ़ाइल सक्रिय करें।",
    "आपके अवसर यहाँ हैं, कहीं न कहीं। आप कहाँ हैं? अपना प्रोफ़ाइल सक्रिय करें।",
    "आपके जीवन का एक ऐसा संस्करण मौजूद है जहाँ सब कुछ वैसा है जैसा आप सपने में देखते हैं। आप उस फ़िल्म के निर्देशक हैं। बस एक्शन कहना है: अपना प्रोफ़ाइल सक्रिय करें।",
    "आपके पेशेवर जीवन का अगला अध्याय आज शुरू हो सकता है। सचमुच आज। एक ऐसी कार्रवाई से जो इस संदेश को पढ़ने से भी कम समय लेती है। अपना प्रोफ़ाइल सक्रिय करें।",
    "सरल। तेज़। आपकी ज़िंदगी बदलने की क्षमता के साथ। कम ही चीज़ें एक साथ ये तीन शर्तें पूरी करती हैं। यह करती है: अपना प्रोफ़ाइल सक्रिय करें।",
    "बेहतर नौकरी पाना आपके लिए कितना मायने रखता है? वह प्रक्रिया यहाँ से शुरू होती है। अपना प्रोफ़ाइल सक्रिय करें।",
    "अभी के दो मिनट उस चीज़ की शुरुआत हो सकते हैं जिसे आप सिर्फ़ सपने में देखने की हिम्मत रखते हैं। अपना प्रोफ़ाइल सक्रिय करें।",
  ],
};

const SEGMENTOS = [
  { id: 'todos',        label: '👥 Todos' },
  { id: 'activos',      label: '✅ Activos' },
  { id: 'en_prueba',    label: '🆓 En prueba gratis' },
  { id: 'pagos',        label: '💳 Pagaron alguna vez' },
  { id: 'inactivos',    label: '⭕ Inactivos' },
  { id: 'inactivos_30d',label: '💤 Sin actividad 30d' },
  { id: 'pais',         label: '🌍 Por país' },
];

function fraseRandom(idioma = 'es') {
  const banco = FRASES_REACTIVACION[idioma] ?? FRASES_REACTIVACION.es;
  return banco[Math.floor(Math.random() * banco.length)];
}

function TabCampanas() {
  const { idioma } = useI18n();
  const [segmento, setSegmento]   = useState('inactivos');
  const [sexo, setSexo]           = useState('');        // '' | 'Masculino' | 'Femenino'
  const [pais, setPais]           = useState('');
  const [paisFocus, setPaisFocus] = useState(false);
  const [mensaje, setMensaje]     = useState('');
  const [tipo, setTipo]           = useState('libre');
  const [conteo, setConteo]       = useState(null);
  const [ids, setIds]             = useState([]);
  const [cargandoIds, setCargandoIds] = useState(false);
  const [enviando, setEnviando]   = useState(false);

  function seleccionarTipo(t) {
    setTipo(t);
    if (t === 'motivacional') setMensaje(fraseRandom(idioma));
  }

  const sugerenciasPaises = Object.entries(NOMBRES_PAISES).filter(([cod, nombre]) => {
    const q = pais.toLowerCase();
    return q.length > 0 && (cod.toLowerCase().includes(q) || nombre.toLowerCase().includes(q));
  }).slice(0, 6);

  useEffect(() => {
    setConteo(null); setIds([]);
  }, [segmento, pais, sexo]);

  async function previsualizar() {
    setCargandoIds(true);
    try {
      const res = await callAdmin('ids_segmento', { segmento, pais: segmento === 'pais' ? pais : '', sexo });
      setIds(res.ids ?? []);
      setConteo(res.total ?? 0);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setCargandoIds(false); }
  }

  async function enviar() {
    if (!ids.length && !mensaje.trim()) {
      Alert.alert('Faltan dos cosas', '1. Hacé Vista previa para cargar los destinatarios.\n2. Escribí el mensaje.');
      return;
    }
    if (!ids.length) {
      Alert.alert('Falta Vista previa', 'Tocá "Vista previa →" para cargar los destinatarios antes de enviar.');
      return;
    }
    if (!mensaje.trim()) {
      Alert.alert('Falta el mensaje', 'Escribí el texto que recibirán los usuarios antes de enviar.');
      return;
    }
    Alert.alert(
      'Confirmar envío',
      `¿Enviar mensaje a ${ids.length.toLocaleString('es-UY')} usuarios?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar', onPress: async () => {
          setEnviando(true);
          try {
            const res = await callAdmin('enviar_mensajes', { receiver_ids: ids, texto: mensaje.trim(), tipo });
            Alert.alert('✅ Enviado', `Mensaje enviado a ${res?.enviados ?? ids.length} usuarios.`);
            setMensaje(''); setConteo(null); setIds([]);
          } catch (e) { Alert.alert('Error al enviar', e.message); }
          finally { setEnviando(false); }
        }},
      ]
    );
  }

  const TIPOS = [{ id: 'libre', label: 'Libre' }, { id: 'motivacional', label: '💪 Motivacional' }, { id: 'incentivo', label: '🎁 Incentivo' }];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never">
      <Text style={ss.secTit}>SEGMENTO</Text>
      <View style={ss.statsGrid}>
        {SEGMENTOS.map(s => (
          <TouchableOpacity key={s.id} style={[ss.segBtn, segmento === s.id && ss.segBtnA]} onPress={() => setSegmento(s.id)}>
            <Text style={[ss.segTxt, segmento === s.id && ss.segTxtA]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Selector de género */}
      <Text style={[ss.secTit, { marginTop: 14 }]}>GÉNERO</Text>
      <View style={ss.statsGrid}>
        {[
          { id: '',          label: '👥 Todos' },
          { id: 'Masculino', label: '♂ Hombres' },
          { id: 'Femenino',  label: '♀ Mujeres' },
        ].map(g => (
          <TouchableOpacity key={g.id} style={[ss.segBtn, sexo === g.id && ss.segBtnA]} onPress={() => setSexo(g.id)}>
            <Text style={[ss.segTxt, sexo === g.id && ss.segTxtA]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {segmento === 'pais' && (
        <View style={{ marginBottom: 12, zIndex: 20 }}>
          <View style={[ss.searchBox, { marginBottom: 0 }]}>
            <Text style={{ fontSize: 13, marginRight: 6 }}>🌍</Text>
            <TextInput
              style={ss.searchInput}
              placeholder="País..."
              placeholderTextColor="#A898B8"
              value={pais}
              onChangeText={setPais}
              onFocus={() => setPaisFocus(true)}
              onBlur={() => setTimeout(() => setPaisFocus(false), 200)}
            />
            {pais.length > 0 && <TouchableOpacity onPress={() => { setPais(''); setPaisFocus(false); }}><Text style={{ color: '#A898B8' }}>✕</Text></TouchableOpacity>}
          </View>
          {paisFocus && sugerenciasPaises.length > 0 && (
            <View style={ss.dropdownList}>
              {sugerenciasPaises.map(([cod, nombre]) => (
                <TouchableOpacity key={cod} style={ss.dropdownItem}
                  onPress={() => { setPais(cod); setPaisFocus(false); }}
                >
                  <Text style={{ fontSize: 16, marginRight: 8 }}>{BANDERAS[cod]}</Text>
                  <Text style={{ fontSize: 13, color: '#1A1020', fontWeight: '600' }}>{nombre}</Text>
                  <Text style={{ fontSize: 11, color: '#A898B8', marginLeft: 6 }}>{cod}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={[ss.filtrarBtn, { marginBottom: 16 }, cargandoIds && { opacity: 0.5 }]} onPress={previsualizar} disabled={cargandoIds}>
        {cargandoIds ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={ss.filtrarBtnTxt}>Vista previa →</Text>}
      </TouchableOpacity>

      {conteo !== null && (
        <View style={[ss.barrasCard, { marginBottom: 16 }]}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A3A5C' }}>👥 {conteo.toLocaleString('es-UY')} destinatarios</Text>
          <Text style={{ fontSize: 12, color: '#A898B8', marginTop: 4 }}>El mensaje se enviará como chat interno a todos estos usuarios</Text>
        </View>
      )}

      <Text style={[ss.secTit, { marginTop: 8 }]}>TIPO DE MENSAJE</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {TIPOS.map(t => (
          <TouchableOpacity key={t.id} style={[ss.filtroBtn, tipo === t.id && ss.filtroBtnA, { flex: 1 }]} onPress={() => seleccionarTipo(t.id)}>
            <Text style={[ss.filtroTxt, tipo === t.id && ss.filtroTxtA]} numberOfLines={1}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={ss.secTit}>MENSAJE</Text>
        {tipo === 'motivacional' && (
          <TouchableOpacity onPress={() => setMensaje(fraseRandom(idioma))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 12, color: '#8B5CF6', fontWeight: '700' }}>🎲 Otra frase</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={[ss.searchBox, { height: 'auto', paddingVertical: 10, marginBottom: 16 }]}>
        <TextInput
          style={[ss.searchInput, { minHeight: 80, textAlignVertical: 'top' }]}
          placeholder="Escribí el mensaje que recibirán los usuarios..."
          placeholderTextColor="#A898B8"
          value={mensaje}
          onChangeText={setMensaje}
          multiline
          maxLength={500}
        />
      </View>
      <Text style={[ss.actualizadoTxt, { textAlign: 'right', marginTop: -10, marginBottom: 12 }]}>{mensaje.length}/500</Text>

      {/* Checklist de condiciones */}
      <View style={{ backgroundColor: '#F8F5F2', borderRadius: 10, padding: 12, marginBottom: 14, gap: 6 }}>
        <Text style={{ fontSize: 12, color: ids.length > 0 ? '#3DA882' : '#E8785A', fontWeight: '700' }}>
          {ids.length > 0 ? `✅ Vista previa lista — ${ids.length.toLocaleString('es-UY')} destinatarios` : '❌ Hacé Vista previa primero'}
        </Text>
        <Text style={{ fontSize: 12, color: mensaje.trim() ? '#3DA882' : '#E8785A', fontWeight: '700' }}>
          {mensaje.trim() ? '✅ Mensaje escrito' : '❌ Escribí el mensaje'}
        </Text>
      </View>

      <TouchableOpacity
        style={[ss.cfgBtn, enviando && { opacity: 0.5 }]}
        onPress={enviar}
        disabled={enviando}
      >
        {enviando ? <ActivityIndicator color="#FFF" /> : <Text style={ss.cfgBtnTxt}>📣 Enviar campaña</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Waitlist
// ─────────────────────────────────────────────────────────────────────────────
function TabWaitlist() {
  const [datos,       setDatos]       = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [guardando,   setGuardando]   = useState(false);
  const [habilitando, setHabilitando] = useState(false);

  // Campos de config editables
  const [cfgActivo,    setCfgActivo]    = useState(true);
  const [cfgBatch,     setCfgBatch]     = useState('');
  const [cfgIntervalo, setCfgIntervalo] = useState('');
  const [cfgUmbral,    setCfgUmbral]    = useState('');
  const [cfgCola,      setCfgCola]      = useState('');
  const [cantManual,   setCantManual]   = useState('100');

  // Lista completa
  const [listaFiltro,   setListaFiltro]   = useState('todos');
  const [lista,         setLista]         = useState([]);
  const [listaTotal,    setListaTotal]    = useState(0);
  const [listaPagina,   setListaPagina]   = useState(0);
  const [listaCargando, setListaCargando] = useState(false);
  const [listaTiene,    setListaTiene]    = useState(false);

  // Gráfica por país
  const [paises,        setPaises]        = useState([]);
  const [paisesLoading, setPaisesLoading] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true); setError('');
    try {
      const res = await callAdmin('waitlist_stats');
      setDatos(res);
      if (res.config) {
        setCfgActivo(res.config.activo);
        setCfgBatch(String(res.config.batch_size));
        setCfgIntervalo(String(res.config.intervalo_minutos));
        setCfgUmbral(String(res.config.umbral_activos_hora));
        setCfgCola(String(res.config.max_cola_pendiente));
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function guardarConfig() {
    setGuardando(true);
    try {
      await callAdmin('waitlist_config', {
        activo:              cfgActivo,
        batch_size:          Number(cfgBatch),
        intervalo_minutos:   Number(cfgIntervalo),
        umbral_activos_hora: Number(cfgUmbral),
        max_cola_pendiente:  Number(cfgCola),
      });
      Alert.alert('✅ Config guardada');
      cargar();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setGuardando(false); }
  }

  async function cargarLista(filtro, pagina, reset = false) {
    setListaCargando(true);
    try {
      const res = await callAdmin('waitlist_lista', { filtro, pagina });
      setLista(prev => reset ? res.usuarios : [...prev, ...res.usuarios]);
      setListaTotal(res.total);
      setListaTiene(res.usuarios.length === res.tam);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setListaCargando(false); }
  }

  function cambiarFiltroLista(f) {
    setListaFiltro(f);
    setListaPagina(0);
    cargarLista(f, 0, true);
  }

  function cargarMas() {
    const siguiente = listaPagina + 1;
    setListaPagina(siguiente);
    cargarLista(listaFiltro, siguiente, false);
  }

  async function cargarPaises() {
    setPaisesLoading(true);
    try {
      const res = await callAdmin('waitlist_paises');
      setPaises(res.paises ?? []);
    } catch (e) { }
    finally { setPaisesLoading(false); }
  }

  async function habilitarManual() {
    const cant = Number(cantManual);
    if (!cant || cant < 1) { Alert.alert('Cantidad inválida'); return; }
    Alert.alert('Habilitar ' + cant + ' usuarios', '¿Confirmar? Se les enviará notificación push.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: async () => {
        setHabilitando(true);
        try {
          const res = await callAdmin('waitlist_habilitar', { cantidad: cant });
          Alert.alert('✅ Listo', `${res.habilitados} habilitados, ${res.notificados} notificados por push.`);
          cargar();
        } catch (e) { Alert.alert('Error', e.message); }
        finally { setHabilitando(false); }
      }},
    ]);
  }

  if (loading) return <ActivityIndicator color="#E8785A" style={{ marginTop: 40 }} />;
  if (error)   return <Text style={[ss.actualizadoTxt, { color: '#EF4444', padding: 20 }]}>{error}</Text>;

  const conv = datos?.registrados && datos?.habilitados ? Math.round((datos.registrados / datos.habilitados) * 100) : 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never">

      {/* Número principal */}
      <View style={{ backgroundColor: '#1A3A5C', borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 56, fontWeight: '900', color: '#FFFFFF', lineHeight: 60 }}>
          {((datos?.en_espera ?? 0) + (datos?.habilitados ?? 0) + (datos?.registrados ?? 0))}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>registrados en lista de espera</Text>
        {(datos?.en_espera ?? 0) > 0 && (
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{datos.en_espera} esperando · {datos.habilitados ?? 0} habilitados · {datos.registrados ?? 0} registrados</Text>
        )}
      </View>

      {/* Toggle ON/OFF */}
      <View style={ss.wlToggleRow}>
        <View>
          <Text style={ss.wlToggleTit}>Lista de espera</Text>
          <Text style={ss.wlToggleSub}>{cfgActivo ? 'Activa — nuevos usuarios van a la lista' : 'Inactiva — registro libre'}</Text>
        </View>
        <TouchableOpacity
          style={[ss.wlToggleBtn, cfgActivo ? ss.wlToggleBtnOn : ss.wlToggleBtnOff]}
          onPress={() => setCfgActivo(!cfgActivo)}
        >
          <Text style={ss.wlToggleTxt}>{cfgActivo ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <Text style={[ss.secTit, { marginTop: 16 }]}>ESTADÍSTICAS</Text>
      <View style={ss.statsGrid}>
        <StatCard emoji="📋" label="En espera"    value={datos?.en_espera   ?? 0} color="#1A3A5C" />
        <StatCard emoji="✅" label="Habilitados"   value={datos?.habilitados ?? 0} color="#22C55E" />
        <StatCard emoji="⏳" label="Sin registrar" value={datos?.pendientes  ?? 0} color="#F59E0B" />
        <StatCard emoji="🎉" label="Registrados"   value={datos?.registrados ?? 0} color="#3DA882" sub={`${conv}% conv.`} />
      </View>

      {/* Habilitar manual */}
      <Text style={[ss.secTit, { marginTop: 20 }]}>HABILITAR MANUALMENTE</Text>
      <View style={ss.barrasCard}>
        <Text style={{ fontSize: 12, color: '#5A4E6A', marginBottom: 10, lineHeight: 18 }}>
          Habilita el próximo lote ahora mismo, sin esperar el intervalo automático.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={[ss.searchBox, { flex: 1, marginBottom: 0 }]}>
            <TextInput
              style={[ss.searchInput, { textAlign: 'center', fontSize: 16, fontWeight: '700' }]}
              value={cantManual}
              onChangeText={setCantManual}
              keyboardType="number-pad"
              placeholder="100"
              placeholderTextColor="#A898B8"
            />
          </View>
          <TouchableOpacity
            style={[ss.cfgBtn, { flex: 2, paddingVertical: 12, backgroundColor: '#3DA882' }, habilitando && { opacity: 0.5 }]}
            onPress={habilitarManual}
            disabled={habilitando}
          >
            {habilitando
              ? <ActivityIndicator color="#FFF" />
              : <Text style={ss.cfgBtnTxt}>⚡ Habilitar ahora</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Próximos en la cola */}
      {datos?.proximos?.length > 0 && <>
        <Text style={[ss.secTit, { marginTop: 20 }]}>PRÓXIMOS EN LA COLA</Text>
        <View style={ss.barrasCard}>
          {datos.proximos.map((u, i) => (
            <View key={u.posicion} style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 }, i > 0 && { borderTopWidth: 1, borderTopColor: '#EDE8E2' }]}>
              <View style={[ss.oficioRank, { backgroundColor: '#F2EDE6' }]}>
                <Text style={ss.oficioRankTxt}>#{u.posicion}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1020' }} numberOfLines={1}>{u.nombre || '—'}</Text>
                <Text style={{ fontSize: 11, color: '#A898B8' }} numberOfLines={1}>{u.email}</Text>
              </View>
            </View>
          ))}
        </View>
      </>}

      {/* Configuración automática */}
      <Text style={[ss.secTit, { marginTop: 20 }]}>CONFIGURACIÓN AUTOMÁTICA</Text>
      <View style={ss.barrasCard}>
        {[
          ['Batch size (usuarios por lote)', cfgBatch,     setCfgBatch,     'number-pad', 'Si la carga es baja, habilita N usuarios por lote'],
          ['Intervalo mínimo (minutos)',     cfgIntervalo, setCfgIntervalo, 'number-pad', 'Tiempo mínimo entre lotes automáticos'],
          ['Umbral de carga (activos/hora)', cfgUmbral,    setCfgUmbral,    'number-pad', 'Si hay más activos que este número, pausa la habilitación'],
          ['Cola máxima pendiente',          cfgCola,      setCfgCola,      'number-pad', 'Máx. habilitados sin registrar antes de pausar'],
        ].map(([label, val, set, kbType, hint], i) => (
          <View key={label} style={[{ paddingVertical: 10 }, i > 0 && { borderTopWidth: 1, borderTopColor: '#EDE8E2' }]}>
            <Text style={ss.cfgLbl}>{label}</Text>
            <Text style={{ fontSize: 10, color: '#A898B8', marginBottom: 6 }}>{hint}</Text>
            <View style={[ss.searchBox, { marginBottom: 0 }]}>
              <TextInput
                style={[ss.searchInput, { fontWeight: '700', fontSize: 15 }]}
                value={val}
                onChangeText={set}
                keyboardType={kbType}
              />
            </View>
          </View>
        ))}
        <TouchableOpacity
          style={[ss.cfgBtn, { marginTop: 12 }, guardando && { opacity: 0.5 }]}
          onPress={guardarConfig}
          disabled={guardando}
        >
          {guardando ? <ActivityIndicator color="#FFF" /> : <Text style={ss.cfgBtnTxt}>Guardar configuración →</Text>}
        </TouchableOpacity>
      </View>

      {/* Log de lotes */}
      {datos?.lotes?.length > 0 && <>
        <Text style={[ss.secTit, { marginTop: 20 }]}>ÚLTIMOS LOTES AUTOMÁTICOS</Text>
        <View style={ss.barrasCard}>
          {datos.lotes.map((l, i) => (
            <View key={i} style={[{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }, i > 0 && { borderTopWidth: 1, borderTopColor: '#EDE8E2' }]}>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1A1020' }}>{l.cantidad} habilitados · {l.notificados} push</Text>
                <Text style={{ fontSize: 10, color: '#A898B8' }}>Carga: {l.carga_pct}% · batch: {l.batch_size_usado}</Text>
              </View>
              <Text style={{ fontSize: 10, color: '#A898B8' }}>{fmtFecha(l.created_at)}</Text>
            </View>
          ))}
        </View>
      </>}

      {/* Lista completa */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8 }}>
        <Text style={ss.secTit}>LISTA COMPLETA{listaTotal > 0 ? ` (${listaTotal})` : ''}</Text>
        {lista.length === 0 && (
          <TouchableOpacity onPress={() => cargarLista('todos', 0, true)}>
            <Text style={{ fontSize: 12, color: '#E8785A', fontWeight: '700' }}>Cargar →</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {[
          { key: 'todos',       label: 'Todos' },
          { key: 'en_espera',   label: 'En espera' },
          { key: 'habilitados', label: 'Habilitados' },
          { key: 'registrados', label: 'Registrados' },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => cambiarFiltroLista(f.key)}
            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: listaFiltro === f.key ? '#1A3A5C' : '#F2EDE6' }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: listaFiltro === f.key ? '#FFF' : '#5A4E6A' }}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {lista.length > 0 && (
        <View style={ss.barrasCard}>
          {lista.map((u, i) => {
            const estado = u.registrado ? { txt: 'Registrado', bg: '#E6FBF5', color: '#22C55E' }
                         : u.habilitado  ? { txt: 'Habilitado',  bg: '#FFF7ED', color: '#F59E0B' }
                         :                 { txt: 'En espera',   bg: '#F2EDE6', color: '#A898B8' };
            const bandera = u.pais ? u.pais.split(' ')[0] : '';
            return (
              <View key={u.posicion ?? i} style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 }, i > 0 && { borderTopWidth: 1, borderTopColor: '#EDE8E2' }]}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#C4B8D4', width: 28, textAlign: 'right' }}>#{u.posicion}</Text>
                {bandera ? <Text style={{ fontSize: 18 }}>{bandera}</Text> : <View style={{ width: 18 }} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1020' }} numberOfLines={1}>{u.nombre || '—'}</Text>
                  <Text style={{ fontSize: 11, color: '#A898B8' }} numberOfLines={1}>{u.email}</Text>
                  <Text style={{ fontSize: 10, color: '#C4B8D4', marginTop: 2 }}>{u.pais ? u.pais.replace(/^[^ ]+ /, '') + ' · ' : ''}{fmtFecha(u.created_at)}</Text>
                </View>
                <View style={{ backgroundColor: estado.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: estado.color }}>{estado.txt}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {listaTiene && (
        <TouchableOpacity
          onPress={cargarMas}
          disabled={listaCargando}
          style={{ marginTop: 10, padding: 14, backgroundColor: '#F2EDE6', borderRadius: 12, alignItems: 'center' }}
        >
          {listaCargando
            ? <ActivityIndicator color="#E8785A" size="small" />
            : <Text style={{ fontSize: 13, fontWeight: '700', color: '#E8785A' }}>Ver más</Text>
          }
        </TouchableOpacity>
      )}

      {/* Gráfica por país */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 8 }}>
        <Text style={ss.secTit}>REGISTROS POR PAÍS</Text>
        {paises.length === 0 && (
          <TouchableOpacity onPress={cargarPaises}>
            <Text style={{ fontSize: 12, color: '#E8785A', fontWeight: '700' }}>Ver →</Text>
          </TouchableOpacity>
        )}
      </View>

      {paisesLoading && <ActivityIndicator color="#E8785A" style={{ marginVertical: 16 }} />}

      {paises.length > 0 && (() => {
        const max = paises[0]?.total ?? 1;
        return (
          <View style={ss.barrasCard}>
            {paises.slice(0, 15).map((p, i) => {
              const bandera = p.pais && p.pais !== 'Sin datos' ? p.pais.split(' ')[0] : '🌍';
              const pct = Math.max(4, Math.round((p.total / max) * 100));
              return (
                <View key={i} style={[{ paddingVertical: 8 }, i > 0 && { borderTopWidth: 1, borderTopColor: '#EDE8E2' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>{bandera}</Text>
                    <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#1A1020' }} numberOfLines={1}>
                      {p.pais === 'Sin datos' ? 'Sin datos' : p.pais.replace(/^[^ ]+ /, '')}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#1A3A5C' }}>{p.total}</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: '#F2EDE6', borderRadius: 3 }}>
                    <View style={{ height: 6, width: `${pct}%`, backgroundColor: '#E8785A', borderRadius: 3 }} />
                  </View>
                </View>
              );
            })}
          </View>
        );
      })()}

    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Scraper
// ─────────────────────────────────────────────────────────────────────────────
const PAISES_SCRAPER = [
  'UY','AR','BR','CL','CO','PE','PY','BO','EC','MX','VE',
  'CU','CR','GT','SV','HN','NI','PA','DO',
  'ES','PT','IT','FR','DE','GB',
  'US','CA','AU','SE','NO','JP','IN',
];

function TabScraper() {
  const [corriendo, setCorriendo] = useState(false);
  const [log,       setLog]       = useState([]);
  const [paisSel,   setPaisSel]   = useState('');
  const [conteos,   setConteos]   = useState({});
  const [cargando,  setCargando]  = useState(true);

  useEffect(() => {
    async function cargarConteos() {
      setCargando(true);
      try {
        const result = await callAdmin('scraper_stats');
        setConteos(result?.conteos ?? {});
      } catch {}
      setCargando(false);
    }
    cargarConteos();
  }, []);

  async function correrScraper(intensivo = false) {
    setCorriendo(true);
    setLog([`${intensivo ? '🔥 Búsqueda intensiva' : '▶ Scraper normal'} iniciado...`]);
    const inicio = Date.now();
    try {
      const body = intensivo
        ? { modo: 'intensivo', ...(paisSel ? { pais: paisSel } : {}) }
        : { ...(paisSel ? { pais: paisSel } : {}) };
      const { data, error } = await supabase.functions.invoke('scraper-concursos', { body });
      const seg = ((Date.now() - inicio) / 1000).toFixed(1);
      if (error) {
        setLog([`❌ Error: ${error.message}`, `Tiempo: ${seg}s`]);
      } else if (intensivo && data?.resumen) {
        const lineas = [`✅ Búsqueda intensiva completada en ${seg}s`];
        Object.entries(data.resumen).forEach(([p, r]) => {
          lineas.push(`  ${p}: ${r.total_scrapeados} scrapeados → ${r.insertados} insertados`);
        });
        setLog(lineas);
        // Recargar conteos
        const nuevos = { ...conteos };
        for (const [p, r] of Object.entries(data.resumen)) {
          if (r.insertados > 0) nuevos[p] = (nuevos[p] || 0) + r.insertados;
        }
        setConteos(nuevos);
      } else {
        const lineas = [`✅ Completado en ${seg}s`];
        if (data?.insertados !== undefined) lineas.push(`📥 Insertados: ${data.insertados}`);
        if (data?.paises) lineas.push(`🌍 Países: ${data.paises.join(', ')}`);
        if (data?.errores?.length) {
          lineas.push(`⚠️ Advertencias:`);
          data.errores.slice(0, 8).forEach(e => lineas.push(`  · ${e}`));
        }
        setLog(lineas);
      }
    } catch (e) {
      setLog([`❌ ${e.message}`]);
    } finally {
      setCorriendo(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A3A5C', marginBottom: 4 }}>Scraper manual</Text>
      <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
        Corre el scraper de empleos ahora mismo. Sin país = todos los países.
      </Text>

      {/* Selector de país */}
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>
        País (opcional) {cargando ? '— cargando...' : ''}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setPaisSel('')}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: paisSel === '' ? '#1A3A5C' : '#E2E8F0' }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: paisSel === '' ? '#fff' : '#475569' }}>Todos</Text>
          </TouchableOpacity>
          {PAISES_SCRAPER.map(p => {
            const n = conteos[p];
            const color = n === 0 ? '#FEE2E2' : paisSel === p ? '#1A3A5C' : '#E2E8F0';
            const txtColor = n === 0 ? '#DC2626' : paisSel === p ? '#fff' : '#475569';
            return (
              <TouchableOpacity
                key={p}
                onPress={() => setPaisSel(p)}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: color, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: txtColor }}>
                  {BANDERAS[p]} {p}
                </Text>
                {!cargando && (
                  <Text style={{ fontSize: 10, fontWeight: '600', color: txtColor, opacity: 0.8 }}>
                    {n?.toLocaleString('es') ?? '—'}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Botones */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
        <TouchableOpacity
          onPress={() => correrScraper(false)}
          disabled={corriendo}
          style={{ flex: 1, backgroundColor: corriendo ? '#94A3B8' : '#0F766E', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
        >
          {corriendo
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>▶ Normal</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => correrScraper(true)}
          disabled={corriendo}
          style={{ flex: 1, backgroundColor: corriendo ? '#94A3B8' : '#B45309', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
        >
          {corriendo
            ? <ActivityIndicator color="#fff" />
            : <>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>🔥 Intensivo</Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 }}>
                  {paisSel ? `${BANDERAS[paisSel]} ${paisSel}` : 'LatAm débil'}
                </Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* Log */}
      {log.length > 0 && (
        <View style={{ backgroundColor: '#0D1117', borderRadius: 12, padding: 16, gap: 6 }}>
          {log.map((l, i) => (
            <Text key={i} style={{ color: '#E2E8F0', fontSize: 13, fontFamily: 'monospace' }}>{l}</Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminScreen({ navigation }) {
  const [tabActiva, setTabActiva]     = useState('panel');
  const [stats, setStats]             = useState(null);
  const [analytics, setAnalytics]     = useState(null);
  const [statsError, setStatsError]   = useState('');
  const [refreshing, setRefreshing]   = useState(false);
  const [refreshingUsuarios, setRefreshingUsuarios] = useState(false);
  const [live, setLive]               = useState(true);
  const [ultimaAct, setUltimaAct]     = useState(null);
  const [detalleUser, setDetalleUser] = useState(null);
  const [cfgVisible, setCfgVisible]   = useState(false);
  const intervalRef = useRef(null);
  const statsLoadedRef = useRef(false);

  const TABS = [
    { id: 'panel',     emoji: '📊', label: 'Panel' },
    { id: 'usuarios',  emoji: '👥', label: 'Usuarios' },
    { id: 'pagos',     emoji: '💳', label: 'Pagos' },
    { id: 'consultas', emoji: '🔍', label: 'Consultas' },
    { id: 'waitlist',  emoji: '🚀', label: 'Waitlist' },
    { id: 'moderacion',emoji: '🚨', label: 'Reportes' },
    { id: 'campanas',  emoji: '📣', label: 'Campañas' },
    { id: 'scraper',   emoji: '⚙️', label: 'Scraper' },
  ];

  useEffect(() => {
    async function checkSesion() {
      const ok = await tieneSessionAdmin();
      if (!ok) navigation.goBack();
    }
    checkSesion();
    const unsub = navigation.addListener('focus', checkSesion);
    return unsub;
  }, [navigation]);

  useEffect(() => {
    navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => navigation.getParent()?.setOptions({ tabBarStyle: undefined });
  }, [navigation]);

  const ADMIN_CACHE_KEY = 'admin_panel_cache_v1';

  const cargarStats = useCallback(async (silencioso = false) => {
    if (!silencioso) setRefreshing(true);
    setStatsError('');
    // Mostrar cache inmediatamente si todavía no cargó nada
    if (!statsLoadedRef.current) {
      try {
        const raw = await AsyncStorage.getItem(ADMIN_CACHE_KEY);
        if (raw) { const { s, a } = JSON.parse(raw); setStats(s); setAnalytics(a); }
      } catch {}
    }
    try {
      const [res, anal] = await Promise.all([callAdmin('stats'), callAdmin('analytics')]);
      setStats(res);
      setAnalytics(anal);
      statsLoadedRef.current = true;
      setUltimaAct(new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }));
      AsyncStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify({ s: res, a: anal })).catch(() => {});
    } catch (e) { setStatsError(e.message); }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    cargarStats(true);
    intervalRef.current = setInterval(() => cargarStats(true), 60000);
    const channel = supabase.channel('admin-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { setLive(true); cargarStats(true); })
      .subscribe();
    return () => { clearInterval(intervalRef.current); supabase.removeChannel(channel); };
  }, [cargarStats]);

  return (
    <SafeAreaView style={ss.safe} edges={['top', 'bottom']}>
      {/* Banda azul: header + tabs */}
      <View style={{ backgroundColor: '#2A5280' }}>
        <View style={ss.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={ss.backBtn}>
            <Text style={ss.backTxt}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={ss.headerTit} numberOfLines={1}>ADMIN</Text>
            {ultimaAct && <Text style={ss.headerSub} numberOfLines={1}>Actualizado {ultimaAct}</Text>}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={ss.liveWrap}>
              <View style={[ss.liveDot, { backgroundColor: live ? '#22C55E' : '#A898B8' }]} />
              <Text style={ss.liveTxt}>Live</Text>
            </View>
            <TouchableOpacity style={ss.headerIconBtn} onPress={() => setCfgVisible(true)}>
              <Text style={ss.headerIconEmoji}>⚙️</Text>
              <Text style={ss.headerIconLbl}>Config</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ss.headerIconBtn}
              onPress={() => Alert.alert('Cerrar sesión', '¿Salir del panel de administrador?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Salir', style: 'destructive', onPress: async () => { await cerrarSesionAdmin(); navigation.goBack(); } },
              ])}
            >
              <Text style={ss.headerIconEmoji}>🔒</Text>
              <Text style={ss.headerIconLbl}>Salir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs — scrollable */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ss.tabBar} contentContainerStyle={{ flexDirection: 'row' }}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.id} style={[ss.tabBtn, tabActiva === tab.id && ss.tabBtnA]} onPress={() => setTabActiva(tab.id)}>
            <Text style={ss.tabEmoji}>{tab.emoji}</Text>
            <Text style={[ss.tabLbl, tabActiva === tab.id && ss.tabLblA]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
        </ScrollView>
      </View>{/* fin banda azul */}

      {/* Contenido */}
      <View style={{ flex: 1, backgroundColor: '#F2F6FA' }}>
        {tabActiva === 'panel'      && <TabPanel stats={stats} analytics={analytics} refreshing={refreshing} onRefresh={() => cargarStats()} error={statsError} />}
        {tabActiva === 'usuarios'   && <TabUsuarios onDetalleUsuario={setDetalleUser} refreshing={refreshingUsuarios} setRefreshing={setRefreshingUsuarios} />}
        {tabActiva === 'pagos'      && <TabPagos />}
        {tabActiva === 'consultas'  && <TabConsultas onDetalleUsuario={setDetalleUser} navigation={navigation} />}
        {tabActiva === 'waitlist'   && <TabWaitlist />}
        {tabActiva === 'moderacion' && <TabModeracion onDetalleUsuario={setDetalleUser} />}
        {tabActiva === 'campanas'   && <TabCampanas />}
        {tabActiva === 'scraper'    && <TabScraper />}
      </View>

      <DetalleModal visible={!!detalleUser} usuario={detalleUser} onClose={() => setDetalleUser(null)} />
      <ConfigModal  visible={cfgVisible}    onClose={() => setCfgVisible(false)} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#F2F6FA' },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, gap: 8 },
  backBtn:        { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt:        { fontSize: 28, color: '#FFFFFF', lineHeight: 32 },
  headerTit:      { fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  headerSub:      { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  liveWrap:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot:        { width: 6, height: 6, borderRadius: 3 },
  liveTxt:        { fontSize: 10, color: '#FFFFFF', fontWeight: '700' },
  headerIconBtn:  { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, minWidth: 62 },
  headerIconEmoji:{ fontSize: 26 },
  headerIconLbl:  { fontSize: 12, color: '#FFFFFF', fontWeight: '800', marginTop: 3 },
  tabBar:         { backgroundColor: '#1A3A5C', paddingHorizontal: 4 },
  tabBtn:         { minWidth: 80, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, gap: 3, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabBtnA:        { borderBottomColor: '#E8785A' },
  tabEmoji:       { fontSize: 22 },
  tabLbl:         { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },
  tabLblA:        { color: '#E8785A' },
  secTit:         { fontSize: 10, fontWeight: '800', color: '#A898B8', letterSpacing: 1.2, marginBottom: 8 },
  statsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:       { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  statEmoji:      { fontSize: 22, marginBottom: 6 },
  statVal:        { fontSize: 26, fontWeight: '900', lineHeight: 30 },
  statLbl:        { fontSize: 11, color: '#A898B8', fontWeight: '600', marginTop: 2 },
  statSub:        { fontSize: 10, color: '#A898B8', marginTop: 1 },
  barrasCard:     { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  barraWrap:      { marginBottom: 10 },
  barraLabel:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barraLblTxt:    { fontSize: 12, color: '#1A1020', fontWeight: '600', flex: 1 },
  barraCount:     { fontSize: 12, color: '#A898B8', fontWeight: '700', marginLeft: 8 },
  barraTrack:     { height: 6, backgroundColor: '#F2EDE6', borderRadius: 3, overflow: 'hidden' },
  barraFill:      { height: 6, borderRadius: 3 },
  ingresosCard:   { backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  ingresoFila:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  ingresoDivider: { height: 1, backgroundColor: '#EDE8E2' },
  ingresoLbl:     { fontSize: 14, color: '#5A4E6A', fontWeight: '600' },
  ingresoVal:     { fontSize: 20, color: '#1A3A5C', fontWeight: '900' },
  metodoRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  metodoIcon:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  metodoNombre:   { fontSize: 13, fontWeight: '700', color: '#1A1020' },
  metodoMonto:    { fontSize: 13, fontWeight: '900' },
  metodoPct:      { fontSize: 10, color: '#A898B8', marginTop: 2 },
  usuariosHeader: { backgroundColor: '#FFFFFF', padding: 12, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: '#EDE8E2', zIndex: 20 },
  dropdownList:   { position: 'absolute', top: 42, left: 0, right: 0, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#EDE8E2', zIndex: 999, elevation: 99, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, maxHeight: 220, overflow: 'hidden' },
  dropdownItem:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F2EDE6' },
  searchBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F5F2', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#EDE8E2' },
  searchInput:    { flex: 1, fontSize: 13, color: '#1A1020' },
  filtroPairRow:  { flexDirection: 'row', marginTop: 0 },
  filtroBtn:      { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F8F5F2', borderRadius: 999, borderWidth: 1.5, borderColor: '#EDE8E2' },
  filtroBtnA:     { backgroundColor: '#FFF3F0', borderColor: '#E8785A' },
  filtroTxt:      { fontSize: 12, fontWeight: '700', color: '#5A4E6A' },
  filtroTxtA:     { color: '#E8785A' },
  limpiarBtn:     { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FEF2F2', borderRadius: 999, borderWidth: 1.5, borderColor: '#EF4444' },
  limpiarTxt:     { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  totalTxt:       { fontSize: 11, color: '#A898B8', fontWeight: '600', marginTop: 6 },
  errorBanner:    { fontSize: 11, color: '#EF4444', fontWeight: '600', marginTop: 6, textAlign: 'center' },
  userCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#EDE8E2' },
  userCardSel:    { borderColor: '#3DA882', backgroundColor: '#E6FBF5' },
  userAvatar:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userNombre:     { fontSize: 14, fontWeight: '800', color: '#1A1020' },
  userOficio:     { fontSize: 12, color: '#5A4E6A', marginTop: 1 },
  userZona:       { fontSize: 11, color: '#A898B8', marginTop: 1 },
  userEmail:      { fontSize: 10, color: '#A898B8', marginTop: 1, fontStyle: 'italic' },
  statusBadge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1.5 },
  statusTxt:      { fontSize: 11, fontWeight: '800' },
  checkBox:       { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D0C8DC', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkBoxSel:    { backgroundColor: '#3DA882', borderColor: '#3DA882' },
  cargarMasBtn:   { paddingVertical: 14, alignItems: 'center' },
  cargarMasTxt:   { fontSize: 13, color: '#E8785A', fontWeight: '700' },
  concursoCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#EDE8E2', gap: 10 },
  concursoTitle:      { fontSize: 13, fontWeight: '800', color: '#1A1020' },
  concursoOrg:        { fontSize: 11, color: '#A898B8', marginTop: 2 },
  concursoLugar:      { fontSize: 11, color: '#A898B8', marginTop: 1 },
  tipoConcurso:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  tipoConcursoPub:    { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  tipoConcursoPriv:   { backgroundColor: '#FFF3F0', borderColor: '#FECACA' },
  tipoTxt:            { fontSize: 10, fontWeight: '700' },
  chipBack:           { backgroundColor: '#F8F5F2', borderBottomWidth: 1, borderBottomColor: '#EDE8E2', flexGrow: 0, flexShrink: 0 },
  chip:               { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFFFFF', borderRadius: 999, borderWidth: 1.5, borderColor: '#EDE8E2' },
  chipTxt:            { fontSize: 11, fontWeight: '700', color: '#5A4E6A' },
  llamadosFiltros:    { backgroundColor: '#F8F5F2', borderBottomWidth: 1, borderBottomColor: '#EDE8E2', padding: 10 },
  modalBackdrop:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: SCREEN_H * 0.88, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  modalHandle:    { width: 40, height: 4, backgroundColor: '#EDE8E2', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTit:       { fontSize: 22, fontWeight: '900', color: '#1A1020', marginBottom: 4 },
  modalEmail:     { fontSize: 13, color: '#A898B8', marginBottom: 16 },
  modalGrid:      { backgroundColor: '#F8F5F2', borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  gridRow:        { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#EDE8E2' },
  gridKey:        { width: 130, fontSize: 12, fontWeight: '700', color: '#A898B8' },
  gridVal:        { flex: 1, fontSize: 12, color: '#1A1020', fontWeight: '600' },
  modalSec:       { marginBottom: 12 },
  modalSecTit:    { fontSize: 10, fontWeight: '800', color: '#A898B8', letterSpacing: 1, marginBottom: 6 },
  modalChips:     { fontSize: 13, color: '#1A1020', lineHeight: 20 },
  pagoRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#EDE8E2' },
  pagoMonto:      { fontSize: 14, fontWeight: '800', color: '#22C55E' },
  pagoMeta:       { fontSize: 11, color: '#A898B8' },
  bioTxt:         { fontSize: 13, color: '#5A4E6A', lineHeight: 20 },
  cerrarBtn:      { backgroundColor: '#F2EDE6', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  cerrarBtnTxt:   { fontSize: 14, fontWeight: '700', color: '#A898B8' },
  pagoItem:       { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pagoId:         { fontSize: 9, color: '#D0C8DC', marginTop: 2 },
  consultasGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  consultaBtn:    { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: '#EDE8E2', alignItems: 'flex-start' },
  consultaEmoji:  { fontSize: 22, marginBottom: 6 },
  consultaLbl:    { fontSize: 12, fontWeight: '700', color: '#1A1020', lineHeight: 16 },
  resultHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F8F5F2' },
  resultTit:      { fontSize: 13, fontWeight: '800', flex: 1 },
  resultCount:    { fontSize: 12, color: '#A898B8', fontWeight: '600', marginLeft: 8 },
  oficioRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#EDE8E2', gap: 10 },
  oficioRank:     { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F2EDE6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  oficioRankTxt:  { fontSize: 12, fontWeight: '900', color: '#A898B8' },
  oficioNombre:   { flex: 1, fontSize: 13, fontWeight: '700', color: '#1A1020' },
  oficioCount:    { fontSize: 15, fontWeight: '900', color: '#8B5CF6' },
  actualizadoTxt: { textAlign: 'center', fontSize: 11, color: '#A898B8', marginTop: 20 },
  periodosWrap:   { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F8F5F2', borderBottomWidth: 1, borderBottomColor: '#EDE8E2' },
  periodoBtn:     { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, borderColor: '#D0C8DC', backgroundColor: '#FFFFFF' },
  periodoBtnA:    { borderColor: '#A898B8', backgroundColor: '#EDE8FF' },
  periodoTxt:     { fontSize: 12, fontWeight: '700', color: '#A898B8' },
  periodoTxtA:    { color: '#5A4E6A' },
  msgFiltrosWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F8F5F2', borderBottomWidth: 1, borderBottomColor: '#EDE8E2' },
  filtrarBtn:     { marginLeft: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#3DA882', borderRadius: 10 },
  filtrarBtnTxt:  { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  paisCountChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#EDE8E2', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  paisCountTxt:   { fontSize: 12, fontWeight: '800', color: '#1A3A5C' },
  selectToolbar:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EDE8E2' },
  selectBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F8F5F2', borderWidth: 1.5, borderColor: '#EDE8E2' },
  selectBtnTxt:   { fontSize: 12, fontWeight: '700', color: '#3DA882' },
  selectCount:    { flex: 1, fontSize: 12, fontWeight: '700', color: '#1A1020', textAlign: 'center' },
  msgBottomBar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EDE8E2', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 4 },
  msgBottomCount: { fontSize: 13, fontWeight: '700', color: '#5A4E6A' },
  msgEnviarBtn:   { backgroundColor: '#3DA882', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  msgEnviarTxt:   { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  wlToggleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#EDE8E2' },
  wlToggleTit:    { fontSize: 15, fontWeight: '800', color: '#1A1020' },
  wlToggleSub:    { fontSize: 11, color: '#A898B8', marginTop: 3 },
  wlToggleBtn:    { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, minWidth: 56, alignItems: 'center' },
  wlToggleBtnOn:  { backgroundColor: '#22C55E' },
  wlToggleBtnOff: { backgroundColor: '#EDE8E2' },
  wlToggleTxt:    { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  cfgCard:        { width: '90%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'stretch' },
  cfgTit:         { fontSize: 18, fontWeight: '900', color: '#1A3A5C', marginBottom: 20, textAlign: 'center' },
  cfgLbl:         { fontSize: 12, fontWeight: '700', color: '#A898B8', marginBottom: 6, marginTop: 4 },
  cfgInput:       { backgroundColor: '#F8F5F2', borderRadius: 12, borderWidth: 1.5, borderColor: '#EDE8E2', paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#1A1020', marginBottom: 4 },
  cfgHint:        { fontSize: 11, color: '#A898B8', textAlign: 'center', marginTop: 8, marginBottom: 16 },
  cfgBtn:         { backgroundColor: '#1A3A5C', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cfgBtnTxt:      { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  // Reportes
  reporteCard:    { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#EDE8E2' },
  reporteBadge:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  reporteNombre:  { fontSize: 14, fontWeight: '800', color: '#1A1020' },
  reporteEmail:   { fontSize: 11, color: '#A898B8', marginTop: 1 },
  reporteZona:    { fontSize: 11, color: '#A898B8' },
  reporteItem:    { paddingVertical: 8 },
  reporteMotivo:  { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  reporteDetalle: { fontSize: 12, color: '#5A4E6A', marginTop: 2 },
  reporteFecha:   { fontSize: 10, color: '#A898B8', marginTop: 2 },
  reporteVerBtn:  { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F0FDFA', borderRadius: 10, borderWidth: 1, borderColor: '#2DD4BF' },
  reporteVerTxt:  { fontSize: 12, fontWeight: '700', color: '#2DD4BF' },
  reporteAccionBtn:{ paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  reporteAccionTxt:{ fontSize: 12, fontWeight: '700' },
  // Conversaciones en DetalleModal
  verConvsBtn:   { backgroundColor: '#FFF3F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#E8785A' },
  verConvsTxt:   { fontSize: 11, fontWeight: '700', color: '#E8785A' },
  convRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F2EDE6' },
  convAvatar:    { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2EDE6', alignItems: 'center', justifyContent: 'center' },
  convNombre:    { fontSize: 13, fontWeight: '700', color: '#1A1020' },
  convUltimo:    { fontSize: 11, color: '#A898B8', marginTop: 1 },
  convFecha:     { fontSize: 10, color: '#A898B8' },
  convTotal:     { fontSize: 10, fontWeight: '700', color: '#E8785A', marginTop: 2 },
  hiloWrap:      { backgroundColor: '#F8F5F2', borderRadius: 10, padding: 10, marginBottom: 6, gap: 6 },
  burbuja:       { maxWidth: '85%', borderRadius: 12, padding: 10, marginBottom: 4 },
  burbujaPropia: { alignSelf: 'flex-end', backgroundColor: '#E8785A' },
  burbujaAjena:  { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDE8E2' },
  burbujaTxt:    { fontSize: 13, color: '#1A1020' },
  burbujaFecha:  { fontSize: 9, color: '#A898B8', marginTop: 4, textAlign: 'right' },
  // Historial en DetalleModal
  histRow:      { flexDirection: 'row', gap: 10, marginBottom: 10 },
  histBox:      { flex: 1, backgroundColor: '#F8F5F2', borderRadius: 10, padding: 10, alignItems: 'center' },
  histNum:      { fontSize: 22, fontWeight: '900', color: '#1A3A5C' },
  histLbl:      { fontSize: 11, color: '#A898B8', fontWeight: '600', marginTop: 2 },
  histItem:     { borderLeftWidth: 3, borderLeftColor: '#E8785A', paddingLeft: 10, marginBottom: 8 },
  histItemTxt:  { fontSize: 13, color: '#1A1020', fontWeight: '600' },
  histItemFecha:{ fontSize: 10, color: '#A898B8', marginTop: 2 },
  propEstado:   { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'center' },
  // Acciones en DetalleModal
  accionBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, backgroundColor: '#FAFAFA' },
  accionBtnTxt:   { fontSize: 12, fontWeight: '700' },
  // Campañas
  segBtn:         { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#EDE8E2', borderRadius: 20 },
  segBtnA:        { backgroundColor: '#1A3A5C', borderColor: '#1A3A5C' },
  segTxt:         { fontSize: 12, fontWeight: '600', color: '#5A4E6A' },
  segTxtA:        { color: '#FFFFFF' },
});
