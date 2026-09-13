export const metadata = {
  title: 'Política de Privacidad',
  description: 'Política de Privacidad de Konexu: qué datos recopilamos, para qué los usamos y cómo los protegemos.',
  alternates: { canonical: '/privacidad' },
  robots: { index: true, follow: true },
}

const EMAIL_PRIVACIDAD = 'privacidad@konexu.app'
const EMPRESA = 'Konexu S.A.S.'
const ULTIMA_ACTUALIZACION = '9 de agosto de 2026'

function Seccion({ titulo, children }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={s.h2}>{titulo}</h2>
      {children}
    </section>
  )
}

function Tabla({ filas }) {
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #EDE8E2', marginBottom: 12 }}>
      {filas.map((f, i) => (
        <div key={i} style={{ display: 'flex', background: i % 2 === 0 ? '#F8F5F2' : '#FFFFFF', padding: '10px 14px', gap: 12 }}>
          <div style={{ flex: '0 0 32%', fontSize: 13, fontWeight: 700, color: '#1A3A5C' }}>{f[0]}</div>
          <div style={{ flex: 1, fontSize: 13, color: '#4A4060', lineHeight: 1.5 }}>{f[1]}</div>
        </div>
      ))}
    </div>
  )
}

export default function PrivacidadPage() {
  return (
    <main style={s.page}>
      <div style={s.container}>
        <a href="/" style={s.volver}>‹ Konexu</a>
        <h1 style={s.h1}>Política de Privacidad</h1>
        <p style={s.meta}>Última actualización: {ULTIMA_ACTUALIZACION}</p>
        <p style={s.intro}>
          En Konexu tomamos tu privacidad muy en serio. Esta Política explica qué datos recopilamos,
          para qué los usamos y cómo los protegemos, en cumplimiento de la Ley N.° 18.331 de la
          República Oriental del Uruguay, el Reglamento General de Protección de Datos (RGPD/GDPR)
          de la Unión Europea y la Lei Geral de Proteção de Dados (LGPD) de Brasil.
        </p>

        <Seccion titulo="1. Responsable del Tratamiento">
          <p style={s.p}>
            {EMPRESA}, con domicilio en la ciudad de Montevideo, República Oriental del Uruguay,
            es el responsable del tratamiento de los datos personales recabados a través de la
            plataforma Konexu.<br />
            Contacto del responsable: {EMAIL_PRIVACIDAD}
          </p>
        </Seccion>

        <Seccion titulo="2. Datos que Recopilamos">
          <Tabla filas={[
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
          <p style={s.p}>Utilizamos tus datos para los siguientes propósitos:</p>
          <ul style={s.ul}>
            <li style={s.li}>Crear y gestionar tu cuenta de usuario.</li>
            <li style={s.li}>Mostrar tu perfil profesional anonimizado a empleadores y empresas con el fin de intermediación laboral, cuando tu perfil esté activo.</li>
            <li style={s.li}>Revelar tus datos de contacto completos a un empleador específico únicamente cuando vos aceptás una propuesta de contacto.</li>
            <li style={s.li}>Calcular la compatibilidad entre tu perfil y las ofertas laborales disponibles.</li>
            <li style={s.li}>Enviarte notificaciones push sobre actividad relevante en la plataforma (podés desactivarlas en cualquier momento).</li>
            <li style={s.li}>Enviarte comunicaciones de marketing sobre el servicio (podés darte de baja en cualquier momento).</li>
            <li style={s.li}>Mejorar el servicio mediante análisis de uso anonimizado.</li>
            <li style={s.li}>Cumplir obligaciones legales y prevenir fraudes.</li>
          </ul>
        </Seccion>

        <Seccion titulo="4. Base Legal del Tratamiento">
          <p style={s.p}>Tratamos tus datos bajo las siguientes bases legales:</p>
          <ul style={s.ul}>
            <li style={s.li}><b>Ejecución del contrato</b>: para proveer el servicio de intermediación laboral.</li>
            <li style={s.li}><b>Consentimiento</b>: para el envío de comunicaciones de marketing y la compartición de datos con empleadores al activar tu perfil.</li>
            <li style={s.li}><b>Interés legítimo</b>: para mejorar la plataforma, prevenir fraudes y garantizar la seguridad del servicio.</li>
            <li style={s.li}><b>Obligación legal</b>: cuando sea requerido por autoridades competentes.</li>
          </ul>
        </Seccion>

        <Seccion titulo="5. Compartición de Datos con Terceros">
          <p style={s.p}>Konexu no vende tus datos personales. Compartimos información exclusivamente en los siguientes supuestos:</p>
          <ul style={s.ul}>
            <li style={s.li}><b>Empleadores y empresas en la plataforma</b>: reciben tu perfil anonimizado cuando tu perfil está activo. Solo acceden a tus datos completos si vos aceptás ser contactado.</li>
            <li style={s.li}><b>Proveedores de servicios</b>: MercadoPago (pagos), Supabase (infraestructura cloud), servicios de analítica. Todos operan bajo contratos que garantizan protección equivalente de datos.</li>
            <li style={s.li}><b>Proveedor de visión por computadora</b>: analiza de forma automática las imágenes de perfil que subís, con el único fin de moderar contenido inapropiado. La imagen se procesa solo para eso y no se utiliza para entrenar sus modelos.</li>
            <li style={s.li}><b>Autoridades competentes</b>: cuando sea exigido por ley, orden judicial o requerimiento de autoridad reguladora.</li>
            <li style={s.li}><b>Transferencia empresarial</b>: en caso de fusión o adquisición, con notificación previa a los usuarios.</li>
          </ul>
          <p style={s.p}>
            Las transferencias internacionales de datos (hacia proveedores cloud ubicados fuera de Uruguay)
            se realizan con las garantías adecuadas exigidas por la Ley 18.331, incluyendo cláusulas
            contractuales estándar reconocidas por la Unidad Reguladora y de Control de Datos Personales (URCDP).
          </p>
          <p style={s.p}>
            La moderación de imágenes de perfil es un <b>procesamiento automatizado</b>. Si una imagen
            tuya es rechazada y considerás que fue un error, podés solicitar su revisión escribiendo
            a {EMAIL_PRIVACIDAD}.
          </p>
        </Seccion>

        <Seccion titulo="6. Retención de Datos">
          <p style={s.p}>Conservamos tus datos durante los siguientes períodos:</p>
          <ul style={s.ul}>
            <li style={s.li}>Datos de cuenta activa: mientras mantengas tu cuenta abierta.</li>
            <li style={s.li}>Tras la eliminación de cuenta: datos anonimizados por hasta 5 años para estadísticas agregadas; datos identificables eliminados dentro de los 30 días siguientes a la solicitud.</li>
            <li style={s.li}>Datos de pago: según exigencias fiscales uruguayas (mínimo 10 años).</li>
            <li style={s.li}>Registros de seguridad: hasta 2 años.</li>
          </ul>
        </Seccion>

        <Seccion titulo="7. Seguridad de los Datos">
          <p style={s.p}>Implementamos medidas técnicas y organizativas para proteger tus datos, que incluyen:</p>
          <ul style={s.ul}>
            <li style={s.li}>Transmisión cifrada mediante TLS/HTTPS en todas las comunicaciones.</li>
            <li style={s.li}>Almacenamiento en servidores con cifrado en reposo.</li>
            <li style={s.li}>Acceso a datos personales restringido al personal autorizado bajo acuerdos de confidencialidad.</li>
            <li style={s.li}>Auditorías periódicas de seguridad.</li>
            <li style={s.li}>Autenticación de dos factores disponible para cuentas de empleadores.</li>
          </ul>
          <p style={s.p}>
            En caso de violación de seguridad que pueda afectar tus datos personales, te notificaremos
            en los plazos exigidos por la legislación aplicable.
          </p>
        </Seccion>

        <Seccion titulo="8. Tus Derechos">
          <p style={s.p}>Tenés derecho a, en cualquier momento:</p>
          <ul style={s.ul}>
            <li style={s.li}><b>Acceder</b> a los datos personales que tenemos sobre vos.</li>
            <li style={s.li}><b>Rectificar</b> datos inexactos o incompletos.</li>
            <li style={s.li}><b>Suprimir</b> (ser olvidado) tus datos, sujeto a obligaciones legales de retención.</li>
            <li style={s.li}><b>Oponerte</b> al tratamiento basado en interés legítimo.</li>
            <li style={s.li}><b>Retirar el consentimiento</b> en cualquier momento, sin afectar la licitud del tratamiento previo.</li>
            <li style={s.li}><b>Portabilidad</b> de tus datos en formato estructurado y de lectura mecánica.</li>
            <li style={s.li}><b>Limitar</b> el tratamiento en determinadas circunstancias.</li>
          </ul>
          <p style={s.p}>
            Para ejercer cualquiera de estos derechos, enviá un email a {EMAIL_PRIVACIDAD} indicando tu
            solicitud y tu dirección de email registrada. Responderemos en un plazo máximo de 30 días hábiles.
          </p>
          <p style={s.p}>
            Si considerás que tus derechos no han sido respetados, podés presentar una queja ante la
            Unidad Reguladora y de Control de Datos Personales (URCDP) de Uruguay en urcdp.gub.uy.
          </p>
        </Seccion>

        <Seccion titulo="9. Cookies y Tecnologías de Seguimiento">
          <p style={s.p}>
            La aplicación móvil de Konexu no utiliza cookies de navegador. Sí puede usar identificadores
            de dispositivo y tokens de sesión para mantener tu sesión activa y enviarte notificaciones
            push. Podés revocar los permisos de notificaciones en los ajustes de tu dispositivo en
            cualquier momento.
          </p>
        </Seccion>

        <Seccion titulo="10. Menores de Edad">
          <p style={s.p}>
            El servicio no está dirigido a personas menores de 18 años. No recopilamos conscientemente
            datos de menores. Si detectamos que un usuario es menor de edad, eliminaremos su cuenta y
            datos asociados de inmediato.
          </p>
        </Seccion>

        <Seccion titulo="11. Cambios en esta Política">
          <p style={s.p}>
            Podemos actualizar esta Política periódicamente. Los cambios significativos serán
            notificados por email y/o mediante aviso en la aplicación con al menos 15 días de
            anticipación. La fecha de "Última actualización" al inicio del documento indica cuándo
            se realizó la última revisión.
          </p>
        </Seccion>

        <Seccion titulo="12. Contacto">
          <p style={s.p}>
            Para cualquier consulta relacionada con el tratamiento de tus datos personales:<br />
            {EMAIL_PRIVACIDAD}
          </p>
          <p style={s.p}>{EMPRESA}<br />Montevideo, República Oriental del Uruguay</p>
        </Seccion>

        <p style={s.pie}>© 2025 {EMPRESA}. Todos los derechos reservados.</p>
      </div>
    </main>
  )
}

const s = {
  page: { background: '#F2EDE6', minHeight: '100vh', padding: '24px 16px 64px' },
  container: { maxWidth: 720, margin: '0 auto' },
  volver: { display: 'inline-block', marginBottom: 20, fontSize: 14, fontWeight: 600, color: '#E8785A', textDecoration: 'none' },
  h1: { fontSize: 24, fontWeight: 800, color: '#1A1020', margin: '0 0 4px' },
  meta: { fontSize: 12, color: '#A898B8', marginBottom: 16 },
  intro: { fontSize: 14, color: '#4A4060', lineHeight: 1.6, fontStyle: 'italic', background: '#FFFFFF', borderRadius: 10, padding: 16, border: '1px solid #EDE8E2' },
  h2: { fontSize: 16, fontWeight: 800, color: '#1A3A5C', marginBottom: 10, letterSpacing: '-0.2px' },
  p: { fontSize: 14, color: '#4A4060', lineHeight: 1.6, marginBottom: 10 },
  ul: { margin: '0 0 10px', padding: '0 0 0 20px' },
  li: { fontSize: 14, color: '#4A4060', lineHeight: 1.6, marginBottom: 8 },
  pie: { marginTop: 40, paddingTop: 20, borderTop: '1px solid #EDE8E2', textAlign: 'center', fontSize: 12, color: '#A898B8' },
}
