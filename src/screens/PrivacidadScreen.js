import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../services/I18nContext';

const ULTIMA_ACTUALIZACION = '1 de enero de 2025';
const EMAIL_PRIVACIDAD = 'privacidad@konexu.app';
const EMPRESA = 'Konexu S.A.S.';

function Seccion({ titulo, children }) {
  return (
    <View style={ss.sec}>
      <Text style={ss.secTit}>{titulo}</Text>
      {children}
    </View>
  );
}

function P({ children }) {
  return <Text style={ss.p}>{children}</Text>;
}

function Li({ children }) {
  return (
    <View style={ss.liRow}>
      <Text style={ss.liBullet}>•</Text>
      <Text style={ss.liTxt}>{children}</Text>
    </View>
  );
}

function Tabla({ filas }) {
  return (
    <View style={ss.tabla}>
      {filas.map((f, i) => (
        <View key={i} style={[ss.tablaFila, i % 2 === 0 && ss.tablaFilaPar]}>
          <Text style={ss.tablaCel1}>{f[0]}</Text>
          <Text style={ss.tablaCel2}>{f[1]}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PrivacidadScreen({ navigation }) {
  const { t } = useI18n();
  return (
    <SafeAreaView style={ss.safe} edges={['top']}>
      <View style={ss.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={ss.backBtn}>
          <Text style={ss.backTxt}>‹ {t('volver')}</Text>
        </TouchableOpacity>
        <Text style={ss.headerTit}>{t('privacidad')}</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={ss.content} showsVerticalScrollIndicator={false}>
        <Text style={ss.meta}>Última actualización: {ULTIMA_ACTUALIZACION}</Text>
        <Text style={ss.intro}>
          En Konexu tomamos tu privacidad muy en serio. Esta Política explica qué datos recopilamos,
          para qué los usamos y cómo los protegemos, en cumplimiento de la Ley N° 18.331 de la
          República Oriental del Uruguay, el Reglamento General de Protección de Datos (RGPD/GDPR)
          de la Unión Europea y la Lei Geral de Proteção de Dados (LGPD) de Brasil.
        </Text>

        <Seccion titulo="1. Responsable del Tratamiento">
          <P>
            {EMPRESA}, con domicilio en la ciudad de Montevideo, República Oriental del Uruguay,
            es el responsable del tratamiento de los datos personales recabados a través de la
            plataforma Konexu.{'\n'}
            Contacto del responsable: {EMAIL_PRIVACIDAD}
          </P>
        </Seccion>

        <Seccion titulo="2. Datos que Recopilamos">
          <Tabla filas={[
            ['Categoría', 'Detalle'],
            ['Identidad', 'Nombre, apellido, fecha de nacimiento, sexo, estado civil'],
            ['Contacto', 'Email, teléfono'],
            ['Ubicación', 'País, ciudad, barrio (aproximado)'],
            ['Profesional', 'Oficios, profesiones, especialidades, experiencia, disponibilidad'],
            ['Económico', 'Pretensión salarial (rango)'],
            ['Foto de perfil', 'Imagen cargada por el usuario'],
            ['Uso', 'Búsquedas, vistas de perfil, clics, sesiones'],
            ['Dispositivo', 'Tipo, sistema operativo, idioma, token de push'],
            ['Pago', 'Procesado por MercadoPago; Konexu no accede a datos de tarjeta'],
          ]} />
        </Seccion>

        <Seccion titulo="3. Finalidades del Tratamiento">
          <P>Utilizamos tus datos para los siguientes propósitos:</P>
          <Li>Crear y gestionar tu cuenta de usuario.</Li>
          <Li>Mostrar tu perfil profesional anonimizado a empleadores y empresas con el fin de intermediación laboral, cuando tu perfil esté activo.</Li>
          <Li>Revelar tus datos de contacto completos a un empleador específico únicamente cuando vos aceptás una propuesta de contacto.</Li>
          <Li>Calcular la compatibilidad entre tu perfil y las ofertas laborales disponibles.</Li>
          <Li>Enviarte notificaciones push sobre actividad relevante en la plataforma (podés desactivarlas en cualquier momento).</Li>
          <Li>Enviarte comunicaciones de marketing sobre el servicio (podés darte de baja en cualquier momento).</Li>
          <Li>Mejorar el servicio mediante análisis de uso anonimizado.</Li>
          <Li>Cumplir obligaciones legales y prevenir fraudes.</Li>
        </Seccion>

        <Seccion titulo="4. Base Legal del Tratamiento">
          <P>Tratamos tus datos bajo las siguientes bases legales:</P>
          <Li><Text style={ss.negrita}>Ejecución del contrato</Text>: para proveer el servicio de intermediación laboral.</Li>
          <Li><Text style={ss.negrita}>Consentimiento</Text>: para el envío de comunicaciones de marketing y la compartición de datos con empleadores al activar tu perfil.</Li>
          <Li><Text style={ss.negrita}>Interés legítimo</Text>: para mejorar la plataforma, prevenir fraudes y garantizar la seguridad del servicio.</Li>
          <Li><Text style={ss.negrita}>Obligación legal</Text>: cuando sea requerido por autoridades competentes.</Li>
        </Seccion>

        <Seccion titulo="5. Compartición de Datos con Terceros">
          <P>
            Konexu no vende tus datos personales. Compartimos información exclusivamente en los
            siguientes supuestos:
          </P>
          <Li>
            <Text style={ss.negrita}>Empleadores y empresas en la plataforma</Text>: reciben tu perfil
            anonimizado cuando tu perfil está activo. Solo acceden a tus datos completos si vos
            aceptás ser contactado.
          </Li>
          <Li>
            <Text style={ss.negrita}>Proveedores de servicios</Text>: MercadoPago (pagos), Supabase
            (infraestructura cloud), servicios de analítica. Todos operan bajo contratos que
            garantizan protección equivalente de datos.
          </Li>
          <Li>
            <Text style={ss.negrita}>Autoridades competentes</Text>: cuando sea exigido por ley,
            orden judicial o requerimiento de autoridad reguladora.
          </Li>
          <Li>
            <Text style={ss.negrita}>Transferencia empresarial</Text>: en caso de fusión o adquisición,
            con notificación previa a los usuarios.
          </Li>
          <P>
            Las transferencias internacionales de datos (hacia proveedores cloud ubicados fuera
            de Uruguay) se realizan con las garantías adecuadas exigidas por la Ley 18.331, incluyendo
            cláusulas contractuales estándar reconocidas por la Unidad Reguladora y de Control
            de Datos Personales (URCDP).
          </P>
        </Seccion>

        <Seccion titulo="6. Retención de Datos">
          <P>Conservamos tus datos durante los siguientes períodos:</P>
          <Li>Datos de cuenta activa: mientras mantengas tu cuenta abierta.</Li>
          <Li>Tras la eliminación de cuenta: datos anonimizados por hasta 5 años para estadísticas agregadas; datos identificables eliminados dentro de los 30 días siguientes a la solicitud.</Li>
          <Li>Datos de pago: según exigencias fiscales uruguayas (mínimo 10 años).</Li>
          <Li>Registros de seguridad: hasta 2 años.</Li>
        </Seccion>

        <Seccion titulo="7. Seguridad de los Datos">
          <P>
            Implementamos medidas técnicas y organizativas para proteger tus datos, que incluyen:
          </P>
          <Li>Transmisión cifrada mediante TLS/HTTPS en todas las comunicaciones.</Li>
          <Li>Almacenamiento en servidores con cifrado en reposo.</Li>
          <Li>Acceso a datos personales restringido al personal autorizado bajo acuerdos de confidencialidad.</Li>
          <Li>Auditorías periódicas de seguridad.</Li>
          <Li>Autenticación de dos factores disponible para cuentas de empleadores.</Li>
          <P>
            En caso de violación de seguridad que pueda afectar tus datos personales, te
            notificaremos en los plazos exigidos por la legislación aplicable.
          </P>
        </Seccion>

        <Seccion titulo="8. Tus Derechos">
          <P>
            Tenés derecho a, en cualquier momento:
          </P>
          <Li><Text style={ss.negrita}>Acceder</Text> a los datos personales que tenemos sobre vos.</Li>
          <Li><Text style={ss.negrita}>Rectificar</Text> datos inexactos o incompletos.</Li>
          <Li><Text style={ss.negrita}>Suprimir</Text> (ser olvidado) tus datos, sujeto a obligaciones legales de retención.</Li>
          <Li><Text style={ss.negrita}>Oponerte</Text> al tratamiento basado en interés legítimo.</Li>
          <Li><Text style={ss.negrita}>Retirar el consentimiento</Text> en cualquier momento, sin afectar la licitud del tratamiento previo.</Li>
          <Li><Text style={ss.negrita}>Portabilidad</Text> de tus datos en formato estructurado y de lectura mecánica.</Li>
          <Li><Text style={ss.negrita}>Limitar</Text> el tratamiento en determinadas circunstancias.</Li>
          <P>
            Para ejercer cualquiera de estos derechos, enviá un email a {EMAIL_PRIVACIDAD}
            indicando tu solicitud y tu dirección de email registrada. Responderemos en un plazo
            máximo de 30 días hábiles.
          </P>
          <P>
            Si considerás que tus derechos no han sido respetados, podés presentar una queja
            ante la Unidad Reguladora y de Control de Datos Personales (URCDP) de Uruguay
            en urcdp.gub.uy.
          </P>
        </Seccion>

        <Seccion titulo="9. Cookies y Tecnologías de Seguimiento">
          <P>
            La aplicación móvil de Konexu no utiliza cookies de navegador. Sí puede usar
            identificadores de dispositivo y tokens de sesión para mantener tu sesión activa
            y enviarte notificaciones push. Podés revocar los permisos de notificaciones en
            los ajustes de tu dispositivo en cualquier momento.
          </P>
        </Seccion>

        <Seccion titulo="10. Menores de Edad">
          <P>
            El servicio no está dirigido a personas menores de 18 años. No recopilamos
            conscientemente datos de menores. Si detectamos que un usuario es menor de edad,
            eliminaremos su cuenta y datos asociados de inmediato.
          </P>
        </Seccion>

        <Seccion titulo="11. Cambios en esta Política">
          <P>
            Podemos actualizar esta Política periódicamente. Los cambios significativos serán
            notificados por email y/o mediante aviso en la aplicación con al menos 15 días de
            anticipación. La fecha de "Última actualización" al inicio del documento indica
            cuándo se realizó la última revisión.
          </P>
        </Seccion>

        <Seccion titulo="12. Contacto">
          <P>
            Para cualquier consulta relacionada con el tratamiento de tus datos personales:{'\n'}
            {EMAIL_PRIVACIDAD}
          </P>
          <P>
            {EMPRESA}{'\n'}
            Montevideo, República Oriental del Uruguay
          </P>
        </Seccion>

        <View style={ss.pie}>
          <Text style={ss.pieTxt}>© 2025 {EMPRESA}. Todos los derechos reservados.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#F2EDE6' },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EDE8E2' },
  backBtn:   { width: 70 },
  backTxt:   { fontSize: 16, color: '#E8785A', fontWeight: '600' },
  headerTit: { fontSize: 15, fontWeight: '800', color: '#1A1020', flex: 1, textAlign: 'center' },
  content:   { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  meta:      { fontSize: 11, color: '#A898B8', marginBottom: 12, textAlign: 'center' },
  intro:     { fontSize: 13, color: '#4A4060', lineHeight: 20, marginBottom: 8, fontStyle: 'italic', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#EDE8E2' },
  sec:       { marginTop: 20 },
  secTit:    { fontSize: 14, fontWeight: '800', color: '#1A3A5C', marginBottom: 8, letterSpacing: -0.2 },
  p:         { fontSize: 13, color: '#4A4060', lineHeight: 20, marginBottom: 8 },
  negrita:   { fontWeight: '700', color: '#1A1020' },
  liRow:     { flexDirection: 'row', marginBottom: 6, paddingLeft: 4 },
  liBullet:  { fontSize: 13, color: '#E8785A', marginRight: 8, lineHeight: 20 },
  liTxt:     { flex: 1, fontSize: 13, color: '#4A4060', lineHeight: 20 },
  tabla:     { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#EDE8E2', marginBottom: 8 },
  tablaFila: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 8, paddingHorizontal: 12 },
  tablaFilaPar: { backgroundColor: '#F8F5F2' },
  tablaCel1: { flex: 0.4, fontSize: 12, fontWeight: '700', color: '#1A3A5C' },
  tablaCel2: { flex: 0.6, fontSize: 12, color: '#4A4060', lineHeight: 17 },
  pie:       { marginTop: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#EDE8E2', alignItems: 'center' },
  pieTxt:    { fontSize: 11, color: '#A898B8' },
});
