import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Keyboard, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { supabase } from "../../services/supabase";

const NIVELES_IDIOMA = ["Básico", "Intermedio", "Avanzado", "Nativo"];
const CORAL = "#E8785A";
const DARK = "#1A1020";
const MUTED = "#A898B8";
const BG = "#FBF8F4";
const CARD = "#FFFFFF";
const BORDER = "#EDE8E2";

// ─── Componentes de formulario ─────────────────────────────────
function Campo({ label, value, onChangeText, placeholder, multiline, keyboardType, optional }) {
  return (
    <View style={s.campo}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={s.lbl}>{label}</Text>
        {optional && <Text style={s.opt}>Opcional</Text>}
      </View>
      <View style={[s.inputBox, multiline && { height: 80, alignItems: "flex-start" }]}>
        <TextInput
          style={[s.input, multiline && { textAlignVertical: "top", paddingTop: 10 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || ""}
          placeholderTextColor="#D0C8DC"
          multiline={multiline}
          keyboardType={keyboardType || "default"}
          autoCapitalize="sentences"
        />
      </View>
    </View>
  );
}

function SeccionHeader({ titulo, onAdd }) {
  return (
    <View style={s.secHdr}>
      <Text style={s.secTit}>{titulo}</Text>
      {onAdd && (
        <TouchableOpacity style={s.addBtn} onPress={onAdd}>
          <Text style={s.addTxt}>+ Agregar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── PANTALLA PRINCIPAL ────────────────────────────────────────
export default function CVScreen({ navigation }) {
  const [tab, setTab] = useState("form"); // "form" | "preview"
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);

  const [cv, setCv] = useState({
    nombre: "", profesion: "", email: "", telefono: "",
    ciudad: "", pais: "", linkedin: "", objetivo: "", foto: "",
    educacion: [{ institucion: "", titulo: "", desde: "", hasta: "" }],
    experiencia: [{ empresa: "", cargo: "", desde: "", hasta: "", descripcion: "" }],
    habilidades: "",
    idiomas: [{ idioma: "", nivel: "Intermedio" }],
    certificaciones: [],
  });

  // Pre-cargar datos del perfil o CV guardado previamente
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        // Si hay un CV guardado, restaurarlo directamente
        const saved = await AsyncStorage.getItem(`cv_${user.id}`);
        if (saved) {
          setCv(JSON.parse(saved));
          return;
        }

        // Si no hay guardado, auto-rellenar desde el perfil
        const { data } = await supabase
          .from("profiles")
          .select("nombre,apellido1,apellido2,telefono,pais,ciudad,servicios,profesiones,tecnicaturas,especialidades,idiomas,bio,descripcion_libre,nacionalidad,anios_experiencia,avatar_url")
          .eq("id", user.id)
          .single();
        if (data) {
          const nombre = [data.nombre, data.apellido1, data.apellido2].filter(Boolean).join(" ");
          const profesion = (data.profesiones?.[0] || data.servicios?.[0] || data.tecnicaturas?.[0] || "");
          const idiomasArr = Array.isArray(data.idiomas) && data.idiomas.length > 0
            ? data.idiomas.map(i => ({ idioma: i, nivel: "Intermedio" }))
            : [{ idioma: "", nivel: "Intermedio" }];
          const habilidadesArr = [
            ...(data.especialidades || []),
            ...(data.servicios || []),
            ...(data.profesiones || []),
          ].filter(Boolean);
          const habilidades = [...new Set(habilidadesArr)].join(", ");
          const objetivo = data.descripcion_libre || data.bio || "";
          setCv(prev => ({
            ...prev,
            nombre,
            profesion,
            email: user.email || "",
            telefono: data.telefono || "",
            pais: data.pais || "",
            ciudad: data.ciudad || "",
            objetivo,
            habilidades,
            idiomas: idiomasArr,
            foto: data.avatar_url || "",
          }));
        }
      } catch { /* sigue con campos vacíos */ }
      finally { setLoading(false); }
    })();
  }, []);

  // Helpers para listas dinámicas
  function addItem(key, template) {
    setCv(prev => ({ ...prev, [key]: [...prev[key], { ...template }] }));
  }
  function removeItem(key, idx) {
    setCv(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
  }
  function updateItem(key, idx, field, value) {
    setCv(prev => {
      const arr = [...prev[key]];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, [key]: arr };
    });
  }
  function set(field, value) { setCv(prev => ({ ...prev, [field]: value })); }

  async function guardarCambios() {
    Keyboard.dismiss();
    if (!cv.nombre.trim()) { Alert.alert("Falta info", "Completá al menos tu nombre antes de guardar."); return; }
    setSaving(true);
    try {
      await AsyncStorage.setItem(`cv_${userId}`, JSON.stringify(cv));
      Alert.alert("Guardado", "Tu CV fue guardado correctamente.");
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar: " + e.message);
    } finally { setSaving(false); }
  }

  // ─── Generar HTML profesional para el CV ─────────────────────
  function generarHTML() {
    const habArr = cv.habilidades.split(/[,\n]+/).map(h => h.trim()).filter(Boolean);
    const edus   = cv.educacion.filter(e => e.titulo || e.institucion);
    const exps   = cv.experiencia.filter(e => e.empresa || e.cargo);
    const certs  = cv.certificaciones.filter(c => c.nombre);
    const idioms = cv.idiomas.filter(i => i.idioma);
    const inicial = cv.nombre ? cv.nombre.trim()[0].toUpperCase() : "?";

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  @page { size: A4; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:210mm; background:#fff; }

  /* ── LAYOUT ─────────────────────────────────── */
  table.page { width:210mm; border-collapse:collapse; min-height:297mm; }

  /* sidebar negro con franja dorada izquierda */
  td.sb {
    width:68mm; background:#111111; vertical-align:top;
    border-left:4pt solid #C9A96E;
    padding:44pt 20pt 40pt 22pt;
  }

  /* columna principal blanca hueso */
  td.mn { vertical-align:top; background:#FDFCFA; padding:0; }

  /* ── FOTO / INICIAL ──────────────────────────── */
  .av-wrap  { text-align:center; margin-bottom:26pt; }
  .av-ini   { display:inline-block; width:68pt; height:68pt; border-radius:34pt;
              background:#222; border:1.5pt solid #C9A96E;
              font-family:Georgia,serif; font-size:26pt; font-weight:bold;
              color:#C9A96E; text-align:center; line-height:68pt; }

  /* ── SIDEBAR TIPOGRAFÍA ──────────────────────── */
  .s-title  { font-family:Georgia,serif; font-size:13.5pt; font-weight:bold;
              color:#FFFFFF; line-height:1.3; letter-spacing:0.2pt;
              text-align:center; margin-bottom:3pt; }
  .s-sub    { font-family:Helvetica,Arial,sans-serif; font-size:7pt; color:#C9A96E;
              text-transform:uppercase; letter-spacing:2.2pt; text-align:center;
              margin-bottom:24pt; }

  .s-sep    { height:1pt; background:linear-gradient(to right,transparent,#2E2E2E,transparent);
              margin:13pt 0; }
  .s-cat    { font-family:Helvetica,Arial,sans-serif; font-size:6.5pt; font-weight:bold;
              color:#C9A96E; text-transform:uppercase; letter-spacing:2.5pt;
              margin-bottom:9pt; }

  .s-row    { margin-bottom:6pt; }
  .s-lbl    { font-family:Helvetica,Arial,sans-serif; font-size:6.5pt; color:#555;
              text-transform:uppercase; letter-spacing:0.8pt; margin-bottom:1pt; }
  .s-val    { font-family:Helvetica,Arial,sans-serif; font-size:9pt; color:#C8C8C8; line-height:1.45; }

  /* idiomas */
  .l-name   { font-family:Helvetica,Arial,sans-serif; font-size:9pt; color:#E0E0E0;
              font-weight:bold; margin-bottom:3pt; }
  .l-track  { height:2.5pt; background:#2A2A2A; margin-bottom:2pt; overflow:hidden; }
  .l-fill   { height:2.5pt; background:#C9A96E; }
  .l-lv     { font-family:Helvetica,Arial,sans-serif; font-size:6.5pt; color:#666; }

  /* habilidades — pastillas */
  .sk-wrap  { margin-bottom:5pt; }
  .sk-pill  { font-family:Helvetica,Arial,sans-serif; font-size:7.5pt; color:#D0D0D0;
              border:0.5pt solid #2E2E2E; padding:2pt 6pt; display:inline-block;
              margin:0 3pt 3pt 0; }

  /* certs */
  .c-name   { font-family:Helvetica,Arial,sans-serif; font-size:8.5pt; color:#E0E0E0; font-weight:bold; }
  .c-sub    { font-family:Helvetica,Arial,sans-serif; font-size:7.5pt; color:#666; margin-top:1pt; }

  /* ── MAIN HEADER ─────────────────────────────── */
  .m-hdr    { background:#111111; padding:34pt 38pt 26pt; }
  .m-name   { font-family:Georgia,'Times New Roman',serif; font-size:24pt; font-weight:bold;
              color:#FFFFFF; line-height:1.15; letter-spacing:0.3pt; }
  .m-prof   { font-family:Helvetica,Arial,sans-serif; font-size:8pt; color:#C9A96E;
              text-transform:uppercase; letter-spacing:3pt; margin-top:9pt; font-weight:bold; }
  .m-rule   { width:36pt; height:1pt; background:#C9A96E; margin-top:14pt; }

  /* ── MAIN BODY ───────────────────────────────── */
  .m-body   { padding:26pt 38pt 30pt; background:#FDFCFA; }
  .m-sec    { margin-bottom:22pt; }
  .m-stit   { font-family:Helvetica,Arial,sans-serif; font-size:7.5pt; font-weight:bold;
              color:#111; text-transform:uppercase; letter-spacing:2.5pt;
              padding-bottom:5pt; border-bottom:0.75pt solid #111; margin-bottom:13pt; }

  .m-profile{ font-family:Georgia,serif; font-size:10pt; color:#3A3A3A;
              line-height:1.85; font-style:italic; }

  .m-entry  { margin-bottom:14pt; padding-left:10pt;
              border-left:2pt solid #EEEAE4; }
  .m-etit   { font-family:Helvetica,Arial,sans-serif; font-size:10.5pt;
              font-weight:bold; color:#111111; }
  .m-esub   { font-family:Helvetica,Arial,sans-serif; font-size:8.5pt; color:#999;
              margin-top:2pt; letter-spacing:0.2pt; }
  .m-edesc  { font-family:Georgia,serif; font-size:9pt; color:#555;
              margin-top:5pt; line-height:1.75; }

  /* ── WATERMARK ──────────────────────────────── */
  .wm { position:fixed; bottom:9pt; left:0; right:0; text-align:center;
        font-family:Helvetica,Arial,sans-serif; font-size:5.5pt;
        color:rgba(0,0,0,0.08); letter-spacing:4pt; text-transform:uppercase; }
</style>
</head>
<body>
<table class="page"><tr>

<!-- ░░ SIDEBAR ░░ -->
<td class="sb">

  <div class="av-wrap">
    ${cv.foto
      ? `<img src="${cv.foto}" style="width:68pt;height:68pt;border-radius:50%;object-fit:cover;border:1.5pt solid #C9A96E;display:block;margin:0 auto;" />`
      : `<div class="av-ini">${inicial}</div>`
    }
  </div>

  <div class="s-title">${cv.nombre ? cv.nombre.split(" ").slice(0,2).join(" ") : "Tu Nombre"}</div>
  ${cv.profesion ? `<div class="s-sub">${cv.profesion}</div>` : `<div style="margin-bottom:24pt"></div>`}

  <div class="s-cat">Contacto</div>
  ${cv.telefono ? `<div class="s-row"><div class="s-lbl">Teléfono</div><div class="s-val">${cv.telefono}</div></div>` : ""}
  ${cv.email    ? `<div class="s-row"><div class="s-lbl">Email</div><div class="s-val">${cv.email}</div></div>` : ""}
  ${(cv.ciudad||cv.pais) ? `<div class="s-row"><div class="s-lbl">Ubicación</div><div class="s-val">${[cv.ciudad,cv.pais].filter(Boolean).join(", ")}</div></div>` : ""}
  ${cv.linkedin ? `<div class="s-row"><div class="s-lbl">LinkedIn</div><div class="s-val">${cv.linkedin}</div></div>` : ""}

  ${idioms.length ? `
  <div class="s-sep"></div>
  <div class="s-cat">Idiomas</div>
  ${idioms.map(i => {
    const pct = i.nivel==="Nativo"?100:i.nivel==="Avanzado"?75:i.nivel==="Intermedio"?50:25;
    return `<div style="margin-bottom:10pt">
      <div class="l-name">${i.idioma}</div>
      <div class="l-track"><div class="l-fill" style="width:${pct}%"></div></div>
      <div class="l-lv">${i.nivel}</div>
    </div>`;
  }).join("")}` : ""}

  ${habArr.length ? `
  <div class="s-sep"></div>
  <div class="s-cat">Competencias</div>
  <div class="sk-wrap">${habArr.map(h=>`<span class="sk-pill">${h}</span>`).join("")}</div>` : ""}

  ${certs.length ? `
  <div class="s-sep"></div>
  <div class="s-cat">Formación Complementaria</div>
  ${certs.map(c=>`<div style="margin-bottom:9pt">
    <div class="c-name">${c.nombre}</div>
    ${c.institucion?`<div class="c-sub">${c.institucion}${c.anio?" &middot; "+c.anio:""}</div>`:""}
  </div>`).join("")}` : ""}

</td>

<!-- ░░ MAIN ░░ -->
<td class="mn">

  <div class="m-hdr">
    <div class="m-name">${cv.nombre || "Tu Nombre"}</div>
    ${cv.profesion ? `<div class="m-prof">${cv.profesion}</div>` : ""}
    <div class="m-rule"></div>
  </div>

  <div class="m-body">

    ${cv.objetivo ? `
    <div class="m-sec">
      <div class="m-stit">Perfil Profesional</div>
      <div class="m-profile">${cv.objetivo}</div>
    </div>` : ""}

    ${exps.length ? `
    <div class="m-sec">
      <div class="m-stit">Experiencia</div>
      ${exps.map(e=>`
      <div class="m-entry">
        <div class="m-etit">${e.cargo||""}</div>
        <div class="m-esub">${[e.empresa,[e.desde,e.hasta||"Presente"].filter(Boolean).join(" &ndash; ")].filter(Boolean).join("&ensp;&middot;&ensp;")}</div>
        ${e.descripcion?`<div class="m-edesc">${e.descripcion}</div>`:""}
      </div>`).join("")}
    </div>` : ""}

    ${edus.length ? `
    <div class="m-sec">
      <div class="m-stit">Educación</div>
      ${edus.map(e=>`
      <div class="m-entry">
        <div class="m-etit">${e.titulo||""}</div>
        <div class="m-esub">${[e.institucion,[e.desde,e.hasta].filter(Boolean).join(" &ndash; ")].filter(Boolean).join("&ensp;&middot;&ensp;")}</div>
      </div>`).join("")}
    </div>` : ""}

  </div>
</td>
</tr></table>

<div class="wm">nexu.fyi</div>
</body>
</html>`;
  }

  async function exportarPDF() {
    Keyboard.dismiss();
    if (!cv.nombre.trim()) { Alert.alert("Falta info", "Completá al menos tu nombre antes de exportar."); return; }
    setExporting(true);
    try {
      const html = generarHTML();
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: ".pdf", dialogTitle: "Compartir CV" });
      } else {
        Alert.alert("PDF listo", "El archivo fue guardado en: " + uri);
      }
    } catch (e) {
      Alert.alert("Error", "No se pudo generar el PDF: " + e.message);
    } finally { setExporting(false); }
  }

  if (loading) return (
    <SafeAreaView style={[s.safe, { alignItems: "center", justifyContent: "center" }]}>
      <ActivityIndicator color={CORAL} size="large" />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* HEADER */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← Volver</Text>
        </TouchableOpacity>
        <Text style={s.titulo}>Mi CV</Text>
        <TouchableOpacity style={s.exportBtn} onPress={exportarPDF} disabled={exporting}>
          {exporting
            ? <ActivityIndicator color={CORAL} size="small" />
            : <Text style={s.exportTxt}>📤 Exportar</Text>}
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === "form" && s.tabA]} onPress={() => setTab("form")}>
          <Text style={[s.tabTxt, tab === "form" && s.tabTxtA]}>✏️ Formulario</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === "preview" && s.tabA]} onPress={() => setTab("preview")}>
          <Text style={[s.tabTxt, tab === "preview" && s.tabTxtA]}>👁 Vista Previa</Text>
        </TouchableOpacity>
      </View>

      {tab === "form" ? (
        <FormularioCV cv={cv} set={set} addItem={addItem} removeItem={removeItem} updateItem={updateItem} onGuardar={guardarCambios} saving={saving} />
      ) : (
        <PreviewCV cv={cv} generarHTML={generarHTML} />
      )}
    </SafeAreaView>
  );
}

// ─── FORMULARIO ───────────────────────────────────────────────
function FormularioCV({ cv, set, addItem, removeItem, updateItem, onGuardar, saving }) {
  return (
    <KeyboardAwareScrollView
      contentContainerStyle={s.scroll}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid extraScrollHeight={120}
    >
      {/* DATOS PERSONALES */}
      <View style={s.card}>
        <SeccionHeader titulo="👤 Datos Personales" />
        <Campo label="Nombre completo" value={cv.nombre} onChangeText={v => set("nombre", v)} placeholder="Ana García" />
        <Campo label="Profesión / Cargo" value={cv.profesion} onChangeText={v => set("profesion", v)} placeholder="Desarrolladora Web" />
        <Campo label="Email" value={cv.email} onChangeText={v => set("email", v)} placeholder="ana@email.com" keyboardType="email-address" />
        <Campo label="Teléfono" value={cv.telefono} onChangeText={v => set("telefono", v)} placeholder="+598 099 000 000" keyboardType="phone-pad" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Campo label="Ciudad" value={cv.ciudad} onChangeText={v => set("ciudad", v)} placeholder="Montevideo" /></View>
          <View style={{ flex: 1 }}><Campo label="País" value={cv.pais} onChangeText={v => set("pais", v)} placeholder="Uruguay" /></View>
        </View>
        <Campo label="LinkedIn / Portfolio" value={cv.linkedin} onChangeText={v => set("linkedin", v)} placeholder="linkedin.com/in/anag" optional />
      </View>

      {/* OBJETIVO */}
      <View style={s.card}>
        <SeccionHeader titulo="🎯 Perfil Profesional" />
        <Campo label="Describite brevemente" value={cv.objetivo} onChangeText={v => set("objetivo", v)} placeholder="Profesional con 5 años de experiencia en..." multiline optional />
      </View>

      {/* EDUCACIÓN */}
      <View style={s.card}>
        <SeccionHeader titulo="🎓 Educación" onAdd={() => addItem("educacion", { institucion: "", titulo: "", desde: "", hasta: "" })} />
        {cv.educacion.map((e, i) => (
          <View key={i} style={s.itemCard}>
            {cv.educacion.length > 1 && (
              <TouchableOpacity style={s.removeBtn} onPress={() => removeItem("educacion", i)}>
                <Text style={s.removeTxt}>✕</Text>
              </TouchableOpacity>
            )}
            <Campo label="Institución" value={e.institucion} onChangeText={v => updateItem("educacion", i, "institucion", v)} placeholder="Universidad de la República" />
            <Campo label="Título / Grado" value={e.titulo} onChangeText={v => updateItem("educacion", i, "titulo", v)} placeholder="Lic. en Informática" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Campo label="Desde" value={e.desde} onChangeText={v => updateItem("educacion", i, "desde", v)} placeholder="2018" keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Campo label="Hasta" value={e.hasta} onChangeText={v => updateItem("educacion", i, "hasta", v)} placeholder="2022 o Presente" /></View>
            </View>
          </View>
        ))}
      </View>

      {/* EXPERIENCIA */}
      <View style={s.card}>
        <SeccionHeader titulo="💼 Experiencia Laboral" onAdd={() => addItem("experiencia", { empresa: "", cargo: "", desde: "", hasta: "", descripcion: "" })} />
        {cv.experiencia.map((e, i) => (
          <View key={i} style={s.itemCard}>
            {cv.experiencia.length > 1 && (
              <TouchableOpacity style={s.removeBtn} onPress={() => removeItem("experiencia", i)}>
                <Text style={s.removeTxt}>✕</Text>
              </TouchableOpacity>
            )}
            <Campo label="Empresa / Organización" value={e.empresa} onChangeText={v => updateItem("experiencia", i, "empresa", v)} placeholder="Empresa S.A." />
            <Campo label="Cargo" value={e.cargo} onChangeText={v => updateItem("experiencia", i, "cargo", v)} placeholder="Analista de Sistemas" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Campo label="Desde" value={e.desde} onChangeText={v => updateItem("experiencia", i, "desde", v)} placeholder="2020" /></View>
              <View style={{ flex: 1 }}><Campo label="Hasta" value={e.hasta} onChangeText={v => updateItem("experiencia", i, "hasta", v)} placeholder="Presente" /></View>
            </View>
            <Campo label="Descripción" value={e.descripcion} onChangeText={v => updateItem("experiencia", i, "descripcion", v)} placeholder="Principales responsabilidades y logros..." multiline optional />
          </View>
        ))}
      </View>

      {/* HABILIDADES */}
      <View style={s.card}>
        <SeccionHeader titulo="⚡ Habilidades" />
        <Campo label="Separadas por comas" value={cv.habilidades} onChangeText={v => set("habilidades", v)} placeholder="React Native, Node.js, SQL, Photoshop..." optional />
      </View>

      {/* IDIOMAS */}
      <View style={s.card}>
        <SeccionHeader titulo="🌐 Idiomas" onAdd={() => addItem("idiomas", { idioma: "", nivel: "Intermedio" })} />
        {cv.idiomas.map((id, i) => (
          <View key={i} style={[s.itemCard, { flexDirection: "row", gap: 10, alignItems: "flex-start" }]}>
            <View style={{ flex: 1 }}>
              <Campo label="Idioma" value={id.idioma} onChangeText={v => updateItem("idiomas", i, "idioma", v)} placeholder="Español" />
            </View>
            <View style={{ flex: 1, marginTop: 0 }}>
              <Text style={[s.lbl, { marginBottom: 6 }]}>Nivel</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {NIVELES_IDIOMA.map(n => (
                  <TouchableOpacity key={n} style={[s.nivelChip, id.nivel === n && s.nivelChipA]} onPress={() => updateItem("idiomas", i, "nivel", n)}>
                    <Text style={[s.nivelChipTxt, id.nivel === n && s.nivelChipTxtA]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {cv.idiomas.length > 1 && (
              <TouchableOpacity style={s.removeBtn} onPress={() => removeItem("idiomas", i)}>
                <Text style={s.removeTxt}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* CERTIFICACIONES */}
      <View style={s.card}>
        <SeccionHeader titulo="📜 Certificaciones" onAdd={() => addItem("certificaciones", { nombre: "", institucion: "", anio: "" })} />
        {cv.certificaciones.length === 0 && (
          <Text style={{ fontSize: 13, color: MUTED, textAlign: "center", paddingVertical: 12 }}>
            Tocá "+ Agregar" para sumar certificaciones, cursos o diplomas.
          </Text>
        )}
        {cv.certificaciones.map((c, i) => (
          <View key={i} style={s.itemCard}>
            <TouchableOpacity style={s.removeBtn} onPress={() => removeItem("certificaciones", i)}>
              <Text style={s.removeTxt}>✕</Text>
            </TouchableOpacity>
            <Campo label="Nombre del certificado" value={c.nombre} onChangeText={v => updateItem("certificaciones", i, "nombre", v)} placeholder="Google Data Analytics" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 2 }}><Campo label="Institución" value={c.institucion} onChangeText={v => updateItem("certificaciones", i, "institucion", v)} placeholder="Coursera" optional /></View>
              <View style={{ flex: 1 }}><Campo label="Año" value={c.anio} onChangeText={v => updateItem("certificaciones", i, "anio", v)} placeholder="2023" keyboardType="number-pad" optional /></View>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={s.saveBtn} onPress={onGuardar} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={s.saveBtnTxt}>Guardar cambios</Text>}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </KeyboardAwareScrollView>
  );
}

// ─── VISTA PREVIA ─────────────────────────────────────────────
const SB_BG   = "#F0E8DF";  // beige sidebar
const SB_ACC  = "#C4A882";  // tan/dorado
const SB_TXT  = "#4A3A2A";  // texto sidebar
const HDR_BG  = "#3A3A3A";  // header gris oscuro
const BODY_TXT = "#2C2C2C";
const SEC_TXT  = "#7A6A5A";

function PreviewCV({ cv }) {
  const habArr = cv.habilidades.split(/[,\n]+/).map(h => h.trim()).filter(Boolean);
  const exps   = cv.experiencia.filter(e => e.empresa || e.cargo);
  const edus   = cv.educacion.filter(e => e.titulo || e.institucion);
  const certs  = cv.certificaciones.filter(c => c.nombre);
  const idioms = cv.idiomas.filter(i => i.idioma);
  const inicial = cv.nombre ? cv.nombre.trim()[0].toUpperCase() : "?";

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexDirection: "row", minHeight: "100%" }} showsVerticalScrollIndicator={false}>

      {/* SIDEBAR BEIGE */}
      <View style={pv.sidebar}>
        {cv.foto
          ? <Image source={{ uri: cv.foto }} style={pv.avImg} />
          : <View style={pv.av}><Text style={pv.avTxt}>{inicial}</Text></View>
        }

        <Text style={pv.sSecTit}>CONTACTO</Text>
        {!!cv.telefono   && <View style={pv.sRow}><View style={pv.sIco}><Text style={pv.sIcoTxt}>☎</Text></View><Text style={pv.sTxt}>{cv.telefono}</Text></View>}
        {!!cv.email      && <View style={pv.sRow}><View style={pv.sIco}><Text style={pv.sIcoTxt}>@</Text></View><Text style={pv.sTxt}>{cv.email}</Text></View>}
        {!!(cv.ciudad||cv.pais) && <View style={pv.sRow}><View style={pv.sIco}><Text style={pv.sIcoTxt}>◎</Text></View><Text style={pv.sTxt}>{[cv.ciudad,cv.pais].filter(Boolean).join(", ")}</Text></View>}

        {idioms.length > 0 && <>
          <View style={pv.sDivider}/>
          <Text style={pv.sSecTit}>IDIOMAS</Text>
          {idioms.map((id, i) => {
            const pct = id.nivel==="Nativo"?1:id.nivel==="Avanzado"?0.75:id.nivel==="Intermedio"?0.5:0.25;
            return (
              <View key={i} style={{ marginBottom: 8 }}>
                <Text style={pv.idNombre}>{id.idioma}</Text>
                <View style={pv.barBg}>
                  <View style={[pv.barFill, { flex: pct }]}/>
                  <View style={{ flex: 1 - pct }}/>
                </View>
                <Text style={pv.idNivel}>{id.nivel}</Text>
              </View>
            );
          })}
        </>}

        {habArr.length > 0 && <>
          <View style={pv.sDivider}/>
          <Text style={pv.sSecTit}>HABILIDADES</Text>
          {habArr.map((h, i) => (
            <View key={i} style={pv.hRow}>
              <Text style={pv.hDash}>—</Text>
              <Text style={pv.hTxt}>{h}</Text>
            </View>
          ))}
        </>}

        {certs.length > 0 && <>
          <View style={pv.sDivider}/>
          <Text style={pv.sSecTit}>CERTIFICACIONES</Text>
          {certs.map((c, i) => (
            <View key={i} style={{ marginBottom: 7 }}>
              <Text style={[pv.sTxt, { fontWeight: "700", color: SB_TXT }]}>{c.nombre}</Text>
              {!!c.institucion && <Text style={pv.sTxt}>{c.institucion}{c.anio ? " · " + c.anio : ""}</Text>}
            </View>
          ))}
        </>}
      </View>

      {/* MAIN */}
      <View style={{ flex: 1 }}>
        {/* Header oscuro */}
        <View style={pv.mHdr}>
          <Text style={pv.mNombre}>{cv.nombre || "Tu Nombre"}</Text>
          {!!cv.profesion && <Text style={pv.mProfesion}>{cv.profesion.toUpperCase()}</Text>}
        </View>

        <View style={pv.mBody}>
          {!!cv.objetivo && (
            <View style={pv.sec}>
              <PvSecTit titulo="Perfil" />
              <Text style={pv.objetivoTxt}>{cv.objetivo}</Text>
            </View>
          )}

          {exps.length > 0 && (
            <View style={pv.sec}>
              <PvSecTit titulo="Experiencias Profesionales" />
              {exps.map((e, i) => (
                <View key={i} style={pv.entry}>
                  <Text style={pv.entryTit}>{e.cargo}</Text>
                  <Text style={pv.entrySub}>
                    {[e.empresa, [e.desde, e.hasta||"Presente"].filter(Boolean).join(" - ")].filter(Boolean).join(" / ")}
                  </Text>
                  {!!e.descripcion && <Text style={pv.entryDesc}>{e.descripcion}</Text>}
                </View>
              ))}
            </View>
          )}

          {edus.length > 0 && (
            <View style={pv.sec}>
              <PvSecTit titulo="Educación" />
              {edus.map((e, i) => (
                <View key={i} style={pv.entry}>
                  <Text style={pv.entryTit}>{e.titulo}</Text>
                  <Text style={pv.entrySub}>
                    {[e.institucion, [e.desde, e.hasta].filter(Boolean).join(" - ")].filter(Boolean).join(" / ")}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={pv.footer}>Generado con Nexu🧩 · nexu.fyi</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function PvSecTit({ titulo }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={pv.secTitTxt}>{titulo.toUpperCase()}</Text>
      <View style={{ height: 1.5, backgroundColor: BODY_TXT, marginTop: 5 }} />
    </View>
  );
}

// ─── ESTILOS FORMULARIO ───────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  hdr: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER },
  back: { fontSize: 14, fontWeight: "700", color: "#2DD4BF", minWidth: 70 },
  titulo: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "900", color: DARK, letterSpacing: -0.5 },
  exportBtn: { minWidth: 70, alignItems: "flex-end" },
  exportTxt: { fontSize: 14, fontWeight: "700", color: CORAL },
  tabs: { flexDirection: "row", backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabA: { borderBottomWidth: 2, borderBottomColor: CORAL },
  tabTxt: { fontSize: 13, fontWeight: "600", color: MUTED },
  tabTxtA: { color: CORAL, fontWeight: "800" },
  scroll: { padding: 16, gap: 12 },
  card: { backgroundColor: CARD, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  secHdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  secTit: { fontSize: 13, fontWeight: "900", color: DARK, letterSpacing: -0.3 },
  addBtn: { backgroundColor: "#FFF5F2", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: CORAL },
  addTxt: { fontSize: 12, color: CORAL, fontWeight: "700" },
  campo: { marginBottom: 10 },
  lbl: { fontSize: 11, fontWeight: "700", color: "#5A4E6A", marginBottom: 5 },
  opt: { fontSize: 10, color: MUTED, fontStyle: "italic" },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: BG, borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, height: 46 },
  input: { flex: 1, fontSize: 14, color: DARK },
  itemCard: { backgroundColor: "#FBF8F4", borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
  removeBtn: { alignSelf: "flex-end", marginBottom: 4 },
  removeTxt: { fontSize: 12, color: "#C0B0C8", fontWeight: "700" },
  nivelChip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1.5, borderColor: BORDER },
  nivelChipA: { backgroundColor: CORAL, borderColor: CORAL },
  nivelChipTxt: { fontSize: 11, color: MUTED, fontWeight: "600" },
  nivelChipTxtA: { color: "#FFF" },
  preview: { padding: 0 },
  saveBtn: { marginHorizontal: 16, marginTop: 4, backgroundColor: DARK, borderRadius: 14, paddingVertical: 16, alignItems: "center", shadowColor: DARK, shadowOpacity: 0.18, shadowRadius: 10, elevation: 4 },
  saveBtnTxt: { color: "#FFF", fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
});

// ─── ESTILOS PREVIEW ──────────────────────────────────────────
const pv = StyleSheet.create({
  sidebar:   { width: 125, backgroundColor: SB_BG, padding: 14, minHeight: 600 },
  av:        { width: 56, height: 56, borderRadius: 28, backgroundColor: SB_ACC, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14, borderWidth: 2, borderColor: SB_ACC },
  avImg:     { width: 56, height: 56, borderRadius: 28, alignSelf: "center", marginBottom: 14, borderWidth: 2, borderColor: SB_ACC },
  avTxt:     { fontSize: 22, fontWeight: "900", color: "#fff" },
  sDivider:  { height: 1, backgroundColor: "#C8B8A2", marginVertical: 11 },
  sSecTit:   { fontSize: 7, fontWeight: "700", color: "#7A6A5A", letterSpacing: 1.2, marginBottom: 8 },
  sRow:      { flexDirection: "row", gap: 6, marginBottom: 6, alignItems: "flex-start" },
  sIco:      { width: 15, height: 15, borderRadius: 8, backgroundColor: SB_ACC, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sIcoTxt:   { fontSize: 7, color: "#fff" },
  sTxt:      { fontSize: 9, color: SB_TXT, lineHeight: 13, flex: 1 },
  idNombre:  { fontSize: 9, fontWeight: "600", color: SB_TXT, marginBottom: 3 },
  barBg:     { height: 3, backgroundColor: "#D8C8B4", borderRadius: 10, flexDirection: "row", overflow: "hidden" },
  barFill:   { backgroundColor: SB_ACC },
  idNivel:   { fontSize: 7.5, color: "#9A8A7A", marginTop: 2 },
  hRow:      { flexDirection: "row", gap: 4, marginBottom: 3 },
  hDash:     { fontSize: 9, color: SB_ACC },
  hTxt:      { fontSize: 9, color: SB_TXT, flex: 1 },
  // Main
  mHdr:      { backgroundColor: HDR_BG, padding: 18 },
  mNombre:   { fontSize: 18, fontWeight: "900", color: "#fff", letterSpacing: -0.5, lineHeight: 22 },
  mProfesion:{ fontSize: 8.5, fontWeight: "600", color: SB_ACC, letterSpacing: 1.5, marginTop: 5 },
  mBody:     { flex: 1, backgroundColor: "#fff", padding: 14 },
  sec:       { marginBottom: 14 },
  secTitTxt: { fontSize: 8.5, fontWeight: "700", color: BODY_TXT, letterSpacing: 1.5 },
  objetivoTxt:{ fontSize: 9.5, color: "#4A4A4A", lineHeight: 15, marginTop: 6 },
  entry:     { marginBottom: 10 },
  entryTit:  { fontSize: 10.5, fontWeight: "700", color: BODY_TXT },
  entrySub:  { fontSize: 9, color: SEC_TXT, marginTop: 2 },
  entryDesc: { fontSize: 9, color: "#555", marginTop: 4, lineHeight: 14 },
  footer:    { textAlign: "center", fontSize: 7.5, color: "#C8C0B8", marginTop: 18, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#EDE8E2", letterSpacing: 0.5 },
});
