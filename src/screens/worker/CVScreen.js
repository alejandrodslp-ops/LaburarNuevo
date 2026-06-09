import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Keyboard, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
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

  const [cv, setCv] = useState({
    nombre: "", profesion: "", email: "", telefono: "",
    ciudad: "", pais: "", linkedin: "", objetivo: "", foto: "",
    educacion: [{ institucion: "", titulo: "", desde: "", hasta: "" }],
    experiencia: [{ empresa: "", cargo: "", desde: "", hasta: "", descripcion: "" }],
    habilidades: "",
    idiomas: [{ idioma: "", nivel: "Intermedio" }],
    certificaciones: [],
  });

  // Pre-cargar datos del perfil
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("profiles")
          .select("nombre,apellido1,apellido2,telefono,pais,ciudad,servicios,profesiones,tecnicaturas,especialidades,idiomas,bio,descripcion_libre,nacionalidad,anios_experiencia,avatar_url")
          .eq("id", user.id)
          .single();
        if (data) {
          const nombre = [data.nombre, data.apellido1, data.apellido2].filter(Boolean).join(" ");
          const profesion = (data.profesiones?.[0] || data.servicios?.[0] || data.tecnicaturas?.[0] || "");

          // Idiomas: array de strings → [{idioma, nivel}]
          const idiomasArr = Array.isArray(data.idiomas) && data.idiomas.length > 0
            ? data.idiomas.map(i => ({ idioma: i, nivel: "Intermedio" }))
            : [{ idioma: "", nivel: "Intermedio" }];

          // Habilidades: especialidades + servicios + profesiones como chips
          const habilidadesArr = [
            ...(data.especialidades || []),
            ...(data.servicios || []),
            ...(data.profesiones || []),
          ].filter(Boolean);
          const habilidades = [...new Set(habilidadesArr)].join(", ");

          // Objetivo: descripcion_libre tiene prioridad sobre bio
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
  table.page  { width:210mm; border-collapse:collapse; min-height:297mm; }
  td.sidebar  { width:72mm; background:#242424; vertical-align:top; padding:36pt 22pt 40pt; }
  td.main     { vertical-align:top; background:#FAFAFA; padding:0; }

  /* ── SIDEBAR ─────────────────────────────────── */
  .av-cell    { width:64pt; height:64pt; background:#B89A72; text-align:center; vertical-align:middle;
                font-family:Georgia,serif; font-size:28pt; font-weight:bold; color:#fff; }
  .av-wrap    { text-align:center; margin-bottom:22pt; }
  .av-border  { display:inline-block; padding:3pt; border:1.5pt solid #B89A72; }

  .s-name     { font-family:Georgia,serif; font-size:14pt; font-weight:bold; color:#fff;
                text-align:center; line-height:1.25; letter-spacing:0.3pt; margin-bottom:3pt; }
  .s-prof     { font-family:Helvetica,Arial,sans-serif; font-size:7.5pt; color:#B89A72;
                text-transform:uppercase; letter-spacing:2pt; text-align:center; margin-bottom:20pt; }

  .s-divider  { height:0.5pt; background:#3D3D3D; margin:14pt 0; }
  .s-section  { font-family:Helvetica,Arial,sans-serif; font-size:7pt; font-weight:bold;
                color:#B89A72; text-transform:uppercase; letter-spacing:2pt; margin-bottom:10pt; }

  .s-row      { margin-bottom:7pt; }
  .s-label    { font-family:Helvetica,Arial,sans-serif; font-size:7pt; color:#888; text-transform:uppercase; letter-spacing:0.8pt; margin-bottom:1pt; }
  .s-value    { font-family:Helvetica,Arial,sans-serif; font-size:9pt; color:#D0D0D0; line-height:1.4; }

  .lang-name  { font-family:Helvetica,Arial,sans-serif; font-size:9pt; color:#E0E0E0; font-weight:bold; margin-bottom:4pt; }
  .lang-track { background:#3A3A3A; height:3pt; margin-bottom:2pt; overflow:hidden; }
  .lang-fill  { height:3pt; background:#B89A72; }
  .lang-level { font-family:Helvetica,Arial,sans-serif; font-size:7.5pt; color:#777; }

  .skill-item { font-family:Helvetica,Arial,sans-serif; font-size:9pt; color:#C8C8C8;
                margin-bottom:4pt; padding-left:10pt; position:relative; }

  .cert-name  { font-family:Helvetica,Arial,sans-serif; font-size:9pt; color:#E0E0E0; font-weight:bold; }
  .cert-sub   { font-family:Helvetica,Arial,sans-serif; font-size:8pt; color:#888; margin-top:1pt; }

  /* ── MAIN HEADER ─────────────────────────────── */
  .m-header   { background:#fff; padding:32pt 36pt 22pt; border-bottom:0.5pt solid #E8E2DC; }
  .m-name     { font-family:Georgia,'Times New Roman',serif; font-size:22pt; font-weight:bold;
                color:#1A1A1A; line-height:1.15; letter-spacing:0.2pt; }
  .m-prof     { font-family:Helvetica,Arial,sans-serif; font-size:8.5pt; color:#B89A72;
                text-transform:uppercase; letter-spacing:2.5pt; margin-top:7pt; font-weight:bold; }
  .m-accent   { width:32pt; height:1.5pt; background:#B89A72; margin-top:12pt; }

  /* ── MAIN BODY ───────────────────────────────── */
  .m-body     { padding:26pt 36pt 30pt; }
  .m-section  { margin-bottom:22pt; }
  .m-sec-title{ font-family:Helvetica,Arial,sans-serif; font-size:8.5pt; font-weight:bold;
                color:#1A1A1A; text-transform:uppercase; letter-spacing:2pt;
                padding-bottom:5pt; border-bottom:1pt solid #1A1A1A; margin-bottom:14pt; }

  .m-obj      { font-family:Georgia,serif; font-size:10.5pt; color:#4A4A4A;
                line-height:1.8; font-style:italic; }

  .m-entry    { margin-bottom:14pt; }
  .m-etit     { font-family:Helvetica,Arial,sans-serif; font-size:11pt; font-weight:bold; color:#1A1A1A; }
  .m-esub     { font-family:Helvetica,Arial,sans-serif; font-size:9.5pt; color:#8A8A8A;
                margin-top:2pt; letter-spacing:0.2pt; }
  .m-edesc    { font-family:Georgia,serif; font-size:9.5pt; color:#555;
                margin-top:6pt; line-height:1.7; }

  /* ── WATERMARK PIE ──────────────────────────── */
  .watermark  { position:fixed; bottom:10pt; left:0; right:0; text-align:center;
                font-family:Helvetica,Arial,sans-serif; font-size:6pt; color:rgba(0,0,0,0.1);
                letter-spacing:3pt; text-transform:uppercase; }
</style>
</head>
<body>
<table class="page">
<tr>

<!-- ░░ SIDEBAR ░░ -->
<td class="sidebar">

  <!-- Avatar -->
  <div class="av-wrap">
    ${cv.foto
      ? `<img src="${cv.foto}" style="width:70pt;height:70pt;border-radius:50%;object-fit:cover;border:2pt solid #B89A72;display:block;margin:0 auto;" />`
      : `<table cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td class="av-cell" style="width:70pt;height:70pt;border:1.5pt solid #B89A72;">${inicial}</td></tr></table>`
    }
  </div>

  <div class="s-name">${cv.nombre ? cv.nombre.split(" ").slice(0,2).join(" ") : "Tu Nombre"}</div>
  ${cv.profesion ? `<div class="s-prof">${cv.profesion}</div>` : `<div style="margin-bottom:20pt"></div>`}

  <!-- Contacto -->
  <div class="s-section">Contacto</div>
  ${cv.telefono ? `<div class="s-row"><div class="s-label">Teléfono</div><div class="s-value">${cv.telefono}</div></div>` : ""}
  ${cv.email    ? `<div class="s-row"><div class="s-label">Email</div><div class="s-value">${cv.email}</div></div>` : ""}
  ${(cv.ciudad||cv.pais) ? `<div class="s-row"><div class="s-label">Ubicación</div><div class="s-value">${[cv.ciudad,cv.pais].filter(Boolean).join(", ")}</div></div>` : ""}
  ${cv.linkedin ? `<div class="s-row"><div class="s-label">LinkedIn</div><div class="s-value">${cv.linkedin}</div></div>` : ""}

  <!-- Idiomas -->
  ${idioms.length ? `
  <div class="s-divider"></div>
  <div class="s-section">Idiomas</div>
  ${idioms.map(i => {
    const pct = i.nivel==="Nativo"?100:i.nivel==="Avanzado"?75:i.nivel==="Intermedio"?50:25;
    return `<div style="margin-bottom:10pt">
      <div class="lang-name">${i.idioma}</div>
      <div class="lang-track"><div class="lang-fill" style="width:${pct}%"></div></div>
      <div class="lang-level">${i.nivel}</div>
    </div>`;
  }).join("")}` : ""}

  <!-- Habilidades -->
  ${habArr.length ? `
  <div class="s-divider"></div>
  <div class="s-section">Habilidades</div>
  ${habArr.map(h=>`<div class="skill-item">&#8212;&nbsp;${h}</div>`).join("")}` : ""}

  <!-- Certificaciones -->
  ${certs.length ? `
  <div class="s-divider"></div>
  <div class="s-section">Certificaciones</div>
  ${certs.map(c=>`<div style="margin-bottom:9pt">
    <div class="cert-name">${c.nombre}</div>
    ${c.institucion?`<div class="cert-sub">${c.institucion}${c.anio?" &middot; "+c.anio:""}</div>`:""}
  </div>`).join("")}` : ""}

</td>

<!-- ░░ MAIN ░░ -->
<td class="main">

  <!-- Header con nombre -->
  <div class="m-header">
    <div class="m-name">${cv.nombre || "Tu Nombre"}</div>
    ${cv.profesion ? `<div class="m-prof">${cv.profesion}</div>` : ""}
    <div class="m-accent"></div>
  </div>

  <div class="m-body">

    ${cv.objetivo ? `
    <div class="m-section">
      <div class="m-sec-title">Perfil Profesional</div>
      <div class="m-obj">${cv.objetivo}</div>
    </div>` : ""}

    ${exps.length ? `
    <div class="m-section">
      <div class="m-sec-title">Experiencia Laboral</div>
      ${exps.map(e=>`
      <div class="m-entry">
        <div class="m-etit">${e.cargo||""}</div>
        <div class="m-esub">${[e.empresa,[e.desde,e.hasta||"Presente"].filter(Boolean).join(" &ndash; ")].filter(Boolean).join("&nbsp;&nbsp;|&nbsp;&nbsp;")}</div>
        ${e.descripcion?`<div class="m-edesc">${e.descripcion}</div>`:""}
      </div>`).join("")}
    </div>` : ""}

    ${edus.length ? `
    <div class="m-section">
      <div class="m-sec-title">Educación</div>
      ${edus.map(e=>`
      <div class="m-entry">
        <div class="m-etit">${e.titulo||""}</div>
        <div class="m-esub">${[e.institucion,[e.desde,e.hasta].filter(Boolean).join(" &ndash; ")].filter(Boolean).join("&nbsp;&nbsp;|&nbsp;&nbsp;")}</div>
      </div>`).join("")}
    </div>` : ""}

  </div>

</td>
</tr>
</table>

<div class="watermark">nexu.fyi</div>

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
        <FormularioCV cv={cv} set={set} addItem={addItem} removeItem={removeItem} updateItem={updateItem} />
      ) : (
        <PreviewCV cv={cv} generarHTML={generarHTML} />
      )}
    </SafeAreaView>
  );
}

// ─── FORMULARIO ───────────────────────────────────────────────
function FormularioCV({ cv, set, addItem, removeItem, updateItem }) {
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
