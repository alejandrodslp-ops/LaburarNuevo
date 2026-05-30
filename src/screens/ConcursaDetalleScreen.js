import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

const BANDERAS = { UY:'🇺🇾', AR:'🇦🇷', BR:'🇧🇷', CL:'🇨🇱', CO:'🇨🇴', PE:'🇵🇪', PY:'🇵🇾', BO:'🇧🇴', EC:'🇪🇨' };

function stripHtml(html) {
  if (!html) return null;
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim() || null;
}

export default function ConcursaDetalleScreen({ route, navigation }) {
  const { match } = route.params || {};
  const c = match?.concursos || match;
  const score = match?.score ?? 0;
  const cumple = match?.cumple ?? false;
  const keywords_match = match?.keywords_match || [];

  if (!c) {
    return (
      <SafeAreaView style={ss.container} edges={['top']}>
        <Text style={{ padding: 24, color: COLORS.texto2 }}>No se encontró el llamado.</Text>
      </SafeAreaView>
    );
  }

  const esPrivado = c.tipo_vinculo === 'privado';
  const esNoticia = c.fuente?.includes('gnews') || c.fuente?.includes('news');
  const bandera = BANDERAS[c.pais] || '🌍';
  const descripcionLimpia = stripHtml(c.descripcion);
  const requisitosLimpios = stripHtml(c.requisitos);

  const diasRestantes = () => {
    if (!c.fecha_cierre) return null;
    return Math.ceil((new Date(c.fecha_cierre) - new Date()) / (1000 * 60 * 60 * 24));
  };
  const dias = diasRestantes();

  const abrirLink = async (url) => {
    if (!url) { Alert.alert('Sin enlace', 'Este llamado no tiene enlace disponible.'); return; }
    const supported = await Linking.canOpenURL(url);
    if (supported) Linking.openURL(url);
    else Alert.alert('Error', 'No se puede abrir el enlace.');
  };

  const scoreColor = score >= 70 ? COLORS.mentaDark : score >= 40 ? COLORS.coral : COLORS.texto3;
  const scoreLabel = score >= 70 ? '✓ Cumplís todos los requisitos'
    : score >= 40 ? `⚡ ${score}% compatible`
    : score > 0  ? `${score}% compatible`
    : 'Sin puntaje calculado';

  return (
    <SafeAreaView style={ss.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#D6E4F0', '#B8D4E8']} style={ss.header}>
        <TouchableOpacity style={ss.back} onPress={() => navigation.goBack()}>
          <Text style={ss.backTxt}>← Volver</Text>
        </TouchableOpacity>
        <View style={ss.sectorBadge}>
          <Text style={[ss.sectorTxt, { color: esNoticia ? '#6B7280' : esPrivado ? '#E65100' : '#1565C0' }]}>
            {esNoticia ? '📰 NOTICIA' : esPrivado ? '💼 SECTOR PRIVADO' : '🏛️ SECTOR PÚBLICO'}
          </Text>
        </View>
        <Text style={ss.cargo} numberOfLines={3}>{c.cargo || c.titulo}</Text>
        <Text style={ss.org}>{bandera} {c.organismo || (esPrivado ? 'Empresa privada' : 'Organismo público')}</Text>
        {c.lugar && <Text style={ss.lugar}>📍 {c.lugar}</Text>}
      </LinearGradient>

      <ScrollView contentContainerStyle={ss.body} showsVerticalScrollIndicator={false}>

        {/* Score */}
        {score > 0 && (
          <View style={[ss.scoreCard, { borderColor: scoreColor + '40' }]}>
            <Text style={[ss.scoreNum, { color: scoreColor }]}>{score}%</Text>
            <View style={{ flex: 1 }}>
              <Text style={[ss.scoreLbl, { color: scoreColor }]}>{scoreLabel}</Text>
              {keywords_match.length > 0 && (
                <View style={ss.kwRow}>
                  {keywords_match.slice(0, 5).map((kw, i) => (
                    <View key={i} style={ss.kwChip}>
                      <Text style={ss.kwTxt}>{kw}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Datos del llamado */}
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Información del llamado</Text>

          {c.numero_llamado && <Row label="Número" value={`#${c.numero_llamado}`} />}
          {c.tipo_tarea && <Row label="Tipo de tarea" value={c.tipo_tarea} />}
          {c.tipo_vinculo && <Row label="Vínculo" value={c.tipo_vinculo} />}
          {c.puestos > 1 && <Row label="Vacantes" value={`${c.puestos} puestos`} />}
          {c.fecha_inicio && <Row label="Inicio" value={formatFecha(c.fecha_inicio)} />}
          {c.fecha_cierre && (
            <Row
              label="Cierre"
              value={`${formatFecha(c.fecha_cierre)}${dias !== null ? ` (${dias > 0 ? `en ${dias} días` : 'vencido'})` : ''}`}
              highlight={dias !== null && dias <= 7 && dias >= 0}
            />
          )}
        </View>

        {/* Descripción */}
        {descripcionLimpia && (
          <View style={ss.section}>
            <Text style={ss.sectionTitle}>{esNoticia ? 'Resumen' : 'Descripción'}</Text>
            <Text style={ss.texto}>{descripcionLimpia}</Text>
          </View>
        )}

        {/* Requisitos */}
        {requisitosLimpios && (
          <View style={ss.section}>
            <Text style={ss.sectionTitle}>Requisitos</Text>
            <Text style={ss.texto}>{requisitosLimpios}</Text>
          </View>
        )}

        {/* Sin descripción */}
        {!descripcionLimpia && !requisitosLimpios && (
          <View style={ss.section}>
            <Text style={{ color: COLORS.texto3, fontSize: SIZES.textSm, textAlign: 'center', paddingVertical: 16 }}>
              {esNoticia ? 'Abrí el artículo para leer el contenido completo.' : 'Las bases completas están en el sitio oficial del organismo.'}
            </Text>
          </View>
        )}

        {/* Botones */}
        {(c.url_detalle || c.url_postulacion) && (
          <View style={ss.btns}>
            {!esNoticia && c.url_detalle && c.url_detalle !== c.url_postulacion && (
              <TouchableOpacity style={ss.btnSecundario} onPress={() => abrirLink(c.url_detalle)}>
                <Text style={ss.btnSecundarioTxt}>📄 Ver bases completas</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={ss.btnPrincipal}
              onPress={() => abrirLink(c.url_postulacion || c.url_detalle)}
            >
              <Text style={ss.btnPrincipalTxt}>{esNoticia ? '📰 Leer artículo →' : (c.pais === 'UY' || c.url_postulacion?.includes('uruguayconcursa')) ? '📄 Ver bases completas →' : 'Postularme →'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, highlight }) {
  return (
    <View style={ss.row}>
      <Text style={ss.rowLabel}>{label}</Text>
      <Text style={[ss.rowValue, highlight && { color: '#C2410C', fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

function formatFecha(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: 'long', year: 'numeric' });
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.crema },
  header: {
    paddingHorizontal: SIZES.md, paddingTop: SIZES.sm, paddingBottom: SIZES.xl,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  back: { marginBottom: SIZES.sm },
  backTxt: { color: '#1A3A5C', fontWeight: '700', fontSize: SIZES.textMd },
  sectorBadge: {
    backgroundColor: 'rgba(255,255,255,0.6)', alignSelf: 'flex-start',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
  },
  sectorTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  cargo: { fontSize: 22, fontWeight: '900', color: '#1A3A5C', lineHeight: 28, marginBottom: 6 },
  org:   { fontSize: 14, color: 'rgba(26,58,92,0.75)', fontWeight: '600', marginBottom: 4 },
  lugar: { fontSize: 13, color: 'rgba(26,58,92,0.6)' },

  body: { padding: SIZES.md, gap: SIZES.md },

  scoreCard: {
    backgroundColor: COLORS.blanco, borderRadius: SIZES.radiusMd,
    padding: SIZES.md, flexDirection: 'row', alignItems: 'center',
    gap: 14, borderWidth: 1.5, ...SHADOWS.sm,
  },
  scoreNum: { fontSize: 36, fontWeight: '900', width: 64, textAlign: 'center' },
  scoreLbl: { fontSize: SIZES.textMd, fontWeight: '700', marginBottom: 6 },
  kwRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  kwChip:   { backgroundColor: COLORS.indigoSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  kwTxt:    { fontSize: 11, color: COLORS.indigo, fontWeight: '600' },

  section: {
    backgroundColor: COLORS.blanco, borderRadius: SIZES.radiusMd,
    padding: SIZES.md, ...SHADOWS.sm,
  },
  sectionTitle: { fontSize: SIZES.textMd, fontWeight: '800', color: COLORS.texto1, marginBottom: 12 },
  texto: { fontSize: SIZES.textSm, color: COLORS.texto2, lineHeight: 22 },

  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borde,
  },
  rowLabel: { fontSize: SIZES.textSm, color: COLORS.texto3, flex: 1 },
  rowValue: { fontSize: SIZES.textSm, color: COLORS.texto1, fontWeight: '600', flex: 2, textAlign: 'right' },

  btns: { gap: 10 },
  btnPrincipal: {
    backgroundColor: COLORS.coral, borderRadius: SIZES.radiusFull,
    paddingVertical: 16, alignItems: 'center',
  },
  btnPrincipalTxt: { color: COLORS.blanco, fontSize: SIZES.textMd, fontWeight: '800' },
  btnSecundario: {
    backgroundColor: COLORS.blanco, borderRadius: SIZES.radiusFull,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#1A3A5C',
  },
  btnSecundarioTxt: { color: '#1A3A5C', fontSize: SIZES.textMd, fontWeight: '700' },
});
