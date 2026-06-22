import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../services/I18nContext';

const ULTIMA_ACTUALIZACION = '1 de enero de 2025';
const EMAIL_LEGAL = 'legal@konexu.app';
const EMPRESA = 'Konexu S.A.S.';
const PAIS = 'República Oriental del Uruguay';

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

export default function TerminosScreen({ navigation }) {
  const { t } = useI18n();
  return (
    <SafeAreaView style={ss.safe} edges={['top']}>
      <View style={ss.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={ss.backBtn}>
          <Text style={ss.backTxt}>‹ {t('volver')}</Text>
        </TouchableOpacity>
        <Text style={ss.headerTit}>{t('terminos')}</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={ss.content} showsVerticalScrollIndicator={false}>
        <Text style={ss.meta}>Última actualización: {ULTIMA_ACTUALIZACION}</Text>
        <Text style={ss.intro}>
          Estos Términos y Condiciones ("Términos") regulan el uso de la plataforma Konexu,
          operada por {EMPRESA}, constituida bajo las leyes de la {PAIS}. Al registrarte
          o utilizar la plataforma aceptás estos Términos en su totalidad. Si no estás de
          acuerdo, no utilices el servicio.
        </Text>

        <Seccion titulo="1. Descripción del Servicio">
          <P>
            Konexu es una plataforma digital de intermediación laboral que conecta a trabajadores
            independientes y en relación de dependencia con empleadores particulares y empresas.
            El servicio incluye, entre otros:
          </P>
          <Li>Creación y gestión de perfiles profesionales anónimos.</Li>
          <Li>Publicación y búsqueda de ofertas de empleo y concursos del sector público.</Li>
          <Li>Sistema de mensajería entre partes interesadas.</Li>
          <Li>Activación de visibilidad del perfil mediante suscripción de pago.</Li>
          <Li>Algoritmo de compatibilidad entre perfiles y llamados.</Li>
        </Seccion>

        <Seccion titulo="2. Registro y Cuenta de Usuario">
          <P>
            Para utilizar Konexu debés crear una cuenta con información veraz, completa y actualizada.
            Sos responsable de mantener la confidencialidad de tus credenciales de acceso y de
            todas las actividades realizadas desde tu cuenta.
          </P>
          <P>
            Al registrarte y completar tu perfil, declarás que eres mayor de 18 años y que
            toda la información que proporcionás — incluyendo datos personales, formación,
            experiencia y aptitudes — es verídica y exacta.{' '}
            <Text style={ss.negrita}>Sos el único responsable de la veracidad o falsedad
            de la información que cargás en la plataforma.</Text>{' '}
            Konexu no verifica de forma independiente los datos ingresados por los usuarios.
          </P>
          <P>
            Konexu se reserva el derecho de suspender o cancelar cuentas que:
          </P>
          <Li>Proporcionen información falsa o engañosa.</Li>
          <Li>Incumplan estos Términos o la legislación aplicable.</Li>
          <Li>Sean utilizadas para actividades fraudulentas o ilegales.</Li>
          <Li>Perjudiquen a otros usuarios o terceros.</Li>
        </Seccion>

        <Seccion titulo="3. Perfiles Anónimos y Visibilidad">
          <P>
            Konexu opera bajo un sistema de <Text style={ss.negrita}>anonimato selectivo</Text>: los
            datos personales del trabajador (nombre completo, teléfono, foto, dirección exacta)
            permanecen ocultos para los empleadores hasta que <Text style={ss.negrita}>ambas partes
            manifiesten interés mutuo en establecer contacto</Text>.
          </P>
          <P>
            Al activar tu perfil, aceptás expresamente que Konexu comparta tu perfil profesional
            anonimizado (oficio, zona geográfica aproximada, experiencia, disponibilidad) con
            empleadores y empresas registradas en la plataforma. La revelación de datos personales
            completos ocurre únicamente cuando el trabajador acepta una propuesta de contacto.
          </P>
          <P>
            El trabajador puede desactivar su visibilidad en cualquier momento desde la sección
            "Mi Perfil". La desactivación no implica el reembolso del período de suscripción ya abonado.
          </P>
        </Seccion>

        <Seccion titulo="4. Recopilación, Uso y Compartición de Datos">
          <P>
            Al registrarte y usar Konexu, autorizás expresamente la recopilación y el uso de los
            siguientes datos con los fines indicados:
          </P>
          <Li>
            <Text style={ss.negrita}>Datos de identidad y contacto</Text> (nombre, email, teléfono,
            fecha de nacimiento): utilizados para verificar identidad, gestionar la cuenta y
            cumplir obligaciones legales.
          </Li>
          <Li>
            <Text style={ss.negrita}>Datos profesionales</Text> (oficios, profesiones, experiencia,
            sueldo pretendido, disponibilidad): compartidos de forma <Text style={ss.negrita}>anonimizada</Text> con
            empleadores y empresas en la plataforma para facilitar la intermediación laboral.
          </Li>
          <Li>
            <Text style={ss.negrita}>Datos de ubicación aproximada</Text> (país, ciudad, barrio):
            utilizados para mostrar resultados relevantes y para el algoritmo de compatibilidad.
            No se comparte ubicación exacta o en tiempo real.
          </Li>
          <Li>
            <Text style={ss.negrita}>Datos de uso y comportamiento</Text> (búsquedas, vistas de perfil,
            interacciones): utilizados para mejorar el algoritmo de recomendación y la experiencia
            de usuario. Pueden ser procesados por proveedores de analítica bajo acuerdos de
            confidencialidad.
          </Li>
          <Li>
            <Text style={ss.negrita}>Datos de pago</Text>: procesados exclusivamente por Stripe Inc.
            bajo sus propios estándares PCI-DSS. Konexu no almacena datos de tarjetas de crédito.
          </Li>
          <P>
            Konexu podrá compartir datos personales con terceros exclusivamente en los siguientes
            casos: (a) con el consentimiento explícito del usuario; (b) con empleadores/empresas
            en la medida establecida en la cláusula 3; (c) cuando sea requerido por autoridad
            competente; (d) con proveedores de servicios (cloud, analítica, pagos) bajo contratos
            que garantizan protección equivalente; (e) en caso de fusión, adquisición o
            reorganización empresarial, notificando a los usuarios con antelación razonable.
          </P>
        </Seccion>

        <Seccion titulo="5. Uso por Empleadores y Empresas">
          <P>
            Los empleadores y empresas que accedan a perfiles de trabajadores en Konexu se comprometen a:
          </P>
          <Li>Utilizar la información obtenida exclusivamente para procesos de selección de personal.</Li>
          <Li>No transferir, vender ni ceder información de perfiles a terceros no autorizados.</Li>
          <Li>No discriminar candidatos por criterios prohibidos por la legislación uruguaya.</Li>
          <Li>Cumplir con todas las obligaciones legales en materia de protección de datos.</Li>
          <P>
            El incumplimiento de estas obligaciones por parte de empleadores o empresas podrá
            resultar en la suspensión del acceso a la plataforma y, en su caso, en acciones
            legales por los daños causados.
          </P>
        </Seccion>

        <Seccion titulo="6. Condiciones de Pago y Suscripción">
          <P>
            La activación del perfil de trabajador requiere el pago de una suscripción según los
            planes vigentes publicados en la plataforma. Al confirmar el pago:
          </P>
          <Li>Aceptás los cargos correspondientes al plan seleccionado.</Li>
          <Li>El período de activación comienza inmediatamente tras la confirmación del pago.</Li>
          <Li>Los pagos son no reembolsables salvo error técnico imputable a Konexu o cuando lo exija la legislación aplicable.</Li>
          <Li>Konexu puede modificar sus precios notificando a los usuarios con al menos 30 días de anticipación.</Li>
          <Li>En caso de fallo en el cobro, el perfil podrá ser desactivado automáticamente.</Li>
        </Seccion>

        <Seccion titulo="7. Conducta Prohibida">
          <P>Queda estrictamente prohibido:</P>
          <Li>Publicar información falsa, engañosa o fraudulenta.</Li>
          <Li>Intentar acceder sin autorización a cuentas de otros usuarios o sistemas de Konexu.</Li>
          <Li>Usar la plataforma para contactar usuarios con fines distintos a la intermediación laboral legítima.</Li>
          <Li>Realizar scraping, extracción masiva de datos u otras técnicas automatizadas no autorizadas.</Li>
          <Li>Compartir fuera de la plataforma datos de contacto obtenidos a través de Konexu sin consentimiento.</Li>
          <Li>Acosar, discriminar o amenazar a otros usuarios.</Li>
          <Li>Publicar contenido ilegal, difamatorio, obsceno o que infrinja derechos de terceros.</Li>
        </Seccion>

        <Seccion titulo="8. Propiedad Intelectual">
          <P>
            Konexu y todo su contenido (marca, logotipos, software, algoritmos, diseños, textos)
            son propiedad exclusiva de {EMPRESA} o de sus licenciantes y están protegidos por las
            leyes de propiedad intelectual vigentes en Uruguay y tratados internacionales.
          </P>
          <P>
            El usuario conserva todos los derechos sobre el contenido que sube (fotos, descripción
            personal, etc.), otorgando a Konexu una licencia no exclusiva, mundial, libre de regalías
            para usar, mostrar y distribuir dicho contenido dentro de la plataforma con los fines
            propios del servicio.
          </P>
        </Seccion>

        <Seccion titulo="9. Limitación de Responsabilidad">
          <P>
            Konexu actúa exclusivamente como intermediario y <Text style={ss.negrita}>no es parte de
            ninguna relación laboral</Text> entre trabajadores y empleadores. En ningún caso {EMPRESA}
            será responsable por:
          </P>
          <Li>La veracidad de la información proporcionada por usuarios.</Li>
          <Li>El resultado de procesos de selección iniciados a través de la plataforma.</Li>
          <Li>Incumplimientos de contrato entre trabajadores y empleadores.</Li>
          <Li>Daños indirectos, lucro cesante o pérdida de datos derivados del uso de la plataforma.</Li>
          <Li>Interrupciones del servicio por causas de fuerza mayor o mantenimiento técnico.</Li>
          <P>
            En la medida permitida por la ley, la responsabilidad total de Konexu hacia cualquier
            usuario no excederá el monto pagado por el usuario en los 12 meses anteriores al
            evento que originó el reclamo.
          </P>
        </Seccion>

        <Seccion titulo="10. Modificaciones">
          <P>
            Konexu puede modificar estos Términos en cualquier momento. Los cambios significativos
            serán notificados por email y/o mediante aviso en la aplicación con al menos 15 días
            de anticipación. El uso continuado de la plataforma tras ese período implica la
            aceptación de los nuevos Términos.
          </P>
        </Seccion>

        <Seccion titulo="11. Ley Aplicable y Jurisdicción">
          <P>
            Estos Términos se rigen por las leyes de la República Oriental del Uruguay,
            incluyendo la Ley N° 18.331 de Protección de Datos Personales y Acción de
            Habeas Data, la Ley N° 18.159 de Competencia y la Ley N° 17.250 de Defensa
            del Consumidor.
          </P>
          <P>
            Cualquier controversia que no pueda resolverse de forma amigable será sometida
            a los tribunales competentes de la ciudad de Montevideo, Uruguay, renunciando
            las partes a cualquier otro fuero o jurisdicción.
          </P>
        </Seccion>

        <Seccion titulo="12. Contacto">
          <P>
            Para consultas sobre estos Términos, podés contactarnos en:{'\n'}
            {EMAIL_LEGAL}
          </P>
          <P>
            {EMPRESA}{'\n'}
            Montevideo, {PAIS}
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
  pie:       { marginTop: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#EDE8E2', alignItems: 'center' },
  pieTxt:    { fontSize: 11, color: '#A898B8' },
});
