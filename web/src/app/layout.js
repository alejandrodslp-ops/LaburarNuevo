import './globals.css'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexu.app'

export const metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'Nexu — Concursos Públicos y Empleos en Uruguay, Argentina y LatAm',
    template: '%s | Nexu',
  },
  description:
    'Miles de concursos públicos, llamados de trabajo y vacantes en Uruguay, Argentina, Brasil y toda LatAm. Sector público y privado. Actualizados diariamente. Gratis.',
  keywords: [
    'concursos públicos Uruguay','llamados ONSC','Uruguay Concursa','empleos Uruguay',
    'concursos públicos Argentina','empleos Argentina','trabajo Argentina',
    'vacantes gobierno','empleo público LatAm','concursos laborales',
    'convocatorias trabajo','trabajo América Latina','empleos Brasil',
    'trabajo Colombia','empleos Chile','concurso público',
  ],
  openGraph: {
    title: 'Nexu — Concursos Públicos y Empleos en Uruguay, Argentina y LatAm',
    description: 'Miles de concursos públicos y vacantes en Uruguay, Argentina, Brasil y toda LatAm. Actualizados diariamente. Gratis.',
    url: '/',
    siteName: 'Nexu',
    locale: 'es_UY',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@nexuapp',
    title: 'Nexu — Concursos Públicos y Empleos en LatAm',
    description: 'Concursos públicos y empleos en Uruguay, Argentina y toda LatAm. Actualizados diariamente. Gratis.',
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.ico' },
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Nexu',
  url: SITE,
  description: 'Concursos y empleos en Uruguay, Argentina y toda LatAm.',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/empleos?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {children}
      </body>
    </html>
  )
}
