import React, { useState } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Pressable, Alert, ActivityIndicator,
} from "react-native";
import { supabase } from "../services/supabase";

const C = {
  coral: "#E8785A", teal: "#2DD4BF", blanco: "#FFFFFF",
  crema: "#FBF8F4", borde: "#EDE8E2",
  texto1: "#1A1020", texto2: "#5A4E6A", texto3: "#A898B8",
  amarillo: "#F59E0B",
};

function StarPicker({ value, onChange }) {
  return (
    <View style={ss.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={8}>
          <Text style={[ss.star, n <= value && ss.starOn]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Pregunta({ numero, texto, value, onChange }) {
  return (
    <View style={ss.pregunta}>
      <Text style={ss.pregTxt}>{numero}. {texto}</Text>
      <StarPicker value={value} onChange={onChange} />
    </View>
  );
}

const PREGUNTAS_WORKER = [
  "¿Cómo fue la comunicación con el empleador?",
  "¿La oferta coincidía con lo que se describía?",
  "¿Recomendarías a este empleador?",
];

const PREGUNTAS_EMPLOYER = [
  "¿Cómo fue la comunicación con el trabajador?",
  "¿El perfil del trabajador coincidía con lo esperado?",
  "¿Recomendarías a este trabajador?",
];

export default function CalificacionModal({ visible, propuestaId, calificadoId, calificadoNombre, rolCalificador, onComplete }) {
  const [f1, setF1] = useState(0);
  const [f2, setF2] = useState(0);
  const [f3, setF3] = useState(0);
  const [enviando, setEnviando] = useState(false);

  const preguntas = rolCalificador === "worker" ? PREGUNTAS_WORKER : PREGUNTAS_EMPLOYER;
  const listo = f1 > 0 && f2 > 0 && f3 > 0;

  async function enviar() {
    if (!listo) return;
    setEnviando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const promedio = Math.round(((f1 + f2 + f3) / 3) * 100) / 100;

      const { error } = await supabase.from("calificaciones").insert({
        propuesta_id: propuestaId,
        calificador_id: user.id,
        calificado_id: calificadoId,
        rol_calificador: rolCalificador,
        factor_comunicacion: f1,
        factor_cumplimiento: f2,
        factor_recomendacion: f3,
        promedio,
      });

      if (error) throw error;

      setF1(0); setF2(0); setF3(0);
      onComplete();
    } catch (e) {
      Alert.alert("Error", "No se pudo enviar la calificación. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  function omitir() {
    setF1(0); setF2(0); setF3(0);
    onComplete();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={omitir}>
      <Pressable style={ss.backdrop} onPress={omitir}>
        <Pressable style={ss.sheet} onPress={() => {}}>
          <View style={ss.handle} />

          <View style={ss.headerRow}>
            <Text style={ss.emoji}>⭐</Text>
            <View style={{ flex: 1 }}>
              <Text style={ss.tit}>¿Cómo fue la experiencia?</Text>
              <Text style={ss.sub} numberOfLines={1}>
                con {calificadoNombre || (rolCalificador === "worker" ? "el empleador" : "el trabajador")}
              </Text>
            </View>
          </View>

          <View style={ss.preguntas}>
            <Pregunta numero={1} texto={preguntas[0]} value={f1} onChange={setF1} />
            <Pregunta numero={2} texto={preguntas[1]} value={f2} onChange={setF2} />
            <Pregunta numero={3} texto={preguntas[2]} value={f3} onChange={setF3} />
          </View>

          <View style={ss.nota}>
            <Text style={ss.notaTxt}>
              Tu calificación es anónima para el otro usuario y ayuda a mejorar la comunidad.
            </Text>
          </View>

          <TouchableOpacity
            style={[ss.btn, !listo && ss.btnOff]}
            onPress={enviar}
            disabled={!listo || enviando}
          >
            {enviando
              ? <ActivityIndicator color={C.blanco} size="small" />
              : <Text style={ss.btnTxt}>Enviar calificación</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={ss.omitirBtn} onPress={omitir}>
            <Text style={ss.omitirTxt}>Omitir por ahora</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ss = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: C.blanco, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  handle: { width: 40, height: 4, backgroundColor: C.borde, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  emoji: { fontSize: 36 },
  tit: { fontSize: 18, fontWeight: "900", color: C.texto1, marginBottom: 2 },
  sub: { fontSize: 13, color: C.texto2 },
  preguntas: { gap: 20, marginBottom: 20 },
  pregunta: { gap: 10 },
  pregTxt: { fontSize: 14, color: C.texto1, fontWeight: "600", lineHeight: 20 },
  stars: { flexDirection: "row", gap: 10 },
  star: { fontSize: 30, color: C.borde },
  starOn: { color: C.amarillo },
  nota: {
    backgroundColor: "#FBF8F4", borderRadius: 10, padding: 12,
    borderLeftWidth: 3, borderLeftColor: C.teal, marginBottom: 20,
  },
  notaTxt: { fontSize: 12, color: C.texto2, lineHeight: 18 },
  btn: {
    backgroundColor: C.coral, borderRadius: 14, paddingVertical: 16,
    alignItems: "center", marginBottom: 10,
  },
  btnOff: { opacity: 0.4 },
  btnTxt: { color: C.blanco, fontSize: 16, fontWeight: "800" },
  omitirBtn: { alignItems: "center", paddingVertical: 8 },
  omitirTxt: { fontSize: 13, color: C.texto3, fontWeight: "600" },
});
