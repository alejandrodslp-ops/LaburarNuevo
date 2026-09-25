export const metadata = {
  title: 'Términos y Condiciones',
  description: 'Términos y Condiciones de uso de la plataforma Konexu.',
  alternates: { canonical: '/terminos' },
  robots: { index: true, follow: true },
}

const EMAIL_LEGAL = 'legal@konexu.app'
const EMPRESA = 'Konexu S.A.S.'
const PAIS = 'República Oriental del Uruguay'
const ULTIMA_ACTUALIZACION = '13 de septiembre de 2026'

function Seccion({ titulo, children }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={s.h2}>{titulo}</h2>
      {children}
    </section>
  )
}

export default function TerminosPage() {
  return (
    <main style={s.page}>
      <div style={s.container}>
        <a href="/" style={s.volver}>‹ Konexu</a>
        <h1 style={s.h1}>Términos y Condiciones</h1>
        <p style={s.meta}>Última actualización: {ULTIMA_ACTUALIZACION}</p>
        <p style={s.intro}>
          Estos Términos y Condiciones ("Términos") regulan el uso de la plataforma Konexu, operada
          por {EMPRESA}, constituida bajo las leyes de la {PAIS}. Al registrarte o utilizar la
          plataforma aceptás estos Términos en su totalidad. Si no estás de acuerdo, no utilices el servicio.
        </p>

        <Seccion titulo="1. Descripción del Servicio">
          <p style={s.p}>
            Konexu es una plataforma digital de intermediación laboral que conecta a trabajadores
            independientes y en relación de dependencia con empleadores particulares y empresas.
            El servicio incluye, entre otros:
          </p>
          <ul style={s.ul}>
            <li style={s.li}>Creación y gestión de perfiles profesionales anónimos.</li>
            <li style={s.li}>Publicación y búsqueda de ofertas de empleo y concursos del sector público.</li>
            <li style={s.li}>Sistema de mensajería entre partes interesadas.</li>
            <li style={s.li}>Activación de visibilidad del perfil mediante suscripción de pago.</li>
            <li style={s.li}>Algoritmo de compatibilidad entre perfiles y llamados.</li>
          </ul>
        </Seccion>

        <Seccion titulo="2. Registro y Cuenta de Usuario">
          <p style={s.p}>
            Para utilizar Konexu debés crear una cuenta con información veraz, completa y actualizada.
            Sos responsable de mantener la confidencialidad de tus credenciales de acceso y de todas
            las actividades realizadas desde tu cuenta.
          </p>
          <p style={s.p}>
            Al registrarte y completar tu perfil, declarás que eres mayor de 18 años y que toda la
            información que proporcionás — incluyendo datos personales, formación, experiencia y
            aptitudes — es verídica y exacta. <b>Sos el único responsable de la veracidad o falsedad
            de la información que cargás en la plataforma.</b> Konexu no verifica de forma
            independiente los datos ingresados por los usuarios.
          </p>
          <p style={s.p}>Konexu se reserva el derecho de suspender o cancelar cuentas que:</p>
          <ul style={s.ul}>
            <li style={s.li}>Proporcionen información falsa o engañosa.</li>
            <li style={s.li}>Incumplan estos Términos o la legislación aplicable.</li>
            <li style={s.li}>Sean utilizadas para actividades fraudulentas o ilegales.</li>
            <li style={s.li}>Perjudiquen a otros usuarios o terceros.</li>
          </ul>
        </Seccion>

        <Seccion titulo="3. Perfiles Anónimos y Visibilidad">
          <p style={s.p}>
            Konexu opera bajo un sistema de <b>anonimato selectivo</b>: los datos personales del
            trabajador (nombre completo, teléfono, foto, dirección exacta) permanecen ocultos para
            los empleadores hasta que <b>ambas partes manifiesten interés mutuo en establecer contacto</b>.
          </p>
          <p style={s.p}>
            Al activar tu perfil, aceptás expresamente que Konexu comparta tu perfil profesional
            anonimizado (oficio, zona geográfica aproximada, experiencia, disponibilidad) con
            empleadores y empresas registradas en la plataforma. La revelación de datos personales
            completos ocurre únicamente cuando el trabajador acepta una propuesta de contacto.
          </p>
          <p style={s.p}>
            El trabajador puede desactivar su visibilidad en cualquier momento desde la sección
            "Mi Perfil". La desactivación no implica el reembolso del período de suscripción ya abonado.
          </p>
        </Seccion>

        <Seccion titulo="4. Recopilación, Uso y Compartición de Datos">
          <p style={s.p}>
            Al registrarte y usar Konexu, autorizás expresamente la recopilación y el uso de los
            siguientes datos con los fines indicados:
          </p>
          <ul style={s.ul}>
            <li style={s.li}><b>Datos de identidad y contacto</b> (nombre, email, teléfono, fecha de nacimiento): utilizados para verificar identidad, gestionar la cuenta y cumplir obligaciones legales.</li>
            <li style={s.li}><b>Datos profesionales</b> (oficios, profesiones, experiencia, sueldo pretendido, disponibilidad): compartidos de forma <b>anonimizada</b> con empleadores y empresas en la plataforma para facilitar la intermediación laboral.</li>
            <li style={s.li}><b>Datos de ubicación aproximada</b> (país, ciudad, barrio): utilizados para mostrar resultados relevantes y para el algoritmo de compatibilidad. No se comparte ubicación exacta o en tiempo real.</li>
            <li style={s.li}><b>Datos de uso y comportamiento</b> (búsquedas, vistas de perfil, interacciones): utilizados para mejorar el algoritmo de recomendación y la experiencia de usuario. Pueden ser procesados por proveedores de analítica bajo acuerdos de confidencialidad.</li>
            <li style={s.li}><b>Datos de pago</b>: procesados exclusivamente por MercadoPago bajo sus propios estándares PCI-DSS. Konexu no almacena datos de tarjetas de crédito.</li>
          </ul>
          <p style={s.p}>
            Konexu podrá compartir datos personales con terceros exclusivamente en los siguientes
            casos: (a) con el consentimiento explícito del usuario; (b) con empleadores/empresas en la
            medida establecida en la cláusula 3; (c) cuando sea requerido por autoridad competente;
            (d) con proveedores de servicios (cloud, analítica, pagos) bajo contratos que garantizan
            protección equivalente; (e) en caso de fusión, adquisición o reorganización empresarial,
            notificando a los usuarios con antelación razonable.
          </p>
        </Seccion>

        <Seccion titulo="5. Uso por Empleadores y Empresas">
          <p style={s.p}>Los empleadores y empresas que accedan a perfiles de trabajadores en Konexu se comprometen a:</p>
          <ul style={s.ul}>
            <li style={s.li}>Utilizar la información obtenida exclusivamente para procesos de selección de personal.</li>
            <li style={s.li}>No transferir, vender ni ceder información de perfiles a terceros no autorizados.</li>
            <li style={s.li}>No discriminar candidatos por criterios prohibidos por la legislación uruguaya.</li>
            <li style={s.li}>Cumplir con todas las obligaciones legales en materia de protección de datos.</li>
          </ul>
          <p style={s.p}>
            El incumplimiento de estas obligaciones por parte de empleadores o empresas podrá resultar
            en la suspensión del acceso a la plataforma y, en su caso, en acciones legales por los
            daños causados.
          </p>
        </Seccion>

        <Seccion titulo="6. Condiciones de Pago y Suscripción">
          <p style={s.p}>
            La activación del perfil de trabajador requiere el pago de una suscripción según los
            planes vigentes publicados en la plataforma. Al confirmar el pago:
          </p>
          <ul style={s.ul}>
            <li style={s.li}>Aceptás los cargos correspondientes al plan seleccionado.</li>
            <li style={s.li}>El período de activación comienza inmediatamente tras la confirmación del pago.</li>
            <li style={s.li}>Los pagos son no reembolsables salvo error técnico imputable a Konexu o cuando lo exija la legislación aplicable.</li>
            <li style={s.li}>Konexu puede modificar sus precios notificando a los usuarios con al menos 30 días de anticipación.</li>
            <li style={s.li}>En caso de fallo en el cobro, el perfil podrá ser desactivado automáticamente.</li>
          </ul>
        </Seccion>

        <Seccion titulo="7. Conducta Prohibida">
          <p style={s.p}>Queda estrictamente prohibido:</p>
          <ul style={s.ul}>
            <li style={s.li}>Publicar información falsa, engañosa o fraudulenta.</li>
            <li style={s.li}>Intentar acceder sin autorización a cuentas de otros usuarios o sistemas de Konexu.</li>
            <li style={s.li}>Usar la plataforma para contactar usuarios con fines distintos a la intermediación laboral legítima.</li>
            <li style={s.li}>Realizar scraping, extracción masiva de datos u otras técnicas automatizadas no autorizadas.</li>
            <li style={s.li}>Compartir fuera de la plataforma datos de contacto obtenidos a través de Konexu sin consentimiento.</li>
            <li style={s.li}>Acosar, discriminar o amenazar a otros usuarios.</li>
            <li style={s.li}>Publicar contenido ilegal, difamatorio, obsceno o que infrinja derechos de terceros.</li>
          </ul>
        </Seccion>

        <Seccion titulo="8. Propiedad Intelectual">
          <p style={s.p}>
            Konexu y todo su contenido (marca, logotipos, software, algoritmos, diseños, textos) son
            propiedad exclusiva de {EMPRESA} o de sus licenciantes y están protegidos por las leyes de
            propiedad intelectual vigentes en Uruguay y tratados internacionales.
          </p>
          <p style={s.p}>
            El usuario conserva todos los derechos sobre el contenido que sube (fotos, descripción
            personal, etc.), otorgando a Konexu una licencia no exclusiva, mundial, libre de regalías
            para usar, mostrar y distribuir dicho contenido dentro de la plataforma con los fines
            propios del servicio.
          </p>
        </Seccion>

        <Seccion titulo="9. Contenido del Usuario: Garantías, Responsabilidad y Retiro">
          <p style={s.p}>
            Al subir o publicar cualquier contenido en Konexu (incluyendo fotos de perfil, imágenes,
            textos, currículums y descripciones), <b>declarás y garantizás que sos el titular de todos
            los derechos sobre ese contenido, o que contás con las autorizaciones y licencias
            necesarias para usarlo.</b> En particular, garantizás que el contenido no infringe derechos
            de autor, marcas registradas, derechos de imagen, privacidad ni ningún otro derecho de terceros.
          </p>
          <p style={s.p}>
            Queda prohibido subir imágenes, logotipos, fotografías u otro material protegido por
            derechos de propiedad intelectual o registrado a nombre de terceros sin su autorización expresa.
          </p>
          <p style={s.p}>
            <b>Sos el único y exclusivo responsable del contenido que subís.</b> Konexu actúa como
            alojamiento pasivo de dicho contenido, no lo genera ni lo revisa o aprueba previamente.
            Konexu se reserva el derecho de retirar o bloquear, sin aviso previo, cualquier contenido
            que considere que infringe estos Términos, la ley o derechos de terceros.
          </p>
          <p style={s.p}>
            <b>Notificación y retiro:</b> Si considerás que un contenido publicado en Konexu infringe
            tus derechos, notificalo a {EMAIL_LEGAL} indicando: (a) el contenido y su ubicación en la
            plataforma; (b) prueba de tu titularidad del derecho; (c) tus datos de contacto. Konexu
            evaluará el reclamo y, de corresponder, retirará el contenido en un plazo razonable. Las
            cuentas que infrinjan derechos de terceros de forma reiterada serán suspendidas.
          </p>
          <p style={s.p}>
            Para usuarios en Brasil, este mecanismo de notificación y retiro se corresponde con el
            régimen de responsabilidad de proveedores de aplicaciones de internet previsto en el
            art. 19 del <b>Marco Civil da Internet</b> (Lei N.º 12.965/2014): Konexu no revisa ni
            aprueba previamente el contenido que suben los usuarios, y actúa sobre el contenido
            notificado conforme a los plazos y criterios que esa normativa establece.
          </p>
        </Seccion>

        <Seccion titulo="10. Uso de Inteligencia Artificial y Herramientas Automatizadas">
          <p style={s.p}>
            Konexu utiliza tecnología de análisis automatizado de terceros para la <b>moderación de
            las imágenes de perfil</b>: mediante servicios de visión por computadora, se analizan las
            imágenes que subís para detectar contenido inapropiado o que incumpla estos Términos.
          </p>
          <p style={s.p}>
            <b>Al subir una imagen autorizás expresamente</b> que sea procesada con ese fin por Konexu
            y por sus proveedores tecnológicos, conforme a las condiciones de estos. La imagen se
            procesa únicamente para esa moderación y <b>no se utiliza para entrenar modelos de
            inteligencia artificial propios de Konexu.</b>
          </p>
          <p style={s.p}>
            Los sistemas automatizados de moderación <b>pueden cometer errores: no garantizan detectar
            todo el contenido inapropiado, ni la ausencia de falsos positivos.</b> Konexu no será
            responsable por las decisiones de estos sistemas, y seguís siendo el único responsable
            del contenido que subís. El sistema de compatibilidad entre perfiles y llamados se basa en
            criterios algorítmicos y de palabras clave, no en inteligencia artificial generativa.
          </p>
        </Seccion>

        <Seccion titulo="11. Limitación de Responsabilidad">
          <p style={s.p}>
            Konexu actúa exclusivamente como intermediario y <b>no es parte de ninguna relación
            laboral</b> entre trabajadores y empleadores. En ningún caso {EMPRESA} será responsable por:
          </p>
          <ul style={s.ul}>
            <li style={s.li}>La veracidad de la información proporcionada por usuarios.</li>
            <li style={s.li}>El resultado de procesos de selección iniciados a través de la plataforma.</li>
            <li style={s.li}>Incumplimientos de contrato entre trabajadores y empleadores.</li>
            <li style={s.li}>Daños indirectos, lucro cesante o pérdida de datos derivados del uso de la plataforma.</li>
            <li style={s.li}>Interrupciones del servicio por causas de fuerza mayor o mantenimiento técnico.</li>
          </ul>
          <p style={s.p}>
            En la medida permitida por la ley, la responsabilidad total de Konexu hacia cualquier
            usuario no excederá el monto pagado por el usuario en los 12 meses anteriores al evento
            que originó el reclamo.
          </p>
        </Seccion>

        <Seccion titulo="12. Indemnización">
          <p style={s.p}>
            Aceptás <b>defender, indemnizar y mantener indemne a {EMPRESA}</b>, sus directores,
            empleados y proveedores, frente a cualquier reclamo, demanda, daño, pérdida, costo o gasto
            (incluidos honorarios legales razonables) que surja de: (a) el contenido que subís o
            publicás; (b) tu incumplimiento de estos Términos o de la legislación aplicable; (c) la
            infracción de derechos de terceros por tu parte, incluyendo derechos de propiedad
            intelectual, marcas o imagen; (d) el uso indebido de la plataforma.
          </p>
        </Seccion>

        <Seccion titulo="13. Modificaciones">
          <p style={s.p}>
            Konexu puede modificar estos Términos en cualquier momento. Los cambios significativos
            serán notificados por email y/o mediante aviso en la aplicación con al menos 15 días de
            anticipación. El uso continuado de la plataforma tras ese período implica la aceptación
            de los nuevos Términos.
          </p>
        </Seccion>

        <Seccion titulo="14. Ley Aplicable y Jurisdicción">
          <p style={s.p}>
            Estos Términos se rigen por las leyes de la República Oriental del Uruguay, incluyendo la
            Ley N.° 18.331 de Protección de Datos Personales y Acción de Habeas Data, la Ley N.° 18.159
            de Competencia y la Ley N.° 17.250 de Defensa del Consumidor.
          </p>
          <p style={s.p}>
            Cualquier controversia que no pueda resolverse de forma amigable será sometida a los
            tribunales competentes de la ciudad de Montevideo, Uruguay, renunciando las partes a
            cualquier otro fuero o jurisdicción.
          </p>
          <p style={s.p}>
            Lo anterior no te priva de las protecciones imperativas que te reconozca la ley de tu
            país de residencia, en la medida en que esa ley resulte aplicable y no pueda excluirse
            por acuerdo entre las partes.
          </p>
        </Seccion>

        <Seccion titulo="15. Contacto">
          <p style={s.p}>Para consultas sobre estos Términos, podés contactarnos en:<br />{EMAIL_LEGAL}</p>
          <p style={s.p}>{EMPRESA}<br />Montevideo, {PAIS}</p>
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
